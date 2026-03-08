import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Inbox, Search } from "lucide-react";
import { useInboxStore } from "@/store/inboxStore";
import IconById from "@/components/ui/IconById";
import { useTranslate } from "@/lib/i18n";
import InboxSessionItem from "@/components/inbox/InboxSessionItem";
import InboxChatView from "@/components/inbox/InboxChatView";

export default function InboxPage() {
    const t = useTranslate();
    const {
        sessions,
        activeSessionId,
        activeMessages,
        totalUnread,
        loading,
        filter,
        setActiveSession,
        setFilter,
        sendReply,
        startListening,
    } = useInboxStore();

    const [search, setSearch] = useState("");

    useEffect(() => {
        const unlisten = startListening();
        return unlisten;
    }, []);

    const activeSession = sessions.find((s) => s.id === activeSessionId);

    // 通道过滤器列表
    const channelOptions = Array.from(new Set(sessions.map((s) => s.channel)));

    const filtered = sessions.filter((s) => {
        if (filter !== "all" && s.channel !== filter) return false;
        if (search) {
            const q = search.toLowerCase();
            return (
                s.channelUserName.toLowerCase().includes(q) ||
                s.channelUserId.toLowerCase().includes(q) ||
                s.lastMessage.toLowerCase().includes(q) ||
                s.channel.toLowerCase().includes(q)
            );
        }
        return true;
    });

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex overflow-hidden"
        >
            {/* 左侧：会话列表 */}
            <div className={`${activeSession ? "hidden md:flex" : "flex"} flex-col w-full md:w-[320px] border-r border-border/40 shrink-0`}>
                {/* 标题 */}
                <div className="px-4 pt-4 pb-2">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Inbox className="w-5 h-5 text-primary" />
                            <h1 className="text-lg font-bold text-foreground">{t.inbox.title}</h1>
                            {totalUnread > 0 && (
                                <span className="min-w-[20px] h-[20px] flex items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white px-1.5">
                                    {totalUnread > 99 ? "99+" : totalUnread}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* 搜索 */}
                    <div className="relative mb-2">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t.inbox.searchSessions}
                            className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                        />
                    </div>

                    {/* 通道筛选 */}
                    {channelOptions.length > 1 && (
                        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
                            <button
                                onClick={() => setFilter("all")}
                                className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                                    filter === "all" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/30"
                                }`}
                            >
                                {t.inbox.all}
                            </button>
                            {channelOptions.map((ch) => (
                                <button
                                    key={ch}
                                    onClick={() => setFilter(ch)}
                                    className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                                        filter === ch ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/30"
                                    }`}
                                >
                                    <IconById id={ch} size={14} />
                                    <span className="capitalize">{ch}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* 会话列表 */}
                <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
                    {loading && sessions.length === 0 ? (
                        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                            {t.inbox.loading}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
                            <Inbox className="w-8 h-8 mb-2" />
                            <p className="text-sm">{search ? t.inbox.noMatch : t.inbox.noMessages}</p>
                            <p className="text-xs mt-1">{t.inbox.channelMessagesHint}</p>
                        </div>
                    ) : (
                        filtered.map((s) => (
                            <InboxSessionItem
                                key={s.id}
                                session={s}
                                active={s.id === activeSessionId}
                                onClick={() => setActiveSession(s.id)}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* 右侧：聊天视图 */}
            <div className={`${activeSession ? "flex" : "hidden md:flex"} flex-1 flex-col min-w-0`}>
                {activeSession ? (
                    <InboxChatView
                        session={activeSession}
                        messages={activeMessages}
                        onSend={(content) => sendReply(activeSessionId!, content)}
                        onBack={() => useInboxStore.setState({ activeSessionId: null })}
                    />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/40">
                        <Inbox className="w-12 h-12 mb-3" />
                        <p className="text-sm font-medium">{t.inbox.selectSession}</p>
                        <p className="text-xs mt-1">{t.inbox.realtimeHint}</p>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
