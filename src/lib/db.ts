import Database from '@tauri-apps/plugin-sql';

export interface Conversation {
    id: string;
    title: string;
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

let dbInstance: Database | null = null;

async function getDb(): Promise<Database> {
    if (!dbInstance) {
        dbInstance = await Database.load('sqlite:chat.db');

        // 初始化所有表结构
        await dbInstance.execute(`
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
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
        `);
    }
    return dbInstance;
}

// ── Conversations API ──────────────────────────────────────

export async function getConversations(): Promise<Conversation[]> {
    const db = await getDb();
    return await db.select<Conversation[]>('SELECT * FROM conversations ORDER BY updated_at DESC');
}

export async function createConversation(title: string = "新对话"): Promise<Conversation> {
    const db = await getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.execute(
        'INSERT INTO conversations (id, title, created_at, updated_at) VALUES ($1, $2, $3, $4)',
        [id, title, now, now]
    );

    return { id, title, created_at: now, updated_at: now };
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

export async function getDocuments(): Promise<DocumentRow[]> {
    const db = await getDb();
    return await db.select<DocumentRow[]>('SELECT * FROM documents ORDER BY created_at DESC');
}

export async function saveDocument(name: string, type: string, size: number): Promise<DocumentRow> {
    const db = await getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.execute(
        'INSERT INTO documents (id, name, type, size, created_at) VALUES ($1, $2, $3, $4, $5)',
        [id, name, type, size, now]
    );

    return { id, name, type, size, created_at: now };
}

export async function deleteDocument(id: string): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM documents WHERE id = $1', [id]);
}

export async function saveChunks(docId: string, chunks: { content: string; embedding: number[] }[]): Promise<void> {
    const db = await getDb();
    const now = new Date().toISOString();

    // 批量插入块 (SQLite 对语句长度有限制，可优化为事务)
    for (const chunk of chunks) {
        const id = crypto.randomUUID();
        await db.execute(
            'INSERT INTO chunks (id, doc_id, content, embedding, created_at) VALUES ($1, $2, $3, $4, $5)',
            [id, docId, chunk.content, JSON.stringify(chunk.embedding), now]
        );
    }
}

export async function getAllChunks(): Promise<ChunkRow[]> {
    const db = await getDb();
    return await db.select<ChunkRow[]>('SELECT * FROM chunks');
}

