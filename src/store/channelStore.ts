import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { openclawBridge, type GatewayEvent } from "@/lib/openclawBridge";
import { type ChannelInstance, type ChannelStatus } from "./channelDefinitions";

// Re-export types and definitions for backward compatibility
export type { ChannelDef, ChannelField, ChannelStatus, ChannelInstance } from "./channelDefinitions";
export { CHANNEL_DEFINITIONS } from "./channelDefinitions";

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
            return `Test failed: ${err}`;
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
