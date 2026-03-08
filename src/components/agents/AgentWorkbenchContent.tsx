import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Star, Copy, Users, GitBranch } from "lucide-react";
import { useAgentStore, type AgentConfig } from "@/store/agentStore";
import AgentAvatar from "@/components/ui/AgentAvatar";
import { useTranslate } from "@/lib/i18n";
import { AGENT_TEMPLATES } from "@/components/agents/agentTemplates";
import AgentCard from "@/components/agents/AgentCard";
import AgentEditPanel from "@/components/agents/AgentEditPanel";
import SwarmPanel from "@/components/agents/SwarmPanel";

export default function AgentWorkbenchContent() {
    const t = useTranslate();
    const { agents, activeAgentId, addAgent, setActiveAgent } = useAgentStore();
    const [selectedAgent, setSelectedAgent] = useState<AgentConfig | null>(null);
    const [view, setView] = useState<"agents" | "templates" | "swarm">("agents");

    const TPL_NAMES: Record<string, string> = {
        "Customer Service": t.agents.tplCustomerService,
        "Translator": t.agents.tplTranslator,
        "Data Analyst": t.agents.tplDataAnalyst,
        "Summarizer": t.agents.tplSummarizer,
        "Code Reviewer": t.agents.tplCodeReviewer,
        "Creative Planner": t.agents.tplCreativePlanner,
    };
    const TPL_DESCS: Record<string, string> = {
        "Customer Service": t.agents.tplCustomerServiceDesc,
        "Translator": t.agents.tplTranslatorDesc,
        "Data Analyst": t.agents.tplDataAnalystDesc,
        "Summarizer": t.agents.tplSummarizerDesc,
        "Code Reviewer": t.agents.tplCodeReviewerDesc,
        "Creative Planner": t.agents.tplCreativePlannerDesc,
    };

    const handleAddFromTemplate = (template: typeof AGENT_TEMPLATES[0]) => {
        addAgent(template);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 space-y-6"
        >
            {/* 操作栏 */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{t.agents.agentCount.replace('{count}', String(agents.length))}</p>
                <button
                    onClick={() => addAgent({
                        name: "New Agent",
                        description: "Custom Agent",
                        avatar: "bot",
                        systemPrompt: "You are a helpful AI assistant.",
                        model: "gpt-4o",
                        enabledTools: [],
                        role: "primary",
                    })}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                    <Plus className="w-3.5 h-3.5" />
                    {t.agents.createAgent}
                </button>
            </div>

            {/* 视图切换 */}
            <div className="flex items-center gap-0.5 bg-black/[0.04] dark:bg-white/[0.04] border border-border/40 rounded-lg p-0.5 w-fit">
                {([
                    { id: "agents" as const, label: t.agents.tabAgents, icon: Users },
                    { id: "templates" as const, label: t.agents.templateTitle, icon: Star },
                    { id: "swarm" as const, label: t.agents.swarmTitle, icon: GitBranch },
                ]).map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setView(tab.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                            view === tab.id
                                ? "bg-card dark:bg-white/[0.08] text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <tab.icon className="w-3.5 h-3.5" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* 内容区 */}
            {view === "agents" && (
                <div className="flex flex-col lg:flex-row gap-6">
                    <div className={`${selectedAgent ? "lg:w-1/2" : "w-full"} transition-all`}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {agents.map((agent) => (
                                <AgentCard
                                    key={agent.id}
                                    agent={agent}
                                    isActive={agent.id === activeAgentId}
                                    onClick={() => setSelectedAgent(agent)}
                                    onActivate={() => setActiveAgent(agent.id)}
                                />
                            ))}
                        </div>
                    </div>
                    <AnimatePresence mode="wait">
                        {selectedAgent && (
                            <div className="w-full lg:w-1/2 lg:sticky lg:top-0">
                                <AgentEditPanel
                                    key={selectedAgent.id}
                                    agent={selectedAgent}
                                    onClose={() => setSelectedAgent(null)}
                                />
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {view === "templates" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {AGENT_TEMPLATES.map((tpl, idx) => (
                        <motion.div
                            key={idx}
                            whileHover={{ scale: 1.01 }}
                            className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-4 group" style={{ boxShadow: 'var(--panel-shadow)' }}
                        >
                            <div className="flex items-start gap-3">
                <AgentAvatar avatar={tpl.avatar} size={24} className="text-foreground/70" />
                                <div className="flex-1 min-w-0">
                                    <span className="font-semibold text-sm text-foreground">{TPL_NAMES[tpl.name] || tpl.name}</span>
                                    <p className="text-xs text-muted-foreground mt-0.5">{TPL_DESCS[tpl.name] || tpl.description}</p>
                                    <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                                        <span className="px-1.5 py-0.5 rounded bg-muted font-mono">{tpl.model.split("-").slice(0, 2).join("-")}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mt-3">
                                <button
                                    onClick={() => handleAddFromTemplate(tpl)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                >
                                    <Plus className="w-3 h-3" />
                                    {t.common.add}
                                </button>
                                <button
                                    onClick={() => handleAddFromTemplate(tpl)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
                                >
                                    <Copy className="w-3 h-3" />
                                    {t.agents.copyAsNew}
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {view === "swarm" && <SwarmPanel agents={agents} />}
        </motion.div>
    );
}
