import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { useToastStore, type ToastType } from "@/store/toastStore";

const ICONS: Record<ToastType, typeof Info> = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
};

const ICON_STYLES: Record<ToastType, string> = {
    success: "text-emerald-600 dark:text-emerald-400",
    error: "text-red-600 dark:text-red-400",
    warning: "text-amber-600 dark:text-amber-400",
    info: "text-blue-600 dark:text-blue-400",
};

const BAR_STYLES: Record<ToastType, string> = {
    success: "bg-emerald-500",
    error: "bg-red-500",
    warning: "bg-amber-500",
    info: "bg-blue-500",
};

export default function ToastContainer() {
    const { toasts, removeToast } = useToastStore();

    return (
        <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
            <AnimatePresence>
                {toasts.map((toast) => {
                    const Icon = ICONS[toast.type];
                    return (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, x: 80, scale: 0.95 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 80, scale: 0.95 }}
                            transition={{ type: "spring", damping: 25, stiffness: 350 }}
                            className="pointer-events-auto relative flex items-center gap-3 pl-4 pr-3 py-3.5 rounded-2xl max-w-sm overflow-hidden
                                bg-white dark:bg-stone-900
                                border border-stone-200 dark:border-stone-700/80
                                shadow-xl shadow-black/8 dark:shadow-black/40
                                text-stone-800 dark:text-stone-200"
                        >
                            {/* 左侧色条 */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${BAR_STYLES[toast.type]}`} />

                            <Icon className={`w-[18px] h-[18px] shrink-0 ${ICON_STYLES[toast.type]}`} />
                            <span className="text-[13px] font-medium leading-snug flex-1">{toast.message}</span>
                            <button
                                onClick={() => removeToast(toast.id)}
                                className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors shrink-0 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
