import Database from '@tauri-apps/plugin-sql';

export interface Conversation {
    id: string;
    title: string;
    agent_id: string;
    pinned: number;
    archived: number;
    created_at: string;
    updated_at: string;
}

export interface MessageRow {
    id: string;
    conversation_id: string;
    role: string;
    content: string;
    created_at: string;
}

// ── RAG 相关类型 ──────────────────────────────────────────

export interface DocumentRow {
    id: string;
    name: string;
    type: string;
    size: number;
    created_at: string;
}

export interface ChunkRow {
    id: string;
    doc_id: string;
    content: string;
    embedding: string; // JSON 序列化的 number[]
    created_at: string;
}

// ── Core Memory 相关类型 ──────────────────────────────────────────

export type MemoryCategory = 'preferences' | 'contacts' | 'projects' | 'learnings' | 'tools' | 'custom';

export interface MemoryRow {
    id: string;
    content: string;
    category: MemoryCategory;
    last_accessed: string;
    created_at: string;
}

let dbInstance: Database | null = null;
let dbPromise: Promise<Database> | null = null;

export async function getDb(): Promise<Database> {
    if (dbInstance) return dbInstance;

    if (!dbPromise) {
        dbPromise = (async () => {
            const db = await Database.load('sqlite:chat.db');

            // 初始化所有表结构
            await db.execute(`
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    agent_id TEXT DEFAULT 'default-sinaclaw',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL,
                    size INTEGER NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS chunks (
                    id TEXT PRIMARY KEY,
                    doc_id TEXT NOT NULL,
                    content TEXT NOT NULL,
                    embedding TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (doc_id) REFERENCES documents (id) ON DELETE CASCADE
                );
                CREATE TABLE IF NOT EXISTS memories (
                    id TEXT PRIMARY KEY,
                    content TEXT NOT NULL,
                    category TEXT DEFAULT 'custom',
                    last_accessed TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
            `);

            // Database migrations
            try {
                await db.execute(`ALTER TABLE conversations ADD COLUMN agent_id TEXT DEFAULT 'default-sinaclaw';`);
            } catch (_e) {
                // Error means column already exists
            }
            try {
                await db.execute(`ALTER TABLE memories ADD COLUMN category TEXT DEFAULT 'custom';`);
            } catch (_e) {}
            try {
                await db.execute(`ALTER TABLE memories ADD COLUMN last_accessed TEXT DEFAULT '';`);
            } catch (_e) {}
            try {
                await db.execute(`ALTER TABLE conversations ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;`);
            } catch (_e) {}
            try {
                await db.execute(`ALTER TABLE conversations ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;`);
            } catch (_e) {}

            dbInstance = db;
            return db;
        })();
    }

    return dbPromise;
}

// ── Conversations API ──────────────────────────────────────

export async function getConversations(): Promise<Conversation[]> {
    const db = await getDb();
    return await db.select<Conversation[]>('SELECT * FROM conversations WHERE archived = 0 ORDER BY pinned DESC, updated_at DESC');
}

export async function getArchivedConversations(): Promise<Conversation[]> {
    const db = await getDb();
    return await db.select<Conversation[]>('SELECT * FROM conversations WHERE archived = 1 ORDER BY updated_at DESC');
}

export async function pinConversation(id: string, pinned: boolean): Promise<void> {
    const db = await getDb();
    await db.execute('UPDATE conversations SET pinned = $1 WHERE id = $2', [pinned ? 1 : 0, id]);
}

export async function archiveConversation(id: string, archived: boolean): Promise<void> {
    const db = await getDb();
    await db.execute('UPDATE conversations SET archived = $1 WHERE id = $2', [archived ? 1 : 0, id]);
}

export async function searchConversations(query: string): Promise<Conversation[]> {
    const db = await getDb();
    const pattern = `%${query}%`;
    return await db.select<Conversation[]>(
        `SELECT DISTINCT c.* FROM conversations c
         LEFT JOIN messages m ON m.conversation_id = c.id
         WHERE c.archived = 0 AND (c.title LIKE $1 OR m.content LIKE $1)
         ORDER BY c.pinned DESC, c.updated_at DESC
         LIMIT 50`,
        [pattern]
    );
}

export async function createConversation(title: string = "新对话", agentId: string = "default-sinaclaw"): Promise<Conversation> {
    const db = await getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.execute(
        'INSERT INTO conversations (id, title, agent_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
        [id, title, agentId, now, now]
    );

    return { id, title, agent_id: agentId, pinned: 0, archived: 0, created_at: now, updated_at: now };
}

export async function updateConversationTitle(id: string, title: string): Promise<void> {
    const db = await getDb();
    await db.execute(
        'UPDATE conversations SET title = $1, updated_at = $2 WHERE id = $3',
        [title, new Date().toISOString(), id]
    );
}

export async function deleteConversation(id: string): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM conversations WHERE id = $1', [id]);
}

export async function touchConversation(id: string): Promise<void> {
    const db = await getDb();
    await db.execute(
        'UPDATE conversations SET updated_at = $1 WHERE id = $2',
        [new Date().toISOString(), id]
    );
}

// ── Messages API ──────────────────────────────────────────

export async function getMessages(conversationId: string): Promise<MessageRow[]> {
    const db = await getDb();
    return await db.select<MessageRow[]>(
        'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
        [conversationId]
    );
}

export async function saveMessage(conversationId: string, role: string, content: string): Promise<MessageRow> {
    const db = await getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.execute(
        'INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES ($1, $2, $3, $4, $5)',
        [id, conversationId, role, content, now]
    );

    // 更新所属对话的 updated_at 时间
    await touchConversation(conversationId);

    return { id, conversation_id: conversationId, role, content, created_at: now };
}

// 清除当前对话的所有消息 (仅清空内容，不删除对话本身)
export async function clearMessages(conversationId: string): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM messages WHERE conversation_id = $1', [conversationId]);
}

// ── RAG API (文档与块) ──────────────────────────────────────
export { getDocuments, saveDocument, deleteDocument, saveChunks, getAllChunks } from "./dbDocuments";

// ── Core Memory API ───────────────────────────────────────
export { appendCoreMemory, getAllCoreMemories, getMemoriesByCategory, updateMemory, deleteMemory, touchMemory, exportMemoriesAsMarkdown } from "./dbMemories";

