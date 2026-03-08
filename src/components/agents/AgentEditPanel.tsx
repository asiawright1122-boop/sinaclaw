import { useState } from "react";
import { motion } from "framer-motion";
import { Trash2, Zap, X, Save } from "lucide-react";
import { useAgentStore, type AgentConfig } from "@/store/agentStore";
import AgentAvatar from "@/components/ui/AgentAvatar";
import { useTranslate } from "@/lib/i18n";

interface AgentEditPanelProps {
    agent: AgentConfig;
    onClose: () => void;
}

export default function AgentEditPanel({ agent, onClose }: AgentEditPanelProps) {
    const t = useTranslate();
    const { updateAgent, removeAgent, setActiveAgent } = useAgentStore();
    const [form, setForm] = useState({
        name: agent.name,
        description: agent.description,
        avatar: agent.avatar,
        systemPrompt: agent.systemPrompt,
        model: agent.model,
    });

    const handleSave = () => {
        updateAgent(agent.id, form);
    };

    const handleDelete = () => {
        removeAgent(agent.id);
        onClose();
    };

    const isPreset = agent.id.startsWith("default-") || agent.id.startsWith("preset-");

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl overflow-hidden"
            style={{ boxShadow: 'var(--panel-shadow)' }}
        >
            <div className="flex items-center justify-between p-4 border-b border-border/40">
                <div className="flex items-center gap-3">
                    <AgentAvatar avatar={agent.avatar} size={24} className="text-foreground/70" />
                    <div>
                        <h3 className="font-semibold text-foreground">{agent.name}</h3>
                        <p className="text-xs text-muted-foreground">{agent.role === "sub" ? t.agents.subAgent : t.agents.primaryAgent}</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">{t.agents.labelName}</label>
                        <input
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">{t.agents.labelAvatar}</label>
                        <input
                            value={form.avatar}
                            onChange={(e) => setForm({ ...form, avatar: e.target.value })}
                            placeholder="bot, code, pen-tool, wrench..."
                            className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">{t.agents.labelDesc}</label>
                    <input
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">{t.agents.labelModel}</label>
                    <select
                        value={form.model}
                        onChange={(e) => setForm({ ...form, model: e.target.value })}
                        className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                    >
                        <option value="gpt-4o">GPT-4o</option>
                        <option value="gpt-4o-mini">GPT-4o Mini</option>
                        <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                        <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                        <option value="deepseek-chat">DeepSeek Chat</option>
                        <option value="deepseek-reasoner">DeepSeek Reasoner</option>
                    </select>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">{t.agents.labelPrompt}</label>
                    <textarea
                        value={form.systemPrompt}
                        onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                        rows={6}
                        className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all font-mono text-xs leading-relaxed"
                    />
                </div>

                <div className="flex items-center gap-2 pt-2">
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                        <Save className="w-3.5 h-3.5" />
                        {t.common.save}
                    </button>
                    <button
                        onClick={() => setActiveAgent(agent.id)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-accent/10 text-accent border border-accent/20 hover:bg-accent/15 transition-colors"
                    >
                        <Zap className="w-3.5 h-3.5" />
                        {t.agents.setActive}
                    </button>
                    {!isPreset && (
                        <button
                            onClick={handleDelete}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/15 transition-colors ml-auto"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            {t.common.delete}
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
