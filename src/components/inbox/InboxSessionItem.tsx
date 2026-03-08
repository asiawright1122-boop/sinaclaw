import type { InboxSession } from "@/store/inboxStore";
import IconById from "@/components/ui/IconById";
import { useTranslate } from "@/lib/i18n";

function channelColor(channel: string): string {
    const map: Record<string, string> = {
        whatsapp: "bg-green-500/15 text-green-600 dark:text-green-400",
        telegram: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
        discord: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
        slack: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
        imessage: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
        bluebubbles: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
        feishu: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
        line: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
        webchat: "bg-gray-500/15 text-gray-600 dark:text-gray-400",
    };
    return map[channel] || "bg-gray-500/15 text-gray-600 dark:text-gray-400";
}

function formatTime(ts: number, t: ReturnType<typeof useTranslate>): string {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 60_000) return t.inbox.justNow;
    if (diffMs < 3600_000) return t.inbox.minutesAgo.replace('{n}', String(Math.floor(diffMs / 60_000)));
    if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return t.inbox.yesterday;
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

interface InboxSessionItemProps {
    session: InboxSession;
    active: boolean;
    onClick: () => void;
}

export { channelColor };

export default function InboxSessionItem({ session, active, onClick }: InboxSessionItemProps) {
    const t = useTranslate();
    return (
        <button
            onClick={onClick}
            className={`w-full text-left px-3 py-3 rounded-xl transition-all ${
                active
                    ? "bg-primary/10 border border-primary/20"
                    : "hover:bg-muted/30 border border-transparent"
            }`}
        >
            <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${channelColor(session.channel)}`}>
                    <IconById id={session.channel} size={18} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground truncate">
                            {session.channelUserName || session.channelUserId || session.channel}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                            {formatTime(session.lastMessageAt, t)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                        <span className="text-xs text-muted-foreground truncate">{session.lastMessage}</span>
                        {session.unreadCount > 0 && (
                            <span className="ml-2 shrink-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white px-1">
                                {session.unreadCount > 99 ? "99+" : session.unreadCount}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </button>
    );
}
