import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { openclawBridge, type GatewayEvent } from "@/lib/openclawBridge";

export interface ChannelDef {
    id: string;
    name: string;
    icon: string;
    description: string;
    requiredFields: ChannelField[];
    optionalFields?: ChannelField[];
    docsUrl: string;
}

export interface ChannelField {
    key: string;
    label: string;
    type: "text" | "password" | "toggle" | "select";
    placeholder?: string;
    envVar?: string;
    options?: { value: string; label: string }[];
}

export type ChannelStatus = "connected" | "disconnected" | "error" | "unknown";

export interface ChannelInstance {
    channelId: string;
    status: ChannelStatus;
    config: Record<string, string>;
    lastError?: string;
    lastActive?: number;
    messageCountIn: number;
    messageCountOut: number;
    errors: { time: number; message: string }[];
}

interface ChannelState {
    channels: ChannelInstance[];
    loading: boolean;
    error: string | null;

    fetchChannels: () => Promise<void>;
    saveChannelConfig: (channelId: string, config: Record<string, string>) => Promise<void>;
    testChannel: (channelId: string) => Promise<string>;
    removeChannel: (channelId: string) => Promise<void>;
    startMonitoring: () => () => void;
}

// OpenClaw 支持的全部通道定义
export const CHANNEL_DEFINITIONS: ChannelDef[] = [
    {
        id: "whatsapp",
        name: "WhatsApp",
        icon: "whatsapp",
        description: "Connect WhatsApp via Baileys, scan QR to pair",
        requiredFields: [],
        docsUrl: "https://docs.openclaw.ai/channels/whatsapp",
    },
    {
        id: "telegram",
        name: "Telegram",
        icon: "telegram",
        description: "Connect Telegram Bot via grammY",
        requiredFields: [
            { key: "botToken", label: "Bot Token", type: "password", placeholder: "123456:ABCDEF...", envVar: "TELEGRAM_BOT_TOKEN" },
        ],
        optionalFields: [
            { key: "webhookUrl", label: "Webhook URL", type: "text", placeholder: "https://..." },
        ],
        docsUrl: "https://docs.openclaw.ai/channels/telegram",
    },
    {
        id: "slack",
        name: "Slack",
        icon: "slack",
        description: "Connect Slack workspace via Bolt SDK",
        requiredFields: [
            { key: "botToken", label: "Bot Token", type: "password", placeholder: "xoxb-...", envVar: "SLACK_BOT_TOKEN" },
            { key: "appToken", label: "App Token", type: "password", placeholder: "xapp-...", envVar: "SLACK_APP_TOKEN" },
        ],
        docsUrl: "https://docs.openclaw.ai/channels/slack",
    },
    {
        id: "discord",
        name: "Discord",
        icon: "discord",
        description: "Connect Discord server via discord.js",
        requiredFields: [
            { key: "token", label: "Bot Token", type: "password", placeholder: "MTk...", envVar: "DISCORD_BOT_TOKEN" },
        ],
        docsUrl: "https://docs.openclaw.ai/channels/discord",
    },
    {
        id: "googlechat",
        name: "Google Chat",
        icon: "googlechat",
        description: "Connect via Google Chat API",
        requiredFields: [
            { key: "serviceAccountKey", label: "Service Account Key (JSON)", type: "text", placeholder: "{...}" },
        ],
        docsUrl: "https://docs.openclaw.ai/channels/googlechat",
    },
    {
        id: "signal",
        name: "Signal",
        icon: "signal",
        description: "Connect Signal via signal-cli",
        requiredFields: [
            { key: "phone", label: "Phone", type: "text", placeholder: "+86..." },
        ],
        docsUrl: "https://docs.openclaw.ai/channels/signal",
    },
    {
        id: "bluebubbles",
        name: "iMessage (BlueBubbles)",
        icon: "bluebubbles",
        description: "Recommended iMessage integration",
        requiredFields: [
            { key: "serverUrl", label: "Server URL", type: "text", placeholder: "http://localhost:1234" },
            { key: "password", label: "Password", type: "password" },
        ],
        docsUrl: "https://docs.openclaw.ai/channels/bluebubbles",
    },
    {
        id: "imessage",
        name: "iMessage (Legacy)",
        icon: "imessage",
        description: "Native macOS iMessage integration (macOS only)",
        requiredFields: [],
        docsUrl: "https://docs.openclaw.ai/channels/imessage",
    },
    {
        id: "msteams",
        name: "Microsoft Teams",
        icon: "msteams",
        description: "Connect Teams via Bot Framework",
        requiredFields: [
            { key: "appId", label: "App ID", type: "text" },
            { key: "appPassword", label: "App Password", type: "password" },
        ],
        docsUrl: "https://docs.openclaw.ai/channels/msteams",
    },
    {
        id: "matrix",
        name: "Matrix",
        icon: "matrix",
        description: "Connect Matrix protocol chatroom",
        requiredFields: [
            { key: "homeserverUrl", label: "Homeserver URL", type: "text", placeholder: "https://matrix.org" },
            { key: "accessToken", label: "Access Token", type: "password" },
        ],
        docsUrl: "https://docs.openclaw.ai/channels/matrix",
    },
    {
        id: "irc",
        name: "IRC",
        icon: "irc",
        description: "Connect IRC server",
        requiredFields: [
            { key: "server", label: "Server", type: "text", placeholder: "irc.libera.chat" },
            { key: "nick", label: "Nickname", type: "text" },
        ],
        docsUrl: "https://docs.openclaw.ai/channels/irc",
    },
    {
        id: "feishu",
        name: "Feishu",
        icon: "feishu",
        description: "Connect Feishu/Lark bot",
        requiredFields: [
            { key: "appId", label: "App ID", type: "text" },
            { key: "appSecret", label: "App Secret", type: "password" },
        ],
        docsUrl: "https://docs.openclaw.ai/channels/feishu",
    },
    {
        id: "line",
        name: "LINE",
        icon: "line",
        description: "Connect LINE Messaging API",
        requiredFields: [
            { key: "channelAccessToken", label: "Channel Access Token", type: "password" },
            { key: "channelSecret", label: "Channel Secret", type: "password" },
        ],
        docsUrl: "https://docs.openclaw.ai/channels/line",
    },
    {
        id: "mattermost",
        name: "Mattermost",
        icon: "mattermost",
        description: "Connect Mattermost server",
        requiredFields: [
            { key: "url", label: "Server URL", type: "text" },
            { key: "token", label: "Bot Token", type: "password" },
        ],
        docsUrl: "https://docs.openclaw.ai/channels/mattermost",
    },
    {
        id: "nostr",
        name: "Nostr",
        icon: "nostr",
        description: "Connect Nostr protocol",
        requiredFields: [
            { key: "privateKey", label: "Private Key (nsec)", type: "password" },
        ],
        docsUrl: "https://docs.openclaw.ai/channels/nostr",
    },
    {
        id: "twitch",
        name: "Twitch",
        icon: "twitch",
        description: "Connect Twitch chat",
        requiredFields: [
            { key: "username", label: "Username", type: "text" },
            { key: "token", label: "OAuth Token", type: "password" },
            { key: "channel", label: "Channel", type: "text" },
        ],
        docsUrl: "https://docs.openclaw.ai/channels/twitch",
    },
    {
        id: "zalo",
        name: "Zalo",
        icon: "zalo",
        description: "Connect Zalo OA",
        requiredFields: [
            { key: "oaId", label: "OA ID", type: "text" },
            { key: "accessToken", label: "Access Token", type: "password" },
        ],
        docsUrl: "https://docs.openclaw.ai/channels/zalo",
    },
    {
        id: "nextcloud-talk",
        name: "Nextcloud Talk",
        icon: "nextcloud",
        description: "Connect Nextcloud Talk",
        requiredFields: [
            { key: "serverUrl", label: "Server URL", type: "text" },
            { key: "username", label: "Username", type: "text" },
            { key: "password", label: "Password", type: "password" },
        ],
        docsUrl: "https://docs.openclaw.ai/channels/nextcloud-talk",
    },
    {
        id: "synology-chat",
        name: "Synology Chat",
        icon: "synology",
        description: "Connect Synology Chat",
        requiredFields: [
            { key: "serverUrl", label: "Server URL", type: "text" },
            { key: "token", label: "Bot Token", type: "password" },
        ],
        docsUrl: "https://docs.openclaw.ai/channels/synology-chat",
    },
    {
        id: "webchat",
        name: "WebChat",
        icon: "webchat",
        description: "Built-in WebChat via Gateway WebSocket",
        requiredFields: [],
        docsUrl: "https://docs.openclaw.ai/web/webchat",
    },
];

