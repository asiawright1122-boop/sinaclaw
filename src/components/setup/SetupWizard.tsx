import { motion, AnimatePresence } from "framer-motion";
import { Shield, CheckCircle, XCircle, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { runEnvironmentScan, type ScanItem } from "@/lib/scanner";

interface SetupWizardProps {
    onComplete: () => void;
}

export default function SetupWizard({ onComplete }: SetupWizardProps) {
    const [items, setItems] = useState<ScanItem[]>([]);
    const [phase, setPhase] = useState<"scanning" | "done" | "error">("scanning");

    useEffect(() => {
        let cancelled = false;

        async function scan() {
            try {
                const scanResult = await runEnvironmentScan((updatedItems) => {
                    if (!cancelled) setItems([...updatedItems]);
                });
                if (!cancelled) {
                    setPhase(scanResult.hasRequired ? "done" : "error");

                    // 只要内置引擎存在，1 秒后自动进入主界面
                    if (scanResult.hasRequired) {
                        setTimeout(() => {
                            if (!cancelled) onComplete();
                        }, 1000);
                    }
                }
            } catch {
                if (!cancelled) setPhase("error");
            }
        }

        scan();
        return () => { cancelled = true; };
    }, [onComplete]);

    const statusIcon = (item: ScanItem) => {
        switch (item.status) {
            case "checking":
                return <Loader2 className="w-4 h-4 animate-spin text-blue-400" />;
            case "installed":
                return <CheckCircle className="w-4 h-4 text-emerald-400" />;
            case "installed_now":
                return <CheckCircle className="w-4 h-4 text-cyan-400" />;
            case "missing":
            case "failed":
                return <XCircle className="w-4 h-4 text-red-400" />;
        }
    };

    const statusText = (item: ScanItem) => {
        switch (item.status) {
            case "checking": return "初始化中...";
            case "installed": return `就绪 (${item.version})`;
            case "failed": return "初始化失败";
            default: return "";
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4, type: "spring" }}
                className="w-[480px] glass-panel rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
            >
                {/* 头部 */}
                <div className="px-6 pt-6 pb-4 text-center">
                    <motion.div
                        animate={{ rotate: phase === "scanning" ? [0, 10, -10, 0] : 0 }}
                        transition={{ repeat: phase === "scanning" ? Infinity : 0, duration: 2 }}
                        className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/30 border border-white/10 mb-4"
                    >
                        {phase === "done" ? (
                            <Sparkles className="w-8 h-8 text-emerald-400" />
                        ) : (
                            <Shield className="w-8 h-8 text-primary-foreground" />
                        )}
                    </motion.div>

                    <h2 className="text-xl font-bold tracking-tight mb-1">
                        {phase === "scanning" && "🚀 初始化引擎..."}
                        {phase === "done" && "✅ 启动就绪！"}
                        {phase === "error" && "⚠️ 内部引擎异常"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {phase === "scanning" && "正在加载 Sinaclaw 内置运行环境"}
                        {phase === "done" && "即将进入系统"}
                        {phase === "error" && "内部引擎加载失败，可能是解压或系统兼容性问题"}
                    </p>
                </div>

                {/* 检测项列表 */}
                <div className="px-6 pb-4">
                    <div className="space-y-1.5">
                        <AnimatePresence>
                            {items.map((item, index) => (
                                <motion.div
                                    key={item.name}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${item.status === "installed_now"
                                        ? "bg-cyan-500/10 border border-cyan-500/20"
                                        : item.status === "installing"
                                            ? "bg-amber-500/10 border border-amber-500/20"
                                            : item.status === "failed"
                                                ? "bg-red-500/10 border border-red-500/20"
                                                : "bg-white/5 border border-transparent"
                                        }`}
                                >
                                    {/* 工具图标 */}
                                    <span className="text-base w-6 text-center">{item.icon}</span>

                                    {/* 标签 */}
                                    <span className="text-sm font-medium text-foreground/80 w-20">
                                        {item.label}
                                    </span>

                                    {/* 必需标识 */}
                                    {item.required && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary-foreground/70 font-bold uppercase tracking-wider">
                                            必需
                                        </span>
                                    )}

                                    {/* 弹性间距 */}
                                    <span className="flex-1" />

                                    {/* 版本/状态文字 */}
                                    <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
                                        {statusText(item)}
                                    </span>

                                    {/* 状态图标 */}
                                    {statusIcon(item)}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>

                {/* 底部操作 */}
                <div className="px-6 pb-6">
                    {phase === "done" && (
                        <motion.button
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            onClick={onComplete}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-semibold text-sm hover:opacity-90 transition-opacity cursor-pointer"
                        >
                            开始使用 OpenClaw 🦀
                        </motion.button>
                    )}
                    {phase === "error" && (
                        <motion.button
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            onClick={onComplete}
                            className="w-full py-3 rounded-xl bg-white/10 border border-white/10 text-foreground/70 font-medium text-sm hover:bg-white/15 transition-colors cursor-pointer"
                        >
                            跳过，继续使用
                        </motion.button>
                    )}
                    {phase === "scanning" && (
                        <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs py-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>请稍候...</span>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
