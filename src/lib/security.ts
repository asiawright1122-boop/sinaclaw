/**
 * 安全管理模块
 *
 * 核心能力：
 * 1. API Key 加密存储（AES-GCM via Web Crypto）
 * 2. Gateway Token 管理
 * 3. 审计日志记录
 * 4. GDPR 数据导出/删除
 */

import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";

// ── 加密存储 ──

const ENCRYPTION_ALGO = "AES-GCM";
const KEY_USAGE: KeyUsage[] = ["encrypt", "decrypt"];

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const rawKey = enc.encode(password);
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        rawKey.buffer as ArrayBuffer,
        "PBKDF2",
        false,
        ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: salt.buffer as ArrayBuffer, iterations: 100_000, hash: "SHA-256" },
        keyMaterial,
        { name: ENCRYPTION_ALGO, length: 256 },
        false,
        KEY_USAGE
    );
}

export async function encryptString(plaintext: string, password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const enc = new TextEncoder();
    const ciphertext = await crypto.subtle.encrypt(
        { name: ENCRYPTION_ALGO, iv },
        key,
        enc.encode(plaintext)
    );
    // 拼接: salt(16) + iv(12) + ciphertext
    const result = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(new Uint8Array(ciphertext), salt.length + iv.length);
    return btoa(String.fromCharCode(...result));
}

export async function decryptString(encoded: string, password: string): Promise<string> {
    const data = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
    const salt = data.slice(0, 16);
    const iv = data.slice(16, 28);
    const ciphertext = data.slice(28);
    const key = await deriveKey(password, salt);
    const plainBuffer = await crypto.subtle.decrypt(
        { name: ENCRYPTION_ALGO, iv },
        key,
        ciphertext
    );
    return new TextDecoder().decode(plainBuffer);
}

// ── Gateway Token 管理 ──

export interface GatewayToken {
    id: string;
    name: string;
    token: string;
    permissions: string[]; // "read" | "write" | "admin"
    createdAt: number;
    lastUsed?: number;
    expiresAt?: number;
}

export async function listGatewayTokens(): Promise<GatewayToken[]> {
    try {
        const result = await invoke<string>("gateway_list_tokens");
        return JSON.parse(result);
    } catch {
        return [];
    }
}

export async function createGatewayToken(
    name: string,
    permissions: string[],
    expiresInDays?: number
): Promise<GatewayToken> {
    const result = await invoke<string>("gateway_create_token", {
        name,
        permissions,
        expiresInDays: expiresInDays ?? null,
    });
    return JSON.parse(result);
}

export async function revokeGatewayToken(tokenId: string): Promise<void> {
    await invoke("gateway_revoke_token", { tokenId });
}

// ── 审计日志 ──

export type AuditAction =
    | "login"
    | "api_key_changed"
    | "api_key_viewed"
    | "agent_activated"
    | "channel_connected"
    | "channel_disconnected"
    | "data_exported"
    | "data_deleted"
    | "token_created"
    | "token_revoked"
    | "settings_changed"
    | "skill_installed"
    | "model_pulled"
    | "backup_created"
    | "backup_restored";

export interface AuditEntry {
    id: string;
    action: AuditAction;
    detail: string;
    timestamp: number;
    ip?: string;
}

let auditDb: Database | null = null;

async function getAuditDb(): Promise<Database> {
    if (!auditDb) auditDb = await Database.load("sqlite:chat.db");
    return auditDb;
}

async function ensureAuditTable(): Promise<void> {
    const db = await getAuditDb();
    await db.execute(`CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        detail TEXT NOT NULL DEFAULT '',
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(timestamp DESC)`);
}

export async function logAudit(action: AuditAction, detail: string = ""): Promise<void> {
    try {
        await ensureAuditTable();
        const db = await getAuditDb();
        await db.execute(
            "INSERT INTO audit_log (id, action, detail) VALUES ($1, $2, $3)",
            [crypto.randomUUID(), action, detail]
        );
    } catch (err) {
        console.error("[Audit] 记录失败:", err);
    }
}

export async function getAuditLog(limit: number = 100): Promise<AuditEntry[]> {
    try {
        await ensureAuditTable();
        const db = await getAuditDb();
        const rows = await db.select<Record<string, unknown>[]>(
            "SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT $1",
            [limit]
        );
        return rows.map((r) => ({
            id: r.id as string,
            action: r.action as AuditAction,
            detail: (r.detail as string) || "",
            timestamp: new Date((r.timestamp as string) || "").getTime(),
        }));
    } catch {
        return [];
    }
}

// ── GDPR: 数据导出 ──

export interface ExportData {
    conversations: unknown[];
    agents: unknown[];
    settings: Record<string, unknown>;
    inboxSessions: unknown[];
    knowledgeDocs: unknown[];
    auditLog: AuditEntry[];
    exportedAt: string;
}

export async function exportAllData(): Promise<ExportData> {
    const db = await getAuditDb();

    const conversations = await db.select<Record<string, unknown>[]>(
        "SELECT * FROM conversations ORDER BY updated_at DESC"
    ).catch(() => []);

    const messages = await db.select<Record<string, unknown>[]>(
        "SELECT * FROM messages ORDER BY created_at DESC"
    ).catch(() => []);

    const inboxSessions = await db.select<Record<string, unknown>[]>(
        "SELECT * FROM inbox_sessions ORDER BY last_message_at DESC"
    ).catch(() => []);

    const inboxMessages = await db.select<Record<string, unknown>[]>(
        "SELECT * FROM inbox_messages ORDER BY created_at DESC"
    ).catch(() => []);

    const documents = await db.select<Record<string, unknown>[]>(
        "SELECT id, name, type, size, created_at FROM documents ORDER BY created_at DESC"
    ).catch(() => []);

    const auditLog = await getAuditLog(500);

    await logAudit("data_exported", "Full GDPR export");

    return {
        conversations: conversations.map((c) => ({
            ...c,
            messages: messages.filter((m) => m.conversation_id === c.id),
        })),
        agents: [], // agentStore 数据在 localStorage，非 DB
        settings: {},
        inboxSessions: inboxSessions.map((s) => ({
            ...s,
            messages: inboxMessages.filter((m) => m.session_id === s.id),
        })),
        knowledgeDocs: documents,
        auditLog,
        exportedAt: new Date().toISOString(),
    };
}

// ── GDPR: 数据删除 ──

export async function deleteAllData(): Promise<void> {
    const db = await getAuditDb();

    await logAudit("data_deleted", "Full GDPR deletion requested");

    const tables = [
        "messages",
        "conversations",
        "inbox_messages",
        "inbox_sessions",
        "usage_records",
        "audit_log",
        "documents",
        "document_chunks",
    ];

    for (const table of tables) {
        try {
            await db.execute(`DELETE FROM ${table}`);
        } catch {
            // 表可能不存在
        }
    }

    // 清除 localStorage
    try {
        localStorage.clear();
    } catch {}
}
