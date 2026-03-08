/**
 * 云存储 IPC 桥接层
 * 
 * 前端 ↔ Rust 后端的云存储操作封装
 */
import { invoke } from "@tauri-apps/api/core";

// ── 类型定义 ─────────────────────────────────────────────

export interface CloudFile {
    id: string;
    name: string;
    mime_type: string;
    size: number;
    is_folder: boolean;
    modified_at: string;
    path: string;
    download_url: string;
}

export interface CloudAccount {
    provider: string;
    email: string;
    display_name: string;
    total_space: number;
    used_space: number;
    connected: boolean;
}

export type CloudProvider = "google_drive" | "onedrive" | "dropbox";

export const CLOUD_PROVIDERS: Record<CloudProvider, { label: string; icon: string; color: string }> = {
    google_drive: { label: "Google Drive", icon: "drive", color: "#4285F4" },
    onedrive: { label: "OneDrive", icon: "cloud", color: "#0078D4" },
    dropbox: { label: "Dropbox", icon: "box", color: "#0061FF" },
};

// ── OAuth 认证 ───────────────────────────────────────────

/** 获取 OAuth 授权 URL（后端自带凭据） */
export async function getAuthUrl(provider: CloudProvider): Promise<string> {
    return invoke<string>("cloud_auth_url", { provider });
}

/** 用授权码换取 token 并获取账户信息（兼容旧接口） */
export async function authExchange(
    provider: CloudProvider,
    _clientId: string,
    _clientSecret: string,
    code: string,
): Promise<CloudAccount> {
    return invoke<CloudAccount>("cloud_auth_exchange", {
        provider, clientId: "", clientSecret: "", code,
    });
}

/** 一键授权：打开浏览器 + 后端自动回调处理（推荐） */
export async function startAuth(provider: CloudProvider): Promise<string> {
    return invoke<string>("cloud_start_auth", { provider });
}

// ── 文件操作 ─────────────────────────────────────────────

/** 列出文件和文件夹 */
export async function listFiles(
    provider: CloudProvider,
    folderId?: string,
): Promise<CloudFile[]> {
    return invoke<CloudFile[]>("cloud_list_files", {
        provider, folderId: folderId ?? null,
    });
}

/** 下载文件到本地路径 */
export async function downloadFile(
    provider: CloudProvider,
    fileId: string,
    localPath: string,
): Promise<string> {
    return invoke<string>("cloud_download", { provider, fileId, localPath });
}

/** 上传本地文件到云端 */
export async function uploadFile(
    provider: CloudProvider,
    localPath: string,
    remoteFolderId?: string,
    fileName?: string,
): Promise<CloudFile> {
    return invoke<CloudFile>("cloud_upload", {
        provider, localPath,
        remoteFolderId: remoteFolderId ?? null,
        fileName: fileName ?? null,
    });
}

/** 删除云端文件 */
export async function deleteFile(
    provider: CloudProvider,
    fileId: string,
): Promise<string> {
    return invoke<string>("cloud_delete", { provider, fileId });
}

// ── 账户管理 ─────────────────────────────────────────────

/** 获取连接状态和配额信息 */
export async function getStatus(provider: CloudProvider): Promise<CloudAccount> {
    return invoke<CloudAccount>("cloud_get_status", { provider });
}

/** 断开连接 */
export async function disconnect(provider: CloudProvider): Promise<string> {
    return invoke<string>("cloud_disconnect", { provider });
}

// ── 工具函数 ─────────────────────────────────────────────

/** 格式化文件大小 */
export function formatSize(bytes: number): string {
    if (bytes === 0) return "—";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/** 格式化日期 */
export function formatDate(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
