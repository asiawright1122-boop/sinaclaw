/**
 * 远程 Gateway 管理模块
 *
 * 核心能力：
 * 1. 多 Gateway 连接管理（本地 / SSH Tunnel / Tailscale）
 * 2. Gateway 健康检测与状态监控
 * 3. Gateway 集群切换
 */

import { invoke } from "@tauri-apps/api/core";

// ── 类型定义 ──

export type GatewayConnectionType = "local" | "ssh_tunnel" | "tailscale" | "direct";

export interface GatewayEndpoint {
    id: string;
    name: string;
    type: GatewayConnectionType;
    host: string;
    port: number;
    wsPort?: number;
    sshUser?: string;
    sshKeyPath?: string;
    tailscaleHostname?: string;
    token?: string;
    isActive: boolean;
    status: "online" | "offline" | "connecting" | "error";
    latencyMs?: number;
    version?: string;
    uptime?: number; // seconds
    lastChecked?: number;
}

export interface GatewayHealth {
    status: "online" | "offline" | "error";
    version: string;
    uptime: number;
    latencyMs: number;
    connectedChannels: number;
    activeAgents: number;
    memoryUsageMB: number;
}

const DEFAULT_LOCAL: GatewayEndpoint = {
    id: "local",
    name: "本地 Gateway",
    type: "local",
    host: "127.0.0.1",
    port: 3778,
    wsPort: 3779,
    isActive: true,
    status: "offline",
};

// ── 状态持久化 ──

const STORAGE_KEY = "sinaclaw-gateways";

export function loadGateways(): GatewayEndpoint[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
    } catch {}
    return [{ ...DEFAULT_LOCAL }];
}

export function saveGateways(gateways: GatewayEndpoint[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gateways));
}

// ── 健康检测 ──

export async function checkGatewayHealth(endpoint: GatewayEndpoint): Promise<GatewayHealth> {
    const url = `http://${endpoint.host}:${endpoint.port}`;
    const start = performance.now();

    try {
        const res = await fetch(`${url}/health`, {
            signal: AbortSignal.timeout(5000),
            headers: endpoint.token ? { Authorization: `Bearer ${endpoint.token}` } : {},
        });

        const latencyMs = Math.round(performance.now() - start);

        if (!res.ok) {
            return { status: "error", version: "", uptime: 0, latencyMs, connectedChannels: 0, activeAgents: 0, memoryUsageMB: 0 };
        }

        const data = await res.json();
        return {
            status: "online",
            version: data.version || "",
            uptime: data.uptime || 0,
            latencyMs,
            connectedChannels: data.channels || 0,
            activeAgents: data.agents || 0,
            memoryUsageMB: data.memory_mb || 0,
        };
    } catch {
        return { status: "offline", version: "", uptime: 0, latencyMs: -1, connectedChannels: 0, activeAgents: 0, memoryUsageMB: 0 };
    }
}

// ── SSH Tunnel 管理 ──

export async function openSSHTunnel(endpoint: GatewayEndpoint): Promise<void> {
    if (endpoint.type !== "ssh_tunnel") throw new Error("非 SSH 类型");
    await invoke("open_ssh_tunnel", {
        host: endpoint.host,
        port: endpoint.port,
        sshUser: endpoint.sshUser || "root",
        sshKeyPath: endpoint.sshKeyPath || "",
        localPort: 13778 + parseInt(endpoint.id.replace(/\D/g, "") || "0"),
    });
}

export async function closeSSHTunnel(endpointId: string): Promise<void> {
    await invoke("close_ssh_tunnel", { endpointId });
}

// ── Gateway 切换 ──

export function setActiveGateway(gateways: GatewayEndpoint[], activeId: string): GatewayEndpoint[] {
    return gateways.map((g) => ({
        ...g,
        isActive: g.id === activeId,
    }));
}

export function getActiveGateway(gateways: GatewayEndpoint[]): GatewayEndpoint | undefined {
    return gateways.find((g) => g.isActive) || gateways[0];
}

// ── CRUD ──

export function addGateway(
    gateways: GatewayEndpoint[],
    config: Omit<GatewayEndpoint, "id" | "isActive" | "status">
): GatewayEndpoint[] {
    const newGw: GatewayEndpoint = {
        ...config,
        id: crypto.randomUUID().slice(0, 8),
        isActive: false,
        status: "offline",
    };
    return [...gateways, newGw];
}

export function removeGateway(gateways: GatewayEndpoint[], id: string): GatewayEndpoint[] {
    if (id === "local") return gateways; // 不能删除本地
    const filtered = gateways.filter((g) => g.id !== id);
    // 如果删除了活跃的，切换到第一个
    if (!filtered.some((g) => g.isActive) && filtered.length > 0) {
        filtered[0].isActive = true;
    }
    return filtered;
}

export function updateGateway(
    gateways: GatewayEndpoint[],
    id: string,
    updates: Partial<GatewayEndpoint>
): GatewayEndpoint[] {
    return gateways.map((g) => (g.id === id ? { ...g, ...updates } : g));
}

// ── 格式化 ──

export function formatUptime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}
