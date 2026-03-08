import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, PanelRight } from "lucide-react";
import { useRef, useEffect, useState } from "react";
import { useChatStore } from "@/store/chatStore";
import { useSettingsStore } from "@/store/settingsStore";
import ChatMessage from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import ToolCallBlock from "@/components/chat/ToolCallBlock";
import ChatWelcome from "@/components/chat/ChatWelcome";
import ChatAgentPicker from "@/components/chat/ChatAgentPicker";
import ChatCanvas from "@/components/chat/ChatCanvas";
import { useTranslate } from "@/lib/i18n";
import { useChatSend } from "@/hooks/useChatSend";

export default function ChatPage() {
    const t = useTranslate();
    const {
        conversations,
        activeConversationId,
        isGenerating,
    } = useChatStore();

    const { apiKey } = useSettingsStore();
    const { handleSend } = useChatSend();

    const activeConversation = conversations.find((c) => c.id === activeConversationId);
    const hasMessages = activeConversation && activeConversation.messages.length > 0;
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const [showCanvas, setShowCanvas] = useState(false);

    // 自动滚动到底部
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [activeConversation?.messages]);

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* 顶栏 — Agent 选择器 + Canvas */}
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-border/40 shrink-0">
                <ChatAgentPicker />
                <button
                    onClick={() => setShowCanvas(!showCanvas)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${showCanvas ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.05] hover:text-foreground'}`}
                >
                    <PanelRight className="w-3.5 h-3.5" />
                    Canvas
                </button>
            </div>

            {/* 主内容区（对话 + Canvas 分屏） */}
            <div className="flex-1 flex overflow-hidden">
            <div className={`flex-1 flex flex-col overflow-hidden ${showCanvas ? 'w-1/2' : 'w-full'} transition-all duration-300`}>
            {/* 消息区域 */}
            {hasMessages ? (
                <div
                    ref={messagesContainerRef}
                    onScroll={() => {
                        const el = messagesContainerRef.current;
                        if (!el) return;
                        setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 200);
                    }}
                    className="flex-1 overflow-y-auto pt-6 px-4 no-scrollbar relative"
                >
                    <div className="max-w-4xl mx-auto pb-6">
                        {activeConversation.messages.map((msg, idx) => (
                            <div key={msg.id}>
                                <ChatMessage
                                    message={msg}
                                    onRetry={msg.role === "assistant" && !isGenerating ? () => {
                                        const prevUserMsg = [...activeConversation.messages].slice(0, idx).reverse().find(m => m.role === "user");
                                        if (prevUserMsg) handleSend(prevUserMsg.content, prevUserMsg.images);
                                    } : undefined}
                                />
                                {msg.toolCalls && msg.toolCalls.length > 0 && (
                                    <div className="ml-12 sm:ml-[72px] mr-4 sm:mr-6 mb-6">
                                        {msg.toolCalls.map((tc) => (
                                            <ToolCallBlock key={tc.id} toolCall={tc} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                        {isGenerating && <TypingIndicator />}
                        <div ref={messagesEndRef} />
                    </div>
                    <AnimatePresence>
                        {showScrollBtn && (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
                                className="sticky bottom-4 left-1/2 -translate-x-1/2 mx-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border/60 dark:border-white/[0.08] text-muted-foreground hover:text-foreground text-xs font-medium transition-colors active:scale-[0.95]"
                                style={{ boxShadow: 'var(--panel-shadow)' }}
                            >
                                <ChevronDown className="w-3.5 h-3.5" />
                                {t.chat.scrollToBottom}
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>
            ) : (
                <ChatWelcome showApiKeyWarning={!apiKey} />
            )}

            <ChatInput onSend={handleSend} />
            </div>

            {/* Canvas 侧面板 */}
            <AnimatePresence>
                {showCanvas && <ChatCanvas onClose={() => setShowCanvas(false)} />}
            </AnimatePresence>
            </div>
        </div>
    );
}
