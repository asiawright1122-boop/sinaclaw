import { useTranslate } from "@/lib/i18n";

interface GatewayStatusBadgeProps {
    running: boolean;
    loading: boolean;
}

export default function GatewayStatusBadge({ running, loading }: GatewayStatusBadgeProps) {
    const t = useTranslate();
    if (loading) {
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                {t.gateway.processing}
            </span>
        );
    }
    if (running) {
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {t.gateway.running}
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            {t.gateway.stopped}
        </span>
    );
}
