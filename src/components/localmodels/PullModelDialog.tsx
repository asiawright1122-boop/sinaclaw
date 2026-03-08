import { useState } from "react";
import { motion } from "framer-motion";
import { Download, X } from "lucide-react";
import type { OllamaModel } from "@/lib/localModelManager";
import { useTranslate } from "@/lib/i18n";

const RECOMMENDED_MODELS = [
    { name: "llama3.3", descKey: "llama33", desc: "Meta Llama 3.3 \u2014 Flagship", size: "~4.7 GB" },
    { name: "qwen2.5:7b", descKey: "qwen25", desc: "Qwen 2.5 7B \u2014 Bilingual", size: "~4.4 GB" },
    { name: "deepseek-r1:14b", descKey: "deepseekR1", desc: "DeepSeek R1 14B \u2014 Reasoning", size: "~9.0 GB" },
    { name: "mistral", descKey: "mistral", desc: "Mistral 7B \u2014 Fast inference", size: "~4.1 GB" },
    { name: "codellama:7b", descKey: "codellama", desc: "Code Llama 7B \u2014 Code", size: "~3.8 GB" },
    { name: "gemma2:9b", descKey: "gemma2", desc: "Google Gemma 2 9B", size: "~5.4 GB" },
    { name: "phi3:mini", descKey: "phi3", desc: "Microsoft Phi-3 Mini", size: "~2.3 GB" },
    { name: "llava:7b", descKey: "llava", desc: "LLaVA 7B \u2014 Multimodal vision", size: "~4.5 GB" },
];

interface PullModelDialogProps {
    models: OllamaModel[];
    pulling: string | null;
    onPull: (name: string) => void;
    onClose: () => void;
}

export default function PullModelDialog({ models, pulling, onPull, onClose }: PullModelDialogProps) {
    const t = useTranslate();
    const localModelsText = t.localModels as Record<string, string>;
    const [customModel, setCustomModel] = useState("");

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={onClose}
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
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground">
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
                                onClick={() => { if (customModel.trim()) { onPull(customModel.trim()); onClose(); } }}
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
                                            <p className="text-[10px] text-muted-foreground">{localModelsText[`rec_${rm.descKey}`] || rm.desc} &middot; {rm.size}</p>
                                        </div>
                                        {installed ? (
                                            <span className="text-[10px] px-2 py-1 rounded-lg text-emerald-500 bg-emerald-500/10 font-medium">{t.localModels.installed}</span>
                                        ) : (
                                            <button
                                                onClick={() => { onPull(rm.name); onClose(); }}
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
    );
}
