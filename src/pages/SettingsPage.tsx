import { useState, useRef, useEffect, lazy, Suspense, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Key, Globe, Zap, ChevronDown, Settings, Brain } from "lucide-react";
import { useSettingsStore, MODEL_OPTIONS, PROVIDER_INFO, type AIProvider } from "@/store/settingsStore";
import { useCloudStore } from "@/store/cloudStore";
import { useMCPStore } from "@/store/mcpStore";
import { useTranslate } from "@/lib/i18n";
import {
    OpenAIAppIcon,
    AnthropicAppIcon,
    GoogleAppIcon,
    DeepSeekAppIcon,
    MiniMaxAppIcon,
    ZhipuAppIcon,
    LocalAppIcon,
    NotionIcon,
    GithubIcon,
    SlackIcon,
    PostgresIcon,
    WorldIcon
} from "@/components/icons/ProviderIcons";
import { Plus, X, Server, Trash2, Volume2, Download, Loader2, Pencil, BarChart3, HardDrive, Cloud, Shield, Bot, Database, Puzzle, Radio } from "lucide-react";
import { MCP_PRESETS } from "@/store/mcpStore";
import { getAllCoreMemories, deleteMemory, updateMemory } from "@/lib/db";

const UsagePage = lazy(() => import("@/pages/UsagePage"));
const SyncPage = lazy(() => import("@/pages/SyncPage"));
const SecurityPage = lazy(() => import("@/pages/SecurityPage"));
const AgentWorkbenchPage = lazy(() => import("@/pages/AgentWorkbenchPage"));
const KnowledgePage = lazy(() => import("@/pages/KnowledgePage"));
const SkillStorePage = lazy(() => import("@/pages/SkillStorePage"));
const ConnectionsPage = lazy(() => import("@/pages/ConnectionsPage"));

