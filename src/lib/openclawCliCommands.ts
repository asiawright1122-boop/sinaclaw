/**
 * OpenClaw CLI 命令快捷方法
 */
import { invoke } from "@tauri-apps/api/core";

export async function runCliCommand(command: string): Promise<string> {
    return invoke<string>("openclaw_run_cli", { command });
}

export async function installSkill(skillName: string): Promise<string> {
    return runCliCommand(`plugins install ${skillName}`);
}

export async function listSkills(): Promise<string> {
    return runCliCommand("plugins list");
}

export async function runDoctor(): Promise<string> {
    return runCliCommand("doctor");
}

export async function setConfig(key: string, value: string): Promise<string> {
    return runCliCommand(`config set ${key} "${value}"`);
}

export async function getConfig(key: string): Promise<string> {
    return runCliCommand(`config get ${key}`);
}

export async function channelLogin(channel?: string): Promise<string> {
    return runCliCommand(channel ? `channels login ${channel}` : "channels login");
}

export async function channelLogout(channel: string): Promise<string> {
    return runCliCommand(`channels logout ${channel}`);
}

export async function listChannels(): Promise<string> {
    return runCliCommand("channels list");
}

export async function uninstallSkill(skillName: string): Promise<string> {
    return runCliCommand(`plugins uninstall ${skillName}`);
}

export async function runWizard(): Promise<string> {
    return runCliCommand("wizard");
}

export async function agentSend(message: string): Promise<string> {
    return runCliCommand(`send "${message}"`);
}

export async function getRustGatewayStatus(): Promise<Record<string, unknown>> {
    return invoke<Record<string, unknown>>("openclaw_gateway_status");
}
