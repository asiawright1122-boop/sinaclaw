import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Key, Bot, ChevronRight, Check, ArrowRight } from "lucide-react";
import { useSettingsStore, PROVIDER_INFO, MODEL_OPTIONS, type AIProvider } from "@/store/settingsStore";
import { useAgentStore } from "@/store/agentStore";
import AgentAvatar from "@/components/ui/AgentAvatar";

const STEPS = ["welcome", "api", "agent"] as const;
type Step = typeof STEPS[number];

const PROVIDERS = (Object.keys(PROVIDER_INFO) as AIProvider[]).map(id => ({
    id,
    label: PROVIDER_INFO[id].label,
    color: PROVIDER_INFO[id].color,
}));

export default function Onboarding() {
    const {
        apiKey, provider, model,
        setApiKey, setProvider, setModel, setSetupCompleted,
    } = useSettingsStore();

    const { agents, activeAgentId, setActiveAgent } = useAgentStore();

    const [step, setStep] = useState<Step>("welcome");
    const [tempKey, setTempKey] = useState(apiKey);
    const [tempProvider, setTempProvider] = useState<AIProvider>(provider);

    const stepIndex = STEPS.indexOf(step);

    const handleFinish = () => {
        if (tempKey) setApiKey(tempKey);
        setProvider(tempProvider);
        const models = MODEL_OPTIONS[tempProvider];
        if (models.length > 0 && !models.find(m => m.id === model)) {
            setModel(models[0].id);
        }
        setSetupCompleted(true);
    };

    const next = () => {
        const i = STEPS.indexOf(step);
        if (i < STEPS.length - 1) {
            setStep(STEPS[i + 1]);
        } else {
            handleFinish();
        }
    };

    const canProceed = () => {
        if (step === "api") return tempProvider === "local" || tempKey.trim().length > 0;
        return true;
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-2xl">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-lg bg-card dark:bg-card border border-border/60 dark:border-white/[0.08] rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--panel-shadow)' }}
            >
                {/* 进度条 */}
                <div className="px-8 pt-6">
                    <div className="flex gap-2">
                        {STEPS.map((s, i) => (
                            <div
                                key={s}
                                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                                    i <= stepIndex ? "bg-primary" : "bg-border/60 dark:bg-white/[0.08]"
                                }`}
                            />
                        ))}
                    </div>
                </div>

                <div className="p-8 min-h-[360px] flex flex-col">
                    <AnimatePresence mode="wait">
                        {/* Step 1: Welcome */}
                        {step === "welcome" && (
                            <motion.div
                                key="welcome"
                                initial={{ opacity: 0, x: 30 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -30 }}
                                className="flex-1 flex flex-col items-center justify-center text-center gap-6"
                            >
                                <div className="w-16 h-16 rounded-2xl bg-primary/[0.08] border border-primary/15 flex items-center justify-center">
                                    <Sparkles className="w-8 h-8 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold tracking-tight mb-1.5">欢迎使用 Sinaclaw</h2>
                                    <p className="text-muted-foreground text-[14px] leading-relaxed">
                                        您的 AI 助手已准备就绪。<br />只需 2 步即可开始使用。
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        {/* Step 2: API Key */}
                        {step === "api" && (
                            <motion.div
                                key="api"
                                initial={{ opacity: 0, x: 30 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -30 }}
                                className="flex-1 flex flex-col gap-5"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-primary/[0.06] border border-border/50 flex items-center justify-center">
                                        <Key className="w-4.5 h-4.5 text-primary" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold">连接 AI 服务</h2>
                                        <p className="text-[13px] text-muted-foreground">选择服务商并输入 API Key</p>
                                    </div>
                                </div>

                                {/* Provider 选择 */}
                                <div className="grid grid-cols-2 gap-2">
                                    {PROVIDERS.map((p) => (
                                        <button
                                            key={p.id}
                                            onClick={() => setTempProvider(p.id)}
                                            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                                                tempProvider === p.id
                                                    ? "bg-primary/10 text-primary border border-primary/25"
                                                    : "bg-black/[0.03] dark:bg-white/[0.04] text-foreground/70 border border-border/50 dark:border-white/[0.06] hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
                                            }`}
                                        >
                                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                                            <span>{p.label}</span>
                                            {tempProvider === p.id && <Check className="w-3.5 h-3.5 ml-auto" />}
                                        </button>
                                    ))}
                                </div>

                                {/* API Key 输入 */}
                                {tempProvider !== "local" && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                            API Key
                                        </label>
                                        <input
                                            type="password"
                                            value={tempKey}
                                            onChange={(e) => setTempKey(e.target.value)}
                                            placeholder={`输入 ${PROVIDER_INFO[tempProvider].label} API Key...`}
                                            className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-4 py-2.5 text-sm focus:border-primary/40 focus:ring-1 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/40"
                                            autoFocus
                                        />
                                    </div>
                                )}

                                {tempProvider === "local" && (
                                    <div className="bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-4 py-2.5 text-sm text-muted-foreground">
                                        将使用本地 Ollama 服务（需提前启动），无需 API Key。
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* Step 3: Agent 选择 */}
                        {step === "agent" && (
                            <motion.div
                                key="agent"
                                initial={{ opacity: 0, x: 30 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -30 }}
                                className="flex-1 flex flex-col gap-5"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-primary/[0.06] border border-border/50 flex items-center justify-center">
                                        <Bot className="w-4.5 h-4.5 text-primary" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold">选择默认 Agent</h2>
                                        <p className="text-[13px] text-muted-foreground">可随时在聊天界面顶栏切换</p>
                                    </div>
                                </div>

                                <div className="space-y-2 max-h-[220px] overflow-y-auto no-scrollbar">
                                    {agents.filter(a => a.role === "primary").map((agent) => (
                                        <button
                                            key={agent.id}
                                            onClick={() => setActiveAgent(agent.id)}
                                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-150 ${
                                                activeAgentId === agent.id
                                                    ? "bg-primary/10 border border-primary/25"
                                                    : "bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
                                            }`}
                                        >
                                            <AgentAvatar avatar={agent.avatar} size={22} className="text-foreground/70" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[14px] font-semibold truncate">{agent.name}</div>
                                                <div className="text-[12px] text-muted-foreground truncate">{agent.description}</div>
                                            </div>
                                            {activeAgentId === agent.id && (
                                                <Check className="w-4 h-4 text-primary shrink-0" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* 底部按钮 */}
                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={next}
                            disabled={!canProceed()}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-40 transition-all"
                        >
                            {step === "agent" ? (
                                <>开始使用 <ArrowRight className="w-4 h-4" /></>
                            ) : (
                                <>继续 <ChevronRight className="w-4 h-4" /></>
                            )}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
