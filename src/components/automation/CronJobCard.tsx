import { Timer, Pause, Play, Trash2, Clock } from "lucide-react";
import type { CronJob } from "@/store/automationStore";
import { useTranslate } from "@/lib/i18n";

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

interface CronJobCardProps {
    job: CronJob;
    onDelete: () => void;
    onToggle: () => void;
}

export default function CronJobCard({ job, onDelete, onToggle }: CronJobCardProps) {
    const t = useTranslate();
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
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-medium animate-pulse">{t.automation.running}</span>
                            )}
                            {job.status === "error" && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 font-medium">{t.automation.error}</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                            <code className="px-1 py-0.5 bg-muted/30 rounded font-mono">{job.schedule}</code>
                            <span className="truncate">{job.command}</span>
                        </div>
                        {job.lastRun && (
                            <div className="text-[10px] text-muted-foreground/60 mt-1 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {t.automation.lastRun.replace('{time}', formatTime(job.lastRun))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title={job.enabled ? t.automation.pause : t.automation.enable}>
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
