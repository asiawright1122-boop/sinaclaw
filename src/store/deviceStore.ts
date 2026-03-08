import { create } from "zustand";
import { openclawBridge, type GatewayEvent } from "@/lib/openclawBridge";

export interface Device {
    id: string;
    name: string;
    type: "macos" | "ios" | "android" | "headless" | "browser" | "unknown";
    capabilities: string[];
    status: "online" | "offline" | "busy";
    lastSeen: number;
    ip?: string;
    version?: string;
}

interface DeviceState {
    devices: Device[];
    loading: boolean;

    fetchDevices: () => Promise<void>;
    sendCommand: (deviceId: string, command: string, args?: Record<string, unknown>) => boolean;
    unpairDevice: (deviceId: string) => Promise<void>;
    startListening: () => () => void;
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
    devices: [],
    loading: false,

    fetchDevices: async () => {
        set({ loading: true });
        try {
            const raw = await openclawBridge.runCliCommand("nodes list");
            const devices: Device[] = [];
            // 尝试 JSON 解析
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    for (const d of parsed) {
                        devices.push({
                            id: d.id || d.nodeId || "",
                            name: d.name || d.label || d.id || "",
                            type: d.type || d.platform || "unknown",
                            capabilities: d.capabilities || [],
                            status: d.status === "online" ? "online" : d.status === "busy" ? "busy" : "offline",
                            lastSeen: d.lastSeen ? new Date(d.lastSeen).getTime() : Date.now(),
                            ip: d.ip,
                            version: d.version,
                        });
                    }
                }
            } catch {
                // 行解析回退
                const lines = raw.split("\n").filter(Boolean);
                for (const line of lines) {
                    const match = line.match(/^\s*(\S+)\s+(\S+)\s+(online|offline|busy)/i);
                    if (match) {
                        devices.push({
                            id: match[1],
                            name: match[1],
                            type: (match[2] as Device["type"]) || "unknown",
                            capabilities: [],
                            status: match[3].toLowerCase() as Device["status"],
                            lastSeen: Date.now(),
                        });
                    }
                }
            }
            set({ devices, loading: false });
        } catch {
            set({ loading: false });
        }
    },

    sendCommand: (deviceId, command, args) => {
        return openclawBridge.sendChannelMessage(
            "__device__",
            deviceId,
            JSON.stringify({ command, ...(args || {}) })
        );
    },

    unpairDevice: async (deviceId) => {
        try {
            await openclawBridge.runCliCommand(`nodes unpair ${deviceId}`);
            set((state) => ({
                devices: state.devices.filter((d) => d.id !== deviceId),
            }));
        } catch (err) {
            console.error("[Devices] 取消配对失败:", err);
        }
    },

    startListening: () => {
        const handler = (event: GatewayEvent) => {
            const p = event.payload;
            if (event.type === "node.connected" || event.type === "node.online") {
                const id = (p.nodeId as string) || (p.id as string) || "";
                if (!id) return;
                set((state) => {
                    const exists = state.devices.find((d) => d.id === id);
                    if (exists) {
                        return {
                            devices: state.devices.map((d) =>
                                d.id === id ? { ...d, status: "online" as const, lastSeen: Date.now() } : d
                            ),
                        };
                    }
                    return {
                        devices: [
                            ...state.devices,
                            {
                                id,
                                name: (p.name as string) || id,
                                type: ((p.type as string) || "unknown") as Device["type"],
                                capabilities: (p.capabilities as string[]) || [],
                                status: "online" as const,
                                lastSeen: Date.now(),
                                version: p.version as string | undefined,
                            },
                        ],
                    };
                });
            }

            if (event.type === "node.disconnected" || event.type === "node.offline") {
                const id = (p.nodeId as string) || (p.id as string) || "";
                set((state) => ({
                    devices: state.devices.map((d) =>
                        d.id === id ? { ...d, status: "offline" as const } : d
                    ),
                }));
            }
        };

        const unlisten = openclawBridge.onEvent(handler);
        get().fetchDevices();
        return unlisten;
    },
}));
