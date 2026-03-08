import { motion } from "framer-motion";
import { useTranslate } from "@/lib/i18n";
import type { AgentConfig } from "@/store/agentStore";
import AgentAvatar from "@/components/ui/AgentAvatar";

interface AgentCardProps {
    agent: AgentConfig;
    isActive: boolean;
    onClick: () => void;
    onActivate: () => void;
}

export default function AgentCard({ agent, isActive, onClick, onActivate }: AgentCardProps) {
    const t = useTranslate();
    return (
        <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className={`relative bg-card/80 dark:bg-card/50 border rounded-xl p-4 cursor-pointer transition-all duration-150 group ${
                isActive
                    ? "border-primary/30 ring-1 ring-primary/15"
                    : "border-border/50 dark:border-white/[0.06] hover:border-primary/20"
            }`}
            style={{ boxShadow: 'var(--panel-shadow)' }}
            onClick={onClick}
        >
            {isActive && (
                <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-primary border-2 border-card" />
            )}
            <div className="flex items-start gap-3">
                <AgentAvatar avatar={agent.avatar} size={24} className="text-foreground/70" />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground truncate">{agent.name}</span>
                        {agent.role === "sub" && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-medium">{t.agents.subAgent}</span>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{agent.description}</p>
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                        <span className="px-1.5 py-0.5 rounded bg-muted/30 font-mono">{agent.model.split("-").slice(0, 2).join("-")}</span>
                        <span>{agent.enabledTools.length === 1 && agent.enabledTools[0] === "*" ? t.agents.allTools : t.agents.toolCount.replace('{count}', String(agent.enabledTools.length))}</span>
                    </div>
                </div>
            </div>
            <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={(e) => { e.stopPropagation(); onActivate(); }}
                    className="px-2 py-1 rounded-lg text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                    {t.agents.activate}
                </button>
            </div>
        </motion.div>
    );
}
