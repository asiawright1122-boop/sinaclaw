/**
 * OpenClaw Agent 循环引擎
 * 
 * 核心逻辑：
 * 1. 发送用户消息 + system prompt + 工具定义给 LLM
 * 2. LLM 返回 tool_calls → 自动执行工具 → 将结果追加到消息历史
 * 3. 再次发送给 LLM → 直到 LLM 返回纯文本回复（不再调用工具）
 */
import { sendMessage, onStreamChunk } from "@/lib/tauri";
import { OPENCLAW_TOOLS, executeTool } from "@/lib/tools";
import { skillManager } from "@/lib/skills";
import { useMCPStore } from "@/store/mcpStore";

// ── System Prompt ────────────────────────────────────────

// System prompt is now injected dynamically via runAgentLoop params

// ── 类型定义 ─────────────────────────────────────────────

export interface ToolCall {
    id: string;
    functionName: string;
    arguments: Record<string, unknown>;
    result?: string;
    status: "pending" | "running" | "done" | "error";
}

// 多模态内容部件
export type ContentPart =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } };

export interface AgentMessage {
    role: "user" | "assistant" | "system" | "tool";
    content: string | ContentPart[] | null;
    toolCalls?: ToolCall[];
    toolCallId?: string;
    name?: string;
}

interface StreamToolCallAccumulator {
    id: string;
    functionName: string;
    argumentsStr: string;
}

// ── Agent 循环引擎 ───────────────────────────────────────

export async function runAgentLoop(params: {
    userMessage: string;
    imageDataUrls?: string[]; // base64 data URL 图片数组
    conversationHistory: AgentMessage[];
    systemPrompt: string;
    enabledTools: string[];
    apiKey: string;
    provider: string;
    model: string;
    temperature: number;
    maxTokens: number;
    onTextChunk: (text: string) => void;
    onToolCallStart: (toolCall: ToolCall) => void;
    onToolCallResult: (toolCallId: string, result: string) => void;
    onDone: (finalContent: string) => void;
    onError: (error: string) => void;
}): Promise<void> {
    const {
        conversationHistory,
        apiKey,
        provider,
        model,
        temperature,
        maxTokens,
        onTextChunk,
        onToolCallStart,
        onToolCallResult,
        onDone,
        onError,
    } = params;

    // 对历史记录进行截断处理，防止超出上下文窗口
    // 策略：保留 System Prompt，保留最近的 MAX_HISTORY_MESSAGES 条消息
    const MAX_HISTORY_MESSAGES = 40; // 约等于 20 轮对话
    let truncatedHistory = conversationHistory;
    if (truncatedHistory.length > MAX_HISTORY_MESSAGES) {
        truncatedHistory = truncatedHistory.slice(truncatedHistory.length - MAX_HISTORY_MESSAGES);
    }

    // 组装最终消息体 (system + 截断的历史 + 当下消息)
    // 如果有图片，构建多模态 content
    let userContent: string | ContentPart[];
    if (params.imageDataUrls && params.imageDataUrls.length > 0) {
        const parts: ContentPart[] = [
            { type: "text", text: params.userMessage },
            ...params.imageDataUrls.map(url => ({
                type: "image_url" as const,
                image_url: { url },
            })),
        ];
        userContent = parts;
    } else {
        userContent = params.userMessage;
    }

    let enrichedSystemPrompt = params.systemPrompt;
    try {
        const { getAllCoreMemories } = await import("@/lib/db");
        const memories = await getAllCoreMemories();
        if (memories.length > 0) {
            const MAX_MEMORY_TOKENS = 1500;
            let memoryBlock = "\n\n## 你的长期记忆\n以下是你记住的关于用户的重要信息（按最近访问排序）：\n";
            let tokenEstimate = 0;
            for (const m of memories) {
                const line = `- [${m.category || 'custom'}] ${m.content}\n`;
                tokenEstimate += line.length / 2;
                if (tokenEstimate > MAX_MEMORY_TOKENS) break;
                memoryBlock += line;
            }
            enrichedSystemPrompt += memoryBlock;
        }
    } catch (e) {
        console.warn("记忆加载失败:", e);
    }

    const finalMessages = [
        { role: "system", content: enrichedSystemPrompt },
        ...truncatedHistory,
        { role: "user", content: userContent },
    ] as AgentMessage[];

    // Agent 循环：最多 10 轮工具调用（防止无限循环）
    const MAX_ROUNDS = 10;
    const TOOL_TIMEOUT_MS = 60_000; // 工具执行超时 60 秒

    for (let round = 0; round < MAX_ROUNDS; round++) {
        // LLM 调用（带重试）
        const result = await callLLMWithRetry({
            messages: finalMessages,
            apiKey,
            provider,
            model,
            temperature,
            maxTokens,
            enabledTools: params.enabledTools,
            onTextChunk,
            onError,
        });

        // 如果 LLM 返回纯文本（没有 tool_calls），Agent 循环结束
        if (!result.toolCalls || result.toolCalls.length === 0) {
            onDone(result.content || "");
            return;
        }

        // LLM 请求调用工具 → 自动执行
        finalMessages.push({
            role: "assistant",
            content: null,
            toolCalls: result.toolCalls,
        });

        // 逐一执行工具（带超时保护）
        for (const toolCall of result.toolCalls) {
            onToolCallStart(toolCall);
            toolCall.status = "running";

            let toolResult: string;
            try {
                // ── Multi-Agent 委派 ───────────────────────
                if (toolCall.functionName === "delegate_to_agent") {
                    const { agent_name, task: subTask } = toolCall.arguments as {
                        agent_name: string;
                        task: string;
                    };
                    // 内联执行子 Agent，收集结果
                    let subResult = "";
                    const { callLLMWithTools: subLLMCall } = await import("@/lib/agent");
                    const subResponse = await subLLMCall({
                        messages: [
                            { role: "system", content: `你是 ${agent_name}。专注完成以下任务，简洁回复结果。` },
                            { role: "user", content: subTask },
                        ],
                        apiKey,
                        provider,
                        model,
                        temperature,
                        maxTokens,
                        onTextChunk: (chunk: string) => { subResult += chunk; },
                        onError: (err: string) => { subResult = `[ERROR] 子Agent错误: ${err}`; },
                    });
                    toolResult = `[${agent_name} 回复]:\n${subResponse.content || subResult}`;
                    toolCall.status = "done";
                } else {
                    toolResult = await Promise.race([
                        executeTool(toolCall.functionName, toolCall.arguments),
                        new Promise<string>((_, reject) =>
                            setTimeout(() => reject(new Error(`⏰ 工具 ${toolCall.functionName} 执行超时 (${TOOL_TIMEOUT_MS / 1000}s)`)), TOOL_TIMEOUT_MS)
                        ),
                    ]);
                    toolCall.status = "done";
                }
            } catch (err) {
                toolResult = `[ERROR] ${err instanceof Error ? err.message : String(err)}`;
                toolCall.status = "error";
            }

            toolCall.result = toolResult;
            onToolCallResult(toolCall.id, toolResult);

            finalMessages.push({
                role: "tool",
                content: toolResult,
                toolCallId: toolCall.id,
                name: toolCall.functionName,
            });
        }
    }

    onDone("[WARN] Agent 已达到最大工具调用轮数 (10 轮)，请检查是否有异常循环。");
}

