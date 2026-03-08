/**
 * OpenClaw Gateway Bridge
 *
 * 启动并管理内嵌的 OpenClaw Gateway 守护进程。
 * 通过 WebSocket 连接 Gateway 的控制面 (ws://127.0.0.1:18789)，
 * 将所有 Agent 消息、工具调用、技能、渠道路由到 OpenClaw 本体。
 *
 * 架构: Sinaclaw GUI → WebSocket → OpenClaw Gateway → Brain/Hands/Memory/Skills/Channels
 */

import { invoke } from "@tauri-apps/api/core";

export interface GatewayStatus {
    running: boolean;
    pid?: number;
    port: number;
    version?: string;
    error?: string;
}

export interface GatewayEvent {
    type: string;
    payload: Record<string, unknown>;
}

type GatewayEventListener = (event: GatewayEvent) => void;

const GATEWAY_PORT = 18789;
const GATEWAY_WS_URL = `ws://127.0.0.1:${GATEWAY_PORT}`;

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let eventListeners: GatewayEventListener[] = [];
let gatewayStatus: GatewayStatus = { running: false, port: GATEWAY_PORT };

function emitEvent(event: GatewayEvent) {
    eventListeners.forEach(fn => fn(event));
}

export const openclawBridge = {
    /**
     * 通过 Node sidecar 启动 OpenClaw Gateway 进程
     */
    async startGateway(): Promise<GatewayStatus> {
        try {
            const result = await invoke<string>("openclaw_start_gateway");
            gatewayStatus = { running: true, port: GATEWAY_PORT, version: result };
            return gatewayStatus;
        } catch (err) {
            gatewayStatus = {
                running: false,
                port: GATEWAY_PORT,
                error: String(err),
            };
            return gatewayStatus;
        }
    },

    /**
     * 停止 OpenClaw Gateway
     */
    async stopGateway(): Promise<void> {
        this.disconnectWs();
        try {
            await invoke("openclaw_stop_gateway");
        } catch {}
        gatewayStatus = { running: false, port: GATEWAY_PORT };
    },

    /**
     * 获取 Gateway 状态
     */
    async getStatus(): Promise<GatewayStatus> {
        try {
            const resp = await fetch(`http://127.0.0.1:${GATEWAY_PORT}/health`);
            if (resp.ok) {
                const data = await resp.json();
                gatewayStatus = {
                    running: true,
                    port: GATEWAY_PORT,
                    version: data.version,
                };
            } else {
                gatewayStatus = { running: false, port: GATEWAY_PORT };
            }
        } catch {
            gatewayStatus = { running: false, port: GATEWAY_PORT };
        }
        return gatewayStatus;
    },

    /**
     * 建立 WebSocket 连接到 Gateway 控制面
     */
    connectWs() {
        if (ws && ws.readyState === WebSocket.OPEN) return;

        try {
            ws = new WebSocket(GATEWAY_WS_URL);

            ws.onopen = () => {
                console.log("[OpenClaw Bridge] WebSocket 已连接到 Gateway");
                emitEvent({ type: "gateway.connected", payload: {} });
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    emitEvent(data);
                } catch {
                    console.warn("[OpenClaw Bridge] 无法解析 Gateway 消息:", event.data);
                }
            };

            ws.onclose = () => {
                console.log("[OpenClaw Bridge] WebSocket 已断开");
                ws = null;
                emitEvent({ type: "gateway.disconnected", payload: {} });
                this.scheduleReconnect();
            };

            ws.onerror = (err) => {
                console.warn("[OpenClaw Bridge] WebSocket 错误:", err);
            };
        } catch (err) {
            console.warn("[OpenClaw Bridge] 连接失败:", err);
            this.scheduleReconnect();
        }
    },

    disconnectWs() {
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        if (ws) {
            ws.close();
            ws = null;
        }
    },

    scheduleReconnect() {
        if (reconnectTimer) return;
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            if (gatewayStatus.running) {
                this.connectWs();
            }
        }, 3000);
    },

    /**
     * 向 Gateway 发送消息并流式接收回复
     */
    async sendAgentMessage(
        message: string,
        callbacks: {
            onTextChunk: (text: string) => void;
            onToolCall?: (name: string, args: Record<string, unknown>) => void;
            onToolResult?: (name: string, result: string) => void;
            onDone: (fullText: string) => void;
            onError: (error: string) => void;
        },
        options?: { thinking?: 'low' | 'medium' | 'high'; sessionId?: string }
    ): Promise<boolean> {
        if (!ws || ws.readyState !== WebSocket.OPEN) return false;

        let fullText = "";

        const handler = (event: GatewayEvent) => {
            switch (event.type) {
                case "agent.text":
                    fullText += (event.payload.content as string) || "";
                    callbacks.onTextChunk((event.payload.content as string) || "");
                    break;
                case "agent.tool.start":
                    callbacks.onToolCall?.(
                        event.payload.name as string,
                        (event.payload.input as Record<string, unknown>) || {}
                    );
                    break;
                case "agent.tool.result":
                    callbacks.onToolResult?.(
                        event.payload.name as string,
                        (event.payload.output as string) || ""
                    );
                    break;
                case "agent.done":
                    fullText += (event.payload.content as string) || "";
                    unlisten();
                    callbacks.onDone(fullText || (event.payload.content as string) || "");
                    break;
                case "agent.error":
                    unlisten();
                    callbacks.onError((event.payload.message as string) || "Unknown error");
                    break;
            }
        };

        const unlisten = this.onEvent(handler);

        ws.send(JSON.stringify({
            type: "agent.task",
            payload: {
                message,
                thinking: options?.thinking || "medium",
                sessionId: options?.sessionId || "main",
            },
        }));

        return true;
    },

    /**
     * 通过 Gateway 发送渠道消息
     */
    sendChannelMessage(channel: string, to: string, message: string): boolean {
        if (!ws || ws.readyState !== WebSocket.OPEN) return false;
        ws.send(JSON.stringify({
            type: "message.send",
            payload: { channel, to, message },
        }));
        return true;
    },

    /**
     * 请求 Gateway 执行 CLI 命令
     */
    async runCliCommand(command: string): Promise<string> {
        return invoke<string>("openclaw_run_cli", { command });
    },

    /**
     * 安装 ClawHub 技能
     */
    async installSkill(skillName: string): Promise<string> {
        return this.runCliCommand(`plugins install ${skillName}`);
    },

    /**
     * 列出已安装的技能
     */
    async listSkills(): Promise<string> {
        return this.runCliCommand("plugins list");
    },

    /**
     * 运行 doctor 诊断
     */
    async runDoctor(): Promise<string> {
        return this.runCliCommand("doctor");
    },

    /**
     * 设置 OpenClaw 配置
     */
    async setConfig(key: string, value: string): Promise<string> {
        return this.runCliCommand(`config set ${key} "${value}"`);
    },

    /**
     * 读取 OpenClaw 配置
     */
    async getConfig(key: string): Promise<string> {
        return this.runCliCommand(`config get ${key}`);
    },

    /**
     * 渠道登录（WhatsApp/Telegram/Discord 等）
     */
    async channelLogin(channel?: string): Promise<string> {
        return this.runCliCommand(channel ? `channels login ${channel}` : "channels login");
    },

    /**
     * 渠道登出
     */
    async channelLogout(channel: string): Promise<string> {
        return this.runCliCommand(`channels logout ${channel}`);
    },

    /**
     * 列出所有渠道状态
     */
    async listChannels(): Promise<string> {
        return this.runCliCommand("channels list");
    },

    /**
     * 卸载技能
     */
    async uninstallSkill(skillName: string): Promise<string> {
        return this.runCliCommand(`plugins uninstall ${skillName}`);
    },

    /**
     * 运行设置向导
     */
    async runWizard(): Promise<string> {
        return this.runCliCommand("wizard");
    },

    /**
     * 直接向 Agent 发送消息（CLI 模式）
     */
    async agentSend(message: string): Promise<string> {
        return this.runCliCommand(`send "${message}"`);
    },

    /**
     * 获取 Gateway 状态（通过 Rust 命令）
     */
    async getRustGatewayStatus(): Promise<Record<string, unknown>> {
        return invoke<Record<string, unknown>>("openclaw_gateway_status");
    },

    /**
     * 监听 Gateway 事件
     */
    onEvent(listener: GatewayEventListener) {
        eventListeners.push(listener);
        return () => {
            eventListeners = eventListeners.filter(l => l !== listener);
        };
    },

    isConnected(): boolean {
        return ws !== null && ws.readyState === WebSocket.OPEN;
    },

    getGatewayStatus(): GatewayStatus {
        return { ...gatewayStatus };
    },
};
