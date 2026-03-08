/**
 * OpenClaw Agent 循环引擎
 * 
 * 核心逻辑：
 * 1. 发送用户消息 + system prompt + 工具定义给 LLM
 * 2. LLM 返回 tool_calls → 自动执行工具 → 将结果追加到消息历史
 * 3. 再次发送给 LLM → 直到 LLM 返回纯文本回复（不再调用工具）
 */
import { executeTool } from "@/lib/tools";
import * as llm from "./agentLLM";
import type { ToolCall, ContentPart, AgentMessage } from "./agentTypes";

// Re-export types and LLM functions for backward compatibility
export type { ToolCall, ContentPart, AgentMessage } from "./agentTypes";
export { callLLMWithRetry, callLLMWithTools } from "./agentLLM";

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
        const result = await llm.callLLMWithRetry({
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
