import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import AnimatedBackground from "../ui/AnimatedBackground";
import { useChatStore } from "@/store/chatStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import ToastContainer from "../ui/Toast";
import TitleBar from "./TitleBar";
import Sidebar from "./Sidebar";
import SetupWizard from "../setup/SetupWizard";

export default function AppLayout() {
    const { initStore } = useChatStore();
    const { theme, setupCompleted, _hydrated, hydrate: hydrateSettings } = useSettingsStore();
    const { hydrate: hydrateWorkspace } = useWorkspaceStore();
    const [showWizard, setShowWizard] = useState(false);

    useEffect(() => {
        if (_hydrated && !setupCompleted) {
            setShowWizard(true);
        }
    }, [_hydrated, setupCompleted]);

    useEffect(() => {
        initStore();
        hydrateSettings();
        hydrateWorkspace();

        import("@/lib/openclawBridge").then(({ openclawBridge }) => {
            openclawBridge.startGateway().then((status) => {
                if (status.running) {
                    openclawBridge.connectWs();
                    console.log("[Sinaclaw] OpenClaw Gateway 已启动:", status.version);
                } else {
                    console.warn("[Sinaclaw] OpenClaw Gateway 未就绪，使用内置 Agent:", status.error);
                }
            });
        });
    }, [initStore, hydrateSettings, hydrateWorkspace]);

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

    return (
        <>
            <AnimatedBackground />
            <div className="flex flex-col h-screen w-full overflow-hidden m-0 relative z-10 text-foreground font-sans bg-transparent">
                {/* macOS 标题栏 */}
                <TitleBar />

                {/* 主内容区 */}
                <div className="flex flex-1 pt-12 p-3 sm:px-4 sm:pb-4 gap-3 min-h-0 overflow-hidden">
                    {/* 侧边栏 */}
                    <Sidebar />

                    {/* 主面板 */}
                    <main className="flex-1 flex flex-col relative min-h-0 overflow-hidden bg-card/80 dark:bg-card/60 backdrop-blur-2xl border border-black/[0.06] dark:border-white/[0.08] rounded-2xl z-20" style={{ boxShadow: 'var(--panel-shadow)' }}>
                        <Outlet />
                    </main>
                </div>
            </div>
            <ToastContainer />
            {showWizard && <SetupWizard onComplete={() => setShowWizard(false)} />}
        </>
    );
}
