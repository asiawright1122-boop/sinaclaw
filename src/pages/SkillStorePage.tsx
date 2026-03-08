import { useEffect, useState } from "react";
import {
    RefreshCw, Search, Plus, Sparkles, Filter,
    Globe, Calculator, Terminal,
    Check, Loader2, LayoutTemplate, Download, ShoppingBag, ArrowUpRight
} from "lucide-react";
import { useToastStore } from "@/store/toastStore";
import { skillManager, type LoadedSkill } from "@/lib/skills";
import { fetchRegistry, installSkill, isSkillInstalled, exportSkillForPublish, type RemoteSkill } from "@/lib/skillRegistry";
import { useTranslate } from "@/lib/i18n";
import IconById from "@/components/ui/IconById";
import SkillMakerPage from "./SkillMakerPage";

export default function SkillStorePage() {
    const t = useTranslate();
    const [localSkills, setLocalSkills] = useState<LoadedSkill[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<"all" | "installed" | "marketplace">("all");
    const addToast = useToastStore(state => state.addToast);

    // 在线市场状态
    const [marketSkills, setMarketSkills] = useState<RemoteSkill[]>([]);
    const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
    const [installingId, setInstallingId] = useState<string | null>(null);
    const [publishJson, setPublishJson] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);


    const loadSkills = async () => {
        setIsLoading(true);
        try {
            await skillManager.init();
            setLocalSkills(skillManager.getAllSkills());
        } catch (error) {
            addToast(t.skills.loadError, "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadSkills();
        loadMarketplace();
    }, []);

    const loadMarketplace = async () => {
        try {
            const registry = await fetchRegistry();
            setMarketSkills(registry.skills);
            const ids = new Set<string>();
            for (const s of registry.skills) {
                if (await isSkillInstalled(s.id)) ids.add(s.id);
            }
            setInstalledIds(ids);
        } catch (err) {
            console.error("加载在线市场失败:", err);
        }
    };

    const handleInstallSkill = async (skill: RemoteSkill) => {
        setInstallingId(skill.id);
        try {
            await installSkill(skill);
            setInstalledIds(prev => new Set(prev).add(skill.id));
            await loadSkills();
            addToast(`技能 [${skill.name}] 安装成功`, "success");
        } catch (err) {
            addToast(`安装失败: ${err instanceof Error ? err.message : String(err)}`, "error");
        } finally {
            setInstallingId(null);
        }
    };

    const handleToggleLocalSkill = async (skillId: string, currentEnabled: boolean) => {
        try {
            await skillManager.toggleSkill(skillId, !currentEnabled);
            setLocalSkills([...skillManager.getAllSkills()]);
            const statusText = !currentEnabled ? t.skills.enabled : t.skills.disabled;
            addToast(t.skills.toggleSuccess.replace("{id}", skillId).replace("{status}", statusText), "success");
        } catch (error) {
            addToast(t.common.error, "error");
        }
    };

    const filteredLocal = localSkills.filter(s =>
        (activeTab === "all" || activeTab === "installed") &&
        (s.definition.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.definition.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (isCreating) {
        return <SkillMakerPage onBack={() => setIsCreating(false)} />;
    }

    return (
        <>
            <div className="h-full bg-background flex flex-col overflow-hidden text-foreground font-sans selection:bg-primary/20">
                {/* Top Navigation Bar: Premium Minimalist */}
                <div className="flex items-center justify-between px-6 py-3.5 flex-shrink-0 border-b border-border/40 z-10">
                    <div className="flex-1" />
                    <div className="flex items-center gap-4">
                        <button
                            onClick={loadSkills}
                            className="p-2 text-muted-foreground hover:text-foreground transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.05] rounded-lg"
                        >
                            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-foreground" : ""}`} />
                        </button>

                        <div className="relative w-64 group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
                            <input
                                type="text"
                                placeholder={t.skills.searchPlaceholder}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-1.5 text-[13px] bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/40"
                            />
                        </div>

                        <button
                            onClick={() => setIsCreating(true)}
                            className="flex items-center gap-2 px-5 py-1.5 text-[13px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-all"
                        >
                            <Sparkles className="w-4 h-4 text-yellow-500 dark:text-yellow-600" />
                            <span>创建技能</span>
                        </button>

                        <button className="flex items-center gap-2 px-4 py-1.5 text-[13px] font-medium bg-card border border-border/60 dark:border-white/[0.08] text-foreground/80 hover:bg-muted/50 rounded-lg transition-colors hidden sm:flex">
                            <Plus className="w-4 h-4" />
                            <span>{t.skills.installSkill}</span>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-8 pb-12 min-h-0 relative">

                    <div className="max-w-6xl mx-auto pt-8 relative z-10">
                        {/* Header */}
                        <div className="mb-8">
                            <h1 className="text-2xl font-semibold text-foreground mb-1.5">{t.skills.title}</h1>
                            <p className="text-muted-foreground text-[13px]">
                                {t.skills.subtitle}
                            </p>
                        </div>

                        {/* Banner: Liquid Glass Minimal */}
                        <div className="w-full h-[160px] bg-card/80 dark:bg-card/50 rounded-xl relative overflow-hidden mb-10 border border-border/50 dark:border-white/[0.06]" style={{ boxShadow: 'var(--panel-shadow)' }}>
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent"></div>

                            <div className="relative h-full flex flex-row items-center justify-between px-10">
                                <div className="max-w-lg z-10">
                                    <h2 className="text-lg font-semibold text-foreground mb-1.5">
                                        {t.skills.bannerTitle}
                                    </h2>
                                    <p className="text-muted-foreground text-[13px] leading-relaxed">
                                        {t.skills.bannerDesc}
                                    </p>
                                </div>

                                {/* Abstract Geometry Graphics */}
                                <div className="relative w-64 h-full flex items-center justify-center opacity-80">
                                    <div className="absolute right-8 w-20 h-28 bg-primary/[0.04] dark:bg-primary/10 rounded-lg border border-border/50 rotate-[12deg] flex flex-col items-center justify-center gap-2 transform transition-transform hover:rotate-6">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                            <LayoutTemplate className="w-4 h-4 text-foreground/60" />
                                        </div>
                                        <div className="text-[9px] font-medium text-muted-foreground">DocMaker</div>
                                    </div>
                                    <div className="absolute right-20 w-20 h-28 bg-card dark:bg-card/80 rounded-lg border border-border/50 rotate-[-8deg] z-10 flex flex-col items-center justify-center gap-2 transform transition-transform hover:rotate-0">
                                        <div className="w-8 h-8 rounded-full bg-primary/[0.06] dark:bg-primary/10 flex items-center justify-center">
                                            <Globe className="w-4 h-4 text-foreground/60" />
                                        </div>
                                        <div className="text-[9px] font-medium text-muted-foreground">Web Search</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tabs & Filters */}
                        <div className="flex items-center justify-between border-b border-border/40 mb-8">
                            <div className="flex gap-6">
                                {[
                                    { id: "all", label: t.skills.allSkills },
                                    { id: "installed", label: t.skills.installed, count: localSkills.length },
                                    { id: "marketplace", label: t.skills.official === "官方精选" ? "在线市场" : "Marketplace", count: marketSkills.length, icon: ShoppingBag }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as any)}
                                        className={`flex items-center gap-2 pb-3 text-[13px] transition-colors duration-150 relative ${activeTab === tab.id ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
                                    >
                                        {tab.icon && <tab.icon className="w-3.5 h-3.5" />}
                                        {tab.label}
                                        {tab.count !== undefined && (
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                                {tab.count}
                                            </span>
                                        )}
                                        {activeTab === tab.id && <div className="absolute bottom-[-1px] left-0 right-0 h-[1.5px] bg-foreground"></div>}
                                    </button>
                                ))}
                            </div>

                            <button className="flex items-center gap-2 px-3 py-1.5 mb-2 text-[12px] text-muted-foreground border border-border/50 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors">
                                <Filter className="w-3 h-3" />
                                <span>{t.common.all || "All"}</span>
                            </button>
                        </div>

                        {/* Skill Lists */}
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                                <Loader2 className="w-6 h-6 animate-spin mb-4 text-foreground/70" />
                                <span className="text-[13px] tracking-widest uppercase font-medium">{t.skills.loading}</span>
                            </div>
                        ) : (
                            <div className="space-y-12">

                                {/* User local skills */}
                                {(activeTab === "all" || activeTab === "installed") && (
                                    <div>
                                        <h3 className="text-[11px] font-semibold text-muted-foreground dark:text-muted-foreground tracking-widest uppercase mb-4 px-1 flex items-center gap-2">
                                            {t.skills.other} <span className="lowercase opacity-70">({filteredLocal.length})</span>
                                        </h3>
                                        {filteredLocal.length === 0 ? (
                                            <div className="border border-dashed border-border rounded-2xl p-12 flex flex-col items-center justify-center text-center bg-transparent">
                                                <div className="w-12 h-12 rounded-full border border-border flex items-center justify-center mb-4">
                                                    <Terminal className="w-5 h-5 text-muted-foreground" />
                                                </div>
                                                <h4 className="text-[14px] font-medium text-foreground tracking-wide mb-1">{t.skills.empty}</h4>
                                                <p className="text-[13px] text-muted-foreground max-w-sm font-light mt-2">
                                                    {t.skills.emptyDesc}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                {filteredLocal.map(skill => {
                                                    let IconComponent = Terminal;
                                                    let colorClass = "text-foreground/80 bg-primary/5 dark:bg-primary/10";
                                                    if (skill.definition.name.toLowerCase().includes("calc")) {
                                                        IconComponent = Calculator;
                                                        colorClass = "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20";
                                                    }

                                                    return (
                                                        <div key={skill.id} className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-4.5 flex flex-col hover:border-border/80 dark:hover:border-white/[0.12] transition-all duration-150 group" style={{ boxShadow: 'var(--panel-shadow)' }}>
                                                            <div className="flex items-center justify-between mb-3 text-foreground">
                                                                <div className="flex items-center gap-3 overflow-hidden">
                                                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border border-border/40 ${!skill.enabled ? 'grayscale opacity-60' : ''} ${colorClass}`}>
                                                                        <IconComponent className="w-5 h-5" />
                                                                    </div>
                                                                    <h4 className={`font-semibold text-[13px] truncate ${!skill.enabled ? 'text-muted-foreground' : ''}`}>
                                                                        {skill.definition.name}
                                                                    </h4>
                                                                </div>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleToggleLocalSkill(skill.id, skill.enabled);
                                                                    }}
                                                                    className={`w-10 h-5 rounded-full shrink-0 relative transition-colors duration-200 ${skill.enabled ? 'bg-primary' : 'bg-muted'}`}
                                                                >
                                                                    <div className={`absolute top-0.5 w-4 h-4 bg-card dark:bg-card rounded-full transition-transform duration-300 shadow-sm ${skill.enabled ? 'translate-x-5' : 'translate-x-0.5'}`}>
                                                                    </div>
                                                                </button>
                                                            </div>
                                                            <p className={`text-[12px] line-clamp-2 leading-relaxed flex-1 ${skill.enabled ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                                                                {skill.definition.description}
                                                            </p>
                                                            <button
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    try {
                                                                        const { registryEntry } = await exportSkillForPublish(skill.id);
                                                                        setPublishJson(JSON.stringify(registryEntry, null, 2));
                                                                    } catch (err) {
                                                                        addToast(`导出失败: ${err instanceof Error ? err.message : String(err)}`, "error");
                                                                    }
                                                                }}
                                                                className="mt-3 w-full py-1.5 rounded-lg text-[11px] font-medium bg-black/[0.03] dark:bg-white/[0.04] text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors duration-150 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5"
                                                            >
                                                                <ArrowUpRight className="w-3.5 h-3.5" /> Share / Export
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 在线市场 */}
                                {activeTab === "marketplace" && (
                                    <div>
                                        <h3 className="text-[11px] font-semibold text-muted-foreground dark:text-muted-foreground tracking-widest uppercase mb-4 px-1 flex items-center gap-2">
                                            {t.skills.official === "官方精选" ? "官方交易市场" : "Official Exchange"} <span className="lowercase opacity-70">({marketSkills.length})</span>
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                            {marketSkills.filter(s =>
                                                s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                s.description.toLowerCase().includes(searchQuery.toLowerCase())
                                            ).map(skill => (
                                                <div key={skill.id} className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-4.5 flex flex-col hover:border-border/80 dark:hover:border-white/[0.12] transition-all duration-150 relative group" style={{ boxShadow: 'var(--panel-shadow)' }}>
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="w-9 h-9 rounded-lg bg-primary/[0.06] dark:bg-primary/10 border border-border/40 flex items-center justify-center text-lg shrink-0">
                                                            <IconById id={skill.icon || 'pkg'} size={20} />
                                                        </div>
                                                        <div className="overflow-hidden">
                                                            <h4 className="font-semibold text-[13px] truncate text-foreground">{skill.name}</h4>
                                                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-widest font-medium mt-0.5">
                                                                <span>{skill.author}</span>
                                                                <span>·</span>
                                                                <span>v{skill.version}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <p className="text-[12px] text-muted-foreground line-clamp-2 leading-relaxed flex-1 mb-3">
                                                        {skill.description}
                                                    </p>
                                                    {skill.trigger && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-500 font-mono mb-3 self-start">
                                                            {skill.trigger.type}: {skill.trigger.pattern.slice(0, 30)}
                                                        </span>
                                                    )}

                                                    <button
                                                        onClick={() => handleInstallSkill(skill)}
                                                        disabled={installedIds.has(skill.id) || installingId === skill.id}
                                                        className={`w-full py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150 ${installedIds.has(skill.id)
                                                            ? 'bg-muted border border-border/40 text-muted-foreground cursor-default'
                                                            : installingId === skill.id
                                                                ? 'bg-muted border border-border/40 text-muted-foreground cursor-wait'
                                                                : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                                            }`}
                                                    >
                                                        {installedIds.has(skill.id) ? (
                                                            <span className="flex items-center justify-center gap-1.5"><Check className="w-3.5 h-3.5" /> Installed</span>
                                                        ) : installingId === skill.id ? (
                                                            <span className="flex items-center justify-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Fetching...</span>
                                                        ) : (
                                                            <span className="flex items-center justify-center gap-1.5"><Download className="w-3.5 h-3.5" /> Install</span>
                                                        )}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Publish Output Modal in Vercel Style */}
            {
                publishJson && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={() => setPublishJson(null)}>
                        <div className="bg-card dark:bg-card rounded-2xl p-6 max-w-lg w-full mx-4 border border-border/60 dark:border-white/[0.08]" style={{ boxShadow: 'var(--panel-shadow)' }} onClick={(e) => e.stopPropagation()}>
                            <h3 className="text-lg font-semibold text-foreground mb-1.5">Export Schema</h3>
                            <p className="text-[13px] text-muted-foreground mb-5 leading-relaxed">
                                Submit this JSON payload to your designated repository or sharing channel to initiate deployment across the grid.
                            </p>
                            <div className="relative group">
                                <pre className="bg-black/[0.03] dark:bg-white/[0.03] p-4 rounded-lg text-[11px] font-mono text-foreground/80 overflow-auto max-h-64 mb-5 border border-border/40">
                                    {publishJson}
                                </pre>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(publishJson!);
                                        addToast("Code payload secured in clipboard", "success");
                                    }}
                                    className="flex-1 py-2 rounded-lg text-[13px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                                >
                                    Copy Payload
                                </button>
                                <button
                                    onClick={() => setPublishJson(null)}
                                    className="px-5 py-2 rounded-lg text-[13px] text-muted-foreground border border-border/50 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-all"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    );
}
