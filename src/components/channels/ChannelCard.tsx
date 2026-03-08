import { motion } from "framer-motion";
import { ChevronRight, Clock, ArrowDownUp, MessageSquare } from "lucide-react";
import type { ChannelDef, ChannelInstance, ChannelStatus } from "@/store/channelStore";
import IconById from "@/components/ui/IconById";
import { useTranslate } from "@/lib/i18n";

function StatusDot({ status }: { status: ChannelStatus }) {
    const cls = {
        connected: "bg-emerald-500",
        disconnected: "bg-gray-400",
        error: "bg-red-500",
        unknown: "bg-gray-300",
    }[status];
    return <span className={`w-2 h-2 rounded-full ${cls} ${status === "connected" ? "animate-pulse" : ""}`} />;
}

function formatTimeAgo(ts: number | undefined, t: ReturnType<typeof useTranslate>): string {
    if (!ts) return "—";
    const diff = Date.now() - ts;
    if (diff < 60_000) return t.channels.justNow;
    if (diff < 3600_000) return t.channels.minutesAgo.replace('{n}', String(Math.floor(diff / 60_000)));
    if (diff < 86400_000) return t.channels.hoursAgo.replace('{n}', String(Math.floor(diff / 3600_000)));
    return t.channels.daysAgo.replace('{n}', String(Math.floor(diff / 86400_000)));
}

interface ChannelCardProps {
    def: ChannelDef;
    instance?: ChannelInstance;
    onClick: () => void;
}

export default function ChannelCard({ def, instance, onClick }: ChannelCardProps) {
    const t = useTranslate();
    const channelDesc = t.channelDesc as Record<string, string>;
    const status = instance?.status ?? "disconnected";
    const totalMsgs = (instance?.messageCountIn ?? 0) + (instance?.messageCountOut ?? 0);
    return (
        <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={onClick}
            className="w-full text-left bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-4 hover:border-primary/20 transition-all duration-150 group" style={{ boxShadow: 'var(--panel-shadow)' }}
        >
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/[0.06] dark:bg-primary/10 border border-border/40 flex items-center justify-center shrink-0">
                        <IconById id={def.icon} size={20} className="text-foreground/70" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground">{def.name}</span>
                            <StatusDot status={status} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{channelDesc[def.id] || def.description}</p>
                    </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0 mt-1" />
            </div>
            {instance && status === "connected" && (
                <div className="flex items-center gap-4 mt-2.5 ml-11 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTimeAgo(instance.lastActive, t)}</span>
                    <span className="flex items-center gap-1"><ArrowDownUp className="w-3 h-3" />{instance.messageCountIn}↓ {instance.messageCountOut}↑</span>
                    {totalMsgs > 0 && <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{t.channels.totalMsgs.replace('{count}', String(totalMsgs))}</span>}
                </div>
            )}
        </motion.button>
    );
}
