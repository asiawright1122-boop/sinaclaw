/**
 * OpenClaw 启动自检引擎
 * 
 * 在应用启动时自动扫描用户的开发环境，
 * 检测缺失的工具并自动安装修复。
 * 不依赖 AI，纯硬编码逻辑。
 */
import { invoke } from "@tauri-apps/api/core";
import { Command } from '@tauri-apps/plugin-shell';
import type { CommandResult } from "@/lib/tools";

// ── 扫描结果类型 ─────────────────────────────────────────

export interface ScanItem {
    name: string;
    label: string;
    icon: string;
    required: boolean;       // 是否为必需工具
    status: "checking" | "installed" | "missing" | "installing" | "installed_now" | "failed";
    version: string;
    installCommand?: string; // (Retained for structure, but unused by sidecar)
    installNote?: string;
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
            name: "node_sidecar",
            label: "Sinaclaw 引擎",
            icon: "gear",
            required: true,
            status: "checking",
            version: "",
            installNote: "内置执行引擎",
        }
    ];
}

// ── 核心扫描函数 ─────────────────────────────────────────

export async function runEnvironmentScan(
    onUpdate: (items: ScanItem[]) => void
): Promise<ScanResult> {
    const items = getCheckList();
    onUpdate([...items]);

    // 检测内置 Node Sidecar 引擎
    const engineItem = items[0];
    engineItem.status = "checking";
    onUpdate([...items]);

    try {
        // 利用 @tauri-apps/plugin-shell 的 Command API 唤起配置好的 node sidecar
        // 注意：这里的标识符必须与 tauri.conf.json "externalBin" 内容完全一致也就是 "bin/node"
        const sidecarCmd = Command.sidecar("bin/node", ["--version"]);
        const output = await sidecarCmd.execute();

        if (output.code === 0 && output.stdout) {
            engineItem.status = "installed";
            engineItem.version = "built-in (Node)"; // output.stdout.trim() typically returns "v20.x.x"
        } else {
            console.error("Sidecar process error:", output.stderr);
            engineItem.status = "failed";
            engineItem.installNote = "无法唤起内置 Node: " + (output.stderr || "Native execution failed");
        }
    } catch (e: any) {
        console.error("Sidecar error IPC:", e);
        engineItem.status = "failed";
        engineItem.installNote = "Sidecar IPC 调用错误: " + String(e);
    }

    onUpdate([...items]);

    const allGood = items.every(i => i.status === "installed");
    const hasRequired = items.filter(i => i.required).every(i => i.status === "installed");

    return { items, allGood, hasRequired };
}

// ── 环境扫描辅助函数 ─────────────────────────────────────


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
            icon: "folder",
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
                nmItem.detail = "已自动执行 npm install";
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
            icon: "lock",
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
            icon: "alert",
            status: "checking",
            detail: "",
        };
        items.push(conflictItem);
        onUpdate([...items]);

        const lsResult = await runCmd("npm ls --depth=0", projectPath);
        const lsOutput = (lsResult.stdout + "\n" + lsResult.stderr).toLowerCase();
        const hasConflicts = /err!|warn|peer|invalid|missing/i.test(lsOutput);
        if (!hasConflicts) {
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
            const recheckResult = await runCmd("npm ls --depth=0", projectPath);
            const recheckOutput = (recheckResult.stdout + "\n" + recheckResult.stderr).toLowerCase();
            const stillHasErrors = /err!|invalid|missing/i.test(recheckOutput);
            if (!stillHasErrors) {
                conflictItem.status = "fixed";
                conflictItem.detail = "依赖冲突已自动修复";
                autoFixed++;
            } else if (fixResult.success) {
                conflictItem.status = "warning";
                conflictItem.detail = "部分冲突已修复，剩余可通过 AI 对话进一步处理";
            } else {
                conflictItem.status = "error";
                conflictItem.detail = extractFirstLine(lsResult.stderr || lsResult.stdout);
            }
        }
        onUpdate([...items]);

        // 检查 4: 过期依赖
        const outdatedItem: ProjectHealthItem = {
            name: "outdated",
            label: "过期依赖",
            icon: "calendar",
            status: "checking",
            detail: "",
        };
        items.push(outdatedItem);
        onUpdate([...items]);

        const outdatedResult = await runCmd("npm outdated --json", projectPath);
        const outdatedStr = outdatedResult.stdout.trim();
        if (!outdatedStr || outdatedStr === "{}") {
            outdatedItem.status = "ok";
            outdatedItem.detail = "所有依赖已是最新";
        } else {
            try {
                const outdated = JSON.parse(outdatedStr);
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
            icon: "crab",
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
            icon: "snake",
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
            pipItem.detail = installResult.success ? "依赖已安装" : "安装失败";
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
        return await invoke<boolean>("tool_file_exists", { path });
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
