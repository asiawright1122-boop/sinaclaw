import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// ── 类型定义 ──────────────────────────────────────────────

export interface ChatMessage {
    role: "user" | "assistant" | "system" | "tool";
    content?: string | null | Array<Record<string, unknown>>;
    tool_calls?: unknown[];
    tool_call_id?: string;
    name?: string;
}

export interface SendMessageRequest {
    messages: ChatMessage[];
    api_key: string;
    provider: string;
    model: string;
    temperature: number;
    max_tokens: number;
    tools?: unknown[];
    tool_choice?: unknown;
}

export interface ToolCallChunk {
    id: string;
    function_name: string;
    arguments: string;
}

export interface StreamChunk {
    content: string;
    done: boolean;
    tool_calls?: ToolCallChunk[];
}

// ── IPC 封装 ─────────────────────────────────────────────

/**
 * 发送消息到 Rust 后端，通过流式事件接收 AI 回复
 */
export async function sendMessage(request: SendMessageRequest): Promise<void> {
    return invoke("send_message", { request });
}

/**
 * 监听流式 token 事件
 * @returns 取消监听的函数
 */
export async function onStreamChunk(
    callback: (chunk: StreamChunk) => void
): Promise<UnlistenFn> {
    return listen<StreamChunk>("chat-stream", (event) => {
        callback(event.payload);
    });
}
