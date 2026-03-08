import { create } from "zustand";

export type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
    id: string;
    message: string;
    type: ToastType;
    createdAt: number;
}

interface ToastState {
    toasts: Toast[];
    addToast: (message: string, type?: ToastType) => void;
    removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
    toasts: [],

    addToast: (message, type = "info") => {
        const { toasts } = useToastStore.getState();
        // 如果已经有相同内容的 Toast 正在显示，则不再重复添加
        if (toasts.some(t => t.message === message)) {
            return;
        }

        const id = crypto.randomUUID();
        const toast: Toast = { id, message, type, createdAt: Date.now() };

        set((state) => ({
            toasts: [...state.toasts, toast].slice(-5), // 最多同时显示 5 条
        }));

        // 5 秒自动消失
        setTimeout(() => {
            set((state) => ({
                toasts: state.toasts.filter((t) => t.id !== id),
            }));
        }, 5000);
    },

    removeToast: (id) => {
        set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id),
        }));
    },
}));
