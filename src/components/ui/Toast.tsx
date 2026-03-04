import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { useToastStore, type ToastType } from "@/store/toastStore";

const ICONS: Record<ToastType, typeof Info> = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
};

const STYLES: Record<ToastType, string> = {
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    error: "border-red-500/30 bg-red-500/10 text-red-200",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    info: "border-blue-500/30 bg-blue-500/10 text-blue-200",
};

export default function ToastContainer() {
    const { toasts, removeToast } = useToastStore();

    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
            <AnimatePresence>
                {toasts.map((toast) => {
                    const Icon = ICONS[toast.type];
                    return (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, x: 100, scale: 0.9 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 100, scale: 0.9 }}
                            transition={{ type: "spring", damping: 20, stiffness: 300 }}
                            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-lg max-w-sm ${STYLES[toast.type]}`}
                        >
                            <Icon className="w-4 h-4 shrink-0" />
                            <span className="text-sm font-medium flex-1">{toast.message}</span>
                            <button
                                onClick={() => removeToast(toast.id)}
                                className="p-0.5 rounded hover:bg-white/10 transition-colors shrink-0"
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
