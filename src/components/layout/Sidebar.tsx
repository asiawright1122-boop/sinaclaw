import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, Sparkles, Trash2, Plus, Languages, Moon, Crown, BookText, Info, LogOut, ChevronRight, ChevronLeft, Sun, Monitor, Check, Search, Pin, Archive, Inbox } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useChatStore } from "@/store/chatStore";
import { useSettingsStore } from "@/store/settingsStore";
import { translations } from "@/lib/i18n";
import { useInboxStore } from "@/store/inboxStore";
import { useChannelStore } from "@/store/channelStore";
import { ConversationSkeleton } from "@/components/ui/Skeleton";
import Tooltip from "@/components/ui/Tooltip";

export default function Sidebar() {
    const inboxTotalUnread = useInboxStore((s) => s.totalUnread);
    const channels = useChannelStore((s) => s.channels);
    const hasChannels = channels.length > 0 || inboxTotalUnread > 0;
    const {
        conversations,
        activeConversationId,
        isInitializing,
        createConversation,
        setActiveConversation,
        deleteConversation,
        renameConversation,
        pinConversation,
        archiveConversation,
        searchConversations,
    } = useChatStore();

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<typeof conversations | null>(null);
    const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [menuView, setMenuView] = useState<"main" | "language" | "theme">("main");
    const userMenuRef = useRef<HTMLDivElement>(null);

    const {
        theme,
        language,
        setTheme,
        setLanguage,
    } = useSettingsStore();

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

    const t = translations[language];
    const navigate = useNavigate();

    const handleNewChat = () => {
        createConversation();
        navigate("/");
    };

    const displayConversations = searchResults ?? conversations;
    const pinnedConvs = displayConversations.filter(c => c.pinned);
    const unpinnedConvs = displayConversations.filter(c => !c.pinned);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults(null);
            return;
        }
        const timer = setTimeout(async () => {
            const results = await searchConversations(searchQuery.trim());
            setSearchResults(results);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, searchConversations]);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
                setContextMenu(null);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isMod = e.metaKey || e.ctrlKey;
            if (isMod && e.key === "n") {
                e.preventDefault();
                handleNewChat();
            }
            if (isMod && e.key === "k") {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    const renderConvItem = (conv: typeof conversations[0]) => (
        <div
            key={conv.id}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-[13px] transition-all duration-200 cursor-pointer group active:scale-[0.98] ${activeConversationId === conv.id
                ? "bg-secondary/60 text-foreground font-medium"
                : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                }`}
            onClick={() => { setActiveConversation(conv.id); navigate("/"); }}
            onDoubleClick={() => {
                setEditingId(conv.id);
                setEditTitle(conv.title);
            }}
            onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ id: conv.id, x: e.clientX, y: e.clientY });
            }}
        >
            <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                {conv.pinned && <Pin className="w-3 h-3 text-primary/60 shrink-0" />}
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
    );

    return (
        <motion.aside
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="hidden md:flex flex-col w-[250px] bg-card/80 dark:bg-card/60 backdrop-blur-2xl border border-black/[0.06] dark:border-white/[0.08] rounded-2xl p-3.5 z-20 shrink-0"
            style={{ boxShadow: 'var(--panel-shadow)' }}
        >
            {/* Logo + 新建对话 */}
            <div className="flex items-center justify-between px-2 mt-0.5 mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="font-semibold text-[15px] tracking-tight text-foreground">
                        Sinaclaw
                    </span>
                </div>
                <Tooltip content={t.sidebar.newAgent} shortcut="⌘N">
                    <button
                        onClick={handleNewChat}
                        className="w-7 h-7 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] text-muted-foreground hover:text-foreground flex items-center justify-center transition-all active:scale-[0.90]"
                    >
                        <Plus className="w-3.5 h-3.5" />
                    </button>
                </Tooltip>
            </div>

            {/* 搜索框 */}
            <div className="px-0.5 mb-2">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="⌘K 搜索对话..."
                        className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.06] rounded-lg pl-7 pr-2 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                    />
                </div>
            </div>

            {/* 对话列表 — 核心区域 */}
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-0.5">
                {isInitializing ? (
                    <ConversationSkeleton count={6} />
                ) : displayConversations.length === 0 ? (
                    <div className="px-3 py-8 text-center">
                        <p className="text-xs text-muted-foreground/50">
                            {searchQuery ? "未找到匹配对话" : t.sidebar.emptyHistory}
                        </p>
                        {!searchQuery && (
                            <button
                                onClick={handleNewChat}
                                className="mt-3 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                            >
                                + {t.sidebar.newAgent}
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {pinnedConvs.length > 0 && (
                            <div className="px-3 pt-1 pb-0.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1">
                                    <Pin className="w-2.5 h-2.5" /> 置顶
                                </span>
                            </div>
                        )}
                        {pinnedConvs.map((conv) => renderConvItem(conv))}
                        {pinnedConvs.length > 0 && unpinnedConvs.length > 0 && (
                            <div className="h-px bg-border/40 mx-3 my-1" />
                        )}
                        {unpinnedConvs.map((conv) => renderConvItem(conv))}
                    </>
                )}

                {/* 右键上下文菜单 */}
                {contextMenu && (
                    <div
                        ref={contextMenuRef}
                        className="fixed z-[100] bg-card dark:bg-card border border-border/60 dark:border-white/[0.08] rounded-xl py-1.5 min-w-[140px]"
                        style={{ left: contextMenu.x, top: contextMenu.y, boxShadow: 'var(--panel-shadow)' }}
                    >
                        {(() => {
                            const conv = displayConversations.find(c => c.id === contextMenu.id);
                            return (
                                <>
                                    <button
                                        onClick={() => { pinConversation(contextMenu.id, !conv?.pinned); setContextMenu(null); }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-foreground/80 hover:bg-muted/50 transition-colors"
                                    >
                                        <Pin className="w-3.5 h-3.5" />
                                        {conv?.pinned ? "取消置顶" : "置顶"}
                                    </button>
                                    <button
                                        onClick={() => { archiveConversation(contextMenu.id); setContextMenu(null); }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-foreground/80 hover:bg-muted/50 transition-colors"
                                    >
                                        <Archive className="w-3.5 h-3.5" />
                                        归档
                                    </button>
                                    <button
                                        onClick={() => { setEditingId(contextMenu.id); setEditTitle(conv?.title ?? ""); setContextMenu(null); }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-foreground/80 hover:bg-muted/50 transition-colors"
                                    >
                                        <Settings className="w-3.5 h-3.5" />
                                        重命名
                                    </button>
                                    <div className="h-px bg-border/40 my-1 mx-1" />
                                    <button
                                        onClick={() => { deleteConversation(contextMenu.id); setContextMenu(null); }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        删除
                                    </button>
                                </>
                            );
                        })()}
                    </div>
                )}
            </div>

            {/* 底部导航 — 收件箱(条件) + 设置 */}
            <div className="mt-2 pt-2 border-t border-border/50 space-y-0.5">
                {/* 收件箱 — 仅在有通道连接时显示 */}
                {hasChannels && (
                    <NavLink
                        to="/inbox"
                        className={({ isActive }) =>
                            `w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 ${isActive
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                            }`
                        }
                    >
                        <Inbox className="w-4 h-4" />
                        <span className="flex-1">收件箱</span>
                        {inboxTotalUnread > 0 && (
                            <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white px-1">
                                {inboxTotalUnread > 99 ? "99+" : inboxTotalUnread}
                            </span>
                        )}
                    </NavLink>
                )}

                {/* 设置 */}
                <NavLink
                    to="/settings"
                    className={({ isActive }) =>
                        `w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 ${isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                        }`
                    }
                >
                    <Settings className="w-4 h-4" />
                    <span className="flex-1">{t.sidebar.settings}</span>
                </NavLink>
            </div>

            {/* 用户信息 */}
            <div className="mt-2 relative" ref={userMenuRef}>
                <AnimatePresence>
                    {isUserMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="absolute bottom-full left-0 w-full mb-3 bg-card dark:bg-card border border-border/60 dark:border-white/[0.08] rounded-xl p-2 py-3 overflow-hidden z-50 origin-bottom" style={{ boxShadow: 'var(--panel-shadow)' }}
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
                                                { icon: Languages, label: t.sidebar.language, hasArrow: true, view: "language" },
                                                { icon: Moon, label: t.sidebar.theme, hasArrow: true, view: "theme" },
                                            ].map((item, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => {
                                                        if (item.view) {
                                                            setMenuView(item.view as any);
                                                        }
                                                    }}
                                                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] font-medium text-foreground/80 hover:bg-muted/40 hover:text-foreground transition-all duration-200"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <item.icon className="w-4 h-4" />
                                                        <span>{item.label}</span>
                                                    </div>
                                                    {item.hasArrow && <ChevronRight className="w-3.5 h-3.5 opacity-40" />}
                                                </button>
                                            ))}

                                            <div className="h-px bg-border/40 my-2 mx-1" />

                                            {[
                                                { icon: Crown, label: t.sidebar.plan },
                                                { icon: BookText, label: t.sidebar.docs },
                                                { icon: Info, label: t.sidebar.aboutUs },
                                            ].map((item, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => setIsUserMenuOpen(false)}
                                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-foreground/80 hover:bg-muted/40 hover:text-foreground transition-all duration-200"
                                                >
                                                    <item.icon className="w-4 h-4" />
                                                    <span>{item.label}</span>
                                                </button>
                                            ))}

                                            <div className="h-px bg-border/40 my-2 mx-1" />

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
                                                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] font-medium text-foreground/80 hover:bg-muted/40 transition-all duration-200"
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
                                                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] font-medium text-foreground/80 hover:bg-muted/40 transition-all duration-200"
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
                    className={`p-2 rounded-xl border transition-all duration-200 cursor-pointer group flex items-center gap-2.5 ${isUserMenuOpen
                        ? "bg-black/[0.04] dark:bg-white/[0.06] border-primary/20"
                        : "bg-transparent border-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                        }`}
                >
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-sm font-semibold text-white shrink-0">
                        K
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-[13px] font-semibold text-foreground truncate">Kaka wah</span>
                        <span className="text-[10px] text-muted-foreground truncate">Pro trial Plan</span>
                    </div>
                </div>
            </div>
        </motion.aside>
    );
}
