import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Download, HardDrive, Loader2, Zap } from "lucide-react";
import { useTranslate } from "@/lib/i18n";
import { MODEL_OPTIONS, useSettingsStore, type AIProvider } from "@/store/settingsStore";

function getTagClass(tag: string, isActive: boolean) {
    if (isActive) return "bg-primary/15 text-primary";
    switch (tag) {
        case "strongest": return "bg-amber-500/15 text-amber-600 dark:text-amber-300";
        case "recommended": return "bg-green-500/15 text-green-600 dark:text-green-300";
        case "fast": return "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300";
        case "reasoning": return "bg-violet-500/15 text-violet-600 dark:text-violet-300";
        case "general": return "bg-blue-500/15 text-blue-600 dark:text-blue-300";
        case "free": return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300";
        case "value": return "bg-teal-500/15 text-teal-600 dark:text-teal-300";
        default: return "bg-muted/50 text-muted-foreground";
    }
}

function getSelectedTagClass(tag: string) {
    switch (tag) {
        case "strongest": return "bg-amber-500/20 text-amber-500 dark:text-amber-300";
        case "recommended": return "bg-green-500/20 text-green-600 dark:text-green-300";
        case "fast": return "bg-cyan-500/20 text-cyan-600 dark:text-cyan-300";
        case "reasoning": return "bg-violet-500/20 text-violet-600 dark:text-violet-300";
        case "general": return "bg-blue-500/20 text-blue-600 dark:text-blue-300";
        case "free": return "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300";
        case "value": return "bg-teal-500/20 text-teal-600 dark:text-teal-300";
        default: return "bg-muted/50 text-muted-foreground";
    }
}

interface ModelSelectorProps {
    provider: AIProvider;
}

