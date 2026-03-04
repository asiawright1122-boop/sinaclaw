import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useRef, useEffect } from "react";
import { useChatStore } from "@/store/chatStore";
import { useSettingsStore } from "@/store/settingsStore";
import { runAgentLoop } from "@/lib/agent";
import type { AgentMessage, ToolCall } from "@/lib/agent";
import ChatMessage from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import ToolCallBlock from "@/components/chat/ToolCallBlock";
import { useTranslate } from "@/lib/i18n";

export default function ChatPage() {
    const t = useTranslate();
    const {
        conversations,
        activeConversationId,
        isGenerating,
        createConversation,
        addMessageToDb,
        updateLocalLastAssistantMessage,
        setIsGenerating,
        setInputValue,
    } = useChatStore();

    const { apiKey, provider, model, temperature, maxTokens } = useSettingsStore();

    const activeConversation = conversations.find((c) => c.id === activeConversationId);
    const hasMessages = activeConversation && activeConversation.messages.length > 0;
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 自动滚动到底部
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [activeConversation?.messages]);

    const handleSend = async (message: string) => {
        let convId = activeConversationId;

        // 如果没有活跃对话，先创建一个
        if (!convId) {
            convId = await createConversation();
        }

        // 添加用户消息到 DB
        await addMessageToDb(convId, "user", message);

        // 如果没有配置 API Key，使用模拟回复
        if (!apiKey) {
            setIsGenerating(true);

            const mt = t.chat.mockReply;
            const mockReply = [
                `# ${mt.title}`,
                `\n\n${mt.warning}`,
                `\n\n${mt.instruction}`,
                ...mt.features.map(f => `\n- ${f}`)
            ];

            // 先在前端添加一条空的 assistant 消息
            const state = useChatStore.getState();
            const conv = state.conversations.find(c => c.id === convId);
            if (conv) {
                const tempMsg = {
                    id: crypto.randomUUID(),
                    role: "assistant" as const,
                    content: "",
                    timestamp: Date.now(),
                };
                useChatStore.setState((s) => ({
                    conversations: s.conversations.map(c =>
                        c.id === convId ? { ...c, messages: [...c.messages, tempMsg] } : c
                    ),
                }));
            }

            let fullContent = "";
            for (const chunk of mockReply) {
                await new Promise((r) => setTimeout(r, 150 + Math.random() * 200));
                fullContent += chunk;
                updateLocalLastAssistantMessage(convId, fullContent);
            }
            await addMessageToDb(convId, "assistant", fullContent);
            setIsGenerating(false);
            return;
        }

        // ══════════════ Agent 模式 ══════════════
        setIsGenerating(true);

        // 在前端添加一条空的 assistant 消息（用于流式更新）
        const tempMsg = {
            id: crypto.randomUUID(),
            role: "assistant" as const,
            content: "",
            timestamp: Date.now(),
            toolCalls: [] as ToolCall[],
        };
        useChatStore.setState((s) => ({
            conversations: s.conversations.map(c =>
                c.id === convId ? { ...c, messages: [...c.messages, tempMsg] } : c
            ),
        }));

        // 构建历史消息
        const currentConv = useChatStore.getState().conversations.find(c => c.id === convId);
        const history: AgentMessage[] = (currentConv?.messages || [])
            .filter(m => m.content && m.id !== tempMsg.id)
            .map(m => ({
                role: m.role as AgentMessage["role"],
                content: m.content,
            }));

        let assistantContent = "";

        try {
            await runAgentLoop({
                userMessage: message,
                conversationHistory: history,
                apiKey,
                provider,
                model,
                temperature,
                maxTokens,
                onTextChunk: (text) => {
                    assistantContent += text;
                    updateLocalLastAssistantMessage(convId!, assistantContent);
                },
                onToolCallStart: (toolCall) => {
                    useChatStore.setState((s) => ({
                        conversations: s.conversations.map(c => {
                            if (c.id !== convId) return c;
                            const msgs = [...c.messages];
                            const lastMsg = msgs[msgs.length - 1];
                            if (lastMsg && lastMsg.role === "assistant") {
                                const existing = lastMsg.toolCalls || [];
                                msgs[msgs.length - 1] = {
                                    ...lastMsg,
                                    toolCalls: [...existing, toolCall],
                                };
                            }
                            return { ...c, messages: msgs };
                        }),
                    }));
                },
                onToolCallResult: (toolCallId, result) => {
                    useChatStore.setState((s) => ({
                        conversations: s.conversations.map(c => {
                            if (c.id !== convId) return c;
                            const msgs = [...c.messages];
                            const lastMsg = msgs[msgs.length - 1];
                            if (lastMsg && lastMsg.role === "assistant" && lastMsg.toolCalls) {
                                const updatedToolCalls = lastMsg.toolCalls.map(tc =>
                                    tc.id === toolCallId ? { ...tc, result, status: "done" as const } : tc
                                );
                                msgs[msgs.length - 1] = {
                                    ...lastMsg,
                                    toolCalls: updatedToolCalls,
                                };
                            }
                            return { ...c, messages: msgs };
                        }),
                    }));
                },
                onDone: async (finalContent) => {
                    const fullText = assistantContent || finalContent;
                    if (fullText) {
                        await addMessageToDb(convId!, "assistant", fullText);
                    }
                    setIsGenerating(false);
                },
                onError: (error) => {
                    updateLocalLastAssistantMessage(convId!, `❌ **错误**: ${error}`);
                    addMessageToDb(convId!, "assistant", `❌ **错误**: ${error}`).catch(console.error);
                    setIsGenerating(false);
                },
            });
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            updateLocalLastAssistantMessage(convId!, `❌ **错误**: ${errorMsg}`);
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* 消息区域 */}
            {hasMessages ? (
                <div className="flex-1 overflow-y-auto pt-6 px-4 no-scrollbar">
                    <div className="max-w-4xl mx-auto pb-6">
                        {activeConversation.messages.map((msg) => (
                            <div key={msg.id}>
                                <ChatMessage message={msg} />
                                {msg.toolCalls && msg.toolCalls.length > 0 && (
                                    <div className="ml-[72px] mr-6 mb-6">
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
                </div>
            ) : (
                <div className="flex-1 flex flex-col justify-center items-center text-center overflow-y-auto p-4 no-scrollbar">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.7, delay: 0.2, type: "spring" }}
                        className="relative mb-8 group"
                    >
                        <div className="absolute inset-0 bg-primary/30 blur-[50px] rounded-full group-hover:bg-primary/50 transition-colors duration-700" />
                        <div className="relative w-28 h-28 rounded-[2rem] bg-card/60 dark:bg-card/40 backdrop-blur-3xl flex items-center justify-center border border-white/40 dark:border-white/10 shadow-2xl overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent" />
                            <motion.div
                                animate={{ rotate: [0, 5, -5, 0] }}
                                transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                            >
                                <Sparkles className="w-12 h-12 text-primary icon-glow" />
                            </motion.div>
                        </div>
                    </motion.div>

                    <motion.h1
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="text-5xl font-black tracking-tight mb-5 bg-gradient-to-br from-foreground to-foreground/50 bg-clip-text text-transparent"
                    >
                        {t.chat.title}
                    </motion.h1>

                    <motion.p
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                        className="text-[15px] text-muted-foreground/80 max-w-md mb-8 font-medium leading-relaxed"
                    >
                        {t.chat.subtitle}
                    </motion.p>

                    {!apiKey && (
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.45 }}
                            className="mb-8 px-5 py-3.5 rounded-2xl border border-orange-500/30 bg-orange-500/10 text-orange-400 text-[13px] font-medium max-w-md shadow-sm backdrop-blur-xl"
                        >
                            {t.chat.apiKeyWarning}
                        </motion.div>
                    )}

                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.5 }}
                        className="grid grid-cols-2 gap-3 max-w-xl mx-auto mb-4 w-full px-4"
                    >
                        {[
                            { key: "diagnose", text: t.chat.suggestions.diagnose },
                            { key: "fixNpm", text: t.chat.suggestions.fixNpm },
                            { key: "setupNode", text: t.chat.suggestions.setupNode },
                            { key: "analyze", text: t.chat.suggestions.analyze },
                        ].map((s, i) => (
                            <div
                                key={i}
                                onClick={() => setInputValue(s.text)}
                                className="p-4 rounded-2xl border border-white/30 dark:border-white/5 bg-white/40 dark:bg-black/20 text-[13px] font-semibold text-foreground/70 hover:bg-white/60 dark:hover:bg-black/40 hover:text-foreground cursor-pointer transition-all duration-300 backdrop-blur-xl shadow-sm hover:shadow-md hover:-translate-y-[2px]"
                            >
                                {s.text}
                            </div>
                        ))}
                    </motion.div>
                </div>
            )}

            <ChatInput onSend={handleSend} />
        </div>
    );
}
