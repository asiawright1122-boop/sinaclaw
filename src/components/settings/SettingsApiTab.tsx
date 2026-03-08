import { motion } from "framer-motion";
import { Globe, Key, Volume2 } from "lucide-react";
import { useTranslate } from "@/lib/i18n";
import { PROVIDER_INFO, useSettingsStore, type AIProvider } from "@/store/settingsStore";
import {
    AnthropicAppIcon,
    DeepSeekAppIcon,
    GoogleAppIcon,
    LocalAppIcon,
    MiniMaxAppIcon,
    OpenAIAppIcon,
    ZhipuAppIcon,
} from "@/components/icons/ProviderIcons";
import ModelSelector from "@/components/settings/ModelSelector";

export default function SettingsApiTab() {
    const {
        apiKey,
        provider,
        localModels,
        refreshLocalModels,
        enableTTS,
        setApiKey,
        setProvider,
        setEnableTTS,
    } = useSettingsStore();
    const t = useTranslate();

    const providerKeys = Object.keys(PROVIDER_INFO) as AIProvider[];

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
        >
            <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-6 space-y-5"
                style={{ boxShadow: "var(--panel-shadow)" }}
            >
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/[0.06] border border-border/50 flex items-center justify-center">
                        <Globe className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <h2 className="text-[17px] font-bold">{t.settings.provider}</h2>
                </div>

                <div className="flex flex-wrap gap-2.5">
                    {providerKeys.map((p) => {
                        const isActive = provider === p;
                        return (
                            <button
                                key={p}
                                onClick={() => setProvider(p)}
                                className={`relative h-10 px-3.5 rounded-xl text-[13px] font-semibold transition-all border cursor-pointer flex items-center gap-2 shrink-0 ${isActive
                                    ? "bg-primary/10 text-primary border-primary/40 ring-1 ring-primary/20"
                                    : "border-border/50 dark:border-white/[0.06] bg-card/60 dark:bg-card/40 text-foreground/70 hover:bg-card/80 dark:hover:bg-card/60 hover:text-foreground"
                                    }`}
                            >
                                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                                    {p === "openai" && <OpenAIAppIcon className="w-full h-full" />}
                                    {p === "anthropic" && <AnthropicAppIcon className="w-full h-full" />}
                                    {p === "google" && <GoogleAppIcon className="w-full h-full" />}
                                    {p === "deepseek" && <DeepSeekAppIcon className="w-full h-full" />}
                                    {p === "minimax" && <MiniMaxAppIcon className="w-full h-full" />}
                                    {p === "zhipu" && <ZhipuAppIcon className="w-full h-full" />}
                                    {p === "local" && <LocalAppIcon className="w-full h-full" />}
                                </div>
                                <span>{PROVIDER_INFO[p].label}</span>
                            </button>
                        );
                    })}
                </div>
            </motion.section>

            {provider !== "local" ? (
                <motion.section
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-6 space-y-4"
                    style={{ boxShadow: "var(--panel-shadow)" }}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/[0.06] border border-border/50 flex items-center justify-center">
                            <Key className="w-4.5 h-4.5 text-primary" />
                        </div>
                        <h2 className="text-[17px] font-bold">{t.settings.apiKey}</h2>
                    </div>

                    <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={t.settings.apiKeyPlaceholder.replace("{provider}", PROVIDER_INFO[provider].label)}
                        className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-5 py-3.5 text-[15px] font-medium text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20 transition-all"
                    />
                    <p className="text-[13px] font-medium text-muted-foreground/80 pl-1">
                        {t.settings.apiKeySecureTip}
                    </p>
                </motion.section>
            ) : (
                <motion.section
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-5"
                    style={{ boxShadow: "var(--panel-shadow)" }}
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${localModels.length > 0 ? "bg-emerald-400" : "bg-amber-400"} animate-pulse`} />
                        <span className="text-[13px] font-medium text-foreground">
                            {localModels.length > 0
                                ? t.settings.ollamaConnected.replace("{count}", String(localModels.length))
                                : t.settings.ollamaDisconnected}
                        </span>
                        <button
                            onClick={() => refreshLocalModels()}
                            className="ml-auto text-xs px-2.5 py-1 rounded-md bg-muted/40 hover:bg-muted/60 text-muted-foreground transition-colors"
                        >
                            {t.settings.ollamaRefresh}
                        </button>
                    </div>
                    <p className="text-[12px] text-muted-foreground/70 mt-2 pl-[22px]">
                        {t.settings.ollamaLocalTip}
                    </p>
                </motion.section>
            )}

            <ModelSelector provider={provider} />

            <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-6 space-y-4 flex items-center justify-between"
                style={{ boxShadow: "var(--panel-shadow)" }}
            >
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/[0.06] border border-border/50 flex items-center justify-center shrink-0">
                        <Volume2 className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-[17px] font-bold">{t.settings.ttsLabel}</h2>
                        <p className="text-[13px] text-muted-foreground mt-0.5">{t.settings.ttsDesc}</p>
                    </div>
                </div>

                <button
                    onClick={() => setEnableTTS(!enableTTS)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${enableTTS ? "bg-primary" : "bg-slate-200 dark:bg-slate-700"}`}
                >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enableTTS ? "translate-x-5" : "translate-x-0"}`} />
                </button>
            </motion.section>
        </motion.div>
    );
}
