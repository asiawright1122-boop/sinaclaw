import fs from 'fs';
import path from 'path';
import https from 'https';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NODE_VERSION = 'v20.11.1'; // 使用稳定的 LTS 版本
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

function extractBinary(archivePath, targetConfig) {
    console.log(`📦 Extracting ${targetConfig.name}...`);
    const isZip = archivePath.endsWith('.zip');
    const tempDir = path.join(TARGET_DIR, 'temp_extract');

    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }

    try {
        if (isZip) {
            // Windows 电脑或者安装了 unzip 的 Mac 可以跑
            execSync(`unzip -q "${archivePath}" -d "${tempDir}"`);
        } else {
            // Mac / Linux 专用
            execSync(`tar -xzf "${archivePath}" -C "${tempDir}"`);
        }

        // 查找提取出来的 node 二进制
        const extractPattern = targetConfig.extract.replace(/\*/g, '[^/]*');
        const findCmd = isZip
            ? `find "${tempDir}" -type f -name "node.exe"`
            : `find "${tempDir}" -type f -name "node"`;

        const foundFiles = execSync(findCmd).toString().trim().split('\n');
        let binaryPath = '';

        // 遍历找到的匹配项，选出对应的真正的执行文件
        for (const f of foundFiles) {
            if (f.includes('bin/node') || f.endsWith('node.exe')) {
                binaryPath = f;
                break;
            }
        }

        if (!binaryPath || !fs.existsSync(binaryPath)) {
            throw new Error(`Could not find extracted binary for ${targetConfig.name}`);
        }

        const finalTarget = path.join(TARGET_DIR, targetConfig.name);
        fs.copyFileSync(binaryPath, finalTarget);

        // 赋予可执行权限 (对 macOS/Linux 上的二进制包)
        if (!isZip) {
            execSync(`chmod +x "${finalTarget}"`);
        }

        console.log(`✅ Successfully created ${targetConfig.name}`);
    } catch (error) {
        console.error(`❌ Failed to extract ${targetConfig.name}:`, error.message);
    } finally {
        // 强制清理临时解压的巨大的文件夹
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
