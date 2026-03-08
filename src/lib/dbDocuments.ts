/**
 * RAG 文档与分块 API
 */
import { getDb, type DocumentRow, type ChunkRow } from "./db";

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

    // 事务批量插入，保证原子性和性能
    await db.execute('BEGIN TRANSACTION');
    try {
        for (const chunk of chunks) {
            const id = crypto.randomUUID();
            await db.execute(
                'INSERT INTO chunks (id, doc_id, content, embedding, created_at) VALUES ($1, $2, $3, $4, $5)',
                [id, docId, chunk.content, JSON.stringify(chunk.embedding), now]
            );
        }
        await db.execute('COMMIT');
    } catch (e) {
        await db.execute('ROLLBACK');
        throw e;
    }
}

export async function getAllChunks(): Promise<ChunkRow[]> {
    const db = await getDb();
    return await db.select<ChunkRow[]>('SELECT * FROM chunks');
}
