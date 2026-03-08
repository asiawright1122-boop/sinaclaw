import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useTranslate } from "@/lib/i18n";
import { useChatStore } from "@/store/chatStore";

interface ChatWelcomeProps {
    showApiKeyWarning: boolean;
}

export default function ChatWelcome({ showApiKeyWarning }: ChatWelcomeProps) {
    const t = useTranslate();
    const setInputValue = useChatStore((s) => s.setInputValue);

    return (
        <div className="flex-1 flex flex-col justify-center items-center text-center overflow-y-auto p-4 no-scrollbar">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.2, type: "spring" }}
                className="relative mb-8 group"
            >
                <div className="absolute inset-0 bg-primary/20 blur-[40px] rounded-full group-hover:bg-primary/30 transition-colors duration-700" />
                <div className="relative w-24 h-24 rounded-3xl bg-card dark:bg-card/60 flex items-center justify-center border border-border/60 dark:border-white/[0.08] overflow-hidden" style={{ boxShadow: 'var(--panel-shadow)' }}>
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent" />
                    <motion.div
                        animate={{ rotate: [0, 5, -5, 0] }}
                        transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                    >
                        <Sparkles className="w-12 h-12 text-primary icon-glow" />
                    </motion.div>
                </div>
            </motion.div>

            <motion.h1
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="text-4xl font-bold tracking-tight mb-4 text-foreground"
            >
                {t.chat.title}
            </motion.h1>

            <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="text-[15px] text-muted-foreground/80 max-w-md mb-8 font-medium leading-relaxed"
            >
                {t.chat.subtitle}
            </motion.p>

            {showApiKeyWarning && (
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.45 }}
                    className="mb-8 px-5 py-3.5 rounded-xl border border-orange-500/30 bg-orange-500/10 text-orange-400 text-[13px] font-medium max-w-md"
                >
                    {t.chat.apiKeyWarning}
                </motion.div>
            )}

            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto mb-4 w-full px-4"
            >
                {[
                    { key: "diagnose", text: t.chat.suggestions.diagnose },
                    { key: "fixNpm", text: t.chat.suggestions.fixNpm },
                    { key: "setupNode", text: t.chat.suggestions.setupNode },
                    { key: "analyze", text: t.chat.suggestions.analyze },
                ].map((s, i) => (
                    <div
                        key={i}
                        onClick={() => setInputValue(s.text)}
                        className="p-3.5 rounded-xl border border-border/60 dark:border-white/[0.06] bg-card/60 dark:bg-white/[0.02] text-[13px] font-medium text-muted-foreground hover:bg-card dark:hover:bg-white/[0.04] hover:text-foreground cursor-pointer transition-all duration-200 hover:shadow-sm hover:-translate-y-px active:scale-[0.97]"
                    >
                        {s.text}
                    </div>
                ))}
            </motion.div>
        </div>
    );
}
