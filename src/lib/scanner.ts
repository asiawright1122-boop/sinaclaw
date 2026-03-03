/**
 * OpenClaw 启动自检引擎
 * 
 * 在应用启动时自动扫描用户的开发环境，
 * 检测缺失的工具并自动安装修复。
 * 不依赖 AI，纯硬编码逻辑。
 */
import { invoke } from "@tauri-apps/api/core";
import type { CommandResult } from "@/lib/tools";

// ── 扫描结果类型 ─────────────────────────────────────────

export interface ScanItem {
    name: string;
    label: string;
    icon: string;
    required: boolean;       // 是否为必需工具
    status: "checking" | "installed" | "missing" | "installing" | "installed_now" | "failed";
    version: string;
    installCommand?: string; // 自动安装命令
    installNote?: string;    // macOS 上通过 Homebrew 安装的提示
}

export interface ScanResult {
    items: ScanItem[];
    allGood: boolean;
    hasRequired: boolean;    // 所有必需工具都已安装
}

// ── 需要检测的工具列表 ───────────────────────────────────

function getCheckList(): ScanItem[] {
    return [
        {
            name: "node",
            label: "Node.js",
            icon: "🟢",
            required: true,
            status: "checking",
            version: "",
            installCommand: "brew install node",
            installNote: "通过 Homebrew 自动安装",
        },
        {
            name: "npm",
            label: "npm",
            icon: "📦",
            required: true,
            status: "checking",
            version: "",
            installCommand: "brew install node", // npm 随 node 附带
            installNote: "Node.js 自带",
        },
        {
            name: "git",
            label: "Git",
            icon: "🔀",
            required: true,
            status: "checking",
            version: "",
            installCommand: "xcode-select --install",
            installNote: "通过 Xcode Command Line Tools 安装",
        },
        {
            name: "yarn",
            label: "Yarn",
            icon: "🧶",
            required: false,
            status: "checking",
            version: "",
            installCommand: "npm install -g yarn",
        },
        {
            name: "pnpm",
            label: "pnpm",
            icon: "⚡",
            required: false,
            status: "checking",
            version: "",
            installCommand: "npm install -g pnpm",
        },
        {
            name: "rustc",
            label: "Rust",
            icon: "🦀",
            required: false,
            status: "checking",
            version: "",
            installCommand: "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y",
            installNote: "通过 rustup 安装",
        },
        {
            name: "python3",
            label: "Python 3",
            icon: "🐍",
            required: false,
            status: "checking",
            version: "",
            installCommand: "brew install python3",
        },
    ];
}

// ── 核心扫描函数 ─────────────────────────────────────────

export async function runEnvironmentScan(
    onUpdate: (items: ScanItem[]) => void
): Promise<ScanResult> {
    const items = getCheckList();
    onUpdate([...items]);

    // 先检测 Homebrew（macOS 的包管理器，很多安装都依赖它）
    const hasHomebrew = await checkToolInstalled("brew --version");

    // 逐一检测
    for (const item of items) {
        item.status = "checking";
        onUpdate([...items]);

        const versionCmd = `${item.name} --version`;
        const result = await checkToolVersion(versionCmd);

        if (result) {
            item.status = "installed";
            item.version = result;
        } else {
            item.status = "missing";
        }
        onUpdate([...items]);
    }

    // 自动修复缺失的 **必需** 工具
    const missingRequired = items.filter(i => i.required && i.status === "missing");

    for (const item of missingRequired) {
        if (!item.installCommand) continue;

        // 如果安装命令依赖 brew，先确保 Homebrew 已安装
        if (item.installCommand.startsWith("brew") && !hasHomebrew) {
            // 先安装 Homebrew
            item.status = "installing";
            item.installNote = "正在安装 Homebrew...";
            onUpdate([...items]);

            const brewResult = await runInstallCommand(
                '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
            );
            if (!brewResult) {
                item.status = "failed";
                item.installNote = "Homebrew 安装失败，请手动安装";
                onUpdate([...items]);
                continue;
            }
        }

        item.status = "installing";
        onUpdate([...items]);

        const success = await runInstallCommand(item.installCommand);
        if (success) {
            // 验证安装
            const version = await checkToolVersion(`${item.name} --version`);
            if (version) {
                item.status = "installed_now";
                item.version = version;
            } else {
                item.status = "installed_now";
                item.version = "刚安装";
            }
        } else {
            item.status = "failed";
        }
        onUpdate([...items]);
    }

    const allGood = items.every(i => i.status === "installed" || i.status === "installed_now" || (!i.required && i.status === "missing"));
    const hasRequired = items.filter(i => i.required).every(i => i.status === "installed" || i.status === "installed_now");

    return { items, allGood, hasRequired };
}

// ── 环境扫描辅助函数 ─────────────────────────────────────

