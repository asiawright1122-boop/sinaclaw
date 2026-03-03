import { create } from "zustand";
import {
    getConversations,
    createConversation as dbCreateConversation,
    deleteConversation as dbDeleteConversation,
    updateConversationTitle,
    getMessages,
    saveMessage
} from "@/lib/db";

export interface Message {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: number;
    toolCalls?: import("@/lib/agent").ToolCall[];
}

export interface Conversation {
    id: string;
    title: string;
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
    createConversation: () => Promise<string>;
    setActiveConversation: (id: string) => Promise<void>;
    deleteConversation: (id: string) => Promise<void>;

    addMessageToDb: (conversationId: string, role: string, content: string) => Promise<void>;
    updateLocalLastAssistantMessage: (conversationId: string, content: string) => void;

    renameConversation: (id: string, newTitle: string) => Promise<void>;
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

    createConversation: async () => {
        const dbConv = await dbCreateConversation("新对话");
        const newConversation: Conversation = {
            id: dbConv.id,
            title: dbConv.title,
            createdAt: new Date(dbConv.created_at).getTime(),
            updatedAt: new Date(dbConv.updated_at).getTime(),
            messages: [],
            isMessagesLoaded: true, // 新对话肯定是空的，无需再次加载
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

    addMessageToDb: async (conversationId, role, content) => {
        const dbMsg = await saveMessage(conversationId, role, content);
        const newMessage: Message = {
            id: dbMsg.id,
            role: dbMsg.role as any,
            content: dbMsg.content,
            timestamp: new Date(dbMsg.created_at).getTime()
        };

        set((state) => {
            return {
                conversations: state.conversations.map((conv) => {
                    if (conv.id !== conversationId) return conv;

                    // 自动重命名由于首个用户消息触发
                    let newTitle = conv.title;
                    if (conv.messages.length === 0 && role === "user") {
                        newTitle = content.slice(0, 30) + (content.length > 30 ? "..." : "");
                        // 触发异步更新DB title (这里不 await 以免阻塞UI)
                        updateConversationTitle(conversationId, newTitle).catch(console.error);
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
