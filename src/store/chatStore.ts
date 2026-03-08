import { create } from "zustand";
import {
    getConversations,
    createConversation as dbCreateConversation,
    deleteConversation as dbDeleteConversation,
    updateConversationTitle,
    getMessages,
    saveMessage,
    pinConversation as dbPinConversation,
    archiveConversation as dbArchiveConversation,
    searchConversations as dbSearchConversations,
} from "@/lib/db";
import { sendMessage, onStreamChunk } from "@/lib/tauri";
import { useSettingsStore } from "@/store/settingsStore";
import { PROVIDER_INFO } from "@/store/settingsStore";
import { useAgentStore } from "@/store/agentStore";

export interface Message {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: number;
    toolCalls?: import("@/lib/agent").ToolCall[];
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

interface ChatState {
    conversations: Conversation[];
    activeConversationId: string | null;
    inputValue: string;
    isGenerating: boolean;
    isInitializing: boolean;

    // Actions
    initStore: () => Promise<void>;
    setInputValue: (value: string) => void;
    setIsGenerating: (value: boolean) => void;

    // DB Actions
    createConversation: (agentId?: string) => Promise<string>;
    setActiveConversation: (id: string) => Promise<void>;
    deleteConversation: (id: string) => Promise<void>;

    addMessageToDb: (conversationId: string, role: string, content: string, images?: string[]) => Promise<void>;
    updateLocalLastAssistantMessage: (conversationId: string, content: string) => void;

