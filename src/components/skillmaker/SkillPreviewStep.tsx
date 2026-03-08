import { useState } from "react";
import { motion } from "framer-motion";
import { Code2, Check, Copy } from "lucide-react";

interface SkillPreviewStepProps {
    editableJson: string;
    onJsonChange: (val: string) => void;
    onBack: () => void;
    onDeploy: () => void;
    t: {
        schemaReview: string;
        copied: string;
        copySource: string;
        reviseConcept: string;
        proceedDeploy: string;
    };
}

export default function SkillPreviewStep({
    editableJson,
    onJsonChange,
    onBack,
    onDeploy,
    t,
}: SkillPreviewStepProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(editableJson);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-3xl"
        >
            <div className="bg-white/80 dark:bg-white/[0.04] backdrop-blur-2xl rounded-[1.5rem] overflow-hidden shadow-[0_2px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_20px_rgba(0,0,0,0.3)] ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
                <div className="px-7 py-4 flex items-center justify-between bg-gradient-to-r from-black/[0.015] to-transparent dark:from-white/[0.02] border-b border-black/[0.04] dark:border-white/[0.06]">
                    <div className="flex items-center gap-2.5">
                        <Code2 className="w-4 h-4 text-primary/60" />
                        <h3 className="text-[13px] font-bold tracking-[0.08em] uppercase text-foreground/70">{t.schemaReview}</h3>
                    </div>
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.06] transition-colors"
                    >
                        {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? t.copied : t.copySource}
                    </button>
                </div>

                <textarea
                    value={editableJson}
                    onChange={(e) => onJsonChange(e.target.value)}
                    className="w-full h-[450px] p-7 bg-transparent font-mono text-[13px] text-foreground/75 resize-none focus:outline-none transition-all leading-loose"
                    spellCheck={false}
                />

                <div className="px-7 py-5 bg-gradient-to-r from-black/[0.015] to-transparent dark:from-white/[0.02] border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between">
                    <button
                        onClick={onBack}
                        className="text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors tracking-wide px-5 py-2.5 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
                    >
                        {t.reviseConcept}
                    </button>
                    <button
                        onClick={() => {
                            try {
                                JSON.parse(editableJson);
                                onDeploy();
                            } catch {
                                alert("Invalid JSON format.");
                            }
                        }}
                        className="px-8 py-2.5 bg-gradient-to-r from-primary to-primary/85 text-white hover:from-primary/90 hover:to-primary/75 rounded-xl text-[13px] font-bold tracking-wide transition-all shadow-[0_2px_12px_rgba(8,145,178,0.25)] hover:shadow-[0_4px_20px_rgba(8,145,178,0.35)] hover:-translate-y-0.5 active:translate-y-0"
                    >
                        {t.proceedDeploy}
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
