/**
 * OpenClaw 启动自检引擎
 * 
 * 在应用启动时自动扫描用户的开发环境，
 * 检测缺失的工具并自动安装修复。
 * 不依赖 AI，纯硬编码逻辑。
 */
import { Command } from '@tauri-apps/plugin-shell';

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
            label: "Sinaclaw Engine",
            icon: "gear",
            required: true,
            status: "checking",
            version: "",
            installNote: "Built-in execution engine",
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
            engineItem.installNote = "Cannot invoke built-in Node: " + (output.stderr || "Native execution failed");
        }
    } catch (e: unknown) {
        console.error("Sidecar error IPC:", e);
        engineItem.status = "failed";
        engineItem.installNote = "Sidecar IPC error: " + String(e);
    }

    onUpdate([...items]);

    const allGood = items.every(i => i.status === "installed");
    const hasRequired = items.filter(i => i.required).every(i => i.status === "installed");

    return { items, allGood, hasRequired };
}

// ── 项目级依赖健康检查 ───────────────────────────────────
export type { ProjectHealthItem, ProjectHealthResult } from "./projectHealth";
export { runProjectHealthCheck } from "./projectHealth";
