/**
 * OpenClaw Agent 类型定义
 */

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

export interface StreamToolCallAccumulator {
    id: string;
    functionName: string;
    argumentsStr: string;
}
