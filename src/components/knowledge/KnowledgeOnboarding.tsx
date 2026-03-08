import { motion } from "framer-motion";
import { Book, Zap, ShieldCheck, ArrowRight } from "lucide-react";

interface KnowledgeOnboardingProps {
    t: {
        card1Title: string;
        card1Desc: string;
        card2Title: string;
        card2Desc: string;
        card3Title: string;
        card3Desc: string;
        step1: string;
        step2: string;
        step3: string;
        tip: string;
    };
}

export default function KnowledgeOnboarding({ t }: KnowledgeOnboardingProps) {
    const cards = [
        { icon: Book, title: t.card1Title, desc: t.card1Desc },
        { icon: Zap, title: t.card2Title, desc: t.card2Desc },
        { icon: ShieldCheck, title: t.card3Title, desc: t.card3Desc },
    ];

    return (
        <>
            {/* Onboarding Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {cards.map((card, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + idx * 0.1 }}
                        className="bg-card/80 dark:bg-card/50 p-5 rounded-xl border border-border/50 dark:border-white/[0.06] flex flex-col gap-3.5 group hover:border-border/80 dark:hover:border-white/[0.12] transition-colors" style={{ boxShadow: 'var(--panel-shadow)' }}
                    >
                        <div className="w-9 h-9 rounded-lg bg-primary/[0.06] dark:bg-primary/10 border border-border/40 flex items-center justify-center text-muted-foreground">
                            <card.icon className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground mb-1 text-[14px]">{card.title}</h3>
                            <p className="text-[12px] text-muted-foreground leading-relaxed">
                                {card.desc}
                            </p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Workflow Indicator */}
            <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-border/40 rounded-xl px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                <div className="flex items-center flex-wrap gap-3.5 text-[12px] font-semibold text-foreground/70 tracking-wide uppercase">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] shrink-0">1</div>
                        <span>{t.step1}</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 opacity-40 hidden sm:block" />
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] shrink-0">2</div>
                        <span>{t.step2}</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 opacity-40 hidden sm:block" />
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] shrink-0 font-bold">3</div>
                        <span className="text-foreground">{t.step3}</span>
                    </div>
                </div>
                <div className="text-[11px] text-muted-foreground hidden lg:block">
                    {t.tip.split('@filename')[0]}<code className="bg-black/[0.04] dark:bg-white/[0.06] border border-border/40 px-1.5 py-0.5 rounded text-foreground font-mono text-[10px] mx-1">@filename</code>{t.tip.split('@filename')[1]}
                </div>
            </div>
        </>
    );
}
