import { useEffect, useRef, useState } from "react";
import { Send, CheckCheck, User, Bot, ChevronLeft } from "lucide-react";
import type { InboxSession, InboxMessage } from "@/store/inboxStore";
import IconById from "@/components/ui/IconById";
import { useTranslate } from "@/lib/i18n";
import { channelColor } from "./InboxSessionItem";

function MessageBubble({ msg }: { msg: InboxMessage }) {
    const isOut = msg.direction === "outgoing";
    return (
        <div className={`flex ${isOut ? "justify-end" : "justify-start"} mb-2`}>
            <div className={`flex items-end gap-2 max-w-[75%] ${isOut ? "flex-row-reverse" : ""}`}>
                {!isOut && (
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${channelColor(msg.channel)}`}>
                        <IconById id={msg.channel} size={14} />
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

interface InboxChatViewProps {
    session: InboxSession;
    messages: InboxMessage[];
    onSend: (content: string) => void;
    onBack: () => void;
}

export default function InboxChatView({ session, messages, onSend, onBack }: InboxChatViewProps) {
    const t = useTranslate();
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
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${channelColor(session.channel)}`}>
                    <IconById id={session.channel} size={18} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">
                        {session.channelUserName || session.channelUserId}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="capitalize">{session.channel}</span>
                        <span>&middot;</span>
                        <span className={`flex items-center gap-0.5 ${
                            session.status === "active" ? "text-emerald-500" :
                            session.status === "agent" ? "text-blue-500" : "text-muted-foreground"
                        }`}>
                            {session.status === "agent" ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                            {session.status === "active" ? t.inbox.active : session.status === "agent" ? t.inbox.agentHandling : t.inbox.closed}
                        </span>
                    </div>
                </div>
            </div>

            {/* 消息区 */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40 gap-1.5">
                        <Send className="w-5 h-5" />
                        <span className="text-xs font-medium">{t.inbox.noMessagesYet}</span>
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
                        placeholder={t.inbox.replyPlaceholder}
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
