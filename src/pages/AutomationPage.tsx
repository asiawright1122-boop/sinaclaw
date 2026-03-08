import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Timer, Webhook, Plus, Link,
    AlertCircle, CheckCircle2, ScrollText,
} from "lucide-react";
import { useAutomationStore } from "@/store/automationStore";
import { useTranslate } from "@/lib/i18n";
import CronJobCard from "@/components/automation/CronJobCard";
import WebhookCard from "@/components/automation/WebhookCard";
import CreateCronDialog from "@/components/automation/CreateCronDialog";

function formatTime(ts?: number): string {
    if (!ts) return "\u2014";
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
    }
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" }) + " " +
        d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function AutomationPage() {
    const t = useTranslate();
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
                        <h1 className="text-lg font-semibold text-foreground">{t.automation.title}</h1>
                        <p className="text-xs text-muted-foreground">
                            {t.automation.subtitle}
                        </p>
                    </div>
                </div>
            </div>

            {/* 标签页 */}
            <div className="flex items-center gap-0.5 bg-black/[0.04] dark:bg-white/[0.04] border border-border/40 rounded-lg p-0.5 w-fit">
                {([
                    { id: "cron" as const, label: `${t.automation.tabCron} (${cronJobs.length})`, icon: Timer },
                    { id: "webhook" as const, label: `${t.automation.tabWebhook} (${webhooks.length})`, icon: Webhook },
                    { id: "logs" as const, label: `${t.automation.tabLogs} (${logs.length})`, icon: ScrollText },
                ]).map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setTab(item.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                            tab === item.id ? "bg-card dark:bg-white/[0.08] text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <item.icon className="w-3.5 h-3.5" />
                        {item.label}
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
                            {t.automation.createCron}
                        </button>
                    </div>
                    {cronJobs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50">
                            <Timer className="w-10 h-10 mb-3" />
                            <p className="text-sm font-medium">{t.automation.emptyCron}</p>
                            <p className="text-xs mt-1">{t.automation.emptyCronDesc}</p>
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
                            onClick={() => createWebhook("New Webhook")}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            {t.automation.createWebhook}
                        </button>
                    </div>
                    {webhooks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50">
                            <Link className="w-10 h-10 mb-3" />
                            <p className="text-sm font-medium">{t.automation.emptyWebhook}</p>
                            <p className="text-xs mt-1">{t.automation.emptyWebhookDesc}</p>
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
                            <p className="text-sm font-medium">{t.automation.emptyLogs}</p>
                            <p className="text-xs mt-1">{t.automation.emptyLogsDesc}</p>
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
