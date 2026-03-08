import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Timer,
    Webhook,
    Plus,
    Trash2,
    Play,
    Pause,
    Clock,
    Link,
    Copy,
    AlertCircle,
    CheckCircle2,
    ScrollText,
    X,
} from "lucide-react";
import {
    useAutomationStore,
    type CronJob,
    type Webhook as WebhookType,
} from "@/store/automationStore";

// ── Cron 模板 ──
const CRON_TEMPLATES = [
    { label: "每日摘要", schedule: "0 9 * * *", command: "send '请生成今日新闻摘要'" },
    { label: "每小时检查", schedule: "0 * * * *", command: "send '检查所有通道状态'" },
    { label: "工作日提醒", schedule: "0 8 * * 1-5", command: "send '早安！今天有什么安排？'" },
    { label: "每周报告", schedule: "0 18 * * 5", command: "send '请生成本周工作总结'" },
];

function formatTime(ts?: number): string {
    if (!ts) return "—";
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
    }
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" }) + " " +
        d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

// ── Cron 任务卡片 ──
function CronJobCard({ job, onDelete, onToggle }: {
    job: CronJob;
    onDelete: () => void;
    onToggle: () => void;
}) {
    return (
        <div className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-3.5 group" style={{ boxShadow: 'var(--panel-shadow)' }}>
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                        job.enabled ? "bg-emerald-500/10 text-emerald-500" : "bg-muted/20 text-muted-foreground"
                    }`}>
                        <Timer className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground truncate">{job.name}</span>
                            {job.status === "running" && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-medium animate-pulse">运行中</span>
                            )}
                            {job.status === "error" && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 font-medium">错误</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                            <code className="px-1 py-0.5 bg-muted/30 rounded font-mono">{job.schedule}</code>
                            <span className="truncate">{job.command}</span>
                        </div>
                        {job.lastRun && (
                            <div className="text-[10px] text-muted-foreground/60 mt-1 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                上次: {formatTime(job.lastRun)}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title={job.enabled ? "暂停" : "启用"}>
                        {job.enabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Webhook 卡片 ──
function WebhookCard({ webhook, onDelete }: {
    webhook: WebhookType;
    onDelete: () => void;
}) {
    const [copied, setCopied] = useState(false);
    const copyUrl = () => {
        navigator.clipboard.writeText(webhook.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-3.5 group" style={{ boxShadow: 'var(--panel-shadow)' }}>
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/[0.06] flex items-center justify-center">
                        <Link className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                        <span className="text-sm font-medium text-foreground">{webhook.name}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <code className="text-[10px] text-muted-foreground font-mono bg-muted/30 px-1.5 py-0.5 rounded truncate max-w-[200px]">
                                {webhook.url}
                            </code>
                            <button onClick={copyUrl} className="p-0.5 text-muted-foreground hover:text-foreground transition-colors" title="复制 URL">
                                {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground/60">
                            <span>{webhook.requestCount} 次请求</span>
                            {webhook.lastTriggered && <span>最近: {formatTime(webhook.lastTriggered)}</span>}
                        </div>
                    </div>
                </div>
                <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100">
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}

// ── 创建 Cron 对话框 ──
function CreateCronDialog({ onClose, onCreate }: {
    onClose: () => void;
    onCreate: (job: { name: string; schedule: string; command: string; enabled: boolean }) => void;
}) {
    const [name, setName] = useState("");
    const [schedule, setSchedule] = useState("");
    const [command, setCommand] = useState("");

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={onClose}
        >
            <div className="bg-card dark:bg-card border border-border/60 dark:border-white/[0.08] rounded-2xl w-[440px] max-w-[90vw]" style={{ boxShadow: 'var(--panel-shadow)' }} onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-border/40">
                    <h3 className="font-semibold text-foreground">创建定时任务</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-4 space-y-3">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">名称</label>
                        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="每日新闻摘要" className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">Cron 表达式</label>
                        <input value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="0 9 * * *" className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">执行命令</label>
                        <input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="send '生成摘要'" className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all" />
                    </div>
                    {/* 快捷模板 */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">快捷模板</label>
                        <div className="flex flex-wrap gap-1.5">
                            {CRON_TEMPLATES.map((tpl) => (
                                <button
                                    key={tpl.label}
                                    onClick={() => { setName(tpl.label); setSchedule(tpl.schedule); setCommand(tpl.command); }}
                                    className="px-2 py-1 rounded-lg text-[10px] font-medium bg-muted/30 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                                >
                                    {tpl.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors">
                            取消
                        </button>
                        <button
                            onClick={() => { if (name && schedule && command) onCreate({ name, schedule, command, enabled: true }); }}
                            disabled={!name || !schedule || !command}
                            className="px-4 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
                        >
                            创建
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

// ── 主页面 ──
export default function AutomationPage() {
    const {
        cronJobs,
        webhooks,
        logs,
        fetchCronJobs,
        createCronJob,
        deleteCronJob,
        toggleCronJob,
        fetchWebhooks,
        createWebhook,
        deleteWebhook,
        fetchLogs,
    } = useAutomationStore();

    const [tab, setTab] = useState<"cron" | "webhook" | "logs">("cron");
    const [showCreateCron, setShowCreateCron] = useState(false);

    useEffect(() => {
        fetchCronJobs();
        fetchWebhooks();
        fetchLogs();
    }, []);

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
                        <Timer className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-foreground">自动化</h1>
                        <p className="text-xs text-muted-foreground">
                            定时任务、Webhook 和触发器管理
                        </p>
                    </div>
                </div>
            </div>

            {/* 标签页 */}
            <div className="flex items-center gap-0.5 bg-black/[0.04] dark:bg-white/[0.04] border border-border/40 rounded-lg p-0.5 w-fit">
                {([
                    { id: "cron" as const, label: `定时任务 (${cronJobs.length})`, icon: Timer },
                    { id: "webhook" as const, label: `Webhook (${webhooks.length})`, icon: Webhook },
                    { id: "logs" as const, label: `执行日志 (${logs.length})`, icon: ScrollText },
                ]).map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                            tab === t.id ? "bg-card dark:bg-white/[0.08] text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <t.icon className="w-3.5 h-3.5" />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Cron 任务 */}
            {tab === "cron" && (
                <div className="space-y-3">
                    <div className="flex justify-end">
                        <button
                            onClick={() => setShowCreateCron(true)}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            新建任务
                        </button>
                    </div>
                    {cronJobs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50">
                            <Timer className="w-10 h-10 mb-3" />
                            <p className="text-sm font-medium">暂无定时任务</p>
                            <p className="text-xs mt-1">创建定时任务来自动执行 Agent 命令</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {cronJobs.map((job) => (
                                <CronJobCard
                                    key={job.id}
                                    job={job}
                                    onDelete={() => deleteCronJob(job.id)}
                                    onToggle={() => toggleCronJob(job.id, !job.enabled)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Webhook */}
            {tab === "webhook" && (
                <div className="space-y-3">
                    <div className="flex justify-end">
                        <button
                            onClick={() => createWebhook("新 Webhook")}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            新建 Webhook
                        </button>
                    </div>
                    {webhooks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50">
                            <Link className="w-10 h-10 mb-3" />
                            <p className="text-sm font-medium">暂无 Webhook</p>
                            <p className="text-xs mt-1">创建 Webhook 来接收外部事件触发</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {webhooks.map((wh) => (
                                <WebhookCard key={wh.id} webhook={wh} onDelete={() => deleteWebhook(wh.id)} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 执行日志 */}
            {tab === "logs" && (
                <div className="space-y-2">
                    {logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50">
                            <ScrollText className="w-10 h-10 mb-3" />
                            <p className="text-sm font-medium">暂无执行日志</p>
                            <p className="text-xs mt-1">任务执行后日志将在此显示</p>
                        </div>
                    ) : (
                        logs.map((log) => (
                            <div key={log.id} className="flex items-start gap-3 px-3 py-2.5 bg-card/60 dark:bg-card/40 border border-border/40 dark:border-white/[0.06] rounded-lg">
                                {log.status === "success" ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                ) : (
                                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-foreground">{log.name}</span>
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted/30 text-muted-foreground uppercase">{log.type}</span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{log.message}</p>
                                </div>
                                <span className="text-[10px] text-muted-foreground/60 shrink-0">{formatTime(log.time)}</span>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* 创建 Cron 对话框 */}
            <AnimatePresence>
                {showCreateCron && (
                    <CreateCronDialog
                        onClose={() => setShowCreateCron(false)}
                        onCreate={(job) => { createCronJob(job); setShowCreateCron(false); }}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    );
}
