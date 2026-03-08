/**
 * 访问控制模块 — 多用户权限管理
 *
 * 核心能力：
 * 1. 用户角色定义（admin / operator / viewer）
 * 2. 通道访问控制
 * 3. Agent 使用权限
 */

import Database from "@tauri-apps/plugin-sql";

// ── 类型定义 ──

export type UserRole = "admin" | "operator" | "viewer";

export interface UserProfile {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    allowedChannels: string[]; // 空数组 = 全部通道
    allowedAgents: string[];   // 空数组 = 全部 Agent
    createdAt: number;
    lastLogin?: number;
}

export const ROLE_PERMISSIONS: Record<UserRole, {
    label: string;
    description: string;
    canManageUsers: boolean;
    canManageGateway: boolean;
    canManageChannels: boolean;
    canManageAgents: boolean;
    canChat: boolean;
    canViewAudit: boolean;
    canExportData: boolean;
}> = {
    admin: {
        label: "Admin",
        description: "Full control permissions",
        canManageUsers: true,
        canManageGateway: true,
        canManageChannels: true,
        canManageAgents: true,
        canChat: true,
        canViewAudit: true,
        canExportData: true,
    },
    operator: {
        label: "Operator",
        description: "Manage channels and Agents, cannot manage users",
        canManageUsers: false,
        canManageGateway: false,
        canManageChannels: true,
        canManageAgents: true,
        canChat: true,
        canViewAudit: false,
        canExportData: false,
    },
    viewer: {
        label: "Viewer",
        description: "Read-only access, can chat",
        canManageUsers: false,
        canManageGateway: false,
        canManageChannels: false,
        canManageAgents: false,
        canChat: true,
        canViewAudit: false,
        canExportData: false,
    },
};

// ── DB 操作 ──

let dbInstance: Database | null = null;
async function getDb(): Promise<Database> {
    if (!dbInstance) dbInstance = await Database.load("sqlite:chat.db");
    return dbInstance;
}

async function ensureTable(): Promise<void> {
    const db = await getDb();
    await db.execute(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT 'viewer',
        allowed_channels TEXT NOT NULL DEFAULT '[]',
        allowed_agents TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_login TEXT
    )`);
}

function parseUser(row: Record<string, unknown>): UserProfile {
    let allowedChannels: string[] = [];
    let allowedAgents: string[] = [];
    try { allowedChannels = JSON.parse((row.allowed_channels as string) || "[]"); } catch {}
    try { allowedAgents = JSON.parse((row.allowed_agents as string) || "[]"); } catch {}
    return {
        id: row.id as string,
        name: row.name as string,
        email: (row.email as string) || "",
        role: (row.role as UserRole) || "viewer",
        allowedChannels,
        allowedAgents,
        createdAt: new Date((row.created_at as string) || "").getTime(),
        lastLogin: row.last_login ? new Date(row.last_login as string).getTime() : undefined,
    };
}

export async function listUsers(): Promise<UserProfile[]> {
    await ensureTable();
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
        "SELECT * FROM users ORDER BY created_at ASC"
    );
    return rows.map(parseUser);
}

export async function createUser(user: Omit<UserProfile, "id" | "createdAt" | "lastLogin">): Promise<UserProfile> {
    await ensureTable();
    const db = await getDb();
    const id = crypto.randomUUID();
    await db.execute(
        `INSERT INTO users (id, name, email, role, allowed_channels, allowed_agents) VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, user.name, user.email, user.role, JSON.stringify(user.allowedChannels), JSON.stringify(user.allowedAgents)]
    );
    return { ...user, id, createdAt: Date.now() };
}

export async function updateUser(id: string, updates: Partial<Omit<UserProfile, "id" | "createdAt">>): Promise<void> {
    await ensureTable();
    const db = await getDb();
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (updates.name !== undefined) { sets.push(`name = $${idx++}`); vals.push(updates.name); }
    if (updates.email !== undefined) { sets.push(`email = $${idx++}`); vals.push(updates.email); }
    if (updates.role !== undefined) { sets.push(`role = $${idx++}`); vals.push(updates.role); }
    if (updates.allowedChannels !== undefined) { sets.push(`allowed_channels = $${idx++}`); vals.push(JSON.stringify(updates.allowedChannels)); }
    if (updates.allowedAgents !== undefined) { sets.push(`allowed_agents = $${idx++}`); vals.push(JSON.stringify(updates.allowedAgents)); }
    if (sets.length === 0) return;
    vals.push(id);
    await db.execute(`UPDATE users SET ${sets.join(", ")} WHERE id = $${idx}`, vals);
}

export async function deleteUser(id: string): Promise<void> {
    await ensureTable();
    const db = await getDb();
    await db.execute("DELETE FROM users WHERE id = $1", [id]);
}

// ── 权限检查 ──

export function canAccessChannel(user: UserProfile, channelName: string): boolean {
    if (user.role === "admin") return true;
    if (user.allowedChannels.length === 0) return true;
    return user.allowedChannels.includes(channelName);
}

export function canUseAgent(user: UserProfile, agentId: string): boolean {
    if (user.role === "admin") return true;
    if (user.allowedAgents.length === 0) return true;
    return user.allowedAgents.includes(agentId);
}

export function hasPermission(user: UserProfile, permission: keyof typeof ROLE_PERMISSIONS.admin): boolean {
    return ROLE_PERMISSIONS[user.role][permission] as boolean;
}
