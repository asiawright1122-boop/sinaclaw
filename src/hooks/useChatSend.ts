import { useChatStore } from "@/store/chatStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useAgentStore } from "@/store/agentStore";
import { runAgentLoop } from "@/lib/agent";
import type { AgentMessage, ToolCall } from "@/lib/agent";
import { openclawBridge } from "@/lib/openclawBridge";
import { useTranslate } from "@/lib/i18n";
import { runDeepResearch } from "@/lib/deepResearchAgent";
import { speak, DEFAULT_VOICE_CONFIG } from "@/lib/voiceManager";

export function useChatSend() {
    const t = useTranslate();
    const {
        activeConversationId,
        createConversation,
        addMessageToDb,
        updateLocalLastAssistantMessage,
        setIsGenerating,
    } = useChatStore();

    const { apiKey, provider, model, temperature, maxTokens, enableTTS } = useSettingsStore();

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
                await runDeepResearch({
                    topic: actualTopic,
                    apiKey,
                    provider,
                    model,
                    temperature,
                    maxTokens,
                    onStateChange: (state, info) => {
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
                updateLocalLastAssistantMessage(convId!, `**[ERROR] ${t.chat.deepResearchFailed}**: ${errorMsg}`);
                setIsGenerating(false);
            }
            return;
        }

        // ================= 常规 Agent 对话路线 =================
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
                        updateLocalLastAssistantMessage(convId!, `**[ERROR] ${t.chat.gatewayError}**: ${error}`);
                        addMessageToDb(convId!, "assistant", `**[ERROR]**: ${error}`).catch(console.error);
                        setIsGenerating(false);
                    },
                }
            );

            if (!sent) {
                updateLocalLastAssistantMessage(convId!, `**[ERROR]** ${t.chat.gatewayDisconnected}`);
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

    return { handleSend };
}
