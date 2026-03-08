/**
 * 消息渠道管理 — 通过 OpenClaw Gateway CLI 代理
 *
 * 所有渠道功能由 OpenClaw Gateway 本体提供。
 * 此模块通过 openclaw_run_cli 命令与 Gateway 交互。
 */

import { invoke } from "@tauri-apps/api/core";

export async function listChannels(): Promise<string> {
    try {
        return await invoke<string>("openclaw_run_cli", { command: "channels list" });
    } catch (err) {
        return `Channel query failed: ${err}`;
    }
}

export async function addChannel(type: string, options?: string): Promise<string> {
    const cmd = options ? `channels add ${type} ${options}` : `channels add ${type}`;
    return invoke<string>("openclaw_run_cli", { command: cmd });
}

export async function removeChannel(channelId: string): Promise<string> {
    return invoke<string>("openclaw_run_cli", { command: `channels remove ${channelId}` });
}
