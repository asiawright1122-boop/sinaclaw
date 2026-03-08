import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Cpu,
    Download,
    Trash2,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    HardDrive,
    X,
    Zap,
} from "lucide-react";
import {
    isOllamaRunning,
    getOllamaVersion,
    listModels,
    pullModel,
    deleteModel,
    formatModelSize,
    type OllamaModel,
    type PullProgress,
} from "@/lib/localModelManager";
import { useSettingsStore } from "@/store/settingsStore";
import { useTranslate } from "@/lib/i18n";

// 推荐模型列表
const RECOMMENDED_MODELS = [
    { name: "llama3.3", descKey: "llama33", desc: "Meta Llama 3.3 — Flagship", size: "~4.7 GB" },
    { name: "qwen2.5:7b", descKey: "qwen25", desc: "Qwen 2.5 7B — Bilingual", size: "~4.4 GB" },
    { name: "deepseek-r1:14b", descKey: "deepseekR1", desc: "DeepSeek R1 14B — Reasoning", size: "~9.0 GB" },
    { name: "mistral", descKey: "mistral", desc: "Mistral 7B — Fast inference", size: "~4.1 GB" },
    { name: "codellama:7b", descKey: "codellama", desc: "Code Llama 7B — Code", size: "~3.8 GB" },
    { name: "gemma2:9b", descKey: "gemma2", desc: "Google Gemma 2 9B", size: "~5.4 GB" },
    { name: "phi3:mini", descKey: "phi3", desc: "Microsoft Phi-3 Mini", size: "~2.3 GB" },
    { name: "llava:7b", descKey: "llava", desc: "LLaVA 7B — Multimodal vision", size: "~4.5 GB" },
];

