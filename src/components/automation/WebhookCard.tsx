import { useState } from "react";
import { Link, Copy, CheckCircle2, Trash2 } from "lucide-react";
import type { Webhook as WebhookType } from "@/store/automationStore";
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

interface WebhookCardProps {
    webhook: WebhookType;
    onDelete: () => void;
}

export default function WebhookCard({ webhook, onDelete }: WebhookCardProps) {
    const t = useTranslate();
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
                            <button onClick={copyUrl} className="p-0.5 text-muted-foreground hover:text-foreground transition-colors" title={t.automation.copyUrl}>
                                {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground/60">
                            <span>{t.automation.requestCount.replace('{count}', String(webhook.requestCount))}</span>
                            {webhook.lastTriggered && <span>{t.automation.recentTrigger.replace('{time}', formatTime(webhook.lastTriggered))}</span>}
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
