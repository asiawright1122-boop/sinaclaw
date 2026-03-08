import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Cpu, Download, RefreshCw, CheckCircle2, AlertCircle, HardDrive,
} from "lucide-react";
import {
    isOllamaRunning, getOllamaVersion, listModels, pullModel, deleteModel, formatModelSize,
    type OllamaModel, type PullProgress,
} from "@/lib/localModelManager";
import { useSettingsStore } from "@/store/settingsStore";
import { useTranslate } from "@/lib/i18n";
import LocalModelCard from "@/components/localmodels/LocalModelCard";
import PullModelDialog from "@/components/localmodels/PullModelDialog";

export default function LocalModelsPage() {
    const t = useTranslate();
    const { provider, model: activeModel, setProvider, setModel, refreshLocalModels } = useSettingsStore();
    const [ollamaRunning, setOllamaRunning] = useState<boolean | null>(null);
    const [ollamaVersion, setOllamaVersion] = useState("");
    const [models, setModels] = useState<OllamaModel[]>([]);
    const [loading, setLoading] = useState(false);
    const [pulling, setPulling] = useState<string | null>(null);
    const [pullProgress, setPullProgress] = useState<PullProgress | null>(null);
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
                                <LocalModelCard
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
                    <PullModelDialog
                        models={models}
                        pulling={pulling}
                        onPull={handlePull}
                        onClose={() => setShowPullDialog(false)}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    );
}
