import { Zap, Settings, Brain, BarChart3, Cloud, Shield, Bot, Database, Puzzle, Radio } from "lucide-react";
import { useTranslate } from "@/lib/i18n";

const VALID_TABS = ["api", "ext", "memory", "usage", "sync", "security", "agents", "knowledge", "skills", "connections"] as const;
export type SettingsTabId = typeof VALID_TABS[number];
export { VALID_TABS };

interface SettingsNavSidebarProps {
    activeTab: SettingsTabId;
    onTabChange: (tab: SettingsTabId) => void;
}

export default function SettingsNavSidebar({ activeTab, onTabChange }: SettingsNavSidebarProps) {
    const t = useTranslate();

    const NAV_GROUPS = [
        {
            label: t.settings.navGeneral,
            items: [
                { id: "api" as const, icon: Settings, label: t.settings.apiTab },
                { id: "ext" as const, icon: Zap, label: t.settings.extTab },
                { id: "memory" as const, icon: Brain, label: t.settings.memoryTab },
                { id: "connections" as const, icon: Radio, label: t.settings.navConnections },
            ],
        },
        {
            label: t.settings.navAI,
            items: [
                { id: "agents" as const, icon: Bot, label: t.settings.navAgents },
                { id: "knowledge" as const, icon: Database, label: t.settings.navKnowledge },
                { id: "skills" as const, icon: Puzzle, label: t.settings.navSkills },
            ],
        },
        {
            label: t.settings.navData,
            items: [
                { id: "usage" as const, icon: BarChart3, label: t.settings.navUsage },
                { id: "sync" as const, icon: Cloud, label: t.settings.navSync },
                { id: "security" as const, icon: Shield, label: t.settings.navSecurity },
            ],
        },
    ];

    return (
        <div className="w-[200px] shrink-0 border-r border-border/60 overflow-y-auto no-scrollbar py-5 px-2.5 space-y-4">
            <div className="px-2.5 mb-1">
                <h1 className="text-[15px] font-semibold text-foreground">{t.settings.title}</h1>
            </div>
            {NAV_GROUPS.map((group) => (
                <div key={group.label} className="space-y-0.5">
                    <div className="px-2.5 mb-0.5">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">{group.label}</span>
                    </div>
                    {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => onTabChange(item.id)}
                                className={`w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] font-medium transition-all duration-150 cursor-pointer ${
                                    isActive
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.05] hover:text-foreground"
                                }`}
                            >
                                <Icon className="w-4 h-4 shrink-0" />
                                {item.label}
                            </button>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