async function checkToolInstalled(cmd: string): Promise<boolean> {
    try {
        const result = await invoke<CommandResult>("tool_run_command", {
            command: cmd,
            cwd: null,
        });
        return result.success;
    } catch {
        return false;
    }
}

async function checkToolVersion(cmd: string): Promise<string | null> {
    try {
        const result = await invoke<CommandResult>("tool_run_command", {
            command: cmd,
            cwd: null,
        });
        if (result.success) {
            return result.stdout.trim().split("\n")[0] || result.stderr.trim().split("\n")[0] || "已安装";
        }
        return null;
    } catch {
        return null;
    }
}

async function runInstallCommand(cmd: string): Promise<boolean> {
    try {
        const result = await invoke<CommandResult>("tool_run_command", {
            command: cmd,
            cwd: null,
        });
        return result.success;
    } catch {
        return false;
    }
}

// ── 项目级依赖健康检查 ───────────────────────────────────
// 用于用户打开某个项目时自动扫描依赖状态

export interface ProjectHealthItem {
    name: string;
    label: string;
    icon: string;
    status: "checking" | "ok" | "warning" | "error" | "fixing" | "fixed";
    detail: string;
}

export interface ProjectHealthResult {
    items: ProjectHealthItem[];
    projectType: "node" | "rust" | "python" | "unknown";
    autoFixed: number; // 自动修复的问题数
}

/**
 * 扫描指定目录的项目依赖健康状况，自动修复常见问题
 */
