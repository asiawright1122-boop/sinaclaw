import { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Settings } from "lucide-react";
import { useAgentStore } from "@/store/agentStore";
import { useTranslate } from "@/lib/i18n";
import AgentAvatar from "@/components/ui/AgentAvatar";

export default function ChatAgentPicker() {
    const t = useTranslate();
    const navigate = useNavigate();
    const { agents, activeAgentId, setActiveAgent } = useAgentStore();
    const currentAgent = agents.find(a => a.id === activeAgentId) || agents[0];

    const [showPicker, setShowPicker] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
                setShowPicker(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    return (
        <div className="relative" ref={pickerRef}>
            <button
                onClick={() => setShowPicker(!showPicker)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm font-medium hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors"
            >
                <AgentAvatar avatar={currentAgent?.avatar || 'bot'} size={18} className="text-foreground/70" />
                <span className="text-foreground">{currentAgent?.name || 'Sinaclaw'}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${showPicker ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {showPicker && (
                    <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.97 }}
                        className="absolute top-full left-0 mt-1.5 w-64 bg-card dark:bg-card border border-border/60 dark:border-white/[0.08] rounded-xl py-1.5 z-50" style={{ boxShadow: 'var(--panel-shadow)' }}
                    >
                        <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            {t.chat.switchAgent}
                        </div>
                        <div className="max-h-[300px] overflow-y-auto no-scrollbar">
                            {agents.filter(a => a.role === 'primary').map((agent) => (
                                <button
                                    key={agent.id}
                                    onClick={() => { setActiveAgent(agent.id); setShowPicker(false); }}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                                        agent.id === activeAgentId
                                            ? 'bg-primary/10 text-primary'
                                            : 'text-foreground/80 hover:bg-muted/30'
                                    }`}
                                >
                                    <AgentAvatar avatar={agent.avatar} size={18} className="text-foreground/70" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[13px] font-medium truncate">{agent.name}</div>
                                        <div className="text-[11px] text-muted-foreground truncate">{agent.description}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                        <div className="border-t border-border/40 mt-1 pt-1">
                            <button
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                                onClick={() => { setShowPicker(false); navigate("/settings?tab=agents"); }}
                            >
                                <Settings className="w-3.5 h-3.5" />
                                {t.chat.manageAgents}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
