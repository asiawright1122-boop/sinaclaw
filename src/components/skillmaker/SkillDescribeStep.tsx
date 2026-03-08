import { motion } from "framer-motion";
import { Wand2, Loader2 } from "lucide-react";

interface SkillDescribeStepProps {
    description: string;
    onDescriptionChange: (val: string) => void;
    onGenerate: () => void;
    isGenerating: boolean;
    hasApiKey: boolean;
    t: {
        heroTitle: string;
        heroDesc: string;
        placeholder: string;
        inputLabel: string;
        btnGenerating: string;
        btnGenerate: string;
        reqApiKey: string;
    };
}

export default function SkillDescribeStep({
    description,
    onDescriptionChange,
    onGenerate,
    isGenerating,
    hasApiKey,
    t,
}: SkillDescribeStepProps) {
    return (
        <motion.div
            key="describe"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-2xl"
        >
            <div className="text-center mb-12 space-y-4">
                <h2 className="text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
                    {t.heroTitle}
                </h2>
                <p className="text-[15px] text-muted-foreground/80 max-w-lg mx-auto leading-relaxed">
                    {t.heroDesc}
                </p>
            </div>

            <div className="group relative">
                <div className="absolute -inset-1 bg-gradient-to-br from-primary/15 via-transparent to-secondary/10 rounded-[1.75rem] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
                <div className="relative bg-white/80 dark:bg-white/[0.04] backdrop-blur-2xl rounded-[1.5rem] overflow-hidden shadow-[0_2px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_20px_rgba(0,0,0,0.3)] ring-1 ring-black/[0.04] dark:ring-white/[0.06] transition-all group-focus-within:shadow-[0_8px_40px_rgba(8,145,178,0.08)] group-focus-within:ring-primary/20">
                    <textarea
                        value={description}
                        onChange={(e) => onDescriptionChange(e.target.value)}
                        placeholder={t.placeholder}
                        className="w-full h-40 p-7 bg-transparent text-foreground placeholder:text-muted-foreground/40 text-[15px] resize-none focus:outline-none leading-relaxed"
                        spellCheck={false}
                    />
                    <div className="px-7 py-4 bg-gradient-to-r from-black/[0.015] to-transparent dark:from-white/[0.02] flex items-center justify-between border-t border-black/[0.04] dark:border-white/[0.06]">
                        <span className="text-[11px] font-semibold text-muted-foreground/50 tracking-[0.15em] uppercase">{t.inputLabel}</span>
                        <button
                            onClick={onGenerate}
                            disabled={!description.trim() || !hasApiKey || isGenerating}
                            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary to-primary/85 text-white hover:from-primary/90 hover:to-primary/75 rounded-xl text-[13px] font-semibold transition-all duration-300 disabled:opacity-40 disabled:grayscale shadow-[0_2px_12px_rgba(8,145,178,0.25)] hover:shadow-[0_4px_20px_rgba(8,145,178,0.35)] disabled:shadow-none hover:-translate-y-0.5 active:translate-y-0"
                        >
                            {isGenerating ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> {t.btnGenerating}</>
                            ) : (
                                <><Wand2 className="w-4 h-4" /> {t.btnGenerate}</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
            {!hasApiKey && (
                <p className="text-center text-[12px] text-destructive/70 mt-6 tracking-wide font-medium bg-destructive/[0.04] py-2.5 rounded-xl w-full ring-1 ring-destructive/10">
                    {t.reqApiKey}
                </p>
            )}
        </motion.div>
    );
}
