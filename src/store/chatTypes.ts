/**
 * Chat Store 类型定义
 */
import type { ToolCall } from "@/lib/agent";

export interface Message {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: number;
    toolCalls?: ToolCall[];
    agentName?: string;   // Multi-Agent: 发送此消息的 Agent 名称
    agentAvatar?: string; // Multi-Agent: Agent 头像 emoji
    images?: string[];
}

export interface Conversation {
    id: string;
    title: string;
    agentId: string;
    pinned: boolean;
    archived: boolean;
    messages: Message[];
    createdAt: number;
    updatedAt: number;
    isMessagesLoaded: boolean;
}

export function toMessageRole(role: string): Message["role"] {
    if (role === "user" || role === "assistant" || role === "system") {
        return role;
    }
    return "assistant";
}
