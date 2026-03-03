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

export default function ChatPage() {
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

            const mockReply = [
                `你好！我是 OpenClaw 🦀`,
                `\n\n⚠️ **未配置 API Key**`,
                `\n\n请前往 **设置** 页面配置你的 API Key，我就可以：`,
                `\n- 🔍 自动检测你的开发环境`,
                `\n- 📦 自动安装缺失的依赖`,
                `\n- 🔧 自动修复编译错误`,
                `\n- 💡 一切全自动，你只需要看着就行！`,
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

        // 构建历史消息（转为 AgentMessage 格式）
        const currentConv = useChatStore.getState().conversations.find(c => c.id === convId);
        const history: AgentMessage[] = (currentConv?.messages || [])
            .filter(m => m.content && m.id !== tempMsg.id) // 排除空的临时消息
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
                    // 将工具调用添加到当前 assistant 消息的 toolCalls 列表
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
                    // 更新工具调用的结果
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
                    // Agent 循环结束，保存最终结果到 DB
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
        <div className="flex-1 flex flex-col h-full">
            {/* 消息区域 */}
            {hasMessages ? (
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-3xl mx-auto">
                        {activeConversation.messages.map((msg) => (
                            <div key={msg.id}>
                                <ChatMessage message={msg} />
                                {/* 渲染该消息关联的工具调用 */}
                                {msg.toolCalls && msg.toolCalls.length > 0 && (
                                    <div className="ml-12 mr-4">
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
                <div className="flex-1 flex flex-col justify-center items-center text-center">
                    {/* 欢迎界面 */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.7, delay: 0.2, type: "spring" }}
                        className="relative mb-8 group"
                    >
                        <div className="absolute inset-0 bg-primary/30 blur-[40px] rounded-full group-hover:bg-primary/50 transition-colors duration-500" />
                        <div className="relative w-24 h-24 rounded-3xl glass-panel flex items-center justify-center border border-white/20 shadow-2xl overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent" />
                            <motion.div
                                animate={{ rotate: [0, 5, -5, 0] }}
                                transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                            >
                                <Sparkles className="w-10 h-10 text-primary-foreground icon-glow" />
                            </motion.div>
                        </div>
                    </motion.div>

                    <motion.h1
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="text-4xl font-black tracking-tight mb-4"
                    >
                        OpenClaw 🦀
                    </motion.h1>

                    <motion.p
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                        className="text-lg text-muted-foreground max-w-md mb-8 font-medium"
                    >
                        智能开发环境助手 — 自动检测、诊断、修复一切问题
                    </motion.p>

                    {/* API Key 提示 */}
                    {!apiKey && (
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.45 }}
                            className="mb-6 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm max-w-md"
                        >
                            💡 前往「设置」页面配置 API Key 以启用 Agent 能力
                        </motion.div>
                    )}

                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.5 }}
                        className="flex flex-wrap gap-2 justify-center mb-4"
                    >
                        {["检查我的开发环境", "npm install 报错了", "帮我装 Node.js", "查看项目结构"].map(
                            (suggestion, i) => (
                                <span
                                    key={i}
                                    onClick={() => setInputValue(suggestion)}
                                    className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs font-medium text-muted-foreground hover:bg-white/10 hover:text-foreground cursor-pointer transition-colors backdrop-blur-sm"
                                >
                                    {suggestion}
                                </span>
                            )
                        )}
                    </motion.div>
                </div>
            )}

            {/* 输入区域始终在底部 */}
            <ChatInput onSend={handleSend} />
        </div>
    );
}