// ── LLM 调用重试（指数退避）────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // 指数退避

function isRetryableError(errorMsg: string): boolean {
    const lower = errorMsg.toLowerCase();
    // 网络错误 / 5xx / 429 速率限制可重试；4xx（认证、参数错误）不重试
    return (
        lower.includes("network") ||
        lower.includes("timeout") ||
        lower.includes("econnreset") ||
        lower.includes("econnrefused") ||
        lower.includes("fetch") ||
        lower.includes("500") ||
        lower.includes("502") ||
        lower.includes("503") ||
        lower.includes("429") ||
        lower.includes("rate limit") ||
        lower.includes("too many requests")
    );
}

export async function callLLMWithRetry(
    params: Parameters<typeof callLLMWithTools>[0]
): Promise<ReturnType<typeof callLLMWithTools> extends Promise<infer R> ? R : never> {
    let lastError = "";
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            return await callLLMWithTools(params);
        } catch (err) {
            lastError = err instanceof Error ? err.message : String(err);
            if (!isRetryableError(lastError) || attempt === MAX_RETRIES - 1) {
                break;
            }
            await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
        }
    }

    const { useSettingsStore } = await import("@/store/settingsStore");
    const settings = useSettingsStore.getState();
    if (settings.fallbackProvider && settings.fallbackModel && settings.fallbackProvider !== params.provider) {
        console.warn(`主 provider (${params.provider}) 失败，切换到 fallback (${settings.fallbackProvider})`);
        try {
            return await callLLMWithTools({
                ...params,
                provider: settings.fallbackProvider,
                model: settings.fallbackModel,
            });
        } catch (fallbackErr) {
            throw new Error(`主备均失败。主: ${lastError} | 备: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`);
        }
    }

    throw new Error(lastError);
}

