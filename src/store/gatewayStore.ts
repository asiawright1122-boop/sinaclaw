import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface GatewayStatus {
    running: boolean;
    hasProcess: boolean;
    pid: number | null;
    port: number;
    version: string;
    uptimeSeconds: number;
    startedAt: number;
    health: Record<string, unknown> | null;
}

export interface GatewayLogEntry {
    stream: "stdout" | "stderr";
    line: string;
    timestamp: number;
}

interface GatewayState {
    status: GatewayStatus | null;
    logs: GatewayLogEntry[];
    loading: boolean;
    error: string | null;
    maxLogs: number;

    fetchStatus: () => Promise<void>;
    startGateway: () => Promise<void>;
    stopGateway: () => Promise<void>;
    restartGateway: () => Promise<void>;
    clearLogs: () => void;
    addLog: (entry: GatewayLogEntry) => void;
    startLogListener: () => Promise<UnlistenFn>;
    startPolling: () => () => void;
}

export const useGatewayStore = create<GatewayState>((set, get) => ({
    status: null,
    logs: [],
    loading: false,
    error: null,
    maxLogs: 500,

    fetchStatus: async () => {
        try {
            const status = await invoke<GatewayStatus>("openclaw_gateway_status");
            set({ status, error: null });
        } catch (err) {
            set({ error: String(err) });
        }
    },

    startGateway: async () => {
        set({ loading: true, error: null });
        try {
            await invoke<string>("openclaw_start_gateway");
            await get().fetchStatus();
        } catch (err) {
            set({ error: String(err) });
        } finally {
            set({ loading: false });
        }
    },

    stopGateway: async () => {
        set({ loading: true, error: null });
        try {
            await invoke<string>("openclaw_stop_gateway");
            await get().fetchStatus();
        } catch (err) {
            set({ error: String(err) });
        } finally {
            set({ loading: false });
        }
    },

    restartGateway: async () => {
        set({ loading: true, error: null });
        try {
            await invoke<string>("openclaw_restart_gateway");
            await get().fetchStatus();
        } catch (err) {
            set({ error: String(err) });
        } finally {
            set({ loading: false });
        }
    },

    clearLogs: () => set({ logs: [] }),

    addLog: (entry: GatewayLogEntry) => {
        const { logs, maxLogs } = get();
        const updated = [...logs, entry];
        set({ logs: updated.length > maxLogs ? updated.slice(-maxLogs) : updated });
    },

    startLogListener: async () => {
        const unlisten = await listen<GatewayLogEntry>("gateway-log", (event) => {
            get().addLog(event.payload);
        });
        return unlisten;
    },

    startPolling: () => {
        get().fetchStatus();
        const interval = setInterval(() => {
            get().fetchStatus();
        }, 5000);
        return () => clearInterval(interval);
    },
}));
