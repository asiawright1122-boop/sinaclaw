import { Plus, GitBranch, ArrowRightLeft } from "lucide-react";
import { useAgentStore, type AgentConfig } from "@/store/agentStore";
import AgentAvatar from "@/components/ui/AgentAvatar";
import { useTranslate } from "@/lib/i18n";

interface SwarmPanelProps {
    agents: AgentConfig[];
}

export default function SwarmPanel({ agents }: SwarmPanelProps) {
    const t = useTranslate();
    const primaryAgents = agents.filter((a) => a.role === "primary");
    const { spawnSubAgent } = useAgentStore();

    return (
        <div className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-5 space-y-4" style={{ boxShadow: 'var(--panel-shadow)' }}>
            <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm text-foreground">{t.agents.swarmTitle}</h3>
            </div>
            <p className="text-xs text-muted-foreground">
                {t.agents.swarmDesc}
            </p>

            <div className="space-y-3">
                {primaryAgents.map((agent) => {
                    const subs = agents.filter((a) => a.role === "sub" && a.parentAgentId === agent.id);
                    return (
                        <div key={agent.id} className="bg-muted/20 rounded-xl p-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <AgentAvatar avatar={agent.avatar} size={18} className="text-foreground/70" />
                                    <span className="text-xs font-medium text-foreground">{agent.name}</span>
                                </div>
                                <button
                                    onClick={() =>
                                        spawnSubAgent(agent.id, {
                                            name: `${agent.name}${t.agents.spawnSubName}`,
                                            description: t.agents.spawnSubDesc,
                                            avatar: "wrench",
                                            systemPrompt: t.agents.spawnSubPrompt,
                                            model: agent.model,
                                            enabledTools: [],
                                        })
                                    }
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors"
                                >
                                    <Plus className="w-3 h-3" />
                                    {t.agents.addSubAgent}
                                </button>
                            </div>
                            {subs.length > 0 && (
                                <div className="mt-2 ml-6 space-y-1.5 border-l-2 border-primary/20 pl-3">
                                    {subs.map((sub) => (
                                        <div key={sub.id} className="flex items-center gap-2 text-[11px]">
                                            <ArrowRightLeft className="w-3 h-3 text-muted-foreground" />
                                            <AgentAvatar avatar={sub.avatar} size={12} className="text-muted-foreground" />
                                            <span className="text-foreground">{sub.name}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
