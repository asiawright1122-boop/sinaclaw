import { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Settings, Sparkles, Plus, Search, Pin, Inbox } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useChatStore } from "@/store/chatStore";
import { useSettingsStore } from "@/store/settingsStore";
import { translations } from "@/lib/i18n";
import { useInboxStore } from "@/store/inboxStore";
import { useChannelStore } from "@/store/channelStore";
import { ConversationSkeleton } from "@/components/ui/Skeleton";
import Tooltip from "@/components/ui/Tooltip";
import SidebarUserMenu from "@/components/layout/SidebarUserMenu";
import SidebarConvItem from "@/components/layout/SidebarConvItem";
import SidebarContextMenu from "@/components/layout/SidebarContextMenu";

export default function Sidebar() {
    const inboxTotalUnread = useInboxStore((s) => s.totalUnread);
    const channels = useChannelStore((s) => s.channels);
    const hasChannels = channels.length > 0 || inboxTotalUnread > 0;
    const {
        conversations,
        activeConversationId,
        isInitializing,
        createConversation,
        searchConversations,
    } = useChatStore();

    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<typeof conversations | null>(null);
    const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const { language } = useSettingsStore();
    const t = translations[language];
    const navigate = useNavigate();

    const handleNewChat = useCallback(() => {
        createConversation();
        navigate("/");
    }, [createConversation, navigate]);

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
    }, [handleNewChat]);

    const handleContextMenu = useCallback((id: string, x: number, y: number) => {
        setContextMenu({ id, x, y });
    }, []);

    const handleStartRename = useCallback((_id: string, _title: string) => {
        // Rename is now handled internally by SidebarConvItem via double-click
    }, []);

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
                        placeholder={t.sidebar.searchPlaceholder}
                        className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.06] rounded-lg pl-7 pr-2 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                    />
                </div>
            </div>

            {/* 对话列表 */}
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-0.5">
                {isInitializing ? (
                    <ConversationSkeleton count={6} />
                ) : displayConversations.length === 0 ? (
                    <div className="px-3 py-8 text-center">
                        <p className="text-xs text-muted-foreground/50">
                            {searchQuery ? t.sidebar.noMatchConversation : t.sidebar.emptyHistory}
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
                                    <Pin className="w-2.5 h-2.5" /> {t.sidebar.pinned}
                                </span>
                            </div>
                        )}
                        {pinnedConvs.map((conv) => (
                            <SidebarConvItem key={conv.id} conv={conv} isActive={activeConversationId === conv.id} onContextMenu={handleContextMenu} />
                        ))}
                        {pinnedConvs.length > 0 && unpinnedConvs.length > 0 && (
                            <div className="h-px bg-border/40 mx-3 my-1" />
                        )}
                        {unpinnedConvs.map((conv) => (
                            <SidebarConvItem key={conv.id} conv={conv} isActive={activeConversationId === conv.id} onContextMenu={handleContextMenu} />
                        ))}
                    </>
                )}

                {contextMenu && (
                    <SidebarContextMenu
                        contextMenu={contextMenu}
                        onClose={() => setContextMenu(null)}
                        onStartRename={handleStartRename}
                    />
                )}
            </div>

            {/* 底部导航 */}
            <div className="mt-2 pt-2 border-t border-border/50 space-y-0.5">
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
                        <span className="flex-1">{t.sidebar.inbox}</span>
                        {inboxTotalUnread > 0 && (
                            <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white px-1">
                                {inboxTotalUnread > 99 ? "99+" : inboxTotalUnread}
                            </span>
                        )}
                    </NavLink>
                )}
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

            <SidebarUserMenu />
        </motion.aside>
    );
}