export async function runProjectHealthCheck(
    projectPath: string,
    onUpdate: (items: ProjectHealthItem[]) => void
): Promise<ProjectHealthResult> {
    const items: ProjectHealthItem[] = [];
    let projectType: "node" | "rust" | "python" | "unknown" = "unknown";
    let autoFixed = 0;

    // 1. 检测项目类型
    const hasPackageJson = await fileExists(`${projectPath}/package.json`);
    const hasCargoToml = await fileExists(`${projectPath}/Cargo.toml`);
    const hasRequirementsTxt = await fileExists(`${projectPath}/requirements.txt`);
    const hasPyprojectToml = await fileExists(`${projectPath}/pyproject.toml`);

    if (hasPackageJson) projectType = "node";
    else if (hasCargoToml) projectType = "rust";
    else if (hasRequirementsTxt || hasPyprojectToml) projectType = "python";

    // ==================== Node.js 项目检查 ====================
    if (projectType === "node") {
        // 检查 1: node_modules 是否存在
        const hasNodeModules = await fileExists(`${projectPath}/node_modules`);
        const nmItem: ProjectHealthItem = {
            name: "node_modules",
            label: "依赖目录",
            icon: "📁",
            status: "checking",
            detail: "",
        };
        items.push(nmItem);
        onUpdate([...items]);

        if (!hasNodeModules) {
            nmItem.status = "fixing";
            nmItem.detail = "node_modules 缺失，正在自动安装...";
            onUpdate([...items]);

            const installResult = await runCmd("npm install", projectPath);
            if (installResult.success) {
                nmItem.status = "fixed";
                nmItem.detail = "✨ 已自动执行 npm install";
                autoFixed++;
            } else {
                nmItem.status = "error";
                nmItem.detail = "npm install 失败: " + extractFirstLine(installResult.stderr);
            }
        } else {
            nmItem.status = "ok";
            nmItem.detail = "已存在";
        }
        onUpdate([...items]);

        // 检查 2: package-lock.json 完整性
        const lockItem: ProjectHealthItem = {
            name: "lockfile",
            label: "Lock 文件",
            icon: "🔒",
            status: "checking",
            detail: "",
        };
        items.push(lockItem);
        onUpdate([...items]);

        const hasLockfile = await fileExists(`${projectPath}/package-lock.json`) ||
            await fileExists(`${projectPath}/yarn.lock`) ||
            await fileExists(`${projectPath}/pnpm-lock.yaml`);
        if (hasLockfile) {
            lockItem.status = "ok";
            lockItem.detail = "完整";
        } else {
            lockItem.status = "warning";
            lockItem.detail = "缺失 lock 文件（建议运行 npm install 生成）";
        }
        onUpdate([...items]);

        // 检查 3: 依赖冲突（npm ls 检测）
        const conflictItem: ProjectHealthItem = {
            name: "conflicts",
            label: "依赖冲突",
            icon: "⚠️",
            status: "checking",
            detail: "",
        };
        items.push(conflictItem);
        onUpdate([...items]);

        const lsResult = await runCmd("npm ls --depth=0 2>&1 | grep -i 'ERR\\|WARN\\|peer\\|invalid\\|missing' | head -5", projectPath);
        if (!lsResult.stdout.trim()) {
            conflictItem.status = "ok";
            conflictItem.detail = "无冲突";
        } else {
            // 有冲突，尝试自动修复
            conflictItem.status = "fixing";
            conflictItem.detail = "发现依赖问题，正在自动修复...";
            onUpdate([...items]);

            // 策略 1: npm dedupe（去重）
            await runCmd("npm dedupe", projectPath);

            // 策略 2: npm install --legacy-peer-deps（跳过 peer 冲突）
            const fixResult = await runCmd("npm install --legacy-peer-deps", projectPath);

            // 重新检查
            const recheckResult = await runCmd("npm ls --depth=0 2>&1 | grep -i 'ERR\\|invalid\\|missing' | head -3", projectPath);
            if (!recheckResult.stdout.trim()) {
                conflictItem.status = "fixed";
                conflictItem.detail = "✨ 依赖冲突已自动修复";
                autoFixed++;
            } else if (fixResult.success) {
                conflictItem.status = "warning";
                conflictItem.detail = "部分冲突已修复，剩余可通过 AI 对话进一步处理";
            } else {
                conflictItem.status = "error";
                conflictItem.detail = extractFirstLine(lsResult.stdout);
            }
        }
        onUpdate([...items]);

        // 检查 4: 过期依赖
        const outdatedItem: ProjectHealthItem = {
            name: "outdated",
            label: "过期依赖",
            icon: "📅",
            status: "checking",
            detail: "",
        };
        items.push(outdatedItem);
        onUpdate([...items]);

        const outdatedResult = await runCmd("npm outdated --json 2>/dev/null | head -1", projectPath);
        if (!outdatedResult.stdout.trim() || outdatedResult.stdout.trim() === "{}") {
            outdatedItem.status = "ok";
            outdatedItem.detail = "所有依赖已是最新";
        } else {
            try {
                const outdated = JSON.parse(outdatedResult.stdout);
                const count = Object.keys(outdated).length;
                outdatedItem.status = "warning";
                outdatedItem.detail = `${count} 个依赖可更新（不影响运行）`;
            } catch {
                outdatedItem.status = "ok";
                outdatedItem.detail = "检测完成";
            }
        }
        onUpdate([...items]);

        // ==================== Rust 项目检查 ====================
    } else if (projectType === "rust") {
        const cargoItem: ProjectHealthItem = {
            name: "cargo_check",
            label: "Cargo 编译检查",
            icon: "🦀",
            status: "checking",
            detail: "",
        };
        items.push(cargoItem);
        onUpdate([...items]);

        const checkResult = await runCmd("cargo check 2>&1 | tail -3", projectPath);
        if (checkResult.success) {
            cargoItem.status = "ok";
            cargoItem.detail = "编译通过";
        } else {
            cargoItem.status = "error";
            cargoItem.detail = extractFirstLine(checkResult.stderr || checkResult.stdout);
        }
        onUpdate([...items]);

        // ==================== Python 项目检查 ====================
    } else if (projectType === "python") {
        const pipItem: ProjectHealthItem = {
            name: "pip_check",
            label: "Python 依赖",
            icon: "🐍",
            status: "checking",
            detail: "",
        };
        items.push(pipItem);
        onUpdate([...items]);

        if (hasRequirementsTxt) {
            // 检查是否有虚拟环境
            const hasVenv = await fileExists(`${projectPath}/venv`) || await fileExists(`${projectPath}/.venv`);
            if (!hasVenv) {
                pipItem.status = "fixing";
                pipItem.detail = "创建虚拟环境...";
                onUpdate([...items]);
                await runCmd("python3 -m venv venv", projectPath);
            }

            pipItem.status = "fixing";
            pipItem.detail = "安装依赖...";
            onUpdate([...items]);

            const installResult = await runCmd(
                hasVenv ? "venv/bin/pip install -r requirements.txt" : "pip3 install -r requirements.txt",
                projectPath
            );
            pipItem.status = installResult.success ? "fixed" : "error";
            pipItem.detail = installResult.success ? "✨ 依赖已安装" : "安装失败";
            if (installResult.success) autoFixed++;
        } else {
            pipItem.status = "ok";
            pipItem.detail = "pyproject.toml 检测到";
        }
        onUpdate([...items]);
    }

    return { items, projectType, autoFixed };
}

// ── 辅助函数 (新增) ─────────────────────────────────────

async function fileExists(path: string): Promise<boolean> {
    try {
        const result = await invoke<CommandResult>("tool_run_command", {
            command: `test -e "${path}" && echo "yes" || echo "no"`,
            cwd: null,
        });
        return result.stdout.trim() === "yes";
    } catch {
        return false;
    }
}

async function runCmd(cmd: string, cwd: string): Promise<CommandResult> {
    try {
        return await invoke<CommandResult>("tool_run_command", {
            command: cmd,
            cwd,
        });
    } catch {
        return { stdout: "", stderr: "命令执行失败", exit_code: -1, success: false };
    }
}

function extractFirstLine(text: string): string {
    return text.trim().split("\n")[0]?.substring(0, 100) || "";
}
