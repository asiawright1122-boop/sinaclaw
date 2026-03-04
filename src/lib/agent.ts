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

const OPENCLAW_SYSTEM_PROMPT = `你是 OpenClaw — 一个内置于 Sinaclaw 桌面应用的智能开发环境助手。

## 你的核心职责
你帮助用户自动检测、诊断和修复开发环境中的所有问题。你不是一个"顾问"，你是一个"工程师"——你必须自己动手解决问题。

## 行为准则
1. **永远不要让用户手动操作**。当你发现问题时，立刻用工具去修复它。
2. **先诊断后修复**。先用 detect_environment 了解环境，再用 run_command / read_file 定位问题，最后用 install_dependency / write_file 修复。
3. **自动安装缺失的依赖**。如果检测到 package.json 但 node_modules 缺失，直接运行 npm install。
4. **修复后要验证**。修复操作完成后，再次运行出错的命令确认问题已解决。
5. **简洁汇报**。修复完成后用简短的中文告诉用户做了什么、结果如何。
6. **保护用户数据**。绝不删除用户文件，写入文件前先读取确认。

## 依赖冲突修复策略
当遇到依赖冲突时，按以下优先级自动修复：

### npm/Node.js 冲突
1. **peer dependency 冲突** → 运行 \`npm install --legacy-peer-deps\`
2. **版本不兼容** → 读取 package.json，分析冲突版本，直接修改为兼容版本后重新安装
3. **依赖树重复** → 运行 \`npm dedupe\` 去重
4. **lock 文件损坏** → 删除 package-lock.json + node_modules，重新 \`npm install\`
5. **缓存污染** → 运行 \`npm cache clean --force\` 后重试
6. **全局包冲突** → 检查 \`npm ls -g --depth=0\` 并修复

### Cargo/Rust 冲突
1. **版本冲突** → 读取 Cargo.toml，调整依赖版本约束
2. **feature 冲突** → 分析错误输出，添加或移除 features
3. **编译错误** → 运行 \`cargo clean\` 后重新构建

### Python/pip 冲突
1. **版本冲突** → 创建虚拟环境隔离 \`python3 -m venv venv\`
2. **依赖不兼容** → 使用 \`pip install --upgrade\` 逐个升级冲突包

## 你可以使用的工具
- run_command: 执行任意 shell 命令
- read_file: 读取文件内容
- write_file: 写入或修改文件
- list_directory: 列出目录
- detect_environment: 检测系统环境和已安装工具
- install_dependency: 用包管理器安装依赖
- cloud_list: 列出用户网盘(Google Drive/OneDrive/Dropbox)中的文件
- cloud_download: 从网盘下载文件到本地
- cloud_upload: 将本地文件上传到网盘

## 云存储操作指南
当用户提到网盘或云端文件时：
1. 先用 cloud_list 浏览文件结构
2. 需要分析/修复文件时，先用 cloud_download 下载到本地，再用 read_file 读取
3. 修复完成后用 cloud_upload 上传回云端
4. provider 参数可选: google_drive / onedrive / dropbox

## 执行外部任务 (MCP & Skills)
除内置工具外，你还具备通过 MCP (Model Context Protocol) 插件系统、以及本地 Skills 脚本扩展能力操作外部服务（如 Notion, GitHub, Slack 等）的能力。你可以跨平台、跨应用完成用户交付的任务。

## 回复语言
始终使用**中文**回复用户。`;

// ── 类型定义 ─────────────────────────────────────────────

export interface ToolCall {
    id: string;
    functionName: string;
    arguments: Record<string, unknown>;
    result?: string;
    status: "pending" | "running" | "done" | "error";
}

export interface AgentMessage {
    role: "user" | "assistant" | "system" | "tool";
    content: string | null;
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
    conversationHistory: AgentMessage[];
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
        userMessage,
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

    // 构建消息历史（加入 system prompt）
    const messages: AgentMessage[] = [
        { role: "system", content: OPENCLAW_SYSTEM_PROMPT },
        ...conversationHistory,
        { role: "user", content: userMessage },
    ];

    // Agent 循环：最多 10 轮工具调用（防止无限循环）
    const MAX_ROUNDS = 10;
    const TOOL_TIMEOUT_MS = 60_000; // 工具执行超时 60 秒

    for (let round = 0; round < MAX_ROUNDS; round++) {
        // LLM 调用（带重试）
        const result = await callLLMWithRetry({
            messages,
            apiKey,
            provider,
            model,
            temperature,
            maxTokens,
            onTextChunk,
            onError,
        });

        // 如果 LLM 返回纯文本（没有 tool_calls），Agent 循环结束
        if (!result.toolCalls || result.toolCalls.length === 0) {
            onDone(result.content || "");
            return;
        }

        // LLM 请求调用工具 → 自动执行
        messages.push({
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
                toolResult = await Promise.race([
                    executeTool(toolCall.functionName, toolCall.arguments),
                    new Promise<string>((_, reject) =>
                        setTimeout(() => reject(new Error(`⏰ 工具 ${toolCall.functionName} 执行超时 (${TOOL_TIMEOUT_MS / 1000}s)`)), TOOL_TIMEOUT_MS)
                    ),
                ]);
                toolCall.status = "done";
            } catch (err) {
                toolResult = `❌ ${err instanceof Error ? err.message : String(err)}`;
                toolCall.status = "error";
            }

            toolCall.result = toolResult;
            onToolCallResult(toolCall.id, toolResult);

            messages.push({
                role: "tool",
                content: toolResult,
                toolCallId: toolCall.id,
                name: toolCall.functionName,
            });
        }
    }

    onDone("⚠️ Agent 已达到最大工具调用轮数 (10 轮)，请检查是否有异常循环。");
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

async function callLLMWithRetry(
    params: Parameters<typeof callLLMWithTools>[0]
): Promise<ReturnType<typeof callLLMWithTools> extends Promise<infer R> ? R : never> {
    let lastError = "";
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            return await callLLMWithTools(params);
        } catch (err) {
            lastError = err instanceof Error ? err.message : String(err);
            if (!isRetryableError(lastError) || attempt === MAX_RETRIES - 1) {
                throw err;
            }
            // 等待后重试
            await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
        }
    }
    throw new Error(lastError);
}

// ── LLM 调用（带工具定义）────────────────────────────────

async function callLLMWithTools(params: {
    messages: AgentMessage[];
    apiKey: string;
    provider: string;
    model: string;
    temperature: number;
    maxTokens: number;
    onTextChunk: (text: string) => void;
    onError: (error: string) => void;
}): Promise<{ content: string; toolCalls: ToolCall[] }> {
    const { messages, apiKey, provider, model, temperature, maxTokens, onTextChunk, onError } = params;

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
                tools: [
                    ...OPENCLAW_TOOLS,
                    ...skillManager.getSkillTools(),
                    ...useMCPStore.getState().getActiveToolsAsSchema()
                ] as any,
                tool_choice: "auto",
            });
        } catch (error) {
            unlisten();
            const errorMsg = error instanceof Error ? error.message : String(error);
            onError(errorMsg);
            resolve({ content: `❌ ${errorMsg}`, toolCalls: [] });
        }
    });
}
