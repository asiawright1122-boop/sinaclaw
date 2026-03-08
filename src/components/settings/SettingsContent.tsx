import { lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { useMCPStore } from "@/store/mcpStore";
import SettingsApiTab from "@/components/settings/SettingsApiTab";
import SettingsExtensionsTab from "@/components/settings/SettingsExtensionsTab";
import MemoryManager from "@/components/settings/MemoryManager";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import type { SettingsTabId } from "@/components/settings/SettingsNavSidebar";

const UsagePage = lazy(() => import("@/pages/UsagePage"));
const SyncPage = lazy(() => import("@/pages/SyncPage"));
const SecurityPage = lazy(() => import("@/pages/SecurityPage"));
const AgentWorkbenchPage = lazy(() => import("@/pages/AgentWorkbenchPage"));
const KnowledgePage = lazy(() => import("@/pages/KnowledgePage"));
const SkillStorePage = lazy(() => import("@/pages/SkillStorePage"));
const ConnectionsPage = lazy(() => import("@/pages/ConnectionsPage"));

const FULL_PAGE_TABS = ["agents", "knowledge", "skills", "connections"] as const;

const LoadingSpinner = () => (
    <div className="flex justify-center py-12">
        <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
);

interface SettingsContentProps {
    activeTab: SettingsTabId;
    onOpenAddExtModal: () => void;
}

export default function SettingsContent({ activeTab, onOpenAddExtModal }: SettingsContentProps) {
    const { servers, toggleServer, removeServer } = useMCPStore();

    if ((FULL_PAGE_TABS as readonly string[]).includes(activeTab)) {
        return (
            <div className="flex-1 flex flex-col overflow-hidden">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 overflow-hidden"
                >
                    {activeTab === "agents" && (
                        <ErrorBoundary><Suspense fallback={<LoadingSpinner />}><AgentWorkbenchPage /></Suspense></ErrorBoundary>
                    )}
                    {activeTab === "knowledge" && (
                        <ErrorBoundary><Suspense fallback={<LoadingSpinner />}><KnowledgePage /></Suspense></ErrorBoundary>
                    )}
                    {activeTab === "skills" && (
                        <ErrorBoundary><Suspense fallback={<LoadingSpinner />}><SkillStorePage /></Suspense></ErrorBoundary>
                    )}
                    {activeTab === "connections" && (
                        <ErrorBoundary><Suspense fallback={<LoadingSpinner />}><ConnectionsPage /></Suspense></ErrorBoundary>
                    )}
                </motion.div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto no-scrollbar p-6 pb-0">
            <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="max-w-3xl mx-auto space-y-5 pb-10"
            >
                {activeTab === "api" && <SettingsApiTab />}

                {activeTab === "ext" && (
                    <SettingsExtensionsTab
                        servers={servers}
                        onToggleServer={toggleServer}
                        onRemoveServer={removeServer}
                        onOpenAddModal={onOpenAddExtModal}
                    />
                )}

                {activeTab === "memory" && <MemoryManager />}

                {activeTab === "usage" && (
                    <ErrorBoundary><Suspense fallback={<LoadingSpinner />}><UsagePage /></Suspense></ErrorBoundary>
                )}

                {activeTab === "sync" && (
                    <ErrorBoundary><Suspense fallback={<LoadingSpinner />}><SyncPage /></Suspense></ErrorBoundary>
                )}

                {activeTab === "security" && (
                    <ErrorBoundary><Suspense fallback={<LoadingSpinner />}><SecurityPage /></Suspense></ErrorBoundary>
                )}
            </motion.div>
        </div>
    );
}