// ── LLM 调用（带工具定义）────────────────────────────────

export async function callLLMWithTools(params: {
    messages: AgentMessage[];
    apiKey: string;
    provider: string;
    model: string;
    temperature: number;
    maxTokens: number;
    enabledTools?: string[];
    onTextChunk: (text: string) => void;
    onError: (error: string) => void;
}): Promise<{ content: string; toolCalls: ToolCall[] }> {
    const { messages, apiKey, provider, model, temperature, maxTokens, onTextChunk, onError } = params;

    const { getActiveToolsAsSchema } = useMCPStore.getState();
    const activeMCPTools = getActiveToolsAsSchema();
    const skillsSchema = skillManager.getSkillTools();

    // Combine built-in rules with active MCP rules & local Skills rules
    let allTools = [...OPENCLAW_TOOLS, ...activeMCPTools, ...skillsSchema];

    if (params.enabledTools && !params.enabledTools.includes("*")) {
        allTools = allTools.filter(t => params.enabledTools!.includes(t.function.name));
    }

    if (allTools.length === 0) {
        // Many models require at least one tool if tools array is passed, so we handle empty case later.
        // Actually, if enabledTools is strictly empty, we might not pass 'tools' key at all.
    }

    return new Promise(async (resolve) => {
        let fullContent = "";
        const toolCallAccumulators: Map<number, StreamToolCallAccumulator> = new Map();

        // 将 AgentMessage 转换为 Rust 后端需要的格式
        const apiMessages = messages.map((m) => {
            const msg: Record<string, unknown> = { role: m.role };

            if (m.content !== null && m.content !== undefined) {
                msg.content = m.content;
            }

            if (m.toolCalls && m.toolCalls.length > 0) {
                msg.tool_calls = m.toolCalls.map((tc) => ({
                    id: tc.id,
                    type: "function",
                    function: {
                        name: tc.functionName,
                        arguments: JSON.stringify(tc.arguments),
                    },
                }));
            }

            if (m.toolCallId) {
                msg.tool_call_id = m.toolCallId;
            }
            if (m.name) {
                msg.name = m.name;
            }

            return msg;
        });

        const unlisten = await onStreamChunk((chunk) => {
            if (chunk.done) {
                // 流结束：汇总所有 tool_calls
                const toolCalls: ToolCall[] = [];
                for (const [, acc] of toolCallAccumulators) {
                    let args: Record<string, unknown> = {};
                    try {
                        args = JSON.parse(acc.argumentsStr);
                    } catch {
                        args = { raw: acc.argumentsStr };
                    }
                    toolCalls.push({
                        id: acc.id,
                        functionName: acc.functionName,
                        arguments: args,
                        status: "pending",
                    });
                }
                unlisten();
                resolve({ content: fullContent, toolCalls });
                return;
            }

            // 处理普通文本
            if (chunk.content) {
                fullContent += chunk.content;
                onTextChunk(chunk.content);
            }

            // 处理流式 tool_calls 片段
            if (chunk.tool_calls) {
                for (let i = 0; i < chunk.tool_calls.length; i++) {
                    const tc = chunk.tool_calls[i];
                    const idx = i; // OpenAI 用 index 来标识同一个 tool_call

                    if (!toolCallAccumulators.has(idx)) {
                        toolCallAccumulators.set(idx, {
                            id: tc.id || "",
                            functionName: tc.function_name || "",
                            argumentsStr: "",
                        });
                    }

                    const acc = toolCallAccumulators.get(idx)!;
                    if (tc.id) acc.id = tc.id;
                    if (tc.function_name) acc.functionName = tc.function_name;
                    if (tc.arguments) acc.argumentsStr += tc.arguments;
                }
            }
        });

        try {
            // 热重载本地外部技能
            await skillManager.init();

            await sendMessage({
                messages: apiMessages as any,
                api_key: apiKey,
                provider,
                model,
                temperature,
                max_tokens: maxTokens,
                tools: allTools as any, // Use the filtered allTools
                tool_choice: "auto",
            });
        } catch (error) {
            unlisten();
            const errorMsg = error instanceof Error ? error.message : String(error);
            onError(errorMsg);
            resolve({ content: `[ERROR] ${errorMsg}`, toolCalls: [] });
        }
    });
}