export const useChannelStore = create<ChannelState>((set, get) => ({
    channels: [],
    loading: false,
    error: null,

    fetchChannels: async () => {
        set({ loading: true, error: null });
        try {
            const raw = await invoke<string>("openclaw_run_cli", { command: "channels list" });
            // 解析 CLI 输出为 channel 实例列表
            // OpenClaw CLI 输出格式因版本而异，这里做基础解析
            const instances: ChannelInstance[] = [];
            const lines = raw.split("\n").filter(Boolean);
            for (const line of lines) {
                // 尝试匹配类似 "telegram: connected" 或 JSON 格式
                const match = line.match(/^\s*(\w[\w-]*)\s*[:\-]\s*(\w+)/);
                if (match) {
                    const [, channelId, statusStr] = match;
                    const status: ChannelStatus =
                        statusStr === "connected" ? "connected" :
                        statusStr === "error" ? "error" :
                        statusStr === "disconnected" ? "disconnected" : "unknown";
                    instances.push({ channelId, status, config: {}, messageCountIn: 0, messageCountOut: 0, errors: [] });
                }
            }
            set({ channels: instances, loading: false });
        } catch (err) {
            set({ error: String(err), loading: false });
        }
    },

    saveChannelConfig: async (channelId: string, config: Record<string, string>) => {
        set({ loading: true, error: null });
        try {
            // 通过 CLI 写入配置
            const configJson = JSON.stringify({ channels: { [channelId]: config } });
            await invoke<string>("openclaw_run_cli", {
                command: `config set --json '${configJson}'`,
            });
            await get().fetchChannels();
        } catch (err) {
            set({ error: String(err), loading: false });
        }
    },

    testChannel: async (channelId: string) => {
        try {
            const result = await invoke<string>("openclaw_run_cli", {
                command: `channels test ${channelId}`,
            });
            return result;
        } catch (err) {
            return `测试失败: ${err}`;
        }
    },

    removeChannel: async (channelId: string) => {
        set({ loading: true, error: null });
        try {
            await invoke<string>("openclaw_run_cli", {
                command: `channels remove ${channelId}`,
            });
            await get().fetchChannels();
        } catch (err) {
            set({ error: String(err), loading: false });
        }
    },

    startMonitoring: () => {
        const handler = (event: GatewayEvent) => {
            const p = event.payload;
            const channel = (p.channel as string) || "";
            if (!channel) return;

            if (event.type === "channel.connected") {
                set((state) => {
                    const exists = state.channels.some((c) => c.channelId === channel);
                    if (exists) {
                        return {
                            channels: state.channels.map((c) =>
                                c.channelId === channel
                                    ? { ...c, status: "connected" as ChannelStatus, lastActive: Date.now() }
                                    : c
                            ),
                        };
                    }
                    return {
                        channels: [
                            ...state.channels,
                            { channelId: channel, status: "connected" as ChannelStatus, config: {}, messageCountIn: 0, messageCountOut: 0, errors: [], lastActive: Date.now() },
                        ],
                    };
                });
            }

            if (event.type === "channel.disconnected") {
                set((state) => ({
                    channels: state.channels.map((c) =>
                        c.channelId === channel ? { ...c, status: "disconnected" as ChannelStatus } : c
                    ),
                }));
            }

            if (event.type === "channel.error") {
                const errMsg = (p.error as string) || (p.message as string) || "Unknown error";
                set((state) => ({
                    channels: state.channels.map((c) =>
                        c.channelId === channel
                            ? {
                                  ...c,
                                  status: "error" as ChannelStatus,
                                  lastError: errMsg,
                                  errors: [...c.errors.slice(-49), { time: Date.now(), message: errMsg }],
                              }
                            : c
                    ),
                }));
            }

            if (event.type === "chat.message" || event.type === "message.received") {
                set((state) => ({
                    channels: state.channels.map((c) =>
                        c.channelId === channel
                            ? { ...c, lastActive: Date.now(), messageCountIn: c.messageCountIn + 1 }
                            : c
                    ),
                }));
            }

            if (event.type === "message.sent" || event.type === "message.send") {
                set((state) => ({
                    channels: state.channels.map((c) =>
                        c.channelId === channel
                            ? { ...c, lastActive: Date.now(), messageCountOut: c.messageCountOut + 1 }
                            : c
                    ),
                }));
            }
        };

        const unlisten = openclawBridge.onEvent(handler);
        get().fetchChannels();
        return unlisten;
    },
}));
