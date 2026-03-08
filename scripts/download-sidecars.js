import fs from 'fs';
import path from 'path';
import https from 'https';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NODE_VERSION = 'v22.16.0'; // OpenClaw 要求 Node.js v22.12+
const TARGET_DIR = path.join(__dirname, '..', 'src-tauri', 'bin');

// Tauri 期望的 sidecar 命名后缀 (对应于 target_os 和 target_arch)
// 详见: https://tauri.app/v1/guides/building/sidecar/
const TARGETS = [
    {
        name: 'node-x86_64-apple-darwin',
        url: `https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-darwin-x64.tar.gz`,
        extract: 'node-v*-darwin-x64/bin/node'
    },
    {
        name: 'node-aarch64-apple-darwin',
        url: `https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-darwin-arm64.tar.gz`,
        extract: 'node-v*-darwin-arm64/bin/node'
    },
    {
        name: 'node-x86_64-pc-windows-msvc.exe',
        url: `https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-win-x64.zip`,
        extract: 'node-v*-win-x64/node.exe'
    }
];

// 确保目录存在
if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
}

async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        console.log(`📡 Downloading ${url}...`);
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
            }
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlinkSync(dest);
            reject(err);
        });
    });
}

/** 递归查找文件 */
function findFileRecursive(dir, matcher) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            const found = findFileRecursive(full, matcher);
            if (found) return found;
        } else if (matcher(full, entry.name)) {
            return full;
        }
    }
    return null;
}

function extractBinary(archivePath, targetConfig) {
    console.log(`📦 Extracting ${targetConfig.name}...`);
    const isZip = archivePath.endsWith('.zip');
    const tempDir = path.join(TARGET_DIR, 'temp_extract');

    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }

    try {
        if (isZip) {
            // 跨平台: 用 PowerShell 解压 (Windows) 或 unzip (macOS/Linux)
            if (process.platform === 'win32') {
                execSync(`powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${tempDir}' -Force"`);
            } else {
                execSync(`unzip -q "${archivePath}" -d "${tempDir}"`);
            }
        } else {
            execSync(`tar -xzf "${archivePath}" -C "${tempDir}"`);
        }

        // 跨平台查找 node 二进制（不依赖 Unix find 命令）
        const binaryName = isZip ? 'node.exe' : 'node';
        const binaryPath = findFileRecursive(tempDir, (fullPath, name) => {
            if (name !== binaryName) return false;
            return fullPath.includes(path.join('bin', 'node')) || name === 'node.exe';
        });

        if (!binaryPath || !fs.existsSync(binaryPath)) {
            throw new Error(`Could not find extracted binary for ${targetConfig.name}`);
        }

        const finalTarget = path.join(TARGET_DIR, targetConfig.name);
        fs.copyFileSync(binaryPath, finalTarget);

        // 赋予可执行权限 (macOS/Linux)
        if (!isZip) {
            fs.chmodSync(finalTarget, 0o755);
        }

        console.log(`✅ Successfully created ${targetConfig.name}`);
    } catch (error) {
        console.error(`❌ Failed to extract ${targetConfig.name}:`, error.message);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

async function main() {
    console.log('🚀 Starting Node.js binaries download for Tauri sidecar...\n');

    for (const target of TARGETS) {
        const finalTarget = path.join(TARGET_DIR, target.name);
        if (fs.existsSync(finalTarget)) {
            console.log(`⏭️  Skipping ${target.name} (Already exists)`);
            continue;
        }

        const archiveName = path.basename(target.url);
        const archivePath = path.join(TARGET_DIR, archiveName);

        try {
            if (!fs.existsSync(archivePath)) {
                await downloadFile(target.url, archivePath);
            } else {
                console.log(`📦 Archive ${archiveName} already downloaded.`);
            }

            extractBinary(archivePath, target);

            // 成功提取后删除压缩包
            if (fs.existsSync(archivePath)) {
                fs.unlinkSync(archivePath);
            }
        } catch (err) {
            console.error(`❌ Error processing ${target.name}:`, err.message);
        }
        console.log('');
    }

    console.log('🎉 All sidecars prepared!');
}

main().catch(console.error);
