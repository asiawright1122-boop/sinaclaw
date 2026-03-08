import { create } from "zustand";
import { openclawBridge, type GatewayEvent } from "@/lib/openclawBridge";
import Database from "@tauri-apps/plugin-sql";

export interface UsageRecord {
    id: string;
    model: string;
    provider: string;
    channel: string;
    inputTokens: number;
    outputTokens: number;
    cost: number; // USD
    timestamp: number;
}

export interface DailySummary {
    date: string; // YYYY-MM-DD
    totalInput: number;
    totalOutput: number;
    totalCost: number;
    byModel: Record<string, { input: number; output: number; cost: number }>;
}

export interface BudgetConfig {
    monthlyLimit: number; // USD
    alertThreshold: number; // 0-1, e.g. 0.8 = 80%
}

// 各提供商定价（USD per 1M tokens）
const PRICING: Record<string, { input: number; output: number }> = {
    "gpt-4o": { input: 2.5, output: 10 },
    "gpt-4o-mini": { input: 0.15, output: 0.6 },
    "gpt-4-turbo": { input: 10, output: 30 },
    "claude-3-5-sonnet-20241022": { input: 3, output: 15 },
    "claude-3-5-haiku-20241022": { input: 0.8, output: 4 },
    "claude-3-opus-20240229": { input: 15, output: 75 },
    "deepseek-chat": { input: 0.14, output: 0.28 },
    "deepseek-reasoner": { input: 0.55, output: 2.19 },
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    const price = PRICING[model];
    if (!price) return 0;
    return (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
}

interface UsageState {
    records: UsageRecord[];
    dailySummaries: DailySummary[];
    budget: BudgetConfig;
    currentMonthCost: number;
    loading: boolean;

    loadUsage: () => Promise<void>;
    addRecord: (record: Omit<UsageRecord, "id" | "cost">) => Promise<void>;
    setBudget: (budget: BudgetConfig) => void;
    startListening: () => () => void;
}

let dbInstance: Database | null = null;
async function getDb(): Promise<Database> {
    if (!dbInstance) dbInstance = await Database.load("sqlite:chat.db");
    return dbInstance;
}

async function ensureTable() {
    const db = await getDb();
    await db.execute(`CREATE TABLE IF NOT EXISTS usage_records (
        id TEXT PRIMARY KEY,
        model TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT '',
        channel TEXT NOT NULL DEFAULT '',
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cost REAL NOT NULL DEFAULT 0,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_usage_ts ON usage_records(timestamp DESC)`);
}

export const useUsageStore = create<UsageState>((set, get) => ({
    records: [],
    dailySummaries: [],
    budget: { monthlyLimit: 50, alertThreshold: 0.8 },
    currentMonthCost: 0,
    loading: false,

    loadUsage: async () => {
        set({ loading: true });
        try {
            await ensureTable();
            const db = await getDb();
            // 加载最近 30 天数据
            const rows = await db.select<Record<string, unknown>[]>(
                "SELECT * FROM usage_records WHERE timestamp > datetime('now', '-30 days') ORDER BY timestamp DESC"
            );
            const records: UsageRecord[] = rows.map((r) => ({
                id: r.id as string,
                model: r.model as string,
                provider: (r.provider as string) || "",
                channel: (r.channel as string) || "",
                inputTokens: (r.input_tokens as number) || 0,
                outputTokens: (r.output_tokens as number) || 0,
                cost: (r.cost as number) || 0,
                timestamp: new Date((r.timestamp as string) || "").getTime(),
            }));

            // 按日汇总
            const dailyMap = new Map<string, DailySummary>();
            for (const r of records) {
                const date = new Date(r.timestamp).toISOString().slice(0, 10);
                let d = dailyMap.get(date);
                if (!d) {
                    d = { date, totalInput: 0, totalOutput: 0, totalCost: 0, byModel: {} };
                    dailyMap.set(date, d);
                }
                d.totalInput += r.inputTokens;
                d.totalOutput += r.outputTokens;
                d.totalCost += r.cost;
                if (!d.byModel[r.model]) d.byModel[r.model] = { input: 0, output: 0, cost: 0 };
                d.byModel[r.model].input += r.inputTokens;
                d.byModel[r.model].output += r.outputTokens;
                d.byModel[r.model].cost += r.cost;
            }

            const dailySummaries = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

            // 本月成本
            const now = new Date();
            const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
            const currentMonthCost = records
                .filter((r) => new Date(r.timestamp).toISOString().startsWith(monthPrefix))
                .reduce((sum, r) => sum + r.cost, 0);

            set({ records, dailySummaries, currentMonthCost, loading: false });
        } catch (err) {
            console.error("[Usage] 加载失败:", err);
            set({ loading: false });
        }
    },

    addRecord: async (record) => {
        const cost = estimateCost(record.model, record.inputTokens, record.outputTokens);
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        try {
            await ensureTable();
            const db = await getDb();
            await db.execute(
                `INSERT INTO usage_records (id, model, provider, channel, input_tokens, output_tokens, cost, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [id, record.model, record.provider, record.channel, record.inputTokens, record.outputTokens, cost, now]
            );
            // 轻量更新状态，不重新加载全部数据
            set((s) => ({
                currentMonthCost: s.currentMonthCost + cost,
            }));
        } catch (err) {
            console.error("[Usage] 记录失败:", err);
        }
    },

    setBudget: (budget) => set({ budget }),

    startListening: () => {
        const handler = async (event: GatewayEvent) => {
            if (event.type === "usage" || event.type === "llm.usage") {
                const p = event.payload;
                await get().addRecord({
                    model: (p.model as string) || "unknown",
                    provider: (p.provider as string) || "",
                    channel: (p.channel as string) || "chat",
                    inputTokens: (p.inputTokens as number) || (p.prompt_tokens as number) || 0,
                    outputTokens: (p.outputTokens as number) || (p.completion_tokens as number) || 0,
                    timestamp: Date.now(),
                });
            }
        };
        const unlisten = openclawBridge.onEvent(handler);
        get().loadUsage();
        return unlisten;
    },
}));
