import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Key, Globe, Zap, ChevronDown, Settings } from "lucide-react";
import { useSettingsStore, MODEL_OPTIONS, PROVIDER_INFO, type AIProvider } from "@/store/settingsStore";
import { useCloudStore } from "@/store/cloudStore";
import { useMCPStore } from "@/store/mcpStore";
import { useTranslate } from "@/lib/i18n";
import CloudConnector from "@/components/cloud/CloudConnector";
import { CLOUD_PROVIDERS, formatSize } from "@/lib/cloud";
import {
    OpenAIAppIcon,
    AnthropicAppIcon,
    GoogleAppIcon,
    DeepSeekAppIcon,
    MiniMaxAppIcon,
    ZhipuAppIcon,
    LocalAppIcon,
    GoogleDriveIcon,
    DropboxIcon,
    OneDriveIcon,
    NotionIcon,
    GithubIcon,
    SlackIcon,
    PostgresIcon,
    WorldIcon
} from "@/components/icons/ProviderIcons";
import { Plus, X, Server, Trash2 } from "lucide-react";
import { MCP_PRESETS } from "@/store/mcpStore";

export default function SettingsPage() {
    const {
        apiKey,
        provider,
        model,
        setApiKey,
        setProvider,
        setModel,
    } = useSettingsStore();
    const t = useTranslate();
    const { servers, removeServer, toggleServer } = useMCPStore();

    const providerKeys = Object.keys(PROVIDER_INFO) as AIProvider[];

    // 下拉与弹窗状态
    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
    const [isAddExtModalOpen, setIsAddExtModalOpen] = useState(false);
    const [customUrl, setCustomUrl] = useState("");
    const [customName, setCustomName] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);

    // 点击外部关闭下拉
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsModelDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const currentModelOption = MODEL_OPTIONS[provider].find(m => m.id === model) || MODEL_OPTIONS[provider][0];

    // Tabs 逻辑
    const [activeTab, setActiveTab] = useState<"api" | "cloud" | "ext">("api");
    const { accounts, initCloudAccounts, disconnectProvider } = useCloudStore();
    useEffect(() => { initCloudAccounts(); }, [initCloudAccounts]);
    const connectedProviders = Object.entries(accounts).filter(([, acc]) => acc !== null);

    const handleAddPreset = async (preset: typeof MCP_PRESETS[0]) => {
        await useMCPStore.getState().addServer(preset);
        setIsAddExtModalOpen(false);
    };

    const handleAddCustom = async () => {
        if (!customUrl || !customName) return;
        await useMCPStore.getState().addServer({
            name: customName,
            url: customUrl,
            type: "sse"
        });
        setCustomUrl("");
        setCustomName("");
        setIsAddExtModalOpen(false);
    };

    return (
        <div className="flex-1 p-10 pb-0 overflow-y-auto no-scrollbar">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="max-w-3xl mx-auto space-y-6 pb-12"
            >
                <div>
                    <h1 className="text-4xl font-black tracking-tight mb-2">{t.settings.title}</h1>
                    <p className="text-[15px] text-muted-foreground font-medium">{t.settings.subtitle}</p>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-2 p-1 bg-white/10 dark:bg-black/20 backdrop-blur-md rounded-2xl w-fit mb-4 border border-white/20 dark:border-white/5 shadow-inner">
                    <button
                        onClick={() => setActiveTab("api")}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${activeTab === "api" ? "bg-white dark:bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}
                    >
                        <Settings className="w-4 h-4" />
                        {t.settings.apiTab}
                    </button>
                    <button
                        onClick={() => setActiveTab("cloud")}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${activeTab === "cloud" ? "bg-white dark:bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}
                    >
                        <Globe className="w-4 h-4" />
                        {t.settings.cloudTab}
                    </button>
                    <button
                        onClick={() => setActiveTab("ext")}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${activeTab === "ext" ? "bg-white dark:bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}
                    >
                        <Zap className="w-4 h-4" />
                        {t.settings.extTab}
                    </button>
                </div>

                {activeTab === "api" && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                    >
                        {/* AI 提供商 */}
                        <motion.section
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-card/60 dark:bg-card/40 backdrop-blur-3xl border border-white/40 dark:border-white/10 shadow-lg rounded-[2rem] p-6 space-y-5"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-inner">
                                    <Globe className="w-5 h-5 text-primary" />
                                </div>
                                <h2 className="text-[17px] font-bold">{t.settings.provider}</h2>
                            </div>

                            <div className="grid grid-cols-4 gap-3">
                                {providerKeys.map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => setProvider(p)}
                                        className={`h-12 px-4 rounded-[14px] text-[14px] font-semibold transition-all border cursor-pointer text-center whitespace-nowrap flex items-center justify-center gap-3 ${provider === p
                                            ? "bg-primary text-primary-foreground border-primary shadow-md hover:-translate-y-[1px]"
                                            : "border-white/20 dark:border-white/5 bg-white/40 dark:bg-black/20 text-foreground/70 hover:bg-white/60 dark:hover:bg-black/40 hover:text-foreground shadow-sm"
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
                                ))}
                            </div>
                        </motion.section>

                        {/* API Key */}
                        <motion.section
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-card/60 dark:bg-card/40 backdrop-blur-3xl border border-white/40 dark:border-white/10 shadow-lg rounded-[2rem] p-6 space-y-4"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-inner">
                                    <Key className="w-5 h-5 text-primary" />
                                </div>
                                <h2 className="text-[17px] font-bold">{t.settings.apiKey}</h2>
                            </div>

                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder={`Enter your ${PROVIDER_INFO[provider].label} API Key...`}
                                className="w-full bg-white/40 dark:bg-black/30 border border-white/40 dark:border-white/10 rounded-[14px] px-5 py-4 text-[15px] font-medium text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all shadow-inner"
                            />
                            <p className="text-[13px] font-medium text-muted-foreground/80 pl-1">
                                {provider === "local"
                                    ? "Local models do not require an API Key. Ensure Ollama is running."
                                    : "Your API Key is stored securely on your local device."}
                            </p>
                        </motion.section>

                        {/* 模型选择 */}
                        <motion.section
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="bg-card/60 dark:bg-card/40 backdrop-blur-3xl border border-white/40 dark:border-white/10 shadow-lg rounded-[2rem] p-6 space-y-4"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-inner">
                                    <Zap className="w-5 h-5 text-primary" />
                                </div>
                                <h2 className="text-[17px] font-bold">{t.settings.model}</h2>
                            </div>

                            <div className="relative" ref={dropdownRef}>
                                <button
                                    onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                                    className="w-full flex items-center justify-between px-5 py-4 rounded-[14px] text-[15px] font-semibold transition-all border border-white/40 dark:border-white/10 bg-white/40 dark:bg-black/20 text-foreground hover:bg-white/60 dark:hover:bg-black/30 shadow-sm"
                                >
                                    <div className="flex items-center gap-3">
                                        <span>{currentModelOption?.name}</span>
                                        {currentModelOption?.tag && (
                                            <span className={`text-[11px] px-2 py-0.5 rounded-lg font-bold uppercase tracking-wider ${currentModelOption.tag === "最强" ? "bg-amber-500/20 text-amber-500 dark:text-amber-300" :
                                                currentModelOption.tag === "推荐" ? "bg-green-500/20 text-green-600 dark:text-green-300" :
                                                    currentModelOption.tag === "极速" ? "bg-cyan-500/20 text-cyan-600 dark:text-cyan-300" :
                                                        currentModelOption.tag === "推理" ? "bg-violet-500/20 text-violet-600 dark:text-violet-300" :
                                                            currentModelOption.tag === "通用" ? "bg-blue-500/20 text-blue-600 dark:text-blue-300" :
                                                                currentModelOption.tag === "免费" ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300" :
                                                                    currentModelOption.tag === "高性价比" ? "bg-teal-500/20 text-teal-600 dark:text-teal-300" :
                                                                        "bg-white/10 text-muted-foreground"
                                                }`}>
                                                {currentModelOption.tag}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-[13px] text-muted-foreground font-mono">{currentModelOption?.id}</span>
                                        <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
                                    </div>
                                </button>

                                <AnimatePresence>
                                    {isModelDropdownOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -5 }}
                                            transition={{ duration: 0.15 }}
                                            className="absolute z-50 top-full left-0 right-0 mt-2 p-2 bg-card/90 backdrop-blur-2xl border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl max-h-72 overflow-y-auto no-scrollbar"
                                        >
                                            {MODEL_OPTIONS[provider].map((m) => (
                                                <button
                                                    key={m.id}
                                                    onClick={() => {
                                                        setModel(m.id);
                                                        setIsModelDropdownOpen(false);
                                                    }}
                                                    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-[14px] font-semibold transition-colors ${model === m.id
                                                        ? "bg-primary text-primary-foreground shadow-md"
                                                        : "text-foreground/80 hover:bg-black/5 dark:hover:bg-white/10 hover:text-foreground"
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span>{m.name}</span>
                                                        {m.tag && (
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider ${model === m.id ? "bg-white/20 text-white" : m.tag === "最强" ? "bg-amber-500/20 text-amber-600 dark:text-amber-300" :
                                                                m.tag === "推荐" ? "bg-green-500/20 text-green-600 dark:text-green-300" :
                                                                    m.tag === "极速" ? "bg-cyan-500/20 text-cyan-600 dark:text-cyan-300" :
                                                                        m.tag === "推理" ? "bg-violet-500/20 text-violet-600 dark:text-violet-300" :
                                                                            m.tag === "通用" ? "bg-blue-500/20 text-blue-600 dark:text-blue-300" :
                                                                                m.tag === "免费" ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300" :
                                                                                    m.tag === "高性价比" ? "bg-teal-500/20 text-teal-600 dark:text-teal-300" :
                                                                                        "bg-black/5 dark:bg-white/10 text-muted-foreground"
                                                                }`}>
                                                                {m.tag}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className={`text-[12px] font-mono ${model === m.id ? "opacity-90" : "opacity-50"}`}>{m.id}</span>
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.section>
                    </motion.div>
                )}

                {activeTab === "cloud" && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                    >
                        <motion.section
                            className="bg-card/60 dark:bg-card/40 backdrop-blur-3xl border border-white/40 dark:border-white/10 shadow-lg rounded-[2rem] p-6 space-y-5"
                        >
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shadow-inner">
                                    <Globe className="w-5 h-5 text-blue-500" />
                                </div>
                                <div>
                                    <h2 className="text-[17px] font-bold">Authorized Cloud Drives</h2>
                                    <p className="text-[13px] text-muted-foreground mt-0.5">Manage your connected cloud storage accounts.</p>
                                </div>
                            </div>

                            {/* Cloud Connected List */}
                            {connectedProviders.length > 0 && (
                                <div className="grid grid-cols-1 gap-3 mb-6">
                                    {connectedProviders.map(([p, acc]) => {
                                        const info = CLOUD_PROVIDERS[p as keyof typeof CLOUD_PROVIDERS];
                                        return (
                                            <div key={p} className="flex items-center justify-between p-4 rounded-2xl border border-white/10 dark:border-white/5 bg-white/40 dark:bg-black/20 shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center p-2 bg-white/10 dark:bg-black/20">
                                                        {p === "google_drive" && <GoogleDriveIcon className="w-full h-full" />}
                                                        {p === "dropbox" && <DropboxIcon className="w-full h-full" />}
                                                        {p === "onedrive" && <OneDriveIcon className="w-full h-full" />}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-[15px]">{info.label}</div>
                                                        <div className="text-[12px] text-muted-foreground">Used: {formatSize((acc as any).used_space)}</div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        if (confirm(`Are you sure you want to disconnect ${info.label}?`)) {
                                                            await disconnectProvider(p as keyof typeof CLOUD_PROVIDERS);
                                                        }
                                                    }}
                                                    className="px-4 py-2 rounded-xl text-[13px] font-bold bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors cursor-pointer"
                                                >
                                                    Disconnect
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* CloudConnector handles new connections */}
                            <h3 className="text-[14px] font-bold text-muted-foreground mb-3 tracking-wider">Add New Connection</h3>
                            <CloudConnector accounts={accounts} />
                        </motion.section>
                    </motion.div>
                )}

                {activeTab === "ext" && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                    >
                        <motion.section
                            className="bg-card/60 dark:bg-card/40 backdrop-blur-3xl border border-white/40 dark:border-white/10 shadow-lg rounded-[2rem] p-6 space-y-5"
                        >
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shadow-inner">
                                        <Zap className="w-5 h-5 text-amber-500" />
                                    </div>
                                    <div>
                                        <h2 className="text-[17px] font-bold">{t.extensions.title}</h2>
                                        <p className="text-[13px] text-muted-foreground mt-0.5">{t.extensions.subtitle}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsAddExtModalOpen(true)}
                                    className="px-4 py-2 rounded-xl text-[13px] font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-2 shadow-lg"
                                >
                                    <Zap className="w-3.5 h-3.5" />
                                    {t.extensions.addServer}
                                </button>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {servers.length > 0 ? (
                                    servers.map((s) => (
                                        <div key={s.id} className="flex items-center justify-between p-5 rounded-2xl border border-white/10 dark:border-white/5 bg-white/40 dark:bg-black/20 shadow-sm group">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-colors ${s.status === 'active' ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-black/5 dark:bg-white/5 border-white/10 text-muted-foreground'}`}>
                                                    <Zap className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-[16px]">{s.name}</span>
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${s.status === 'active' ? 'bg-green-500/20 text-green-600' : 'bg-red-500/10 text-muted-foreground'}`}>
                                                            {s.status === 'active' ? t.extensions.active : t.extensions.inactive}
                                                        </span>
                                                    </div>
                                                    <div className="text-[12px] text-muted-foreground font-mono mt-0.5 opacity-60">{s.url}</div>
                                                    <div className="text-[11px] font-bold text-primary mt-1">{t.extensions.toolsFound.replace('{count}', s.toolCount.toString())}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => toggleServer(s.id)}
                                                    className={`px-4 py-2 rounded-lg text-[13px] font-bold transition-all cursor-pointer ${s.status === 'active' ? 'bg-black/5 dark:bg-white/10 text-foreground hover:bg-black/10' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
                                                >
                                                    {s.status === 'active' ? t.extensions.inactive : t.extensions.active}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (confirm(t.common.delete + "?")) removeServer(s.id);
                                                    }}
                                                    className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-12 bg-white/5 dark:bg-black/5 rounded-3xl border border-dashed border-white/20">
                                        <p className="text-muted-foreground font-medium">{t.extensions.empty}</p>
                                    </div>
                                )}
                            </div>
                        </motion.section>
                    </motion.div>
                )}
            </motion.div>

            {/* Add Extension Modal */}
            <AnimatePresence>
                {isAddExtModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsAddExtModalOpen(false)}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-xl bg-card border border-white/20 dark:border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-8 space-y-8">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-2xl font-black tracking-tight">{t.extensions.addServer}</h2>
                                        <p className="text-sm text-muted-foreground mt-1">Connect new tools to your AI agent.</p>
                                    </div>
                                    <button
                                        onClick={() => setIsAddExtModalOpen(false)}
                                        className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>

                                {/* Presets Section */}
                                <div className="space-y-4">
                                    <h3 className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider px-1">{t.extensions.presets}</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {MCP_PRESETS.map((p) => (
                                            <button
                                                key={p.name}
                                                onClick={() => handleAddPreset(p)}
                                                className="flex items-center gap-3 p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all text-left group"
                                            >
                                                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center p-2 group-hover:scale-110 transition-transform">
                                                    {p.name === "Notion" && <NotionIcon className="w-full h-full" />}
                                                    {p.name === "GitHub" && <GithubIcon className="w-full h-full" />}
                                                    {p.name === "Slack" && <SlackIcon className="w-full h-full" />}
                                                    {p.name === "PostgreSQL" && <PostgresIcon className="w-full h-full" />}
                                                    {p.name === "Browser Fetch" && <WorldIcon className="w-full h-full font-bold" />}
                                                    {!["Notion", "GitHub", "Slack", "PostgreSQL", "Browser Fetch"].includes(p.name) && <Server className="w-full h-full p-1" />}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-[14px]">{p.name}</div>
                                                    <div className="text-[11px] text-muted-foreground line-clamp-1 opacity-60">
                                                        {p.name === "Notion" ? t.extensions.notionDesc :
                                                            p.name === "GitHub" ? t.extensions.githubDesc :
                                                                p.name === "Slack" ? t.extensions.slackDesc :
                                                                    p.name === "Browser Fetch" ? t.extensions.fetchDesc :
                                                                        p.name === "PostgreSQL" ? t.extensions.postgresDesc : ""}
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Custom Input */}
                                <div className="space-y-4 pt-2">
                                    <h3 className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider px-1">{t.extensions.custom}</h3>
                                    <div className="space-y-3">
                                        <input
                                            type="text"
                                            placeholder={t.extensions.serverName}
                                            value={customName}
                                            onChange={(e) => setCustomName(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary/50 outline-none transition-all"
                                        />
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder={t.extensions.serverUrl}
                                                value={customUrl}
                                                onChange={(e) => setCustomUrl(e.target.value)}
                                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-primary/50 outline-none transition-all"
                                            />
                                            <button
                                                onClick={handleAddCustom}
                                                disabled={!customUrl || !customName}
                                                className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
                                            >
                                                <Plus className="w-4 h-4" />
                                                {t.common.add}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

