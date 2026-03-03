import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Key, Globe, Zap, ChevronDown } from "lucide-react";
import { useSettingsStore, MODEL_OPTIONS, PROVIDER_INFO, type AIProvider } from "@/store/settingsStore";

export default function SettingsPage() {
    const {
        apiKey,
        provider,
        model,
        setApiKey,
        setProvider,
        setModel,
    } = useSettingsStore();

    const providerKeys = Object.keys(PROVIDER_INFO) as AIProvider[];

    // 下拉状态
    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // 点击外部关闭下拉
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsModelDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const currentModelOption = MODEL_OPTIONS[provider].find(m => m.id === model) || MODEL_OPTIONS[provider][0];

    return (
        <div className="flex-1 p-8 pb-0 overflow-y-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="max-w-2xl mx-auto space-y-8 pb-12"
            >
                <div>
                    <h1 className="text-3xl font-black tracking-tight mb-2">设置</h1>
                    <p className="text-muted-foreground">配置你的 AI 模型和偏好设置。</p>
                </div>

                {/* AI 提供商 */}
                <motion.section
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass-panel rounded-2xl p-6 space-y-5"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                            <Globe className="w-4 h-4 text-primary" />
                        </div>
                        <h2 className="text-lg font-bold">AI 提供商</h2>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                        {providerKeys.map((p) => (
                            <button
                                key={p}
                                onClick={() => setProvider(p)}
                                className={`h-10 px-2 rounded-xl text-[13px] font-medium transition-all border cursor-pointer text-center whitespace-nowrap flex items-center justify-center gap-1 ${provider === p
                                    ? "bg-primary/20 border-primary/40 text-primary-foreground shadow-[0_0_15px_rgba(139,92,246,0.15)]"
                                    : "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                                    }`}
                            >
                                <span>{PROVIDER_INFO[p].emoji}</span>
                                <span>{PROVIDER_INFO[p].label}</span>
                            </button>
                        ))}
                    </div>
                </motion.section>

                {/* API Key */}
                <motion.section
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="glass-panel rounded-2xl p-6 space-y-4"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                            <Key className="w-4 h-4 text-primary" />
                        </div>
                        <h2 className="text-lg font-bold">API Key</h2>
                    </div>

                    <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={`输入你的 ${PROVIDER_INFO[provider].label} API Key...`}
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 transition-colors"
                    />
                    <p className="text-xs text-muted-foreground">
                        {provider === "local"
                            ? "本地模型无需 API Key，确保 Ollama 已在本地运行即可。"
                            : "API Key 将安全存储在你的本地设备上，不会传输到任何外部服务器。"}
                    </p>
                </motion.section>

                {/* 模型选择 */}
                <motion.section
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="glass-panel rounded-2xl p-6 space-y-4"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                            <Zap className="w-4 h-4 text-primary" />
                        </div>
                        <h2 className="text-lg font-bold">模型</h2>
                    </div>

                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                            className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all border border-white/10 bg-white/5 text-foreground hover:bg-white/10"
                        >
                            <div className="flex items-center gap-2">
                                <span>{currentModelOption?.name}</span>
                                {currentModelOption?.tag && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider ${currentModelOption.tag === "最强" ? "bg-amber-500/20 text-amber-300" :
                                            currentModelOption.tag === "推荐" ? "bg-green-500/20 text-green-300" :
                                                currentModelOption.tag === "极速" ? "bg-cyan-500/20 text-cyan-300" :
                                                    currentModelOption.tag === "推理" ? "bg-violet-500/20 text-violet-300" :
                                                        currentModelOption.tag === "通用" ? "bg-blue-500/20 text-blue-300" :
                                                            currentModelOption.tag === "免费" ? "bg-emerald-500/20 text-emerald-300" :
                                                                currentModelOption.tag === "高性价比" ? "bg-teal-500/20 text-teal-300" :
                                                                    "bg-white/10 text-white/60"
                                        }`}>
                                        {currentModelOption.tag}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground/60 font-mono">{currentModelOption?.id}</span>
                                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
                            </div>
                        </button>

                        <AnimatePresence>
                            {isModelDropdownOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute z-50 top-full left-0 right-0 mt-2 p-1.5 glass-panel border border-white/10 rounded-xl shadow-2xl max-h-64 overflow-y-auto"
                                >
                                    {MODEL_OPTIONS[provider].map((m) => (
                                        <button
                                            key={m.id}
                                            onClick={() => {
                                                setModel(m.id);
                                                setIsModelDropdownOpen(false);
                                            }}
                                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${model === m.id
                                                    ? "bg-primary/20 text-primary-foreground"
                                                    : "text-muted-foreground hover:bg-white/10 hover:text-foreground"
                                                }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span>{m.name}</span>
                                                {m.tag && (
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider ${m.tag === "最强" ? "bg-amber-500/20 text-amber-300" :
                                                            m.tag === "推荐" ? "bg-green-500/20 text-green-300" :
                                                                m.tag === "极速" ? "bg-cyan-500/20 text-cyan-300" :
                                                                    m.tag === "推理" ? "bg-violet-500/20 text-violet-300" :
                                                                        m.tag === "通用" ? "bg-blue-500/20 text-blue-300" :
                                                                            m.tag === "免费" ? "bg-emerald-500/20 text-emerald-300" :
                                                                                m.tag === "高性价比" ? "bg-teal-500/20 text-teal-300" :
                                                                                    "bg-white/10 text-white/60"
                                                        }`}>
                                                        {m.tag}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-xs font-mono opacity-60">{m.id}</span>
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.section>
            </motion.div>
        </div>
    );
}
