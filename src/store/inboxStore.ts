import { create } from "zustand";
import { openclawBridge, type GatewayEvent } from "@/lib/openclawBridge";
import Database from "@tauri-apps/plugin-sql";

export interface InboxMessage {
    id: string;
    channel: string;
    channelUserId: string;
    channelUserName: string;
    direction: "incoming" | "outgoing";
    content: string;
    contentType: "text" | "image" | "file" | "audio" | "sticker";
    metadata: Record<string, unknown>;
    sessionId: string;
    isRead: boolean;
    createdAt: number;
}

export interface InboxSession {
    id: string;
    channel: string;
    channelUserId: string;
    channelUserName: string;
    lastMessage: string;
    lastMessageAt: number;
    unreadCount: number;
    status: "active" | "agent" | "closed";
    createdAt: number;
}

interface InboxState {
    sessions: InboxSession[];
    activeSessionId: string | null;
    activeMessages: InboxMessage[];
    totalUnread: number;
    loading: boolean;
    filter: "all" | string; // "all" 或通道名

    loadSessions: () => Promise<void>;
    setActiveSession: (id: string) => Promise<void>;
    setFilter: (filter: string) => void;
    sendReply: (sessionId: string, content: string) => Promise<void>;
    markSessionRead: (sessionId: string) => Promise<void>;
    startListening: () => () => void;
}

let dbInstance: Database | null = null;

async function getDb(): Promise<Database> {
    if (!dbInstance) {
        dbInstance = await Database.load("sqlite:chat.db");
    }
    return dbInstance;
}

function parseSession(row: Record<string, unknown>): InboxSession {
    return {
        id: row.id as string,
        channel: row.channel as string,
        channelUserId: (row.channel_user_id as string) || "",
        channelUserName: (row.channel_user_name as string) || "",
        lastMessage: (row.last_message as string) || "",
        lastMessageAt: new Date((row.last_message_at as string) || "").getTime(),
        unreadCount: (row.unread_count as number) || 0,
        status: (row.status as InboxSession["status"]) || "active",
        createdAt: new Date((row.created_at as string) || "").getTime(),
    };
}

function parseMessage(row: Record<string, unknown>): InboxMessage {
    let metadata: Record<string, unknown> = {};
    try {
        metadata = JSON.parse((row.metadata as string) || "{}");
    } catch {}
    return {
        id: row.id as string,
        channel: row.channel as string,
        channelUserId: (row.channel_user_id as string) || "",
        channelUserName: (row.channel_user_name as string) || "",
        direction: (row.direction as "incoming" | "outgoing") || "incoming",
        content: (row.content as string) || "",
        contentType: (row.content_type as InboxMessage["contentType"]) || "text",
        metadata,
        sessionId: (row.session_id as string) || "",
        isRead: (row.is_read as number) === 1,
        createdAt: new Date((row.created_at as string) || "").getTime(),
    };
}

