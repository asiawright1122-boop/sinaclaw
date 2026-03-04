/**
 * 全局云存储状态管理
 * 
 * 使用 Zustand store 保持云盘连接状态，页面切换不会丢失
 */
import { create } from "zustand";
import {
    type CloudProvider,
    type CloudAccount,
    CLOUD_PROVIDERS,
    getStatus,
    startAuth,
    disconnect as cloudDisconnect,
} from "@/lib/cloud";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";

interface CloudState {
    accounts: Record<string, CloudAccount | null>;
    loading: boolean;
    error: string;

    // Actions
    initCloudAccounts: () => Promise<void>;
    connectProvider: (provider: CloudProvider) => Promise<void>;
    disconnectProvider: (provider: CloudProvider) => Promise<void>;
    setAccount: (provider: CloudProvider, account: CloudAccount) => void;
    setError: (error: string) => void;
}

export const useCloudStore = create<CloudState>((set) => ({
    accounts: {
        google_drive: null,
        onedrive: null,
        dropbox: null,
    },
    loading: false,
    error: "",

    // 从后端恢复已连接的云盘状态
    initCloudAccounts: async () => {
        const restored: Record<string, CloudAccount | null> = {
            google_drive: null,
            onedrive: null,
            dropbox: null,
        };

        for (const provider of Object.keys(CLOUD_PROVIDERS) as CloudProvider[]) {
            try {
                const acc = await getStatus(provider);
                if (acc && acc.connected) {
                    restored[provider] = acc;
                }
            } catch {
                // 未连接，忽略
            }
        }

        set({ accounts: restored });

        // 监听后端 OAuth 回调完成事件
        listen<CloudAccount>("cloud-auth-complete", (event) => {
            const account = event.payload;
            const provider = account.provider as CloudProvider;
            set((state) => ({
                accounts: { ...state.accounts, [provider]: account },
                loading: false,
                error: "",
            }));
        });

        listen<string>("cloud-auth-error", (event) => {
            set({ loading: false, error: event.payload });
        });
    },

    // 一键连接：打开浏览器 + 后端自动回调
    connectProvider: async (provider: CloudProvider) => {
        set({ loading: true, error: "" });
        try {
            const url = await startAuth(provider);
            await openUrl(url);
            // 等待后端回调完成（通过 cloud-auth-complete 事件通知）
        } catch (err) {
            set({ loading: false, error: String(err) });
        }
    },

    // 断开连接
    disconnectProvider: async (provider: CloudProvider) => {
        try {
            await cloudDisconnect(provider);
            set((state) => ({
                accounts: { ...state.accounts, [provider]: null },
            }));
        } catch (err) {
            console.error("断开失败:", err);
        }
    },

    setAccount: (provider, account) => {
        set((state) => ({
            accounts: { ...state.accounts, [provider]: account },
        }));
    },

    setError: (error) => set({ error }),
}));
