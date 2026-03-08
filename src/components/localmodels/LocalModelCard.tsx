import { Cpu, Trash2, Zap } from "lucide-react";
import { formatModelSize, type OllamaModel } from "@/lib/localModelManager";
import { useTranslate } from "@/lib/i18n";

interface LocalModelCardProps {
    model: OllamaModel;
    onDelete: () => void;
    onActivate: () => void;
    isActive: boolean;
}

export default function LocalModelCard({ model, onDelete, onActivate, isActive }: LocalModelCardProps) {
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
                            {model.parameterSize && <span>&middot; {model.parameterSize}</span>}
                            {model.quantization && <span>&middot; {model.quantization}</span>}
                            {model.family && <span>&middot; {model.family}</span>}
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
