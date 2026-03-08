import { motion, AnimatePresence } from "framer-motion";
import { Shield, CheckCircle, XCircle, Loader2, Sparkles, ChevronRight, Eye, EyeOff, ArrowLeft, Bot } from "lucide-react";
import IconById from "@/components/ui/IconById";
import { useEffect, useState } from "react";
import { runEnvironmentScan, type ScanItem } from "@/lib/scanner";
import { useSettingsStore, PROVIDER_INFO, MODEL_OPTIONS, type AIProvider } from "@/store/settingsStore";
import { useTranslate } from "@/lib/i18n";

interface SetupWizardProps {
    onComplete: () => void;
}

type WizardStep = "scan" | "provider" | "done";

/* ── Step 1: 环境扫描 ────────────────────────────── */
function ScanStep({ onNext }: { onNext: () => void }) {
    const t = useTranslate();
    const [items, setItems] = useState<ScanItem[]>([]);
    const [phase, setPhase] = useState<"scanning" | "done" | "error">("scanning");

    useEffect(() => {
        let cancelled = false;
        async function scan() {
            try {
                const scanResult = await runEnvironmentScan((updatedItems) => {
                    if (!cancelled) setItems([...updatedItems]);
                });
                if (!cancelled) {
                    setPhase(scanResult.hasRequired ? "done" : "error");
                    if (scanResult.hasRequired) {
                        setTimeout(() => { if (!cancelled) onNext(); }, 1200);
                    }
                }
            } catch {
                if (!cancelled) setPhase("error");
            }
        }
        scan();
        return () => { cancelled = true; };
    }, [onNext]);

    const statusIcon = (item: ScanItem) => {
        switch (item.status) {
            case "checking": return <Loader2 className="w-4 h-4 animate-spin text-blue-400" />;
            case "installed": return <CheckCircle className="w-4 h-4 text-emerald-400" />;
            case "installed_now": return <CheckCircle className="w-4 h-4 text-cyan-400" />;
            case "missing":
            case "failed": return <XCircle className="w-4 h-4 text-red-400" />;
        }
    };

    const statusText = (item: ScanItem) => {
        switch (item.status) {
            case "checking": return t.setup.scanInitializing;
            case "installed": return t.setup.scanReady.replace('{version}', item.version || '');
            case "failed": return t.setup.scanFailed;
            default: return "";
        }
    };

    return (
        <>
            <div className="px-6 pt-6 pb-4 text-center">
                <motion.div
                    animate={{ rotate: phase === "scanning" ? [0, 10, -10, 0] : 0 }}
                    transition={{ repeat: phase === "scanning" ? Infinity : 0, duration: 2 }}
                    className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-primary/30 to-accent/30 border border-border/50 mb-4"
                >
                    {phase === "done" ? (
                        <Sparkles className="w-8 h-8 text-emerald-400" />
                    ) : (
                        <Shield className="w-8 h-8 text-primary-foreground" />
                    )}
                </motion.div>
                <h2 className="text-xl font-bold tracking-tight mb-1">
                    {phase === "scanning" && t.setup.scanTitle}
                    {phase === "done" && t.setup.scanDone}
                    {phase === "error" && t.setup.scanError}
                </h2>
                <p className="text-sm text-muted-foreground">
                    {phase === "scanning" && t.setup.scanDesc}
                    {phase === "done" && t.setup.scanDoneDesc}
                    {phase === "error" && t.setup.scanErrorDesc}
                </p>
            </div>
            <div className="px-6 pb-4">
                <div className="space-y-1.5">
                    <AnimatePresence>
                        {items.map((item, index) => (
                            <motion.div
                                key={item.name}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${item.status === "installed_now"
                                    ? "bg-cyan-500/10 border border-cyan-500/20"
                                    : item.status === "installing"
                                        ? "bg-amber-500/10 border border-amber-500/20"
                                        : item.status === "failed"
                                            ? "bg-red-500/10 border border-red-500/20"
                                            : "bg-black/[0.02] dark:bg-white/[0.03] border border-transparent"
                                    }`}
                            >
                                <span className="w-6 flex justify-center"><IconById id={item.icon} size={18} className="text-foreground/60" /></span>
                                <span className="text-sm font-medium text-foreground/80 w-20">{({ node_sidecar: t.setup.engineLabel }[item.name] || item.label)}</span>
                                {item.required && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary-foreground/70 font-bold uppercase tracking-wider">{t.setup.required}</span>
                                )}
                                <span className="flex-1" />
                                <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">{statusText(item)}</span>
                                {statusIcon(item)}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>
            <div className="px-6 pb-6">
                {phase === "error" && (
                    <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onNext}
                        className="w-full py-3 rounded-xl bg-muted/50 border border-border/50 text-foreground/70 font-medium text-sm hover:bg-muted/70 transition-colors cursor-pointer">
                        {t.setup.skipContinue}
                    </motion.button>
                )}
                {phase === "scanning" && (
                    <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs py-2">
                        <Loader2 className="w-3 h-3 animate-spin" /><span>{t.setup.pleaseWait}</span>
                    </div>
                )}
            </div>
        </>
    );
}

/* ── Step 2: 选择 AI 提供商 + 输入 API Key ────────── */
function ProviderStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
    const t = useTranslate();
    const { provider, apiKey, setProvider, setApiKey, setModel } = useSettingsStore();
    const [localKey, setLocalKey] = useState(apiKey);
    const [showKey, setShowKey] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<AIProvider>(provider);

    const providers: AIProvider[] = ["openai", "anthropic", "google", "deepseek", "minimax", "zhipu", "local"];

    const handleConfirm = () => {
        setProvider(selectedProvider);
        setApiKey(localKey);
        setModel(MODEL_OPTIONS[selectedProvider][0].id);
        onNext();
    };

    const needsKey = selectedProvider !== "local";
    const canProceed = !needsKey || localKey.trim().length > 0;

    return (
        <>
            <div className="px-6 pt-6 pb-4 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-violet-500/30 to-blue-500/30 border border-border/50 mb-4">
                    <Bot className="w-8 h-8 text-violet-400" />
                </div>
                <h2 className="text-xl font-bold tracking-tight mb-1">{t.setup.providerTitle}</h2>
                <p className="text-sm text-muted-foreground">{t.setup.providerDesc}</p>
            </div>

            <div className="px-6 pb-4 space-y-4">
                {/* 提供商网格 */}
                <div className="grid grid-cols-2 gap-2">
                    {providers.map((p) => {
                        const info = PROVIDER_INFO[p];
                        const active = selectedProvider === p;
                        return (
                            <button
                                key={p}
                                onClick={() => setSelectedProvider(p)}
                                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm font-medium transition-all cursor-pointer ${
                                    active
                                        ? "bg-primary/15 border-primary/40 text-primary border-2"
                                        : "bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] text-foreground/70 hover:bg-black/[0.06] dark:hover:bg-white/[0.07]"
                                }`}
                            >
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: info.color }} />
                                <span>{info.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* API Key 输入 */}
                {needsKey && (
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground/70">
                            {PROVIDER_INFO[selectedProvider].label} API Key
                        </label>
                        <div className="relative">
                            <input
                                type={showKey ? "text" : "password"}
                                value={localKey}
                                onChange={(e) => setLocalKey(e.target.value)}
                                placeholder={t.setup.apiKeyPlaceholder}
                                className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 pr-9 transition-all"
                            />
                            <button
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                            >
                                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                        <p className="text-[11px] text-muted-foreground/60">
                            {t.setup.keyLocalOnly}
                        </p>
                    </div>
                )}

                {!needsKey && (
                    <div className="bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-3 text-xs text-muted-foreground">
                        {t.setup.localModeTip}
                    </div>
                )}
            </div>

            <div className="px-6 pb-6 flex items-center gap-2">
                <button onClick={onBack}
                    className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer">
                    <ArrowLeft className="w-3.5 h-3.5" /> {t.setup.back}
                </button>
                <button
                    onClick={handleConfirm}
                    disabled={!canProceed}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer"
                >
                    {t.setup.finishSetup} <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </>
    );
}

