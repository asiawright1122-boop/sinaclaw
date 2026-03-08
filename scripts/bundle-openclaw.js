/**
 * bundle-openclaw.js
 *
 * 将 openclaw 及其完整运行时依赖树收集到 src-tauri/openclaw-bundle/ 目录，
 * 供 Tauri resources 打包。这样用户无需 npm install，开箱即用。
 *
 * 运行: node scripts/bundle-openclaw.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const NODE_MODULES = path.join(ROOT, 'node_modules');
const BUNDLE_DIR = path.join(ROOT, 'src-tauri', 'openclaw-bundle');

// ── 收集 openclaw 完整依赖树 ──────────────────────────────

function collectDeps(pkgName, collected = new Set()) {
    if (collected.has(pkgName)) return collected;
    collected.add(pkgName);

    const pkgDir = path.join(NODE_MODULES, pkgName);
    const pkgJsonPath = path.join(pkgDir, 'package.json');

    if (!fs.existsSync(pkgJsonPath)) return collected;

    try {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
        const deps = pkg.dependencies || {};
        for (const dep of Object.keys(deps)) {
            // 处理 scoped packages（如 @slack/bolt → @slack 目录）
            collectDeps(dep, collected);
        }
    } catch {
        // 读取失败则跳过
    }

    return collected;
}

// ── 复制目录（递归） ──────────────────────────────────────

// 跳过的目录名
const SKIP_DIRS = new Set([
    '.git', '.github', '.vscode', '.idea',
    'test', 'tests', '__tests__', '__mocks__',
    'example', 'examples', 'benchmark', 'benchmarks',
    'docs', 'doc', 'man', 'coverage', '.nyc_output',
    'src',  // 仅保留 dist/lib, 不需要源码
    'android', 'ios', // 移动端 native
]);

// 跳过的文件名/扩展名
const SKIP_FILES = new Set([
    'CHANGELOG.md', 'HISTORY.md', 'CHANGES.md',
    'README.md', 'README', 'LICENSE', 'LICENSE.md', 'LICENSE.txt',
    'CONTRIBUTING.md', '.editorconfig', '.eslintrc.json', '.eslintrc.js',
    '.prettierrc', '.prettierrc.json', 'tsconfig.json', 'tsconfig.build.json',
    '.npmignore', '.gitignore', 'Makefile', 'Gruntfile.js', 'Gulpfile.js',
    'jest.config.js', 'vitest.config.ts', '.eslintignore',
]);

function shouldSkipFile(name) {
    if (SKIP_FILES.has(name)) return true;
    if (name.endsWith('.map')) return true;
    if (name.endsWith('.ts') && !name.endsWith('.d.ts')) return true;
    if (name.endsWith('.d.ts')) return true;
    if (name.endsWith('.min.js.map')) return true;
    if (name.endsWith('.tgz')) return true;
    if (name.endsWith('.gz') && !name.endsWith('.tar.gz')) return true;
    return false;
}

// openclaw dist/ 中只保留 .js，跳过 docs 子目录下的大图片
const OPENCLAW_SKIP_DIRS = new Set(['docs', 'apps']);

function copyDirSync(src, dest, isOpenclawRoot = false) {
    if (!fs.existsSync(src)) return;

    fs.mkdirSync(dest, { recursive: true });

    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue;
            if (isOpenclawRoot && OPENCLAW_SKIP_DIRS.has(entry.name)) continue;
            // 对 native 模块: 只保留当前平台的 prebuilds 和 build
            if (entry.name === 'prebuilds' || entry.name === 'build') {
                copyNativeFiltered(srcPath, destPath);
                continue;
            }
            copyDirSync(srcPath, destPath);
        } else {
            if (shouldSkipFile(entry.name)) continue;
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

/** native 模块: 只保留当前平台的预编译二进制 (build/, prebuilds/) */
function copyNativeFiltered(src, dest) {
    if (!fs.existsSync(src)) return;
    const plat = process.platform;  // darwin, win32, linux
    const arch = process.arch;       // arm64, x64
    const platKey = plat === 'darwin' ? 'darwin' : plat === 'win32' ? 'win32' : 'linux';

    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        const name = entry.name.toLowerCase();

        if (entry.isDirectory()) {
            // 检测是否为平台目录 (如 darwin_arm64, win32_x64, linux-x64-gnu 等)
            const looksLikePlatformDir = /^(darwin|win32|linux|musl|freebsd|openbsd)/.test(name)
                || /-(darwin|win32|linux|gnu|musl)/.test(name);

            if (looksLikePlatformDir) {
                // 只保留匹配当前平台的
                if (name.includes(platKey)) {
                    copyDirSync(srcPath, destPath);
                }
                // 否则跳过（其他平台的 native 二进制）
            } else {
                // 非平台目录，递归过滤
                copyNativeFiltered(srcPath, destPath);
            }
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// ── Main ──────────────────────────────────────────────────

function main() {
    console.log('📦 Bundling OpenClaw + dependencies...\n');

    // 清理旧 bundle
    if (fs.existsSync(BUNDLE_DIR)) {
        fs.rmSync(BUNDLE_DIR, { recursive: true, force: true });
    }

    // 收集依赖树
    const allDeps = collectDeps('openclaw');
    console.log(`📋 Found ${allDeps.size} packages in dependency tree`);

    // 创建 node_modules 结构
    const bundleNodeModules = path.join(BUNDLE_DIR, 'node_modules');
    fs.mkdirSync(bundleNodeModules, { recursive: true });

    let copied = 0;
    let skipped = 0;

    for (const dep of allDeps) {
        // 跳过 @types（纯类型定义，运行时不需要）
        if (dep.startsWith('@types/')) {
            skipped++;
            continue;
        }

        const srcDir = path.join(NODE_MODULES, dep);
        const destDir = path.join(bundleNodeModules, dep);

        if (!fs.existsSync(srcDir)) {
            skipped++;
            continue;
        }

        // openclaw 自身已复制到 bundle 根目录，node_modules 内不再重复
        if (dep === 'openclaw') {
            skipped++;
            continue;
        }
        copyDirSync(srcDir, destDir);
        copied++;
    }

    // openclaw 入口复制到 bundle 根目录方便定位
    const openclawSrc = path.join(NODE_MODULES, 'openclaw');
    const openclawDest = path.join(BUNDLE_DIR, 'openclaw');
    if (fs.existsSync(openclawSrc)) {
        copyDirSync(openclawSrc, openclawDest, true);
    }

    // 计算 bundle 大小
    const bundleSize = execSync(`du -sh "${BUNDLE_DIR}"`).toString().trim().split('\t')[0];

    console.log(`\n✅ Bundle complete!`);
    console.log(`   Copied: ${copied} packages`);
    console.log(`   Skipped: ${skipped} (not found in node_modules)`);
    console.log(`   Bundle size: ${bundleSize}`);
    console.log(`   Location: ${BUNDLE_DIR}`);
}

main();