export const useInboxStore = create<InboxState>((set, get) => ({
    sessions: [],
    activeSessionId: null,
    activeMessages: [],
    totalUnread: 0,
    loading: false,
    filter: "all",

    loadSessions: async () => {
        set({ loading: true });
        try {
            const db = await getDb();
            // 确保表存在
            await db.execute(`CREATE TABLE IF NOT EXISTS inbox_sessions (
                id TEXT PRIMARY KEY, channel TEXT NOT NULL,
                channel_user_id TEXT NOT NULL DEFAULT '', channel_user_name TEXT NOT NULL DEFAULT '',
                last_message TEXT DEFAULT '', last_message_at TEXT NOT NULL DEFAULT (datetime('now')),
                unread_count INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )`);
            await db.execute(`CREATE TABLE IF NOT EXISTS inbox_messages (
                id TEXT PRIMARY KEY, channel TEXT NOT NULL,
                channel_user_id TEXT NOT NULL DEFAULT '', channel_user_name TEXT NOT NULL DEFAULT '',
                direction TEXT NOT NULL DEFAULT 'incoming', content TEXT NOT NULL,
                content_type TEXT NOT NULL DEFAULT 'text', metadata TEXT DEFAULT '{}',
                session_id TEXT NOT NULL DEFAULT '', is_read INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )`);

            const rows = await db.select<Record<string, unknown>[]>(
                "SELECT * FROM inbox_sessions ORDER BY last_message_at DESC"
            );
            const sessions = rows.map(parseSession);
            const totalUnread = sessions.reduce((sum, s) => sum + s.unreadCount, 0);
            set({ sessions, totalUnread, loading: false });
        } catch (err) {
            console.error("[Inbox] 加载会话失败:", err);
            set({ loading: false });
        }
    },

    setActiveSession: async (id: string) => {
        set({ activeSessionId: id, loading: true });
        try {
            const db = await getDb();
            const rows = await db.select<Record<string, unknown>[]>(
                "SELECT * FROM inbox_messages WHERE session_id = $1 ORDER BY created_at ASC",
                [id]
            );
            set({ activeMessages: rows.map(parseMessage), loading: false });
            // 自动标记已读
            await get().markSessionRead(id);
        } catch (err) {
            console.error("[Inbox] 加载消息失败:", err);
            set({ loading: false });
        }
    },

    setFilter: (filter: string) => set({ filter }),

    sendReply: async (sessionId: string, content: string) => {
        const session = get().sessions.find((s) => s.id === sessionId);
        if (!session) return;

        // 通过 Gateway WS 发送
        const sent = openclawBridge.sendChannelMessage(
            session.channel,
            session.channelUserId,
            content
        );
        if (!sent) {
            console.warn("[Inbox] Gateway 未连接，无法发送");
            return;
        }

        // 本地持久化
        const db = await getDb();
        const msgId = crypto.randomUUID();
        const now = new Date().toISOString();
        await db.execute(
            `INSERT INTO inbox_messages (id, channel, channel_user_id, channel_user_name, direction, content, session_id, is_read, created_at)
             VALUES ($1, $2, $3, $4, 'outgoing', $5, $6, 1, $7)`,
            [msgId, session.channel, session.channelUserId, session.channelUserName, content, sessionId, now]
        );
        await db.execute(
            "UPDATE inbox_sessions SET last_message = $1, last_message_at = $2 WHERE id = $3",
            [content, now, sessionId]
        );

        const newMsg: InboxMessage = {
            id: msgId,
            channel: session.channel,
            channelUserId: session.channelUserId,
            channelUserName: session.channelUserName,
            direction: "outgoing",
            content,
            contentType: "text",
            metadata: {},
            sessionId,
            isRead: true,
            createdAt: Date.now(),
        };

        set((state) => ({
            activeMessages: state.activeSessionId === sessionId
                ? [...state.activeMessages, newMsg]
                : state.activeMessages,
            sessions: state.sessions.map((s) =>
                s.id === sessionId
                    ? { ...s, lastMessage: content, lastMessageAt: Date.now() }
                    : s
            ),
        }));
    },

    markSessionRead: async (sessionId: string) => {
        try {
            const db = await getDb();
            await db.execute(
                "UPDATE inbox_messages SET is_read = 1 WHERE session_id = $1 AND is_read = 0",
                [sessionId]
            );
            await db.execute(
                "UPDATE inbox_sessions SET unread_count = 0 WHERE id = $1",
                [sessionId]
            );
            set((state) => ({
                sessions: state.sessions.map((s) =>
                    s.id === sessionId ? { ...s, unreadCount: 0 } : s
                ),
                totalUnread: state.sessions
                    .filter((s) => s.id !== sessionId)
                    .reduce((sum, s) => sum + s.unreadCount, 0),
            }));
        } catch (err) {
            console.error("[Inbox] 标记已读失败:", err);
        }
    },

    startListening: () => {
        const handleEvent = async (event: GatewayEvent) => {
            // Gateway 的通道消息事件
            if (event.type === "chat.message" || event.type === "message.received") {
                const p = event.payload;
                const channel = (p.channel as string) || "unknown";
                const userId = (p.userId as string) || (p.from as string) || "";
                const userName = (p.userName as string) || (p.fromName as string) || userId;
                const content = (p.text as string) || (p.content as string) || (p.message as string) || "";
                const contentType = (p.type as string) || "text";
                const sessionId = (p.sessionId as string) || `${channel}:${userId}`;

                const db = await getDb();
                const now = new Date().toISOString();
                const msgId = crypto.randomUUID();

                // 确保会话存在
                const existingSessions = await db.select<Record<string, unknown>[]>(
                    "SELECT id FROM inbox_sessions WHERE id = $1",
                    [sessionId]
                );
                if (existingSessions.length === 0) {
                    await db.execute(
                        `INSERT INTO inbox_sessions (id, channel, channel_user_id, channel_user_name, last_message, last_message_at, unread_count, status, created_at)
                         VALUES ($1, $2, $3, $4, $5, $6, 1, 'active', $6)`,
                        [sessionId, channel, userId, userName, content, now]
                    );
                } else {
                    await db.execute(
                        "UPDATE inbox_sessions SET last_message = $1, last_message_at = $2, unread_count = unread_count + 1, channel_user_name = $3 WHERE id = $4",
                        [content, now, userName, sessionId]
                    );
                }

                // 存储消息
                await db.execute(
                    `INSERT INTO inbox_messages (id, channel, channel_user_id, channel_user_name, direction, content, content_type, session_id, created_at)
                     VALUES ($1, $2, $3, $4, 'incoming', $5, $6, $7, $8)`,
                    [msgId, channel, userId, userName, content, contentType, sessionId, now]
                );

                // 更新 store
                await get().loadSessions();
                if (get().activeSessionId === sessionId) {
                    const newMsg: InboxMessage = {
                        id: msgId, channel, channelUserId: userId, channelUserName: userName,
                        direction: "incoming", content, contentType: contentType as InboxMessage["contentType"],
                        metadata: {}, sessionId, isRead: false, createdAt: Date.now(),
                    };
                    set((state) => ({
                        activeMessages: [...state.activeMessages, newMsg],
                    }));
                }
            }
        };

        const unlisten = openclawBridge.onEvent(handleEvent);
        // 首次加载
        get().loadSessions();
        return unlisten;
    },
}));
