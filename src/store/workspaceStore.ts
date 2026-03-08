import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { load } from "@tauri-apps/plugin-store";
import { homeDir } from "@tauri-apps/api/path";

interface WorkspaceState {
    /** 当前已授权的工作目录绝对路径 */
    currentPath: string | null;
    /** 最近打开过的目录列表 */
    recentPaths: string[];
    /** 是否正在选择目录 */
    isSelecting: boolean;

    /** 弹出原生文件夹选择器并授权 */
    openFolder: () => Promise<void>;
    /** 设置工作目录（同步后端 + 持久化） */
    setWorkspace: (path: string) => Promise<void>;
    /** 关闭当前工作目录 */
    closeWorkspace: () => void;
    /** 从持久化存储中恢复上次工作目录 */
    hydrate: () => Promise<void>;
}

/** 回落到用户 Home 目录作为默认工作上下文 */
async function fallbackToHome(set: (state: Partial<WorkspaceState>) => void) {
    try {
        const home = await homeDir();
        if (home) {
            await invoke("set_workspace", { path: home });
            set({ currentPath: home });
        }
    } catch (e) {
        console.warn("设置默认 Home 目录失败:", e);
    }
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
    currentPath: null,
    recentPaths: [],
    isSelecting: false,

    openFolder: async () => {
        set({ isSelecting: true });
        try {
            // 调用 Rust 后端原生对话框（绕过前端插件 IPC 问题）
            const selected = await invoke<string | null>("pick_folder");
            if (selected) {
                // pick_folder 已在 Rust 端设置了安全边界，这里只需更新前端状态
                const recent = get().recentPaths.filter((p) => p !== selected);
                recent.unshift(selected);
                const trimmed = recent.slice(0, 10);

                set({ currentPath: selected, recentPaths: trimmed });

                // 持久化
                try {
                    const store = await load("settings.json");
                    await store.set("workspace_current", selected);
                    await store.set("workspace_recent", trimmed);
                    await store.save();
                } catch (e) {
                    console.error("持久化工作目录失败:", e);
                }
            }
        } catch (e) {
            console.error("打开文件夹失败:", e);
        } finally {
            set({ isSelecting: false });
        }
    },

    setWorkspace: async (path: string) => {
        // 通知 Rust 后端设置安全边界
        await invoke("set_workspace", { path });

        // 更新最近列表（去重 + 限制 10 条）
        const recent = get().recentPaths.filter((p) => p !== path);
        recent.unshift(path);
        const trimmed = recent.slice(0, 10);

        set({ currentPath: path, recentPaths: trimmed });

        // 持久化
        try {
            const store = await load("settings.json");
            await store.set("workspace_current", path);
            await store.set("workspace_recent", trimmed);
            await store.save();
        } catch (e) {
            console.error("持久化工作目录失败:", e);
        }
    },

    closeWorkspace: () => {
        set({ currentPath: null });
    },

    hydrate: async () => {
        try {
            const store = await load("settings.json");
            const current = await store.get<string>("workspace_current");
            const recent = await store.get<string[]>("workspace_recent");

            if (recent) set({ recentPaths: recent });

            if (current) {
                // 恢复已有工作目录
                try {
                    await invoke("set_workspace", { path: current });
                    set({ currentPath: current });
                } catch {
                    // 目录不存在了，回落到 Home
                    console.warn("上次工作目录不可用:", current);
                    await fallbackToHome(set);
                }
            } else {
                // 首次启动：默认以 Home 目录作为工作上下文
                await fallbackToHome(set);
            }
        } catch (e) {
            console.error("恢复工作目录失败:", e);
            // 即使恢复失败也尝试设置 Home
            await fallbackToHome(set);
        }
    },
}));

declare global {
    interface Window {
        useWorkspaceStore?: typeof useWorkspaceStore;
    }
}

if (import.meta.env.DEV) {
    window.useWorkspaceStore = useWorkspaceStore;
}