/* ── Step 3: 完成 ──────────────────────────────────── */
function DoneStep({ onFinish }: { onFinish: () => void }) {
    const t = useTranslate();
    useEffect(() => {
        const timer = setTimeout(onFinish, 2000);
        return () => clearTimeout(timer);
    }, [onFinish]);

    return (
        <div className="px-6 py-10 text-center">
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 10, stiffness: 200 }}
                className="inline-flex items-center justify-center w-20 h-20 rounded-xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 border border-border/50 mb-4"
            >
                <Sparkles className="w-10 h-10 text-emerald-400" />
            </motion.div>
            <h2 className="text-xl font-bold tracking-tight mb-1">{t.setup.doneTitle}</h2>
            <p className="text-sm text-muted-foreground mb-6">{t.setup.doneDesc}</p>
            <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                onClick={onFinish}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-semibold text-sm hover:opacity-90 transition-opacity cursor-pointer"
            >
                {t.setup.startUsing}
            </motion.button>
        </div>
    );
}

/* ── 主向导容器 ────────────────────────────────────── */
export default function SetupWizard({ onComplete }: SetupWizardProps) {
    const [step, setStep] = useState<WizardStep>("scan");
    const { setSetupCompleted } = useSettingsStore();

    const handleFinish = () => {
        setSetupCompleted(true);
        onComplete();
    };

    const steps: WizardStep[] = ["scan", "provider", "done"];
    const currentIdx = steps.indexOf(step);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4, type: "spring" }}
                className="w-full max-w-[520px] mx-4 glass-panel rounded-2xl border border-border/50 dark:border-white/[0.08] overflow-hidden" style={{ boxShadow: 'var(--panel-shadow)' }}
            >
                {/* 步骤指示器 */}
                <div className="flex items-center justify-center gap-1.5 pt-5 pb-1">
                    {steps.map((s, i) => (
                        <div
                            key={s}
                            className={`h-1 rounded-full transition-all duration-300 ${
                                i <= currentIdx ? "bg-primary w-8" : "bg-muted/40 w-4"
                            }`}
                        />
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    {step === "scan" && (
                        <motion.div key="scan" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                            <ScanStep onNext={() => setStep("provider")} />
                        </motion.div>
                    )}
                    {step === "provider" && (
                        <motion.div key="provider" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                            <ProviderStep onNext={() => setStep("done")} onBack={() => setStep("scan")} />
                        </motion.div>
                    )}
                    {step === "done" && (
                        <motion.div key="done" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                            <DoneStep onFinish={handleFinish} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}
