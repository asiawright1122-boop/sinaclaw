import { create } from "zustand";
import { openclawBridge } from "@/lib/openclawBridge";

export interface CronJob {
    id: string;
    name: string;
    schedule: string; // cron 表达式
    command: string;
    agentId?: string;
    enabled: boolean;
    lastRun?: number;
    nextRun?: number;
    lastResult?: string;
    status: "idle" | "running" | "error";
}

export interface Webhook {
    id: string;
    name: string;
    url: string;
    secret?: string;
    boundAgentId?: string;
    boundSkillId?: string;
    createdAt: number;
    requestCount: number;
    lastTriggered?: number;
}

export interface AutomationLog {
    id: string;
    type: "cron" | "webhook" | "gmail";
    name: string;
    time: number;
    status: "success" | "error";
    message: string;
}

interface AutomationState {
    cronJobs: CronJob[];
    webhooks: Webhook[];
    logs: AutomationLog[];
    loading: boolean;

    fetchCronJobs: () => Promise<void>;
    createCronJob: (job: Omit<CronJob, "id" | "status" | "lastRun" | "nextRun" | "lastResult">) => Promise<void>;
    deleteCronJob: (id: string) => Promise<void>;
    toggleCronJob: (id: string, enabled: boolean) => Promise<void>;

    fetchWebhooks: () => Promise<void>;
    createWebhook: (name: string, boundAgentId?: string) => Promise<void>;
    deleteWebhook: (id: string) => Promise<void>;

    fetchLogs: () => Promise<void>;
}

export const useAutomationStore = create<AutomationState>((set, get) => ({
    cronJobs: [],
    webhooks: [],
    logs: [],
    loading: false,

    fetchCronJobs: async () => {
        set({ loading: true });
        try {
            const raw = await openclawBridge.runCliCommand("cron list");
            const jobs: CronJob[] = [];
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    for (const j of parsed) {
                        jobs.push({
                            id: j.id || crypto.randomUUID(),
                            name: j.name || j.id || "",
                            schedule: j.schedule || j.cron || "",
                            command: j.command || j.task || "",
                            agentId: j.agentId,
                            enabled: j.enabled !== false,
                            lastRun: j.lastRun ? new Date(j.lastRun).getTime() : undefined,
                            nextRun: j.nextRun ? new Date(j.nextRun).getTime() : undefined,
                            lastResult: j.lastResult,
                            status: "idle",
                        });
                    }
                }
            } catch {
                const lines = raw.split("\n").filter(Boolean);
                for (const line of lines) {
                    const match = line.match(/^\s*(\S+)\s+(.+?)\s+\|\s+(.+)/);
                    if (match) {
                        jobs.push({
                            id: match[1],
                            name: match[1],
                            schedule: match[2].trim(),
                            command: match[3].trim(),
                            enabled: true,
                            status: "idle",
                        });
                    }
                }
            }
            set({ cronJobs: jobs, loading: false });
        } catch {
            set({ loading: false });
        }
    },

    createCronJob: async (job) => {
        try {
            await openclawBridge.runCliCommand(
                `cron add "${job.name}" "${job.schedule}" "${job.command}"`
            );
            await get().fetchCronJobs();
        } catch (err) {
            console.error("[Automation] 创建 Cron 失败:", err);
        }
    },

    deleteCronJob: async (id) => {
        try {
            await openclawBridge.runCliCommand(`cron remove ${id}`);
            set((s) => ({ cronJobs: s.cronJobs.filter((j) => j.id !== id) }));
        } catch (err) {
            console.error("[Automation] 删除 Cron 失败:", err);
        }
    },

    toggleCronJob: async (id, enabled) => {
        try {
            await openclawBridge.runCliCommand(`cron ${enabled ? "enable" : "disable"} ${id}`);
            set((s) => ({
                cronJobs: s.cronJobs.map((j) => (j.id === id ? { ...j, enabled } : j)),
            }));
        } catch (err) {
            console.error("[Automation] 切换 Cron 失败:", err);
        }
    },

    fetchWebhooks: async () => {
        try {
            const raw = await openclawBridge.runCliCommand("webhook list");
            const webhooks: Webhook[] = [];
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    for (const w of parsed) {
                        webhooks.push({
                            id: w.id || crypto.randomUUID(),
                            name: w.name || w.id || "",
                            url: w.url || "",
                            secret: w.secret,
                            boundAgentId: w.agentId,
                            boundSkillId: w.skillId,
                            createdAt: w.createdAt ? new Date(w.createdAt).getTime() : Date.now(),
                            requestCount: w.requestCount || 0,
                            lastTriggered: w.lastTriggered ? new Date(w.lastTriggered).getTime() : undefined,
                        });
                    }
                }
            } catch {}
            set({ webhooks });
        } catch {}
    },

    createWebhook: async (name, boundAgentId) => {
        try {
            const cmd = boundAgentId
                ? `webhook create "${name}" --agent ${boundAgentId}`
                : `webhook create "${name}"`;
            await openclawBridge.runCliCommand(cmd);
            await get().fetchWebhooks();
        } catch (err) {
            console.error("[Automation] 创建 Webhook 失败:", err);
        }
    },

    deleteWebhook: async (id) => {
        try {
            await openclawBridge.runCliCommand(`webhook remove ${id}`);
            set((s) => ({ webhooks: s.webhooks.filter((w) => w.id !== id) }));
        } catch (err) {
            console.error("[Automation] 删除 Webhook 失败:", err);
        }
    },

    fetchLogs: async () => {
        try {
            const raw = await openclawBridge.runCliCommand("automation logs --limit 50");
            const logs: AutomationLog[] = [];
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    for (const l of parsed) {
                        logs.push({
                            id: l.id || crypto.randomUUID(),
                            type: l.type || "cron",
                            name: l.name || "",
                            time: l.time ? new Date(l.time).getTime() : Date.now(),
                            status: l.status === "error" ? "error" : "success",
                            message: l.message || l.result || "",
                        });
                    }
                }
            } catch {}
            set({ logs });
        } catch {}
    },
}));