export default function ModelSelector({ provider }: ModelSelectorProps) {
    const {
        model,
        localModels,
        refreshLocalModels,
        setModel,
    } = useSettingsStore();
    const t = useTranslate();

    const TAG_LABELS: Record<string, string> = {
        strongest: t.settings.tagStrongest,
        value: t.settings.tagValue,
        reasoning: t.settings.tagReasoning,
        recommended: t.settings.tagRecommended,
        fast: t.settings.tagFast,
        general: t.settings.tagGeneral,
        free: t.settings.tagFree,
    };

    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [pullModelName, setPullModelName] = useState("");
    const [isPullingModel, setIsPullingModel] = useState(false);
    const [pullProgress, setPullProgress] = useState("");

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsModelDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const currentOptions = provider === "local" && localModels.length > 0 ? localModels : MODEL_OPTIONS[provider];
    const currentModelOption = currentOptions.find((m) => m.id === model) || currentOptions[0];

    const handlePullModel = async () => {
        if (!pullModelName.trim()) return;
        setIsPullingModel(true);
        setPullProgress(t.settings.ollamaConnecting);
        try {
            const { listen } = await import("@tauri-apps/api/event");
            const unlisten = await listen<{ status: string; completed?: number; total?: number }>("ollama-pull-progress", (event) => {
                const { status, completed, total } = event.payload;
                if (completed && total) {
                    const pct = Math.round((completed / total) * 100);
                    setPullProgress(`${status} ${pct}%`);
                } else {
                    setPullProgress(status);
                }
            });
            const { invoke } = await import("@tauri-apps/api/core");
            await invoke("ollama_pull_model", { modelName: pullModelName.trim() });
            unlisten();
            setPullProgress(t.settings.pullComplete.replace("{model}", pullModelName));
            setPullModelName("");
            refreshLocalModels();
        } catch (err) {
            setPullProgress(t.settings.pullFailed.replace("{error}", String(err)));
        } finally {
            setIsPullingModel(false);
        }
    };

    return (
        <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-6 space-y-4"
            style={{ boxShadow: "var(--panel-shadow)" }}
        >
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/[0.06] border border-border/50 flex items-center justify-center">
                    <Zap className="w-4.5 h-4.5 text-primary" />
                </div>
                <h2 className="text-[17px] font-bold">{t.settings.model}</h2>
            </div>

            {provider !== "local" ? (
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-[14px] font-semibold transition-all border border-border/50 dark:border-white/[0.06] bg-card/60 dark:bg-card/40 text-foreground hover:bg-card/80 dark:hover:bg-card/60"
                    >
                        <div className="flex items-center gap-2.5">
                            <span>{currentModelOption?.name}</span>
                            {currentModelOption?.tag && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider ${getSelectedTagClass(currentModelOption.tag)}`}>
                                    {TAG_LABELS[currentModelOption.tag] || currentModelOption.tag}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-[12px] text-muted-foreground font-mono">{currentModelOption?.id}</span>
                            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isModelDropdownOpen ? "rotate-180" : ""}`} />
                        </div>
                    </button>

                    <AnimatePresence>
                        {isModelDropdownOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                transition={{ duration: 0.15 }}
                                className="absolute z-50 top-full left-0 right-0 mt-2 p-1.5 bg-card dark:bg-card border border-border/60 dark:border-white/[0.08] rounded-xl max-h-72 overflow-y-auto no-scrollbar"
                                style={{ boxShadow: "var(--panel-shadow)" }}
                            >
                                {currentOptions.map((m) => (
                                    <button
                                        key={m.id}
                                        onClick={() => {
                                            setModel(m.id);
                                            setIsModelDropdownOpen(false);
                                        }}
                                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-[13px] font-semibold transition-colors ${model === m.id
                                            ? "bg-primary/10 text-primary"
                                            : "text-foreground/80 hover:bg-muted/40 hover:text-foreground"
                                            }`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <span>{m.name}</span>
                                            {m.tag && (
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${getTagClass(m.tag, model === m.id)}`}>
                                                    {TAG_LABELS[m.tag] || m.tag}
                                                </span>
                                            )}
                                        </div>
                                        <span className={`text-[11px] font-mono ${model === m.id ? "text-primary/70" : "text-muted-foreground/50"}`}>{m.id}</span>
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            ) : (
                <div className="space-y-4">
                    {localModels.length > 0 ? (
                        <div className="space-y-1.5">
                            {localModels.map((m) => {
                                const isActive = model === m.id || model === m.name;
                                return (
                                    <button
                                        key={m.id}
                                        onClick={() => setModel(m.id)}
                                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-left transition-all duration-150 ${isActive
                                            ? "bg-primary/10 border border-primary/30 ring-1 ring-primary/10"
                                            : "border border-transparent hover:bg-muted/30"
                                            }`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${isActive ? "bg-primary/15" : "bg-muted/30"}`}>
                                                <HardDrive className={`w-3.5 h-3.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                                            </div>
                                            <div className="min-w-0">
                                                <span className={`text-[13px] font-semibold font-mono truncate block ${isActive ? "text-primary" : "text-foreground"}`}>{m.name}</span>
                                                {m.tag && m.tag !== "latest" && (
                                                    <span className="text-[10px] text-muted-foreground/60 font-mono">{m.tag}</span>
                                                )}
                                            </div>
                                        </div>
                                        {isActive && (
                                            <span className="text-[10px] px-2 py-0.5 rounded bg-primary/15 text-primary font-medium shrink-0">{t.extensions.active}</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground/50">
                            <HardDrive className="w-8 h-8 mx-auto mb-2" />
                            <p className="text-[13px] font-medium">{t.settings.ollamaDisconnected}</p>
                        </div>
                    )}

                    <div className="pt-3 border-t border-border/40 space-y-3">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder={t.settings.pullPlaceholder}
                                value={pullModelName}
                                onChange={(e) => setPullModelName(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handlePullModel()}
                                className="flex-1 bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3.5 py-2 text-[13px] font-mono focus:border-primary/30 focus:ring-1 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/40"
                            />
                            <button
                                onClick={handlePullModel}
                                disabled={!pullModelName.trim() || isPullingModel}
                                className="px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary/90 disabled:opacity-40 transition-all flex items-center gap-1.5"
                            >
                                {isPullingModel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                {isPullingModel ? t.settings.pulling : t.settings.pullModel}
                            </button>
                        </div>
                        {pullProgress && (
                            <div className="text-[11px] text-muted-foreground bg-black/[0.03] dark:bg-white/[0.04] border border-border/30 rounded-lg px-3 py-2 font-mono">
                                {pullProgress}
                            </div>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                            {["llama3.3", "qwen2.5:7b", "deepseek-r1:14b", "mistral", "gemma2:9b"].map((name) => {
                                const installed = localModels.some((m) => name.startsWith(m.name?.split(":")[0]));
                                return (
                                    <button
                                        key={name}
                                        disabled={installed || isPullingModel}
                                        onClick={() => {
                                            setPullModelName(name);
                                        }}
                                        className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors ${installed
                                            ? "bg-emerald-500/10 text-emerald-500 cursor-default"
                                            : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground cursor-pointer"
                                            }`}
                                    >
                                        {installed ? "[v] " : ""}{name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </motion.section>
    );
}
