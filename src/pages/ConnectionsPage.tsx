/**
 * 连接与通道 — 合并页
 *
 * 整合 Gateway 状态 + 通道管理 + 设备 + Gateway 集群
 * 通过顶部 Tab 切换四个子视图
 */
import { useState, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { Radio, Server, Cpu, Network } from "lucide-react";
import { useTranslate } from "@/lib/i18n";

const GatewayPage = lazy(() => import("@/pages/GatewayPage"));
const ChannelsPage = lazy(() => import("@/pages/ChannelsPage"));
const DevicesPage = lazy(() => import("@/pages/DevicesPage"));
const GatewayClusterPage = lazy(() => import("@/pages/GatewayClusterPage"));

const TABS = [
    { id: "gateway", labelKey: "gateway", icon: Server },
    { id: "channels", labelKey: "tabChannels", icon: Radio },
    { id: "devices", labelKey: "tabDevices", icon: Cpu },
    { id: "cluster", labelKey: "tabCluster", icon: Network },
] as const;

type TabId = (typeof TABS)[number]["id"];

function TabLoader() {
    return (
        <div className="flex-1 flex items-center justify-center py-20">
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
    );
}

export default function ConnectionsPage() {
    const t = useTranslate();
    const TAB_LABELS: Record<string, string> = {
        gateway: "Gateway",
        tabChannels: t.connections.tabChannels,
        tabDevices: t.connections.tabDevices,
        tabCluster: t.connections.tabCluster,
    };
    const [activeTab, setActiveTab] = useState<TabId>("gateway");

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* 标题 + Tab 切换 */}
            <div className="px-6 pt-6 pb-0">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-lg bg-primary/[0.06] border border-border/50 flex items-center justify-center">
                        <Radio className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-foreground">{t.connections.title}</h1>
                        <p className="text-[12px] text-muted-foreground">{t.connections.subtitle}</p>
                    </div>
                </div>

                <div className="flex gap-0.5 bg-black/[0.04] dark:bg-white/[0.04] border border-border/40 rounded-lg p-0.5">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                                    isActive
                                        ? "bg-card dark:bg-white/[0.08] shadow-sm text-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{TAB_LABELS[tab.labelKey]}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tab 内容 */}
            <div className="flex-1 overflow-y-auto">
                <Suspense fallback={<TabLoader />}>
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className="h-full"
                    >
                        {activeTab === "gateway" && <GatewayPage />}
                        {activeTab === "channels" && <ChannelsPage />}
                        {activeTab === "devices" && <DevicesPage />}
                        {activeTab === "cluster" && <GatewayClusterPage />}
                    </motion.div>
                </Suspense>
            </div>
        </div>
    );
}