function ModelCard({
    model,
    onDelete,
    onActivate,
    isActive,
}: {
    model: OllamaModel;
    onDelete: () => void;
    onActivate: () => void;
    isActive: boolean;
}) {
    const t = useTranslate();
    return (
        <div className={`bg-card/80 dark:bg-card/50 border rounded-xl p-3.5 group transition-all duration-150 ${
            isActive ? "border-primary/30 ring-1 ring-primary/15" : "border-border/50 dark:border-white/[0.06] hover:border-primary/20"
        }`} style={{ boxShadow: 'var(--panel-shadow)' }}>
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-muted/20 border border-border/50 dark:border-white/[0.06] flex items-center justify-center shrink-0">
                        <Cpu className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground truncate font-mono">{model.name}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">{model.tag}</span>
                            {isActive && <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{t.localModels.active}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                            <span>{formatModelSize(model.size)}</span>
                            {model.parameterSize && <span>· {model.parameterSize}</span>}
                            {model.quantization && <span>· {model.quantization}</span>}
                            {model.family && <span>· {model.family}</span>}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                        onClick={onActivate}
                        className="px-2 py-1 rounded-lg text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                        <Zap className="w-3 h-3" />
                    </button>
                    <button
                        onClick={onDelete}
                        className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function LocalModelsPage() {
    const t = useTranslate();
    const { provider, model: activeModel, setProvider, setModel, refreshLocalModels } = useSettingsStore();
    const [ollamaRunning, setOllamaRunning] = useState<boolean | null>(null);
    const [ollamaVersion, setOllamaVersion] = useState("");
    const [models, setModels] = useState<OllamaModel[]>([]);
    const [loading, setLoading] = useState(false);
    const [pulling, setPulling] = useState<string | null>(null);
    const [pullProgress, setPullProgress] = useState<PullProgress | null>(null);
    const [customModel, setCustomModel] = useState("");
    const [showPullDialog, setShowPullDialog] = useState(false);

    const checkOllama = async () => {
        const running = await isOllamaRunning();
        setOllamaRunning(running);
        if (running) {
            const ver = await getOllamaVersion();
            setOllamaVersion(ver);
        }
    };

    const loadModels = async () => {
        setLoading(true);
        try {
            const list = await listModels();
            setModels(list);
            await refreshLocalModels();
        } catch (err) {
            console.error("[LocalModels] 列表加载失败:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkOllama().then(() => {
            if (ollamaRunning !== false) loadModels();
        });
    }, []);

    useEffect(() => {
        if (ollamaRunning === true) loadModels();
    }, [ollamaRunning]);

    const handlePull = async (name: string) => {
        setPulling(name);
        setPullProgress({ status: t.localModels.preparing, percent: 0 });
        try {
            await pullModel(name, (p) => setPullProgress(p));
            await loadModels();
            setPullProgress(null);
        } catch (err) {
            console.error("[LocalModels] 拉取失败:", err);
            setPullProgress({ status: t.localModels.pullFailed.replace('{error}', String(err)), percent: 0 });
        } finally {
            setPulling(null);
        }
    };

    const handleDelete = async (name: string, tag: string) => {
        const fullName = `${name}:${tag}`;
        if (!confirm(t.localModels.deleteConfirm.replace('{name}', fullName))) return;
        try {
            await deleteModel(fullName);
            await loadModels();
        } catch (err) {
            console.error("[LocalModels] 删除失败:", err);
        }
    };

    const handleActivate = (modelName: string, tag: string) => {
        const fullName = tag === "latest" ? modelName : `${modelName}:${tag}`;
        if (provider !== "local") setProvider("local");
        setModel(fullName);
    };

    const totalSize = models.reduce((s, m) => s + m.size, 0);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 overflow-y-auto p-6 space-y-6"
        >
            {/* 标题 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/[0.06] border border-border/50 flex items-center justify-center">
                        <Cpu className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-foreground">{t.localModels.title}</h1>
                        <p className="text-xs text-muted-foreground">
                            {t.localModels.subtitle}
                            {ollamaVersion && <span className="ml-1 font-mono">v{ollamaVersion}</span>}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowPullDialog(true)}
                        disabled={!ollamaRunning}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
                    >
                        <Download className="w-3.5 h-3.5" />
                        {t.localModels.pullModel}
                    </button>
                    <button
                        onClick={() => { checkOllama(); loadModels(); }}
                        className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {/* Ollama 状态 */}
            {ollamaRunning === false && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                        <h3 className="text-sm font-semibold text-foreground">{t.localModels.ollamaNotDetected}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t.localModels.ollamaNotDetectedDesc}{" "}
                            <a href="https://ollama.com" target="_blank" rel="noreferrer" className="text-primary hover:underline">ollama.com</a>
                        </p>
                        <button
                            onClick={checkOllama}
                            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
                        >
                            <RefreshCw className="w-3 h-3" />
                            {t.localModels.recheck}
                        </button>
                    </div>
                </div>
            )}

            {ollamaRunning === true && (
                <>
                    {/* 概览 */}
                    <div className="flex items-center gap-6 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span>{t.localModels.ollamaRunning}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <HardDrive className="w-3.5 h-3.5" />
                            <span>{t.localModels.modelCount.replace('{count}', String(models.length)).replace('{size}', formatModelSize(totalSize))}</span>
                        </div>
                    </div>

                    {/* 模型列表 */}
                    {models.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50">
                            <Cpu className="w-10 h-10 mb-3" />
                            <p className="text-sm font-medium">{t.localModels.emptyModels}</p>
                            <p className="text-xs mt-1">{t.localModels.emptyModelsDesc}</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {models.map((m) => (
                                <ModelCard
                                    key={`${m.name}:${m.tag}`}
                                    model={m}
                                    isActive={provider === "local" && (activeModel === m.name || activeModel === `${m.name}:${m.tag}`)}
                                    onDelete={() => handleDelete(m.name, m.tag)}
                                    onActivate={() => handleActivate(m.name, m.tag)}
                                />
                            ))}
                        </div>
                    )}

                    {/* 拉取进度 */}
                    {pulling && pullProgress && (
                        <div className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-4" style={{ boxShadow: 'var(--panel-shadow)' }}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-foreground font-mono">{pulling}</span>
                                <span className="text-[10px] text-muted-foreground">{pullProgress.percent.toFixed(0)}%</span>
                            </div>
                            <div className="w-full bg-muted/30 rounded-full h-1.5">
                                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pullProgress.percent}%` }} />
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1.5">{pullProgress.status}</p>
                        </div>
                    )}
                </>
            )}

            {/* 拉取对话框 */}
            <AnimatePresence>
                {showPullDialog && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
                        onClick={() => setShowPullDialog(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.95 }}
                            className="bg-card dark:bg-card border border-border/60 dark:border-white/[0.08] rounded-xl w-[480px] max-w-[90vw] max-h-[80vh] overflow-hidden" style={{ boxShadow: 'var(--panel-shadow)' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between p-4 border-b border-border/40">
                                <h3 className="font-semibold text-foreground">{t.localModels.pullDialogTitle}</h3>
                                <button onClick={() => setShowPullDialog(false)} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
                                {/* 自定义输入 */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-foreground">{t.localModels.modelName}</label>
                                    <div className="flex gap-2">
                                        <input
                                            value={customModel}
                                            onChange={(e) => setCustomModel(e.target.value)}
                                            placeholder={t.localModels.modelNamePlaceholder}
                                            className="flex-1 bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                                        />
                                        <button
                                            onClick={() => { if (customModel.trim()) { handlePull(customModel.trim()); setShowPullDialog(false); } }}
                                            disabled={!customModel.trim() || !!pulling}
                                            className="px-4 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
                                        >
                                            {t.localModels.pull}
                                        </button>
                                    </div>
                                </div>

                                {/* 推荐模型 */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">{t.localModels.recommendedModels}</label>
                                    <div className="space-y-1.5">
                                        {RECOMMENDED_MODELS.map((rm) => {
                                            const installed = models.some((m) => rm.name.startsWith(m.name));
                                            return (
                                                <div key={rm.name} className="flex items-center justify-between p-2.5 rounded-lg bg-black/[0.02] dark:bg-white/[0.03] border border-border/40 dark:border-white/[0.06] hover:border-primary/20 transition-colors">
                                                    <div>
                                                        <span className="text-xs font-medium text-foreground font-mono">{rm.name}</span>
                                                        <p className="text-[10px] text-muted-foreground">{(t.localModels as any)[`rec_${rm.descKey}`] || rm.desc} · {rm.size}</p>
                                                    </div>
                                                    {installed ? (
                                                        <span className="text-[10px] px-2 py-1 rounded-lg text-emerald-500 bg-emerald-500/10 font-medium">{t.localModels.installed}</span>
                                                    ) : (
                                                        <button
                                                            onClick={() => { handlePull(rm.name); setShowPullDialog(false); }}
                                                            disabled={!!pulling}
                                                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-40"
                                                        >
                                                            <Download className="w-3 h-3" />
                                                            {t.localModels.pull}
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
