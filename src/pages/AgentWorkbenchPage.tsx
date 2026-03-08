import { useState, lazy, Suspense } from "react";
import { Bot, Timer } from "lucide-react";
import { useTranslate } from "@/lib/i18n";
import AgentWorkbenchContent from "@/components/agents/AgentWorkbenchContent";

const AutomationPage = lazy(() => import("@/pages/AutomationPage"));

export default function AgentWorkbenchPage() {
    const t = useTranslate();
    const [topTab, setTopTab] = useState<"agents" | "automation">("agents");

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* 顶部 Tab */}
            <div className="px-6 pt-6 pb-0">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-lg bg-primary/[0.06] border border-border/50 flex items-center justify-center">
                        <Bot className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-foreground">{t.agents.title}</h1>
                        <p className="text-[12px] text-muted-foreground">{t.agents.subtitle}</p>
                    </div>
                </div>
                <div className="flex gap-0.5 bg-black/[0.04] dark:bg-white/[0.04] border border-border/40 rounded-lg p-0.5 w-fit mb-4">
                    <button
                        onClick={() => setTopTab("agents")}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                            topTab === "agents"
                                ? "bg-card dark:bg-white/[0.08] shadow-sm text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <Bot className="w-3.5 h-3.5" />
                        {t.agents.tabAgents}
                    </button>
                    <button
                        onClick={() => setTopTab("automation")}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                            topTab === "automation"
                                ? "bg-card dark:bg-white/[0.08] shadow-sm text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <Timer className="w-3.5 h-3.5" />
                        {t.agents.tabAutomation}
                    </button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto">
                {topTab === "agents" ? (
                    <AgentWorkbenchContent />
                ) : (
                    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}>
                        <AutomationPage />
                    </Suspense>
                )}
            </div>
        </div>
    );
}
