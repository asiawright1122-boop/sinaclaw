import { useEffect, useState } from "react";
import {
    RefreshCw, Search, Plus, Sparkles, Filter,
    Globe, MonitorPlay, Calculator, Terminal,
    Check, Loader2, LayoutTemplate
} from "lucide-react";
import { useToastStore } from "@/store/toastStore";
import { skillManager, type LoadedSkill } from "@/lib/skills";
import { useTranslate } from "@/lib/i18n";

export default function SkillStorePage() {
    const t = useTranslate();
    const [localSkills, setLocalSkills] = useState<LoadedSkill[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<"all" | "builtin" | "installed">("all");
    const addToast = useToastStore(state => state.addToast);

    // 模拟内置核心工具的展示数据 (Localizable)
    const BUILT_IN_SKILLS = [
        {
            id: "core_search_web",
            name: t.sidebar.knowledge === "知识库" ? "网页搜索" : "Web Search",
            description: t.skills.official === "官方精选"
                ? "综合性研究助手，能从多个搜索结果中综合提炼信息。"
                : "Comprehensive research assistant that synthesizes information from multiple search results.",
            icon: Globe,
            color: "bg-blue-500",
            type: "Built-in"
        },
        {
            id: "core_screenshot",
            name: t.sidebar.knowledge === "知识库" ? "屏幕分析" : "Screen Analysis",
            description: t.skills.official === "官方精选"
                ? "捕获当前屏幕内容，允许 Agent 对视觉交互进行深度上下文分析。"
                : "Captures the current screen and allows the agent to analyze visual context deeply.",
            icon: MonitorPlay,
            color: "bg-emerald-500",
            type: "Built-in"
        }
    ];

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
    }, []);

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

    // Filter logic
    const filteredBuiltIn = BUILT_IN_SKILLS.filter(s =>
        (activeTab === "all" || activeTab === "builtin") &&
        (s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const filteredLocal = localSkills.filter(s =>
        (activeTab === "all" || activeTab === "installed") &&
        (s.definition.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.definition.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="h-full bg-white dark:bg-[#121212] flex flex-col overflow-hidden text-slate-800 dark:text-slate-200 font-sans">
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between px-8 py-4 flex-shrink-0 border-b border-transparent">
                <div className="flex-1" />
                <div className="flex items-center gap-3">
                    <button
                        onClick={loadSkills}
                        className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-blue-500" : ""}`} />
                    </button>

                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder={t.skills.searchPlaceholder}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-1.5 text-sm bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-full focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-600 transition-all placeholder:text-slate-400"
                        />
                    </div>

                    <button className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full transition-colors">
                        <Sparkles className="w-4 h-4" />
                        <span>{t.skills.createWith}</span>
                    </button>

                    <button className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-800 dark:hover:bg-slate-200 rounded-full transition-colors hidden sm:flex shadow-sm">
                        <Plus className="w-4 h-4" />
                        <span>{t.skills.installSkill}</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 pb-12 min-h-0">
                <div className="max-w-6xl mx-auto pt-6">
                    {/* Header */}
                    <div className="mb-6">
                        <h1 className="text-[32px] font-bold tracking-tight mb-2">{t.skills.title}</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-[15px]">
                            {t.skills.subtitle}
                        </p>
                    </div>

                    {/* Banner */}
                    <div className="w-full h-[180px] bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/40 dark:to-cyan-950/40 rounded-2xl relative overflow-hidden mb-8 border border-blue-100/50 dark:border-blue-900/30">
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay"></div>
                        <div className="relative h-full flex items-center px-10">
                            <div className="max-w-lg z-10">
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                                    {t.skills.bannerTitle}
                                </h2>
                                <p className="text-slate-600 dark:text-slate-400">
                                    {t.skills.bannerDesc}
                                </p>
                            </div>

                            {/* Decorative graphics */}
                            <div className="absolute right-10 top-1/2 -translate-y-1/2 flex gap-4 rotate-[-6deg] opacity-90">
                                <div className="w-32 h-40 bg-white dark:bg-slate-800 rounded-xl shadow-xl flex flex-col items-center justify-center p-4 transform translate-y-4 -rotate-6 border border-slate-100 dark:border-slate-700">
                                    <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-500/20 text-orange-500 flex items-center justify-center mb-3">
                                        <LayoutTemplate className="w-6 h-6" />
                                    </div>
                                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">DocMaker</div>
                                    <div className="text-[9px] text-slate-400 text-center mt-1">One-click export</div>
                                </div>
                                <div className="w-32 h-40 bg-white dark:bg-slate-800 rounded-xl shadow-xl flex flex-col items-center justify-center p-4 transform z-10 border border-slate-100 dark:border-slate-700">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-500/20 text-blue-500 flex items-center justify-center mb-3">
                                        <Globe className="w-6 h-6" />
                                    </div>
                                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Web Research</div>
                                    <div className="text-[9px] text-slate-400 text-center mt-1">Deep search web</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tabs & Filters */}
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 mb-6">
                        <div className="flex gap-8">
                            <button
                                onClick={() => setActiveTab("all")}
                                className={`pb-4 text-[15px] font-medium transition-colors relative ${activeTab === "all" ? "text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}
                            >
                                {t.skills.allSkills}
                                {activeTab === "all" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black dark:bg-white rounded-t-full"></div>}
                            </button>
                            <button
                                onClick={() => setActiveTab("builtin")}
                                className={`pb-4 text-[15px] font-medium transition-colors relative ${activeTab === "builtin" ? "text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}
                            >
                                {t.skills.builtin}
                                {activeTab === "builtin" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black dark:bg-white rounded-t-full"></div>}
                            </button>
                            <button
                                onClick={() => setActiveTab("installed")}
                                className={`flex items-center gap-2 pb-4 text-[15px] font-medium transition-colors relative ${activeTab === "installed" ? "text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}
                            >
                                {t.skills.installed}
                                <span className={`text-[11px] px-1.5 py-0.5 rounded-md ${activeTab === 'installed' ? 'bg-slate-200 dark:bg-slate-700' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                    {localSkills.length}
                                </span>
                                {activeTab === "installed" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black dark:bg-white rounded-t-full"></div>}
                            </button>
                        </div>

                        <button className="flex items-center gap-2 px-3 py-1.5 mb-2 text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                            <Filter className="w-3.5 h-3.5" />
                            <span>{t.common.all || "All"}</span>
                        </button>
                    </div>

                    {/* Skill Lists */}
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <Loader2 className="w-6 h-6 animate-spin mb-3" />
                            <span className="text-sm">{t.skills.loading}</span>
                        </div>
                    ) : (
                        <div className="space-y-10">
                            {/* Official / Built-in Selection */}
                            {(activeTab === "all" || activeTab === "builtin") && filteredBuiltIn.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4 px-1">
                                        {t.skills.official}
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                        {filteredBuiltIn.map(skill => (
                                            <div key={skill.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col hover:shadow-md transition-shadow cursor-pointer relative group">
                                                <div className="absolute top-4 right-4 text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {t.skills.builtin}
                                                </div>
                                                <div className="flex items-center gap-3 mb-3 text-slate-800 dark:text-slate-100">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm ${skill.color}`}>
                                                        <skill.icon className="w-5 h-5" />
                                                    </div>
                                                    <h4 className="font-semibold text-[15px] truncate">{skill.name}</h4>
                                                </div>
                                                <p className="text-[13px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed flex-1">
                                                    {skill.description}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* User local skills */}
                            {(activeTab === "all" || activeTab === "installed") && (
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4 px-1 flex items-center gap-2">
                                        {t.skills.other} <span className="text-xs opacity-70">· {filteredLocal.length}</span>
                                    </h3>
                                    {filteredLocal.length === 0 ? (
                                        <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-10 flex flex-col items-center justify-center text-center">
                                            <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-3">
                                                <Terminal className="w-5 h-5 text-slate-400" />
                                            </div>
                                            <h4 className="text-[15px] font-medium mb-1">{t.skills.empty}</h4>
                                            <p className="text-sm text-slate-500 max-w-sm">
                                                {t.skills.emptyDesc}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                            {filteredLocal.map(skill => {
                                                let IconComponent = Terminal;
                                                let colorClass = "bg-slate-800 text-white";
                                                if (skill.definition.name.toLowerCase().includes("calc")) {
                                                    IconComponent = Calculator;
                                                    colorClass = "bg-purple-500 text-white";
                                                }

                                                return (
                                                    <div key={skill.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col hover:border-slate-300 dark:hover:border-slate-700 transition-colors group">
                                                        <div className="flex items-center justify-between mb-3 text-slate-800 dark:text-slate-100">
                                                            <div className="flex items-center gap-3 overflow-hidden">
                                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${!skill.enabled ? 'grayscale opacity-60' : ''} ${colorClass}`}>
                                                                    <IconComponent className="w-5 h-5" />
                                                                </div>
                                                                <h4 className={`font-semibold text-[15px] truncate ${!skill.enabled ? 'text-slate-400' : ''}`}>
                                                                    {skill.definition.name}
                                                                </h4>
                                                            </div>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleToggleLocalSkill(skill.id, skill.enabled);
                                                                }}
                                                                className={`w-12 h-6 rounded-full shrink-0 relative transition-colors duration-200 ${skill.enabled ? 'bg-black dark:bg-white' : 'bg-slate-200 dark:bg-slate-700'}`}
                                                            >
                                                                <div className={`absolute top-1 w-4 h-4 bg-white dark:bg-black rounded-full transition-transform duration-200 ${skill.enabled ? 'translate-x-7' : 'translate-x-1'}`}>
                                                                    {skill.enabled && <Check className="w-3 h-3 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-black dark:text-white" />}
                                                                </div>
                                                            </button>
                                                        </div>
                                                        <p className={`text-[13px] line-clamp-2 leading-relaxed flex-1 ${skill.enabled ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400/70'}`}>
                                                            {skill.definition.description}
                                                        </p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
