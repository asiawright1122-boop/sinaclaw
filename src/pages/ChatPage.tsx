import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronDown, Settings, PanelRight, X } from "lucide-react";
import { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useChatStore } from "@/store/chatStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useAgentStore } from "@/store/agentStore";
import { runAgentLoop } from "@/lib/agent";
import type { AgentMessage, ToolCall } from "@/lib/agent";
import { openclawBridge } from "@/lib/openclawBridge";
import ChatMessage from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import ToolCallBlock from "@/components/chat/ToolCallBlock";
import { useTranslate } from "@/lib/i18n";
import { runDeepResearch } from "@/lib/deepResearchAgent";
import { speak, DEFAULT_VOICE_CONFIG } from "@/lib/voiceManager";
import AgentAvatar from "@/components/ui/AgentAvatar";

export default function ChatPage() {
    const t = useTranslate();
    const navigate = useNavigate();
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

    const { apiKey, provider, model, temperature, maxTokens, enableTTS } = useSettingsStore();

    const activeConversation = conversations.find((c) => c.id === activeConversationId);
    const hasMessages = activeConversation && activeConversation.messages.length > 0;
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const [showScrollBtn, setShowScrollBtn] = useState(false);

    // 自动滚动到底部
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [activeConversation?.messages]);

    const handleSend = async (message: string, imageDataUrls?: string[]) => {
        let convId = activeConversationId;

        // 检查是否是 deep research 指令
        const isDeepResearch = message.trim().startsWith("/research ") || message.trim().startsWith("/deep ");
        const actualTopic = isDeepResearch ? (message.startsWith("/research") ? message.slice(9).trim() : message.slice(5).trim()) : message;

        // 如果没有活跃对话，先创建一个
        if (!convId) {
            convId = await createConversation();
        }

        await addMessageToDb(convId, "user", message, imageDataUrls);

        if (!apiKey && provider !== "local") {
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
        // 获取当前会话关联的 Agent 配置
        const currentConv = useChatStore.getState().conversations.find(c => c.id === convId);
        const currentAgentId = currentConv?.agentId || useAgentStore.getState().activeAgentId;
        const currentAgent = useAgentStore.getState().agents.find(a => a.id === currentAgentId) || useAgentStore.getState().agents[0];

        const history: AgentMessage[] = (currentConv?.messages || [])
            .filter(m => m.content && m.id !== tempMsg.id)
            .map(m => ({
                role: m.role as AgentMessage["role"],
                content: m.content,
            }));

        let assistantContent = "";

        // ================= Deep Research 专用路线 =================
        if (isDeepResearch) {
            try {
                // 仅传递实际的主题过去
                await runDeepResearch({
                    topic: actualTopic,
                    apiKey,
                    provider,
                    model,
                    temperature,
                    maxTokens,
                    onStateChange: (state, info) => {
                        // 在 UI 渲染进度块
                        const iconMap: Record<string, string> = {
                            "Planning": "[Plan]", "Searching": "[Search]", "Reading": "[Read]", "Synthesizing": "[Write]", "Done": "[OK]", "Error": "[ERR]"
                        };
                        assistantContent += `> [!NOTE] ${iconMap[state] || "[...]"} **[Deep Research: ${state}]**\\n> ${info.replace(/\\n/g, "\\n> ")}\\n\\n`;
                        updateLocalLastAssistantMessage(convId!, assistantContent);
                    },
                    onTextChunk: (text) => {
                        assistantContent += text;
                        updateLocalLastAssistantMessage(convId!, assistantContent);
                    },
                    onDone: async (_finalReport) => {
                        await addMessageToDb(convId!, "assistant", assistantContent);
                        setIsGenerating(false);
                    },
                    onError: (error) => {
                        assistantContent += `\\n**[ERROR] Research Error**: ${error}`;
                        updateLocalLastAssistantMessage(convId!, assistantContent);
                        addMessageToDb(convId!, "assistant", assistantContent).catch(console.error);
                        setIsGenerating(false);
                    },
                    checkAbort: () => !useChatStore.getState().isGenerating,
                });
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                updateLocalLastAssistantMessage(convId!, `**[ERROR] 初始化深研失败**: ${errorMsg}`);
                setIsGenerating(false);
            }
            return;
        }

        // ================= 常规 Agent 对话路线 =================
        // 策略: 优先通过 OpenClaw Gateway WebSocket 路由，不可用时 fallback 到内置 agent loop
        const gatewayAvailable = openclawBridge.isConnected();

        if (gatewayAvailable) {
            // ── OpenClaw Gateway 路线 ──
            const sent = await openclawBridge.sendAgentMessage(
                message,
                {
                    onTextChunk: (text) => {
                        assistantContent += text;
                        updateLocalLastAssistantMessage(convId!, assistantContent);
                    },
                    onToolCall: (name, args) => {
                        const tc: ToolCall = {
                            id: crypto.randomUUID(),
                            functionName: name,
                            arguments: args,
                            status: "running",
                        };
                        useChatStore.setState((s) => ({
                            conversations: s.conversations.map(c => {
                                if (c.id !== convId) return c;
                                const msgs = [...c.messages];
                                const lastMsg = msgs[msgs.length - 1];
                                if (lastMsg && lastMsg.role === "assistant") {
                                    msgs[msgs.length - 1] = { ...lastMsg, toolCalls: [...(lastMsg.toolCalls || []), tc] };
                                }
                                return { ...c, messages: msgs };
                            }),
                        }));
                    },
                    onToolResult: (name, result) => {
                        useChatStore.setState((s) => ({
                            conversations: s.conversations.map(c => {
                                if (c.id !== convId) return c;
                                const msgs = [...c.messages];
                                const lastMsg = msgs[msgs.length - 1];
                                if (lastMsg?.role === "assistant" && lastMsg.toolCalls) {
                                    const pending = lastMsg.toolCalls.find(tc => tc.functionName === name && tc.status === "running");
                                    if (pending) {
                                        pending.result = result;
                                        pending.status = "done";
                                        msgs[msgs.length - 1] = { ...lastMsg, toolCalls: [...lastMsg.toolCalls] };
                                    }
                                }
                                return { ...c, messages: msgs };
                            }),
                        }));
                    },
                    onDone: async (fullText) => {
                        const text = assistantContent || fullText;
                        if (text) {
                            await addMessageToDb(convId!, "assistant", text);
                            if (enableTTS) {
                                const clean = text.replace(/[\*\#\`\~\_\>\[\]\(\)]/g, "");
                                speak(clean, DEFAULT_VOICE_CONFIG, apiKey).catch(console.error);
                            }
                        }
                        setIsGenerating(false);
                    },
                    onError: (error) => {
                        updateLocalLastAssistantMessage(convId!, `**[ERROR] Gateway 错误**: ${error}`);
                        addMessageToDb(convId!, "assistant", `**[ERROR]**: ${error}`).catch(console.error);
                        setIsGenerating(false);
                    },
                }
            );

            if (!sent) {
                updateLocalLastAssistantMessage(convId!, "**[ERROR]** Gateway 连接已断开，请检查 OpenClaw 服务状态。");
                setIsGenerating(false);
            }
        } else {
            // ── 内置 Agent Loop Fallback ──
            try {
                await runAgentLoop({
                    userMessage: message,
                    imageDataUrls,
                    conversationHistory: history,
                    systemPrompt: currentAgent.systemPrompt,
                    enabledTools: currentAgent.enabledTools,
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
                            if (enableTTS) {
                                const cleanText = fullText.replace(/[\*\#\`\~\_\>\[\]\(\)]/g, "");
                                speak(cleanText, DEFAULT_VOICE_CONFIG, apiKey).catch(console.error);
                            }
                        }
                        setIsGenerating(false);
                    },
                    onError: (error) => {
                        updateLocalLastAssistantMessage(convId!, `**[ERROR]**: ${error}`);
                        addMessageToDb(convId!, "assistant", `**[ERROR]**: ${error}`).catch(console.error);
                        setIsGenerating(false);
                    },
                });
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                updateLocalLastAssistantMessage(convId!, `**[ERROR]**: ${errorMsg}`);
                setIsGenerating(false);
            }
        }
    };

    const { agents, activeAgentId, setActiveAgent } = useAgentStore();
    const currentAgent = agents.find(a => a.id === activeAgentId) || agents[0];
    const [showAgentPicker, setShowAgentPicker] = useState(false);
    const [showCanvas, setShowCanvas] = useState(false);
    const agentPickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (agentPickerRef.current && !agentPickerRef.current.contains(e.target as Node)) {
                setShowAgentPicker(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* 顶栏 — Agent 选择器 + Canvas */}
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-border/40 shrink-0">
                <div className="relative" ref={agentPickerRef}>
                    <button
                        onClick={() => setShowAgentPicker(!showAgentPicker)}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm font-medium hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors"
                    >
                        <AgentAvatar avatar={currentAgent?.avatar || 'bot'} size={18} className="text-foreground/70" />
                        <span className="text-foreground">{currentAgent?.name || 'Sinaclaw'}</span>
                        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${showAgentPicker ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                        {showAgentPicker && (
                            <motion.div
                                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                                className="absolute top-full left-0 mt-1.5 w-64 bg-card dark:bg-card border border-border/60 dark:border-white/[0.08] rounded-xl py-1.5 z-50" style={{ boxShadow: 'var(--panel-shadow)' }}
                            >
                                <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                    切换 Agent
                                </div>
                                <div className="max-h-[300px] overflow-y-auto no-scrollbar">
                                    {agents.filter(a => a.role === 'primary').map((agent) => (
                                        <button
                                            key={agent.id}
                                            onClick={() => { setActiveAgent(agent.id); setShowAgentPicker(false); }}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                                                agent.id === activeAgentId
                                                    ? 'bg-primary/10 text-primary'
                                                    : 'text-foreground/80 hover:bg-muted/30'
                                            }`}
                                        >
                                            <AgentAvatar avatar={agent.avatar} size={18} className="text-foreground/70" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[13px] font-medium truncate">{agent.name}</div>
                                                <div className="text-[11px] text-muted-foreground truncate">{agent.description}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                <div className="border-t border-border/40 mt-1 pt-1">
                                    <button
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                                        onClick={() => { setShowAgentPicker(false); navigate("/settings?tab=agents"); }}
                                    >
                                        <Settings className="w-3.5 h-3.5" />
                                        管理 Agent →
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
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
                                滚动到底部
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>
            ) : (
                <div className="flex-1 flex flex-col justify-center items-center text-center overflow-y-auto p-4 no-scrollbar">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.7, delay: 0.2, type: "spring" }}
                        className="relative mb-8 group"
                    >
                        <div className="absolute inset-0 bg-primary/20 blur-[40px] rounded-full group-hover:bg-primary/30 transition-colors duration-700" />
                        <div className="relative w-24 h-24 rounded-3xl bg-card dark:bg-card/60 flex items-center justify-center border border-border/60 dark:border-white/[0.08] overflow-hidden" style={{ boxShadow: 'var(--panel-shadow)' }}>
                            <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent" />
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
                        className="text-4xl font-bold tracking-tight mb-4 text-foreground"
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
                            className="mb-8 px-5 py-3.5 rounded-xl border border-orange-500/30 bg-orange-500/10 text-orange-400 text-[13px] font-medium max-w-md"
                        >
                            {t.chat.apiKeyWarning}
                        </motion.div>
                    )}

                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.5 }}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto mb-4 w-full px-4"
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
                                className="p-3.5 rounded-xl border border-border/60 dark:border-white/[0.06] bg-card/60 dark:bg-white/[0.02] text-[13px] font-medium text-muted-foreground hover:bg-card dark:hover:bg-white/[0.04] hover:text-foreground cursor-pointer transition-all duration-200 hover:shadow-sm hover:-translate-y-px active:scale-[0.97]"
                            >
                                {s.text}
                            </div>
                        ))}
                    </motion.div>
                </div>
            )}

            <ChatInput onSend={handleSend} />
            </div>

            {/* Canvas 侧面板 */}
            <AnimatePresence>
                {showCanvas && (
                    <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: '50%', opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="border-l border-border/60 dark:border-white/[0.08] overflow-hidden"
                    >
                        <div className="h-full flex flex-col">
                            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 shrink-0">
                                <span className="text-sm font-medium text-foreground">Canvas</span>
                                <button
                                    onClick={() => setShowCanvas(false)}
                                    className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <iframe
                                    src="http://127.0.0.1:18789/__openclaw__/canvas/"
                                    className="w-full h-full border-0"
                                    title="Canvas"
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            </div>
        </div>
    );
}
