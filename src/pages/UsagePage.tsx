import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    BarChart3,
    TrendingUp,
    DollarSign,
    Cpu,
    AlertTriangle,
    Settings,
    ArrowUpRight,
    ArrowDownRight,
} from "lucide-react";
import { useUsageStore, type DailySummary } from "@/store/usageStore";

function formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
}

function formatCost(n: number): string {
    if (n < 0.01) return `$${n.toFixed(4)}`;
    return `$${n.toFixed(2)}`;
}

// ── 简单柱状图 ──
function MiniBarChart({ data, maxVal }: { data: { label: string; value: number }[]; maxVal: number }) {
    return (
        <div className="flex items-end gap-[3px] h-24">
            {data.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                        className="w-full bg-primary/60 rounded-t-sm min-h-[2px] transition-all duration-300"
                        style={{ height: `${maxVal > 0 ? (d.value / maxVal) * 100 : 0}%` }}
                        title={`${d.label}: ${formatCost(d.value)}`}
                    />
                    <span className="text-[8px] text-muted-foreground/50 -rotate-45 origin-left whitespace-nowrap">
                        {d.label.slice(5)}
                    </span>
                </div>
            ))}
        </div>
    );
}

// ── 模型分布 ──
function ModelBreakdown({ summaries }: { summaries: DailySummary[] }) {
    const modelTotals = new Map<string, { input: number; output: number; cost: number }>();
    for (const s of summaries) {
        for (const [model, data] of Object.entries(s.byModel)) {
            const existing = modelTotals.get(model) || { input: 0, output: 0, cost: 0 };
            existing.input += data.input;
            existing.output += data.output;
            existing.cost += data.cost;
            modelTotals.set(model, existing);
        }
    }

    const sorted = Array.from(modelTotals.entries()).sort((a, b) => b[1].cost - a[1].cost);
    const totalCost = sorted.reduce((s, [, d]) => s + d.cost, 0);

    if (sorted.length === 0) return null;

    const colors = [
        "bg-primary/70", "bg-emerald-500/70", "bg-amber-500/70", "bg-violet-500/70",
        "bg-cyan-500/70", "bg-rose-500/70", "bg-indigo-500/70", "bg-orange-500/70",
    ];

    return (
        <div className="space-y-3">
            {/* 条形占比 */}
            <div className="flex h-3 rounded-full overflow-hidden">
                {sorted.map(([model, data], i) => (
                    <div
                        key={model}
                        className={`${colors[i % colors.length]} transition-all`}
                        style={{ width: `${totalCost > 0 ? (data.cost / totalCost) * 100 : 0}%` }}
                        title={`${model}: ${formatCost(data.cost)}`}
                    />
                ))}
            </div>
            {/* 列表 */}
            <div className="space-y-1.5">
                {sorted.map(([model, data], i) => (
                    <div key={model} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-2.5 h-2.5 rounded-sm ${colors[i % colors.length]}`} />
                            <span className="text-foreground font-medium truncate font-mono text-[11px]">{model}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground shrink-0">
                            <span>{formatTokens(data.input + data.output)} tok</span>
                            <span className="font-medium text-foreground">{formatCost(data.cost)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── 主页面 ──
export default function UsagePage() {
    const {
        dailySummaries,
        budget,
        currentMonthCost,
        setBudget,
        startListening,
    } = useUsageStore();

    const [showBudgetEdit, setShowBudgetEdit] = useState(false);
    const [budgetInput, setBudgetInput] = useState(String(budget.monthlyLimit));

    useEffect(() => {
        const unlisten = startListening();
        return unlisten;
    }, []);

    // 统计
    const last7 = dailySummaries.slice(-7);
    const last30 = dailySummaries.slice(-30);
    const todaySummary = dailySummaries.find((s) => s.date === new Date().toISOString().slice(0, 10));
    const yesterdaySummary = dailySummaries.find((s) => {
        const y = new Date(); y.setDate(y.getDate() - 1);
        return s.date === y.toISOString().slice(0, 10);
    });

    const todayCost = todaySummary?.totalCost ?? 0;
    const yesterdayCost = yesterdaySummary?.totalCost ?? 0;
    const costDelta = yesterdayCost > 0 ? ((todayCost - yesterdayCost) / yesterdayCost) * 100 : 0;

    const totalTokens30d = last30.reduce((s, d) => s + d.totalInput + d.totalOutput, 0);
    const totalCost30d = last30.reduce((s, d) => s + d.totalCost, 0);

    const budgetUsed = budget.monthlyLimit > 0 ? currentMonthCost / budget.monthlyLimit : 0;
    const overBudgetThreshold = budgetUsed >= budget.alertThreshold;

    // 图表数据
    const chartData = last30.map((s) => ({ label: s.date, value: s.totalCost }));
    const maxChartVal = Math.max(...chartData.map((d) => d.value), 0.01);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 overflow-y-auto p-6 space-y-6"
        >
            {/* 标题 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/[0.06] border border-border/50 flex items-center justify-center">
                        <BarChart3 className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-foreground">用量与成本</h1>
                        <p className="text-[12px] text-muted-foreground">Token 消耗追踪与成本估算</p>
                    </div>
                </div>
            </div>

            {/* 概览卡片 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 今日成本 */}
                <div className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-4" style={{ boxShadow: 'var(--panel-shadow)' }}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground font-medium">今日成本</span>
                        <DollarSign className="w-4 h-4 text-muted-foreground/50" />
                    </div>
                    <div className="text-2xl font-bold text-foreground">{formatCost(todayCost)}</div>
                    {yesterdayCost > 0 && (
                        <div className={`flex items-center gap-0.5 mt-1 text-[11px] font-medium ${costDelta >= 0 ? "text-red-400" : "text-emerald-400"}`}>
                            {costDelta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {Math.abs(costDelta).toFixed(1)}% vs 昨日
                        </div>
                    )}
                </div>

                {/* 本月成本 */}
                <div className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-4" style={{ boxShadow: 'var(--panel-shadow)' }}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground font-medium">本月成本</span>
                        <TrendingUp className="w-4 h-4 text-muted-foreground/50" />
                    </div>
                    <div className="text-2xl font-bold text-foreground">{formatCost(currentMonthCost)}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                        预算 {formatCost(budget.monthlyLimit)}
                    </div>
                </div>

                {/* 30天 Token */}
                <div className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-4" style={{ boxShadow: 'var(--panel-shadow)' }}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground font-medium">30天 Token</span>
                        <Cpu className="w-4 h-4 text-muted-foreground/50" />
                    </div>
                    <div className="text-2xl font-bold text-foreground">{formatTokens(totalTokens30d)}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                        成本 {formatCost(totalCost30d)}
                    </div>
                </div>

                {/* 预算进度 */}
                <div className={`bg-card/80 dark:bg-card/50 border rounded-xl p-4 ${overBudgetThreshold ? "border-amber-500/40" : "border-border/50 dark:border-white/[0.06]"}`} style={{ boxShadow: 'var(--panel-shadow)' }}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground font-medium">预算使用</span>
                        <button onClick={() => { setShowBudgetEdit(!showBudgetEdit); setBudgetInput(String(budget.monthlyLimit)); }}>
                            <Settings className="w-4 h-4 text-muted-foreground/50 hover:text-foreground transition-colors" />
                        </button>
                    </div>
                    <div className="text-2xl font-bold text-foreground">{(budgetUsed * 100).toFixed(0)}%</div>
                    <div className="w-full bg-muted/30 rounded-full h-1.5 mt-2">
                        <div
                            className={`h-full rounded-full transition-all ${overBudgetThreshold ? "bg-amber-500" : "bg-primary"}`}
                            style={{ width: `${Math.min(budgetUsed * 100, 100)}%` }}
                        />
                    </div>
                    {overBudgetThreshold && (
                        <div className="flex items-center gap-1 mt-1.5 text-[10px] text-amber-500 font-medium">
                            <AlertTriangle className="w-3 h-3" />
                            已超过预警阈值
                        </div>
                    )}
                </div>
            </div>

            {/* 预算编辑 */}
            {showBudgetEdit && (
                <div className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-4 flex items-center gap-3" style={{ boxShadow: 'var(--panel-shadow)' }}>
                    <span className="text-xs font-medium text-foreground">月度预算 (USD):</span>
                    <input
                        type="number"
                        value={budgetInput}
                        onChange={(e) => setBudgetInput(e.target.value)}
                        className="w-24 bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                    />
                    <button
                        onClick={() => { setBudget({ ...budget, monthlyLimit: parseFloat(budgetInput) || 50 }); setShowBudgetEdit(false); }}
                        className="px-3 py-1 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                        保存
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 成本趋势图 */}
                <div className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-5" style={{ boxShadow: 'var(--panel-shadow)' }}>
                    <h3 className="text-sm font-semibold text-foreground mb-4">30天成本趋势</h3>
                    {chartData.length === 0 ? (
                        <div className="h-24 flex items-center justify-center text-xs text-muted-foreground/50">暂无数据</div>
                    ) : (
                        <MiniBarChart data={chartData} maxVal={maxChartVal} />
                    )}
                </div>

                {/* 模型分布 */}
                <div className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-5" style={{ boxShadow: 'var(--panel-shadow)' }}>
                    <h3 className="text-sm font-semibold text-foreground mb-4">模型用量分布</h3>
                    {last30.length === 0 ? (
                        <div className="h-24 flex items-center justify-center text-xs text-muted-foreground/50">暂无数据</div>
                    ) : (
                        <ModelBreakdown summaries={last30} />
                    )}
                </div>
            </div>

            {/* 每日明细 */}
            {last7.length > 0 && (
                <div className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-5" style={{ boxShadow: 'var(--panel-shadow)' }}>
                    <h3 className="text-sm font-semibold text-foreground mb-3">最近 7 天明细</h3>
                    <div className="space-y-1 overflow-x-auto">
                        <div className="grid grid-cols-5 min-w-[400px] text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 pb-1">
                            <span>日期</span>
                            <span className="text-right">输入 Token</span>
                            <span className="text-right">输出 Token</span>
                            <span className="text-right">总 Token</span>
                            <span className="text-right">成本</span>
                        </div>
                        {last7.slice().reverse().map((s) => (
                            <div key={s.date} className="grid grid-cols-5 min-w-[400px] text-xs px-2 py-1.5 hover:bg-muted/30 rounded-lg transition-colors">
                                <span className="text-foreground font-mono">{s.date.slice(5)}</span>
                                <span className="text-right text-muted-foreground">{formatTokens(s.totalInput)}</span>
                                <span className="text-right text-muted-foreground">{formatTokens(s.totalOutput)}</span>
                                <span className="text-right text-foreground font-medium">{formatTokens(s.totalInput + s.totalOutput)}</span>
                                <span className="text-right text-foreground font-medium">{formatCost(s.totalCost)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </motion.div>
    );
}
