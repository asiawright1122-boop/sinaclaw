import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
    Inbox,
    Send,
    Search,
    CheckCheck,
    User,
    Bot,
    ChevronLeft,
} from "lucide-react";
import { useInboxStore, type InboxSession, type InboxMessage } from "@/store/inboxStore";
import { CHANNEL_DEFINITIONS } from "@/store/channelStore";

const CHANNEL_ICON: Record<string, string> = {};
CHANNEL_DEFINITIONS.forEach((d) => { CHANNEL_ICON[d.id] = d.icon; });

function channelIcon(channel: string): string {
    return CHANNEL_ICON[channel] || "💬";
}

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

function formatTime(ts: number): string {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 60_000) return "刚刚";
    if (diffMs < 3600_000) return `${Math.floor(diffMs / 60_000)}分钟前`;
    if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "昨天";
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

/* ── 会话列表项 ── */
function SessionItem({
    session,
    active,
    onClick,
}: {
    session: InboxSession;
    active: boolean;
    onClick: () => void;
}) {
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
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${channelColor(session.channel)}`}>
                    {channelIcon(session.channel)}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground truncate">
                            {session.channelUserName || session.channelUserId || session.channel}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                            {formatTime(session.lastMessageAt)}
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

/* ── 消息气泡 ── */
function MessageBubble({ msg }: { msg: InboxMessage }) {
    const isOut = msg.direction === "outgoing";
    return (
        <div className={`flex ${isOut ? "justify-end" : "justify-start"} mb-2`}>
            <div className={`flex items-end gap-2 max-w-[75%] ${isOut ? "flex-row-reverse" : ""}`}>
                {!isOut && (
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 ${channelColor(msg.channel)}`}>
                        {channelIcon(msg.channel)}
                    </div>
                )}
                <div
                    className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                        isOut
                            ? "bg-primary text-white rounded-br-md"
                            : "bg-card/80 dark:bg-card/60 border border-border/40 dark:border-white/[0.06] text-foreground rounded-bl-md"
                    }`}
                >
                    {!isOut && msg.channelUserName && (
                        <div className="text-[10px] font-medium text-muted-foreground mb-0.5">
                            {msg.channelUserName}
                        </div>
                    )}
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    <div className={`flex items-center gap-1 mt-1 ${isOut ? "justify-end" : ""}`}>
                        <span className={`text-[10px] ${isOut ? "text-white/60" : "text-muted-foreground/60"}`}>
                            {new Date(msg.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}
                        </span>
                        {isOut && <CheckCheck className="w-3 h-3 text-white/60" />}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── 聊天视图 ── */
function ChatView({
    session,
    messages,
    onSend,
    onBack,
}: {
    session: InboxSession;
    messages: InboxMessage[];
    onSend: (content: string) => void;
    onBack: () => void;
}) {
    const [input, setInput] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = () => {
        if (!input.trim()) return;
        onSend(input.trim());
        setInput("");
    };

    return (
        <div className="flex flex-col h-full">
            {/* 头部 */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
                <button onClick={onBack} className="md:hidden p-1 rounded-lg hover:bg-muted/50 text-muted-foreground">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base ${channelColor(session.channel)}`}>
                    {channelIcon(session.channel)}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">
                        {session.channelUserName || session.channelUserId}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="capitalize">{session.channel}</span>
                        <span>·</span>
                        <span className={`flex items-center gap-0.5 ${
                            session.status === "active" ? "text-emerald-500" :
                            session.status === "agent" ? "text-blue-500" : "text-muted-foreground"
                        }`}>
                            {session.status === "agent" ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                            {session.status === "active" ? "活跃" : session.status === "agent" ? "Agent 处理中" : "已关闭"}
                        </span>
                    </div>
                </div>
            </div>

            {/* 消息区 */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40 gap-1.5">
                        <Send className="w-5 h-5" />
                        <span className="text-xs font-medium">暂无消息</span>
                    </div>
                ) : (
                    messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
                )}
            </div>

            {/* 输入框 */}
            <div className="px-4 py-3 border-t border-border/40">
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        placeholder="输入回复..."
                        className="flex-1 bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim()}
                        className="p-2.5 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-40 transition-colors"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ── 主页面 ── */
export default function InboxPage() {
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
                            <h1 className="text-lg font-bold text-foreground">收件箱</h1>
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
                            placeholder="搜索会话..."
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
                                全部
                            </button>
                            {channelOptions.map((ch) => (
                                <button
                                    key={ch}
                                    onClick={() => setFilter(ch)}
                                    className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                                        filter === ch ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/30"
                                    }`}
                                >
                                    <span>{channelIcon(ch)}</span>
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
                            加载中...
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
                            <Inbox className="w-8 h-8 mb-2" />
                            <p className="text-sm">{search ? "未找到匹配会话" : "暂无消息"}</p>
                            <p className="text-xs mt-1">通道消息将在此处显示</p>
                        </div>
                    ) : (
                        filtered.map((s) => (
                            <SessionItem
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
                    <ChatView
                        session={activeSession}
                        messages={activeMessages}
                        onSend={(content) => sendReply(activeSessionId!, content)}
                        onBack={() => useInboxStore.setState({ activeSessionId: null })}
                    />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/40">
                        <Inbox className="w-12 h-12 mb-3" />
                        <p className="text-sm font-medium">选择一个会话开始回复</p>
                        <p className="text-xs mt-1">来自各通道的消息将实时显示</p>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
