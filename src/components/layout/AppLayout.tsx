import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Command, Settings, Sparkles, MessageSquarePlus, Trash2, Cloud } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import AnimatedBackground from "../ui/AnimatedBackground";
import { useChatStore } from "@/store/chatStore";
import SetupWizard from "@/components/setup/SetupWizard";

export default function AppLayout() {
    const {
        conversations,
        activeConversationId,
        isInitializing,
        initStore,
        createConversation,
        setActiveConversation,
        deleteConversation
    } = useChatStore();

    // 首次启动自检向导
    const [showSetupWizard, setShowSetupWizard] = useState(true);
    const handleSetupComplete = useCallback(() => setShowSetupWizard(false), []);

    useEffect(() => {
        initStore();
    }, [initStore]);

    const handleNewChat = () => {
        createConversation();
    };

    return (
        <>
            {/* 启动自检向导 */}
            {showSetupWizard && <SetupWizard onComplete={handleSetupComplete} />}

            <AnimatedBackground />
            <div className="flex flex-col h-screen w-full rounded-2xl overflow-hidden m-0 relative z-10 text-foreground font-sans bg-transparent">
                {/* macOS 标题栏 */}
                <div
                    data-tauri-drag-region
                    className="titlebar px-5 bg-transparent border-b border-white/5 select-none hover:bg-white/[0.02]"
                >
                    <div className="flex items-center space-x-2 pointer-events-none mt-1">
                        <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-black/10 hover:bg-[#FF5F56]/80 transition-colors pointer-events-auto cursor-pointer" />
                        <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-black/10 hover:bg-[#FFBD2E]/80 transition-colors pointer-events-auto cursor-pointer" />
                        <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-black/10 hover:bg-[#27C93F]/80 transition-colors pointer-events-auto cursor-pointer" />
                    </div>
                    <div className="text-[13px] font-semibold tracking-wide text-foreground/50 pointer-events-none">
                        Sinaclaw
                    </div>
                    <div className="flex items-center w-12" />
                </div>

                {/* 主内容区 */}
                <div className="flex flex-1 pt-10 px-4 pb-4 gap-4 min-h-0 overflow-hidden">
                    {/* 侧边栏 */}
                    <motion.aside
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="w-64 glass-panel rounded-2xl p-4 flex flex-col gap-4"
                    >
                        {/* Logo */}
                        <div className="flex items-center space-x-3 px-2 mt-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg icon-glow">
                                <Sparkles className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                                Sinaclaw
                            </span>
                        </div>

                        {/* 新建对话按钮 */}
                        <button
                            onClick={handleNewChat}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-foreground/80 font-medium text-sm transition-all cursor-pointer group"
                        >
                            <MessageSquarePlus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                            <span>新建对话</span>
                        </button>

                        {/* 导航 */}
                        <div className="flex-1 space-y-6 mt-2 overflow-y-auto">
                            {/* 工作区 */}
                            <div className="space-y-2">
                                <div className="px-2">
                                    <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">
                                        工作区
                                    </h2>
                                </div>
                                <div className="space-y-1">
                                    <NavLink
                                        to="/"
                                        end
                                        className={({ isActive }) =>
                                            `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer group ${isActive
                                                ? "bg-primary/20 text-primary-foreground border border-primary/30 shadow-[0_0_15px_rgba(139,92,246,0.15)]"
                                                : "hover:bg-white/10 text-foreground/70 hover:text-foreground border border-transparent"
                                            }`
                                        }
                                    >
                                        <Command className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                                        <span>Agent Studio</span>
                                    </NavLink>
                                    <NavLink
                                        to="/cloud"
                                        className={({ isActive }) =>
                                            `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer group ${isActive
                                                ? "bg-primary/20 text-primary-foreground border border-primary/30 shadow-[0_0_15px_rgba(139,92,246,0.15)]"
                                                : "hover:bg-white/10 text-foreground/70 hover:text-foreground border border-transparent"
                                            }`
                                        }
                                    >
                                        <Cloud className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                                        <span>云存储</span>
                                    </NavLink>
                                    <NavLink
                                        to="/settings"
                                        className={({ isActive }) =>
                                            `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer group ${isActive
                                                ? "bg-primary/20 text-primary-foreground border border-primary/30 shadow-[0_0_15px_rgba(139,92,246,0.15)]"
                                                : "hover:bg-white/10 text-foreground/70 hover:text-foreground border border-transparent"
                                            }`
                                        }
                                    >
                                        <Settings className="w-4 h-4 group-hover:rotate-45 transition-transform duration-300" />
                                        <span>设置</span>
                                    </NavLink>
                                </div>
                            </div>

                            {/* 对话历史 */}
                            <div className="space-y-2">
                                <div className="px-2">
                                    <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">
                                        对话历史
                                    </h2>
                                </div>
                                <div className="space-y-1">
                                    {isInitializing ? (
                                        <div className="px-4 py-2 text-xs text-muted-foreground animate-pulse">
                                            正在加载历史记录...
                                        </div>
                                    ) : conversations.length === 0 ? (
                                        <div className="px-4 py-2 text-xs text-muted-foreground/50">
                                            暂无对话记录
                                        </div>
                                    ) : (
                                        conversations.map((conv) => (
                                            <div
                                                key={conv.id}
                                                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm transition-all cursor-pointer group ${activeConversationId === conv.id
                                                    ? "bg-white/10 text-foreground"
                                                    : "text-foreground/50 hover:bg-white/5 hover:text-foreground/80"
                                                    }`}
                                                onClick={() => setActiveConversation(conv.id)}
                                            >
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                                                    <span className="truncate">{conv.title}</span>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteConversation(conv.id);
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 hover:text-red-400 rounded-md transition-colors"
                                                    title="删除对话"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 用户信息 */}
                        <div className="mt-auto p-3 rounded-xl bg-black/20 border border-white/5 flex items-center gap-3 hover:bg-black/30 transition-colors cursor-default">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center text-xs font-bold text-white shadow-inner">
                                U
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-foreground">Local User</span>
                                <span className="text-xs text-muted-foreground">Pro Plan</span>
                            </div>
                        </div>
                    </motion.aside>

                    {/* 主面板：渲染路由子页面 */}
                    <main className="flex-1 flex flex-col relative min-h-0 overflow-hidden">
                        <Outlet />
                    </main>
                </div>
            </div>
        </>
    );
}