function MemoryManager() {
    const t = useTranslate();
    const [memories, setMemories] = useState<any[]>([]);
    const [filterCategory, setFilterCategory] = useState<string>("all");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState("");

    const categories = [
        { id: "all", label: t.settings.memoryCatAll },
        { id: "preferences", label: t.settings.memoryCatPreferences },
        { id: "contacts", label: t.settings.memoryCatContacts },
        { id: "projects", label: t.settings.memoryCatProjects },
        { id: "learnings", label: t.settings.memoryCatLearnings },
        { id: "tools", label: t.settings.memoryCatTools },
        { id: "custom", label: t.settings.memoryCatCustom },
    ];

    const loadMemories = async () => {
        const mems = await getAllCoreMemories();
        setMemories(mems);
    };

    useEffect(() => { loadMemories(); }, []);

    const filtered = filterCategory === "all"
        ? memories
        : memories.filter(m => (m.category || 'custom') === filterCategory);

    const handleDelete = async (id: string) => {
        await deleteMemory(id);
        await loadMemories();
    };

    const handleSaveEdit = async (id: string) => {
        await updateMemory(id, editContent);
        setEditingId(null);
        await loadMemories();
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
        >
            <motion.section
                className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-6 space-y-5" style={{ boxShadow: 'var(--panel-shadow)' }}
            >
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-primary/[0.06] border border-border/50 flex items-center justify-center">
                        <Brain className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-[17px] font-bold">{t.settings.memoryTitle}</h2>
                        <p className="text-[13px] text-muted-foreground mt-0.5">
                            {t.settings.memorySubtitle.replace('{count}', String(memories.length))}
                        </p>
                    </div>
                </div>

                {/* Category Filter */}
                <div className="flex gap-2 flex-wrap">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setFilterCategory(cat.id)}
                            className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all ${filterCategory === cat.id
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "bg-black/[0.04] dark:bg-white/[0.04] text-muted-foreground hover:bg-black/[0.07] dark:hover:bg-white/[0.07]"
                            }`}
                        >
                            {cat.label}
                            {cat.id !== "all" && (
                                <span className="ml-1 opacity-60">
                                    {memories.filter(m => (m.category || 'custom') === cat.id).length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Memory List */}
                <div className="space-y-3 max-h-[400px] overflow-y-auto no-scrollbar">
                    {filtered.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            {t.settings.memoryEmpty}
                        </div>
                    ) : (
                        filtered.map(mem => (
                            <div key={mem.id} className="group p-4 rounded-xl border border-border/50 dark:border-white/[0.06] bg-card/60 dark:bg-card/40">
                                {editingId === mem.id ? (
                                    <div className="space-y-2">
                                        <textarea
                                            value={editContent}
                                            onChange={e => setEditContent(e.target.value)}
                                            className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-2 text-[13px] resize-none min-h-[60px] outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20 transition-all"
                                        />
                                        <div className="flex gap-2 justify-end">
                                            <button onClick={() => setEditingId(null)} className="px-3 py-1 text-[12px] rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">{t.common.cancel}</button>
                                            <button onClick={() => handleSaveEdit(mem.id)} className="px-3 py-1 text-[12px] rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity">{t.common.save}</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-violet-500/15 text-violet-400 font-semibold">
                                                    {categories.find(c => c.id === (mem.category || 'custom'))?.label || t.settings.memoryCatCustom}
                                                </span>
                                                <span className="text-[11px] text-muted-foreground/50">
                                                    {new Date(mem.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <p className="text-[13px] text-foreground/80 leading-relaxed">{mem.content}</p>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                            <button
                                                onClick={() => { setEditingId(mem.id); setEditContent(mem.content); }}
                                                className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(mem.id)}
                                                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </motion.section>
        </motion.div>
    );
}

export default function SettingsPage() {
    const {
        apiKey,
        provider,
        model,
        localModels,
        refreshLocalModels,
        enableTTS,
        setApiKey,
        setProvider,
        setModel,
        setEnableTTS,
    } = useSettingsStore();
    const t = useTranslate();
    const { servers, removeServer, toggleServer } = useMCPStore();

    const TAG_LABELS: Record<string, string> = {
        strongest: t.settings.tagStrongest,
        value: t.settings.tagValue,
        reasoning: t.settings.tagReasoning,
        recommended: t.settings.tagRecommended,
        fast: t.settings.tagFast,
        general: t.settings.tagGeneral,
        free: t.settings.tagFree,
    };

    const providerKeys = Object.keys(PROVIDER_INFO) as AIProvider[];

    // 下拉与弹窗状态
    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
    const [isAddExtModalOpen, setIsAddExtModalOpen] = useState(false);
    const [customUrl, setCustomUrl] = useState("");
    const [customName, setCustomName] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [pullModelName, setPullModelName] = useState("");
    const [isPullingModel, setIsPullingModel] = useState(false);
    const [pullProgress, setPullProgress] = useState("");

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

    const currentOptions = provider === 'local' && localModels.length > 0 ? localModels : MODEL_OPTIONS[provider];
    const currentModelOption = currentOptions.find(m => m.id === model) || currentOptions[0];

    // Tabs 逻辑
    const [searchParams] = useSearchParams();
    const validTabs = ["api", "ext", "memory", "usage", "sync", "security", "agents", "knowledge", "skills", "connections"] as const;
    type TabId = typeof validTabs[number];
    const initialTab = useMemo(() => {
        const t = searchParams.get("tab");
        return (t && validTabs.includes(t as TabId)) ? t as TabId : "api";
    }, []);
    const [activeTab, setActiveTab] = useState<TabId>(initialTab);
    const { initCloudAccounts } = useCloudStore();
    useEffect(() => { initCloudAccounts(); }, [initCloudAccounts]);

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

    const handlePullModel = async () => {
        if (!pullModelName.trim()) return;
        setIsPullingModel(true);
        setPullProgress(t.settings.ollamaConnecting);
        try {
            const { listen } = await import("@tauri-apps/api/event");
            const unlisten = await listen<{ status: string; completed?: number; total?: number }>("ollama-pull-progress", (event) => {
                const { status, completed, total } = event.payload;
                if (completed && total) {
                    const pct = Math.round((completed / total) * 100);
                    setPullProgress(`${status} ${pct}%`);
                } else {
                    setPullProgress(status);
                }
            });
            const { invoke } = await import("@tauri-apps/api/core");
            await invoke("ollama_pull_model", { modelName: pullModelName.trim() });
            unlisten();
            setPullProgress(t.settings.pullComplete.replace('{model}', pullModelName));
            setPullModelName("");
            refreshLocalModels();
        } catch (err) {
            setPullProgress(t.settings.pullFailed.replace('{error}', String(err)));
        } finally {
            setIsPullingModel(false);
        }
    };

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
        <div className="flex-1 flex h-full overflow-hidden">
            {/* 左侧导航 */}
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
                                    onClick={() => setActiveTab(item.id as typeof activeTab)}
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

            {/* 右侧内容 */}
            {["agents", "knowledge", "skills", "connections"].includes(activeTab) ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                        className="flex-1 overflow-hidden"
                    >
                        {activeTab === "agents" && (
                            <Suspense fallback={<div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}>
                                <AgentWorkbenchPage />
                            </Suspense>
                        )}
                        {activeTab === "knowledge" && (
                            <Suspense fallback={<div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}>
                                <KnowledgePage />
                            </Suspense>
                        )}
                        {activeTab === "skills" && (
                            <Suspense fallback={<div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}>
                                <SkillStorePage />
                            </Suspense>
                        )}
                        {activeTab === "connections" && (
                            <Suspense fallback={<div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}>
                                <ConnectionsPage />
                            </Suspense>
                        )}
                    </motion.div>
                </div>
            ) : (
            <div className="flex-1 overflow-y-auto no-scrollbar p-6 pb-0">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="max-w-3xl mx-auto space-y-5 pb-10"
                >

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
                            className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-6 space-y-5" style={{ boxShadow: 'var(--panel-shadow)' }}
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

                        {/* API Key — local 模式下显示 Ollama 状态 */}
                        {provider !== "local" ? (
                            <motion.section
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-6 space-y-4" style={{ boxShadow: 'var(--panel-shadow)' }}
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
                                className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-5" style={{ boxShadow: 'var(--panel-shadow)' }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-2.5 h-2.5 rounded-full ${localModels.length > 0 ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
                                    <span className="text-[13px] font-medium text-foreground">
                                        {localModels.length > 0
                                            ? t.settings.ollamaConnected.replace('{count}', String(localModels.length))
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

                        {/* 模型选择 */}
                        <motion.section
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-6 space-y-4" style={{ boxShadow: 'var(--panel-shadow)' }}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-primary/[0.06] border border-border/50 flex items-center justify-center">
                                    <Zap className="w-4.5 h-4.5 text-primary" />
                                </div>
                                <h2 className="text-[17px] font-bold">{t.settings.model}</h2>
                            </div>

                            {provider !== 'local' ? (
                                /* ── 云端 Provider：下拉选择 ── */
                                <div className="relative" ref={dropdownRef}>
                                    <button
                                        onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                                        className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-[14px] font-semibold transition-all border border-border/50 dark:border-white/[0.06] bg-card/60 dark:bg-card/40 text-foreground hover:bg-card/80 dark:hover:bg-card/60"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <span>{currentModelOption?.name}</span>
                                            {currentModelOption?.tag && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                                                    currentModelOption.tag === "strongest" ? "bg-amber-500/20 text-amber-500 dark:text-amber-300" :
                                                    currentModelOption.tag === "recommended" ? "bg-green-500/20 text-green-600 dark:text-green-300" :
                                                    currentModelOption.tag === "fast" ? "bg-cyan-500/20 text-cyan-600 dark:text-cyan-300" :
                                                    currentModelOption.tag === "reasoning" ? "bg-violet-500/20 text-violet-600 dark:text-violet-300" :
                                                    currentModelOption.tag === "general" ? "bg-blue-500/20 text-blue-600 dark:text-blue-300" :
                                                    currentModelOption.tag === "free" ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300" :
                                                    currentModelOption.tag === "value" ? "bg-teal-500/20 text-teal-600 dark:text-teal-300" :
                                                    "bg-muted/50 text-muted-foreground"
                                                }`}>
                                                    {TAG_LABELS[currentModelOption.tag] || currentModelOption.tag}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[12px] text-muted-foreground font-mono">{currentModelOption?.id}</span>
                                            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
                                        </div>
                                    </button>

                                    <AnimatePresence>
                                        {isModelDropdownOpen && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -5 }}
                                                transition={{ duration: 0.15 }}
                                                className="absolute z-50 top-full left-0 right-0 mt-2 p-1.5 bg-card dark:bg-card border border-border/60 dark:border-white/[0.08] rounded-xl max-h-72 overflow-y-auto no-scrollbar" style={{ boxShadow: 'var(--panel-shadow)' }}
                                            >
                                                {currentOptions.map((m) => (
                                                    <button
                                                        key={m.id}
                                                        onClick={() => { setModel(m.id); setIsModelDropdownOpen(false); }}
                                                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-[13px] font-semibold transition-colors ${model === m.id
                                                            ? "bg-primary/10 text-primary"
                                                            : "text-foreground/80 hover:bg-muted/40 hover:text-foreground"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <span>{m.name}</span>
                                                            {m.tag && (
                                                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                                                                    model === m.id ? "bg-primary/15 text-primary" :
                                                                    m.tag === "strongest" ? "bg-amber-500/15 text-amber-600 dark:text-amber-300" :
                                                                    m.tag === "recommended" ? "bg-green-500/15 text-green-600 dark:text-green-300" :
                                                                    m.tag === "fast" ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300" :
                                                                    m.tag === "reasoning" ? "bg-violet-500/15 text-violet-600 dark:text-violet-300" :
                                                                    m.tag === "general" ? "bg-blue-500/15 text-blue-600 dark:text-blue-300" :
                                                                    m.tag === "free" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" :
                                                                    m.tag === "value" ? "bg-teal-500/15 text-teal-600 dark:text-teal-300" :
                                                                    "bg-muted/50 text-muted-foreground"
                                                                }`}>
                                                                    {TAG_LABELS[m.tag] || m.tag}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className={`text-[11px] font-mono ${model === m.id ? "text-primary/70" : "text-muted-foreground/50"}`}>{m.id}</span>
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            ) : (
                                /* ── 本地 Provider：完整的 Ollama 模型管理 ── */
                                <div className="space-y-4">
                                    {/* 已安装模型列表 */}
                                    {localModels.length > 0 ? (
                                        <div className="space-y-1.5">
                                            {localModels.map((m) => {
                                                const isActive = model === m.id || model === m.name;
                                                return (
                                                    <button
                                                        key={m.id}
                                                        onClick={() => setModel(m.id)}
                                                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-left transition-all duration-150 ${isActive
                                                            ? "bg-primary/10 border border-primary/30 ring-1 ring-primary/10"
                                                            : "border border-transparent hover:bg-muted/30"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${isActive ? "bg-primary/15" : "bg-muted/30"}`}>
                                                                <HardDrive className={`w-3.5 h-3.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <span className={`text-[13px] font-semibold font-mono truncate block ${isActive ? "text-primary" : "text-foreground"}`}>{m.name}</span>
                                                                {m.tag && m.tag !== "latest" && (
                                                                    <span className="text-[10px] text-muted-foreground/60 font-mono">{m.tag}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {isActive && (
                                                            <span className="text-[10px] px-2 py-0.5 rounded bg-primary/15 text-primary font-medium shrink-0">{t.extensions.active}</span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-muted-foreground/50">
                                            <HardDrive className="w-8 h-8 mx-auto mb-2" />
                                            <p className="text-[13px] font-medium">{t.settings.ollamaDisconnected}</p>
                                        </div>
                                    )}

                                    {/* 拉取模型 */}
                                    <div className="pt-3 border-t border-border/40 space-y-3">
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder={t.settings.pullPlaceholder}
                                                value={pullModelName}
                                                onChange={(e) => setPullModelName(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handlePullModel()}
                                                className="flex-1 bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3.5 py-2 text-[13px] font-mono focus:border-primary/30 focus:ring-1 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/40"
                                            />
                                            <button
                                                onClick={handlePullModel}
                                                disabled={!pullModelName.trim() || isPullingModel}
                                                className="px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary/90 disabled:opacity-40 transition-all flex items-center gap-1.5"
                                            >
                                                {isPullingModel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                                {isPullingModel ? t.settings.pulling : t.settings.pullModel}
                                            </button>
                                        </div>
                                        {pullProgress && (
                                            <div className="text-[11px] text-muted-foreground bg-black/[0.03] dark:bg-white/[0.04] border border-border/30 rounded-lg px-3 py-2 font-mono">
                                                {pullProgress}
                                            </div>
                                        )}
                                        {/* 推荐模型快捷标签 */}
                                        <div className="flex flex-wrap gap-1.5">
                                            {["llama3.3", "qwen2.5:7b", "deepseek-r1:14b", "mistral", "gemma2:9b"].map((name) => {
                                                const installed = localModels.some((m) => name.startsWith(m.name?.split(":")[0]));
                                                return (
                                                    <button
                                                        key={name}
                                                        disabled={installed || isPullingModel}
                                                        onClick={() => { setPullModelName(name); }}
                                                        className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors ${installed
                                                            ? "bg-emerald-500/10 text-emerald-500 cursor-default"
                                                            : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground cursor-pointer"
                                                        }`}
                                                    >
                                                        {installed ? "[v] " : ""}{name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.section>

                        {/* TTS (Voice Interaction) */}
                        <motion.section
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-6 space-y-4 flex items-center justify-between" style={{ boxShadow: 'var(--panel-shadow)' }}
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
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${enableTTS ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
                            >
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enableTTS ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
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
                            className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-6 space-y-5" style={{ boxShadow: 'var(--panel-shadow)' }}
                        >
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-primary/[0.06] border border-border/50 flex items-center justify-center">
                                        <Zap className="w-4.5 h-4.5 text-primary" />
                                    </div>
                                    <div>
                                        <h2 className="text-[17px] font-bold">{t.extensions.title}</h2>
                                        <p className="text-[13px] text-muted-foreground mt-0.5">{t.extensions.subtitle}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsAddExtModalOpen(true)}
                                    className="px-4 py-2 rounded-xl text-[13px] font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-2"
                                >
                                    <Zap className="w-3.5 h-3.5" />
                                    {t.extensions.addServer}
                                </button>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {servers.length > 0 ? (
                                    servers.map((s) => (
                                        <div key={s.id} className="flex items-center justify-between p-5 rounded-xl border border-border/50 dark:border-white/[0.06] bg-card/60 dark:bg-card/40 group">
                                            <div className="flex items-center gap-4 min-w-0 flex-1">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-colors shrink-0 ${s.status === 'active' ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-muted/20 border-border/50 text-muted-foreground'}`}>
                                                    <Zap className="w-6 h-6" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-[16px]">{s.name}</span>
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${s.status === 'active' ? 'bg-green-500/20 text-green-600' : 'bg-red-500/10 text-muted-foreground'}`}>
                                                            {s.status === 'active' ? t.extensions.active : t.extensions.inactive}
                                                        </span>
                                                    </div>
                                                    <div className="text-[12px] text-muted-foreground font-mono mt-0.5 opacity-60 truncate max-w-[300px]">{s.url}</div>
                                                    <div className="text-[11px] font-bold text-primary mt-1">{t.extensions.toolsFound.replace('{count}', s.toolCount.toString())}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => toggleServer(s.id)}
                                                    className={`px-4 py-2 rounded-lg text-[13px] font-bold transition-all cursor-pointer ${s.status === 'active' ? 'bg-muted/50 text-foreground hover:bg-muted/70' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
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
                                    <div className="text-center py-12 bg-black/[0.02] dark:bg-white/[0.02] rounded-xl border border-dashed border-border/50">
                                        <p className="text-muted-foreground font-medium">{t.extensions.empty}</p>
                                    </div>
                                )}
                            </div>
                        </motion.section>
                    </motion.div>
                )}

                {activeTab === "memory" && (
                    <MemoryManager />
                )}

                {activeTab === "usage" && (
                    <Suspense fallback={<div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}>
                        <UsagePage />
                    </Suspense>
                )}

                {activeTab === "sync" && (
                    <Suspense fallback={<div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}>
                        <SyncPage />
                    </Suspense>
                )}

                {activeTab === "security" && (
                    <Suspense fallback={<div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}>
                        <SecurityPage />
                    </Suspense>
                )}

                </motion.div>
            </div>
            )}

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
                            className="relative w-full max-w-xl bg-card border border-border/60 dark:border-white/[0.08] rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--panel-shadow)' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-8 space-y-8">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-2xl font-black tracking-tight">{t.extensions.addServer}</h2>
                                        <p className="text-sm text-muted-foreground mt-1">{t.extensions.addServerDesc}</p>
                                    </div>
                                    <button
                                        onClick={() => setIsAddExtModalOpen(false)}
                                        className="p-2 rounded-full hover:bg-muted/50 transition-colors"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>

                                {/* Presets Section */}
                                <div className="space-y-4">
                                    <h3 className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider px-1">{t.extensions.presets}</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {MCP_PRESETS.map((p) => (
                                            <button
                                                key={p.name}
                                                onClick={() => handleAddPreset(p)}
                                                className="flex items-center gap-3 p-4 rounded-xl border border-border/50 dark:border-white/[0.06] bg-card/60 dark:bg-card/40 hover:bg-card/80 dark:hover:bg-card/60 hover:border-border/80 transition-all text-left group"
                                            >
                                                <div className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center p-2 group-hover:scale-110 transition-transform">
                                                    {p.name === "Notion" && <NotionIcon className="w-full h-full" />}
                                                    {p.name === "GitHub" && <GithubIcon className="w-full h-full" />}
                                                    {p.name === "Slack" && <SlackIcon className="w-full h-full" />}
                                                    {p.name === "PostgreSQL" && <PostgresIcon className="w-full h-full" />}
                                                    {p.name === "Browser Fetch" && <WorldIcon className="w-full h-full font-bold" />}
                                                    {p.name === "OpenClaw Interpreter" && <Zap className="w-full h-full p-1 text-emerald-400" />}
                                                    {!["Notion", "GitHub", "Slack", "PostgreSQL", "Browser Fetch", "OpenClaw Interpreter"].includes(p.name) && <Server className="w-full h-full p-1" />}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-[14px]">{p.name}</div>
                                                    <div className="text-[11px] text-muted-foreground line-clamp-1 opacity-60">
                                                        {p.name === "Notion" ? t.extensions.notionDesc :
                                                            p.name === "GitHub" ? t.extensions.githubDesc :
                                                                p.name === "Slack" ? t.extensions.slackDesc :
                                                                    p.name === "Browser Fetch" ? t.extensions.fetchDesc :
                                                                        p.name === "PostgreSQL" ? t.extensions.postgresDesc :
                                                                            p.name === "OpenClaw Interpreter" ? t.extensions.interpreterDesc : ""}
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
                                            className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-4 py-3 text-sm focus:border-primary/50 outline-none transition-all"
                                        />
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder={t.extensions.serverUrl}
                                                value={customUrl}
                                                onChange={(e) => setCustomUrl(e.target.value)}
                                                className="flex-1 bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-4 py-3 text-sm focus:border-primary/50 outline-none transition-all"
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

