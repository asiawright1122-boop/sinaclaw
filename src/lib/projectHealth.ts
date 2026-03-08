/**
 * 项目级依赖健康检查
 * 用于用户打开某个项目时自动扫描依赖状态
 */
import { invoke } from "@tauri-apps/api/core";
import type { CommandResult } from "@/lib/tools";

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
            label: "Dependencies",
            icon: "folder",
            status: "checking",
            detail: "",
        };
        items.push(nmItem);
        onUpdate([...items]);

        if (!hasNodeModules) {
            nmItem.status = "fixing";
            nmItem.detail = "node_modules missing, auto-installing...";
            onUpdate([...items]);

            const installResult = await runCmd("npm install", projectPath);
            if (installResult.success) {
                nmItem.status = "fixed";
                nmItem.detail = "Auto-ran npm install";
                autoFixed++;
            } else {
                nmItem.status = "error";
                nmItem.detail = "npm install failed: " + extractFirstLine(installResult.stderr);
            }
        } else {
            nmItem.status = "ok";
            nmItem.detail = "Present";
        }
        onUpdate([...items]);

        // 检查 2: package-lock.json 完整性
        const lockItem: ProjectHealthItem = {
            name: "lockfile",
            label: "Lock File",
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
            lockItem.detail = "Present";
        } else {
            lockItem.status = "warning";
            lockItem.detail = "Lock file missing (run npm install to generate)";
        }
        onUpdate([...items]);

        // 检查 3: 依赖冲突（npm ls 检测）
        const conflictItem: ProjectHealthItem = {
            name: "conflicts",
            label: "Dep Conflicts",
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
            conflictItem.detail = "No conflicts";
        } else {
            // 有冲突，尝试自动修复
            conflictItem.status = "fixing";
            conflictItem.detail = "Dependency issues found, auto-fixing...";
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
                conflictItem.detail = "Conflicts auto-fixed";
                autoFixed++;
            } else if (fixResult.success) {
                conflictItem.status = "warning";
                conflictItem.detail = "Partially fixed, remaining can be resolved via AI chat";
            } else {
                conflictItem.status = "error";
                conflictItem.detail = extractFirstLine(lsResult.stderr || lsResult.stdout);
            }
        }
        onUpdate([...items]);

        // 检查 4: 过期依赖
        const outdatedItem: ProjectHealthItem = {
            name: "outdated",
            label: "Outdated Deps",
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
            outdatedItem.detail = "All dependencies up to date";
        } else {
            try {
                const outdated = JSON.parse(outdatedStr);
                const count = Object.keys(outdated).length;
                outdatedItem.status = "warning";
                outdatedItem.detail = `${count} deps can be updated (no impact on runtime)`;
            } catch {
                outdatedItem.status = "ok";
                outdatedItem.detail = "Check complete";
            }
        }
        onUpdate([...items]);

        // ==================== Rust 项目检查 ====================
    } else if (projectType === "rust") {
        const cargoItem: ProjectHealthItem = {
            name: "cargo_check",
            label: "Cargo Build Check",
            icon: "crab",
            status: "checking",
            detail: "",
        };
        items.push(cargoItem);
        onUpdate([...items]);

        const checkResult = await runCmd("cargo check 2>&1 | tail -3", projectPath);
        if (checkResult.success) {
            cargoItem.status = "ok";
            cargoItem.detail = "Build passed";
        } else {
            cargoItem.status = "error";
            cargoItem.detail = extractFirstLine(checkResult.stderr || checkResult.stdout);
        }
        onUpdate([...items]);

        // ==================== Python 项目检查 ====================
    } else if (projectType === "python") {
        const pipItem: ProjectHealthItem = {
            name: "pip_check",
            label: "Python Deps",
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
                pipItem.detail = "Creating virtual environment...";
                onUpdate([...items]);
                await runCmd("python3 -m venv venv", projectPath);
            }

            pipItem.status = "fixing";
            pipItem.detail = "Installing dependencies...";
            onUpdate([...items]);

            const installResult = await runCmd(
                hasVenv ? "venv/bin/pip install -r requirements.txt" : "pip3 install -r requirements.txt",
                projectPath
            );
            pipItem.status = installResult.success ? "fixed" : "error";
            pipItem.detail = installResult.success ? "Dependencies installed" : "Installation failed";
            if (installResult.success) autoFixed++;
        } else {
            pipItem.status = "ok";
            pipItem.detail = "pyproject.toml detected";
        }
        onUpdate([...items]);
    }

    return { items, projectType, autoFixed };
}

// ── 辅助函数 ─────────────────────────────────────────────

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
        return { stdout: "", stderr: "Command execution failed", exit_code: -1, success: false };
    }
}

function extractFirstLine(text: string): string {
    return text.trim().split("\n")[0]?.substring(0, 100) || "";
}