    renameConversation: (id: string, newTitle: string) => Promise<void>;
    pinConversation: (id: string, pinned: boolean) => Promise<void>;
    archiveConversation: (id: string) => Promise<void>;
    searchConversations: (query: string) => Promise<Conversation[]>;
}

// ── LLM 自动标题生成 ────────────────────────────────────────
async function generateSmartTitle(conversationId: string, userMessage: string) {
    try {
        const settings = useSettingsStore.getState();
        if (!settings.apiKey || !settings.provider) return;

        const providerInfo = PROVIDER_INFO[settings.provider];
        if (!providerInfo) return;

        let generatedTitle = "";

        const unlisten = await onStreamChunk((chunk) => {
            if (chunk.done) {
                unlisten();
                // 清理标题（去掉引号和多余空白）
                const title = generatedTitle.replace(/["""'']/g, "").trim().slice(0, 20);
                if (title.length >= 2) {
                    // 更新 store 和 DB
                    updateConversationTitle(conversationId, title).catch(console.error);
                    useChatStore.setState((state) => ({
                        conversations: state.conversations.map((c) =>
                            c.id === conversationId ? { ...c, title } : c
                        ),
                    }));
                }
                return;
            }
            if (chunk.content) {
                generatedTitle += chunk.content;
            }
        });

        await sendMessage({
            messages: [
                {
                    role: "system",
                    content: "你是一个标题生成器。给用户的消息生成一个简短的中文标题，不超过15个字。只输出标题本身，不要加引号、标点或解释。",
                },
                { role: "user", content: userMessage.slice(0, 200) },
            ],
            api_key: settings.apiKey,
            provider: settings.provider,
            model: settings.model,
            temperature: 0.3,
            max_tokens: 30,
        });
    } catch (e) {
        // LLM 调用失败时静默降级（截断标题已设置）
        console.warn("标题生成失败:", e);
    }
}

export const useChatStore = create<ChatState>((set, get) => ({
    conversations: [],
    activeConversationId: null,
    inputValue: "",
    isGenerating: false,
    isInitializing: true,

    initStore: async () => {
        try {
            const dbConvs = await getConversations();
            const conversations: Conversation[] = dbConvs.map(c => ({
                id: c.id,
                title: c.title,
                agentId: c.agent_id,
                pinned: c.pinned === 1,
                archived: c.archived === 1,
                createdAt: new Date(c.created_at).getTime(),
                updatedAt: new Date(c.updated_at).getTime(),
                messages: [],
                isMessagesLoaded: false
            }));

            let activeId = null;
            if (conversations.length > 0) {
                // 默认选中最近更新的一个对话
                activeId = conversations[0].id;
                // 加载该对话的消息
                const dbMsgs = await getMessages(activeId);
                conversations[0].messages = dbMsgs.map(m => ({
                    id: m.id,
                    role: m.role as any,
                    content: m.content,
                    timestamp: new Date(m.created_at).getTime()
                }));
                conversations[0].isMessagesLoaded = true;
            }

            set({ conversations, activeConversationId: activeId, isInitializing: false });
        } catch (error) {
            console.error("Failed to init db store:", error);
            set({ isInitializing: false });
        }
    },

    setInputValue: (value) => set({ inputValue: value }),
    setIsGenerating: (value) => set({ isGenerating: value }),

    createConversation: async (optionalAgentId?: string) => {
        const agentId = optionalAgentId || useAgentStore.getState().activeAgentId;
        const dbConv = await dbCreateConversation("New Chat", agentId);
        const newConversation: Conversation = {
            id: dbConv.id,
            title: dbConv.title,
            agentId: dbConv.agent_id,
            pinned: false,
            archived: false,
            createdAt: new Date(dbConv.created_at).getTime(),
            updatedAt: new Date(dbConv.updated_at).getTime(),
            messages: [],
            isMessagesLoaded: true,
        };

        set((state) => ({
            conversations: [newConversation, ...state.conversations],
            activeConversationId: newConversation.id,
        }));

        return newConversation.id;
    },

    setActiveConversation: async (id) => {
        set({ activeConversationId: id });

        const state = get();
        const conv = state.conversations.find(c => c.id === id);

        // 如果该对话的消息还未预先加载，则从 DB 加载
        if (conv && !conv.isMessagesLoaded) {
            const dbMsgs = await getMessages(id);
            const messages: Message[] = dbMsgs.map(m => ({
                id: m.id,
                role: m.role as any,
                content: m.content,
                timestamp: new Date(m.created_at).getTime()
            }));

            set((state) => ({
                conversations: state.conversations.map(c =>
                    c.id === id ? { ...c, messages, isMessagesLoaded: true } : c
                )
            }));
        }
    },

    deleteConversation: async (id) => {
        await dbDeleteConversation(id);

        set((state) => {
            const newConvs = state.conversations.filter(c => c.id !== id);
            let activeId = state.activeConversationId;
            if (activeId === id) {
                activeId = newConvs.length > 0 ? newConvs[0].id : null;
            }
            return { conversations: newConvs, activeConversationId: activeId };
        });

        const state = get();
        if (state.activeConversationId) {
            // 如果切换了选中对话，确保加载消息
            await state.setActiveConversation(state.activeConversationId);
        }
    },

    renameConversation: async (id, newTitle) => {
        await updateConversationTitle(id, newTitle);
        set((state) => ({
            conversations: state.conversations.map(c =>
                c.id === id ? { ...c, title: newTitle, updatedAt: Date.now() } : c
            )
        }));
    },

    addMessageToDb: async (conversationId, role, content, images?) => {
        const dbMsg = await saveMessage(conversationId, role, content);
        const newMessage: Message = {
            id: dbMsg.id,
            role: dbMsg.role as any,
            content: dbMsg.content,
            timestamp: new Date(dbMsg.created_at).getTime(),
            images,
        };

        set((state) => {
            return {
                conversations: state.conversations.map((conv) => {
                    if (conv.id !== conversationId) return conv;

                    // 首条用户消息触发标题生成
                    let newTitle = conv.title;
                    if (conv.messages.length === 0 && role === "user") {
                        // 立即设置截断标题（快速反馈）
                        newTitle = content.slice(0, 30) + (content.length > 30 ? "..." : "");
                        updateConversationTitle(conversationId, newTitle).catch(console.error);

                        // 异步调用 LLM 生成更好的标题
                        generateSmartTitle(conversationId, content);
                    }

                    return {
                        ...conv,
                        messages: [...conv.messages, newMessage],
                        title: newTitle,
                        updatedAt: Date.now()
                    };
                }),
            };
        });
    },

    pinConversation: async (id, pinned) => {
        await dbPinConversation(id, pinned);
        set((state) => ({
            conversations: state.conversations.map(c =>
                c.id === id ? { ...c, pinned } : c
            ),
        }));
    },

    archiveConversation: async (id) => {
        await dbArchiveConversation(id, true);
        set((state) => {
            const newConvs = state.conversations.filter(c => c.id !== id);
            let activeId = state.activeConversationId;
            if (activeId === id) {
                activeId = newConvs.length > 0 ? newConvs[0].id : null;
            }
            return { conversations: newConvs, activeConversationId: activeId };
        });
    },

    searchConversations: async (query) => {
        const dbConvs = await dbSearchConversations(query);
        return dbConvs.map(c => ({
            id: c.id,
            title: c.title,
            agentId: c.agent_id,
            pinned: c.pinned === 1,
            archived: c.archived === 1,
            createdAt: new Date(c.created_at).getTime(),
            updatedAt: new Date(c.updated_at).getTime(),
            messages: [],
            isMessagesLoaded: false,
        }));
    },

    updateLocalLastAssistantMessage: (conversationId, content) => {
        set((state) => ({
            conversations: state.conversations.map((conv) => {
                if (conv.id !== conversationId) return conv;
                const msgs = [...conv.messages];
                const lastMsg = msgs[msgs.length - 1];
                // 仅限内存里的最后一条助手消息更新使用（例如流式吐字期间）
                // 这个时候不会保存到数据库，等流结束后才调 addMessageToDb (注意：如果在流期间不发到DB，那我们需要在开始时插入一条空的并不断更新？)
                // 或者更好的做法是：流式输出仅在前端状态变更，流结束时将整条文本 insert 进 DB
                if (lastMsg && lastMsg.role === "assistant") {
                    msgs[msgs.length - 1] = { ...lastMsg, content };
                }
                return { ...conv, messages: msgs, updatedAt: Date.now() };
            }),
        }));
    },
}));
