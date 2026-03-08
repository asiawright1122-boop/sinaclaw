/**
 * Core Memory API
 */
import { getDb, type MemoryCategory, type MemoryRow } from "./db";

export async function appendCoreMemory(content: string, category: MemoryCategory = 'custom'): Promise<MemoryRow> {
    const db = await getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.execute(
        'INSERT INTO memories (id, content, category, last_accessed, created_at) VALUES ($1, $2, $3, $4, $5)',
        [id, content, category, now, now]
    );

    return { id, content, category, last_accessed: now, created_at: now };
}

export async function getAllCoreMemories(): Promise<MemoryRow[]> {
    const db = await getDb();
    return await db.select<MemoryRow[]>('SELECT * FROM memories ORDER BY last_accessed DESC, created_at DESC');
}

export async function getMemoriesByCategory(category: MemoryCategory): Promise<MemoryRow[]> {
    const db = await getDb();
    return await db.select<MemoryRow[]>(
        'SELECT * FROM memories WHERE category = $1 ORDER BY last_accessed DESC',
        [category]
    );
}

export async function updateMemory(id: string, content: string): Promise<void> {
    const db = await getDb();
    await db.execute(
        'UPDATE memories SET content = $1, last_accessed = $2 WHERE id = $3',
        [content, new Date().toISOString(), id]
    );
}

export async function deleteMemory(id: string): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM memories WHERE id = $1', [id]);
}

export async function touchMemory(id: string): Promise<void> {
    const db = await getDb();
    await db.execute(
        'UPDATE memories SET last_accessed = $1 WHERE id = $2',
        [new Date().toISOString(), id]
    );
}

export async function exportMemoriesAsMarkdown(): Promise<Record<string, string>> {
    const memories = await getAllCoreMemories();
    const grouped: Record<string, MemoryRow[]> = {};

    for (const m of memories) {
        const cat = m.category || 'custom';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(m);
    }

    const titles: Record<string, string> = {
        preferences: 'User Preferences',
        contacts: 'Contacts',
        projects: 'Projects',
        learnings: 'Learnings & Solutions',
        tools: 'Tools & Workflows',
        custom: 'General Notes',
    };

    const files: Record<string, string> = {};
    for (const [cat, mems] of Object.entries(grouped)) {
        let md = `## ${titles[cat] || cat}\n\n`;
        for (const m of mems) md += `- ${m.content}\n`;
        md += `\n## Updated: ${new Date().toISOString().split('T')[0]}\n`;
        files[`${cat}.md`] = md;
    }

    return files;
}
