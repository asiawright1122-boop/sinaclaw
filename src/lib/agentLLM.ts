/**
 * OpenClaw LLM 调用层（带重试 + 流式解析）
 */
import { sendMessage, onStreamChunk, type ChatMessage as TauriChatMessage } from "@/lib/tauri";
import { OPENCLAW_TOOLS } from "@/lib/tools";
import { skillManager } from "@/lib/skills";
import { useMCPStore } from "@/store/mcpStore";
import type { ToolCall, AgentMessage, StreamToolCallAccumulator } from "./agentTypes";

// ── LLM 调用重试（指数退避）────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // 指数退避

function isRetryableError(errorMsg: string): boolean {
    const lower = errorMsg.toLowerCase();
    // 网络错误 / 5xx / 429 速率限制可重试；4xx（认证、参数错误）不重试
    return (
        lower.includes("network") ||
        lower.includes("timeout") ||
        lower.includes("unavailable") ||
        lower.includes("bad gateway") ||
        lower.includes("protocol error") ||
        lower.includes("unexpected eof") ||
        lower.includes(" eof") ||
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
            params.onError(`主备均失败。主: ${lastError} | 备: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`);
            throw new Error(`主备均失败。主: ${lastError} | 备: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`);
        }
    }

    params.onError(lastError);
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
    const { messages, apiKey, provider, model, temperature, maxTokens, onTextChunk } = params;

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

    return new Promise(async (resolve, reject) => {
        let fullContent = "";
        const toolCallAccumulators: Map<number, StreamToolCallAccumulator> = new Map();

        // 将 AgentMessage 转换为 Rust 后端需要的格式
        const apiMessages: TauriChatMessage[] = messages.map((m) => {
            const msg: TauriChatMessage = { role: m.role };

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
                messages: apiMessages,
                api_key: apiKey,
                provider,
                model,
                temperature,
                max_tokens: maxTokens,
                tools: allTools,
                tool_choice: "auto",
            });
        } catch (error) {
            unlisten();
            const errorMsg = error instanceof Error ? error.message : String(error);
            reject(new Error(errorMsg));
        }
    });
}
