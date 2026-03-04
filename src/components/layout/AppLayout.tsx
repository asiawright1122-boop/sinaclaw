import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, Sparkles, Trash2, FolderOpen, Database, Puzzle, Plus, Languages, Moon, Crown, BookText, Info, LogOut, ChevronRight, ChevronLeft, Sun, Monitor, Check } from "lucide-react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import AnimatedBackground from "../ui/AnimatedBackground";
import { useChatStore } from "@/store/chatStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import WelcomePage from "@/pages/WelcomePage";
import ToastContainer from "../ui/Toast";
import { translations } from "@/lib/i18n";

import { useRef } from "react";

export default function AppLayout() {
    const {
        conversations,
        activeConversationId,
        isInitializing,
        initStore,
        createConversation,
        setActiveConversation,
        deleteConversation,
        renameConversation
    } = useChatStore();

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [menuView, setMenuView] = useState<"main" | "language" | "theme">("main");
    const userMenuRef = useRef<HTMLDivElement>(null);


    const {
        theme,
        language,
        setTheme,
        setLanguage,
        hydrate: hydrateSettings
    } = useSettingsStore();
    const { currentPath, openFolder, hydrate: hydrateWorkspace } = useWorkspaceStore();

    useEffect(() => {
        initStore();
        hydrateSettings();
        hydrateWorkspace();
    }, [initStore, hydrateSettings, hydrateWorkspace]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
                setMenuView("main");
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // 主题切换逻辑
    useEffect(() => {
        const root = window.document.documentElement;
        const applyTheme = (t: "light" | "dark" | "system") => {
            if (t === "system") {
                const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                root.classList.toggle("dark", systemDark);
            } else {
                root.classList.toggle("dark", t === "dark");
            }
        };

        applyTheme(theme);

        if (theme === "system") {
            const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
            const handleChange = () => applyTheme("system");
            mediaQuery.addEventListener("change", handleChange);
            return () => mediaQuery.removeEventListener("change", handleChange);
        }
    }, [theme]);

    // 全局多语言支持
    const t = translations[language];

    const navigate = useNavigate();
    const location = useLocation();

    const handleNewChat = () => {
        createConversation();
        navigate("/");
    };

    const isStudioActive = location.pathname === "/";

    return (
        <>
            <AnimatedBackground />
            <div className="flex flex-col h-screen w-full overflow-hidden m-0 relative z-10 text-foreground font-sans bg-transparent">
                {/* macOS 标题栏 */}
                <div
                    data-tauri-drag-region
                    className="titlebar px-5 bg-transparent select-none z-50"
                >
                    <div className="flex items-center space-x-2 pointer-events-none mt-1">
                        <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-black/10 hover:bg-[#FF5F56]/80 transition-colors pointer-events-auto cursor-pointer" />
                        <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-black/10 hover:bg-[#FFBD2E]/80 transition-colors pointer-events-auto cursor-pointer" />
                        <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-black/10 hover:bg-[#27C93F]/80 transition-colors pointer-events-auto cursor-pointer" />
                    </div>
                    <div className="text-[13px] font-semibold tracking-wide text-foreground/40 pointer-events-none">
                        Sinaclaw
                    </div>
                    <div className="flex items-center w-12" />
                </div>

                {/* 主内容区 */}
                <div className="flex flex-1 pt-12 p-3 sm:px-5 sm:pb-5 gap-3 sm:gap-5 min-h-0 overflow-hidden">
                    {/* 侧边栏 */}
                    <motion.aside
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="hidden md:flex flex-col w-[240px] lg:w-[280px] bg-card/40 dark:bg-card/30 backdrop-blur-3xl border border-white/40 dark:border-white/10 rounded-3xl p-4 gap-4 shadow-xl z-20 shrink-0"
                    >
                        {/* Logo */}
                        <div className="flex items-center space-x-3 px-2 mt-1 mb-2">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
                                <Sparkles className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                                Sinaclaw
                            </span>
                        </div>

                        {/* 当前工作目录 */}
                        <button
                            onClick={openFolder}
                            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/20 dark:border-white/5 bg-white/40 dark:bg-black/20 hover:bg-white/60 dark:hover:bg-black/40 text-foreground/70 text-xs transition-all duration-200 cursor-pointer group shadow-sm"
                            title={currentPath || t.sidebar.selectWorkspace}
                        >
                            <FolderOpen className="w-4 h-4 text-primary/70 shrink-0" />
                            <span className="truncate font-medium text-[13px]">
                                {currentPath ? currentPath.split("/").pop() : t.sidebar.noWorkspace}
                            </span>
                        </button>

                        {/* 新建对话 / Agent Studio 按钮 */}
                        <button
                            onClick={handleNewChat}
                            className={`w-full flex items-center justify-center gap-2 px-3 py-3 rounded-2xl font-bold text-sm transition-all duration-300 cursor-pointer shadow-md hover:shadow-lg hover:-translate-y-[2px] active:translate-y-[0px] active:shadow-sm ${isStudioActive
                                ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                                : "bg-surface dark:bg-black/20 text-foreground border border-white/20 dark:border-white/5 hover:bg-white/40 dark:hover:bg-black/40"
                                }`}
                        >
                            <Plus className={`w-5 h-5 ${isStudioActive ? "text-primary-foreground" : "text-primary"}`} />
                            <span>{t.sidebar.newAgent}</span>
                        </button>

                        {/* 导航 */}
                        <div className="flex-1 space-y-6 mt-4 overflow-y-auto no-scrollbar">
                            {/* 工作区 */}
                            <div className="space-y-1.5">
                                <div className="px-3 mb-2">
                                    <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                        Platform
                                    </h2>
                                </div>
                                <div className="space-y-0.5">
                                    {[
                                        { to: "/knowledge", icon: Database, label: language === 'zh' ? '知识库' : 'Knowledge', end: false },
                                        { to: "/skills", icon: Puzzle, label: language === 'zh' ? '技能大厅' : 'Skill Store', end: false },
                                    ].map((item) => (
                                        <NavLink
                                            key={item.to}
                                            to={item.to}
                                            end={item.end}
                                            className={({ isActive }) =>
                                                `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-[13px] transition-all duration-200 cursor-pointer group ${isActive
                                                    ? "bg-primary/10 text-primary"
                                                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                                                }`
                                            }
                                        >
                                            <item.icon className="w-4 h-4" />
                                            <span>{item.label}</span>
                                        </NavLink>
                                    ))}
                                </div>
                            </div>

                            {/* 对话历史 */}
                            <div className="space-y-1.5">
                                <div className="px-3 mb-2">
                                    <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                        {t.sidebar.history}
                                    </h2>
                                </div>
                                <div className="space-y-0.5">
                                    {isInitializing ? (
                                        <div className="px-3 py-2 text-xs text-muted-foreground animate-pulse">
                                            Loading history...
                                        </div>
                                    ) : conversations.length === 0 ? (
                                        <div className="px-3 py-2 text-xs text-muted-foreground/50">
                                            {t.sidebar.emptyHistory}
                                        </div>
                                    ) : (
                                        conversations.map((conv) => (
                                            <div
                                                key={conv.id}
                                                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-[13px] transition-all duration-200 cursor-pointer group ${activeConversationId === conv.id
                                                    ? "bg-secondary/60 text-foreground font-medium"
                                                    : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                                                    }`}
                                                onClick={() => setActiveConversation(conv.id)}
                                                onDoubleClick={() => {
                                                    setEditingId(conv.id);
                                                    setEditTitle(conv.title);
                                                }}
                                            >
                                                <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                                                    {editingId === conv.id ? (
                                                        <input
                                                            className="bg-transparent border-b border-primary outline-none text-foreground text-[13px] w-full py-0.5"
                                                            value={editTitle}
                                                            onChange={(e) => setEditTitle(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter" && editTitle.trim()) {
                                                                    renameConversation(conv.id, editTitle.trim());
                                                                    setEditingId(null);
                                                                } else if (e.key === "Escape") {
                                                                    setEditingId(null);
                                                                }
                                                            }}
                                                            onBlur={() => {
                                                                if (editTitle.trim() && editTitle !== conv.title) {
                                                                    renameConversation(conv.id, editTitle.trim());
                                                                }
                                                                setEditingId(null);
                                                            }}
                                                            autoFocus
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    ) : (
                                                        <span className="truncate">{conv.title}</span>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteConversation(conv.id);
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors shrink-0"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 用户信息与设置菜单 */}
                        <div className="mt-auto relative" ref={userMenuRef}>
                            <AnimatePresence>
                                {isUserMenuOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                        className="absolute bottom-full left-0 w-full mb-3 bg-card/90 dark:bg-card/80 backdrop-blur-2xl border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl p-2 py-3 overflow-hidden z-50 origin-bottom"
                                    >
                                        <div className="overflow-hidden">
                                            <AnimatePresence mode="wait">
                                                {menuView === "main" && (
                                                    <motion.div
                                                        key="main"
                                                        initial={{ opacity: 0, x: -20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        exit={{ opacity: 0, x: -20 }}
                                                        className="space-y-1"
                                                    >
                                                        {[
                                                            { to: "/settings", icon: Settings, label: t.sidebar.settings },
                                                            { icon: Languages, label: t.sidebar.language, hasArrow: true, view: "language" },
                                                            { icon: Moon, label: t.sidebar.theme, hasArrow: true, view: "theme" },
                                                        ].map((item, idx) => (
                                                            <button
                                                                key={idx}
                                                                onClick={() => {
                                                                    if (item.to) {
                                                                        navigate(item.to);
                                                                        setIsUserMenuOpen(false);
                                                                    } else if (item.view) {
                                                                        setMenuView(item.view as any);
                                                                    }
                                                                }}
                                                                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] font-medium text-foreground/80 hover:bg-white/10 dark:hover:bg-white/5 hover:text-foreground transition-all duration-200"
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <item.icon className="w-4 h-4" />
                                                                    <span>{item.label}</span>
                                                                </div>
                                                                {item.hasArrow && <ChevronRight className="w-3.5 h-3.5 opacity-40 transition-transform group-hover:translate-x-0.5" />}
                                                            </button>
                                                        ))}

                                                        <div className="h-px bg-white/10 dark:bg-white/5 my-2 mx-1" />

                                                        {[
                                                            { icon: Crown, label: t.sidebar.plan },
                                                            { icon: BookText, label: t.sidebar.docs },
                                                            { icon: Info, label: t.sidebar.aboutUs },
                                                        ].map((item, idx) => (
                                                            <button
                                                                key={idx}
                                                                onClick={() => setIsUserMenuOpen(false)}
                                                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-foreground/80 hover:bg-white/10 dark:hover:bg-white/5 hover:text-foreground transition-all duration-200"
                                                            >
                                                                <item.icon className="w-4 h-4" />
                                                                <span>{item.label}</span>
                                                            </button>
                                                        ))}

                                                        <div className="h-px bg-white/10 dark:bg-white/5 my-2 mx-1" />

                                                        <button
                                                            onClick={() => setIsUserMenuOpen(false)}
                                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
                                                        >
                                                            <LogOut className="w-4 h-4" />
                                                            <span>{t.sidebar.logout}</span>
                                                        </button>
                                                    </motion.div>
                                                )}

                                                {menuView === "language" && (
                                                    <motion.div
                                                        key="language"
                                                        initial={{ opacity: 0, x: 20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        exit={{ opacity: 0, x: 20 }}
                                                        className="space-y-1"
                                                    >
                                                        <button
                                                            onClick={() => setMenuView("main")}
                                                            className="w-full flex items-center gap-3 px-3 py-2 mb-2 text-[12px] font-bold text-muted-foreground hover:text-foreground transition-colors"
                                                        >
                                                            <ChevronLeft className="w-4 h-4" />
                                                            <span>{t.common.back}</span>
                                                        </button>
                                                        {[
                                                            { id: "zh", label: "简体中文" },
                                                            { id: "en", label: "English" }
                                                        ].map((lang) => (
                                                            <button
                                                                key={lang.id}
                                                                onClick={() => setLanguage(lang.id as any)}
                                                                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] font-medium text-foreground/80 hover:bg-white/10 dark:hover:bg-white/5 transition-all duration-200"
                                                            >
                                                                <span>{lang.label}</span>
                                                                {language === lang.id && <Check className="w-4 h-4 text-primary" />}
                                                            </button>
                                                        ))}
                                                    </motion.div>
                                                )}

                                                {menuView === "theme" && (
                                                    <motion.div
                                                        key="theme"
                                                        initial={{ opacity: 0, x: 20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        exit={{ opacity: 0, x: 20 }}
                                                        className="space-y-1"
                                                    >
                                                        <button
                                                            onClick={() => setMenuView("main")}
                                                            className="w-full flex items-center gap-3 px-3 py-2 mb-2 text-[12px] font-bold text-muted-foreground hover:text-foreground transition-colors"
                                                        >
                                                            <ChevronLeft className="w-4 h-4" />
                                                            <span>{t.common.back}</span>
                                                        </button>
                                                        {[
                                                            { id: "light", label: t.sidebar.light, icon: Sun },
                                                            { id: "dark", label: t.sidebar.dark, icon: Moon },
                                                            { id: "system", label: t.sidebar.system, icon: Monitor }
                                                        ].map((mode) => (
                                                            <button
                                                                key={mode.id}
                                                                onClick={() => setTheme(mode.id as any)}
                                                                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] font-medium text-foreground/80 hover:bg-white/10 dark:hover:bg-white/5 transition-all duration-200"
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <mode.icon className="w-4 h-4" />
                                                                    <span>{mode.label}</span>
                                                                </div>
                                                                {theme === mode.id && <Check className="w-4 h-4 text-primary" />}
                                                            </button>
                                                        ))}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div
                                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                className={`p-3 rounded-2xl border transition-all duration-300 cursor-pointer shadow-sm group flex items-center gap-3 ${isUserMenuOpen
                                    ? "bg-white/50 dark:bg-card/80 border-primary/30"
                                    : "bg-white/30 dark:bg-black/20 border-white/30 dark:border-white/5 hover:bg-white/50 dark:hover:bg-black/40"
                                    }`}
                            >
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-primary flex items-center justify-center text-sm font-bold text-white shadow-md group-hover:scale-105 transition-transform duration-300 shrink-0">
                                    K
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[13px] font-bold text-foreground truncate">Kaka wah</span>
                                    <span className="text-[11px] text-muted-foreground font-medium truncate">Pro trial Plan</span>
                                </div>
                            </div>
                        </div>
                    </motion.aside>

                    {/* 主面板 */}
                    <main className="flex-1 flex flex-col relative min-h-0 overflow-hidden bg-card/60 dark:bg-card/40 backdrop-blur-3xl border border-white/40 dark:border-white/10 rounded-3xl shadow-xl z-20">
                        {currentPath ? <Outlet /> : <WelcomePage />}
                    </main>
                </div>
            </div>
            <ToastContainer />
        </>
    );
}

