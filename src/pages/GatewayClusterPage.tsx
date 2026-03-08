import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Server,
    Plus,
    Trash2,
    RefreshCw,
    Wifi,
    Zap,
    Globe,
    Terminal,
    X,
    Activity,
    Clock,
    HardDrive,
} from "lucide-react";
import {
    type GatewayEndpoint,
    type GatewayConnectionType,
    type GatewayHealth,
    loadGateways,
    saveGateways,
    checkGatewayHealth,
    setActiveGateway,
    addGateway,
    removeGateway,
    formatUptime,
} from "@/lib/remoteGateway";
import { useTranslate } from "@/lib/i18n";

function StatusDot({ status }: { status: GatewayEndpoint["status"] }) {
    const colors: Record<string, string> = {
        online: "bg-emerald-500 shadow-emerald-500/40",
        offline: "bg-muted-foreground/30",
        connecting: "bg-amber-500 animate-pulse shadow-amber-500/40",
        error: "bg-red-500 shadow-red-500/40",
    };
    return <span className={`w-2.5 h-2.5 rounded-full shadow-sm ${colors[status] || colors.offline}`} />;
}

export default function GatewayClusterPage() {
    const t = useTranslate();

    const TYPE_LABELS: Record<GatewayConnectionType, { label: string; icon: typeof Server }> = {
        local: { label: t.gatewayCluster.local, icon: Server },
        ssh_tunnel: { label: "SSH Tunnel", icon: Terminal },
        tailscale: { label: "Tailscale", icon: Globe },
        direct: { label: t.gatewayCluster.direct, icon: Wifi },
    };

    const [gateways, setGateways] = useState<GatewayEndpoint[]>(loadGateways);
    const [healthMap, setHealthMap] = useState<Record<string, GatewayHealth>>({});
    const [checking, setChecking] = useState(false);
    const [showAdd, setShowAdd] = useState(false);

    // 表单
    const [formName, setFormName] = useState("");
    const [formType, setFormType] = useState<GatewayConnectionType>("direct");
    const [formHost, setFormHost] = useState("");
    const [formPort, setFormPort] = useState("3778");
    const [formToken, setFormToken] = useState("");

    const persist = useCallback((gws: GatewayEndpoint[]) => {
        setGateways(gws);
        saveGateways(gws);
    }, []);

    const checkAll = useCallback(async () => {
        setChecking(true);
        const results: Record<string, GatewayHealth> = {};
        const updated = [...gateways];
        await Promise.all(
            updated.map(async (gw) => {
                const health = await checkGatewayHealth(gw);
                results[gw.id] = health;
                gw.status = health.status === "online" ? "online" : "offline";
                gw.latencyMs = health.latencyMs >= 0 ? health.latencyMs : undefined;
                gw.version = health.version || gw.version;
                gw.uptime = health.uptime || gw.uptime;
                gw.lastChecked = Date.now();
            })
        );
        setHealthMap(results);
        persist(updated);
        setChecking(false);
    }, [gateways, persist]);

    useEffect(() => {
        checkAll();
        const timer = setInterval(checkAll, 30_000);
        return () => clearInterval(timer);
    }, []);

    const handleActivate = (id: string) => {
        persist(setActiveGateway(gateways, id));
    };

    const handleRemove = (id: string, name: string) => {
        if (!confirm(t.gatewayCluster.confirmRemove.replace('{name}', name))) return;
        persist(removeGateway(gateways, id));
    };

    const handleAdd = () => {
        if (!formName.trim() || !formHost.trim()) return;
        const updated = addGateway(gateways, {
            name: formName.trim(),
            type: formType,
            host: formHost.trim(),
            port: parseInt(formPort) || 3778,
            token: formToken || undefined,
        });
        persist(updated);
        setShowAdd(false);
        setFormName("");
        setFormHost("");
        setFormPort("3778");
        setFormToken("");
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 overflow-y-auto p-6 space-y-6"
        >
            {/* 标题 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/[0.06] border border-border/50 flex items-center justify-center">
                        <Server className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-foreground">{t.gatewayCluster.title}</h1>
                        <p className="text-[12px] text-muted-foreground">{t.gatewayCluster.subtitle}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowAdd(true)}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        {t.gatewayCluster.add}
                    </button>
                    <button
                        onClick={checkAll}
                        disabled={checking}
                        className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {/* 概览 */}
            <div className="flex gap-4 text-xs text-muted-foreground">
                <span>{t.gatewayCluster.gatewayCount.replace('{count}', String(gateways.length))}</span>
                <span>{t.gatewayCluster.onlineCount.replace('{count}', String(gateways.filter((g) => g.status === "online").length))}</span>
                <span>{t.gatewayCluster.activeLabel.replace('{name}', gateways.find((g) => g.isActive)?.name || "—")}</span>
            </div>

            {/* Gateway 列表 */}
            <div className="space-y-3">
                {gateways.map((gw) => {
                    const health = healthMap[gw.id];
                    const typeInfo = TYPE_LABELS[gw.type];
                    return (
                        <div
                            key={gw.id}
                            className={`bg-card/80 dark:bg-card/50 border rounded-xl p-4 group transition-all duration-150 ${
                                gw.isActive ? "border-primary/30 ring-1 ring-primary/15" : "border-border/50 dark:border-white/[0.06]"
                            }`}
                            style={{ boxShadow: 'var(--panel-shadow)' }}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <StatusDot status={gw.status} />
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-foreground">{gw.name}</span>
                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex items-center gap-1">
                                                <typeInfo.icon className="w-2.5 h-2.5" />
                                                {typeInfo.label}
                                            </span>
                                            {gw.isActive && (
                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{t.gatewayCluster.activeTag}</span>
                                            )}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                            {gw.host}:{gw.port}
                                            {gw.version && <span className="ml-2">v{gw.version}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {!gw.isActive && (
                                        <button
                                            onClick={() => handleActivate(gw.id)}
                                            className="px-2 py-1 rounded-lg text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                        >
                                            <Zap className="w-3 h-3" />
                                        </button>
                                    )}
                                    {gw.id !== "local" && (
                                        <button
                                            onClick={() => handleRemove(gw.id, gw.name)}
                                            className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* 健康指标 */}
                            {health && health.status === "online" && (
                                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/30 text-[10px] text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <Activity className="w-3 h-3" />
                                        {health.latencyMs}ms
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {formatUptime(health.uptime)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Wifi className="w-3 h-3" />
                                        {t.gatewayCluster.channels.replace('{count}', String(health.connectedChannels))}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <HardDrive className="w-3 h-3" />
                                        {health.memoryUsageMB}MB
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* 添加对话框 */}
            <AnimatePresence>
                {showAdd && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
                        onClick={() => setShowAdd(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.95 }}
                            className="bg-card dark:bg-card border border-border/60 dark:border-white/[0.08] rounded-xl w-[420px] max-w-[90vw]" style={{ boxShadow: 'var(--panel-shadow)' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between p-4 border-b border-border/40">
                                <h3 className="font-semibold text-foreground">{t.gatewayCluster.addGateway}</h3>
                                <button onClick={() => setShowAdd(false)} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-foreground">{t.gatewayCluster.labelName}</label>
                                    <input
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        placeholder={t.gatewayCluster.namePlaceholder}
                                        className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-foreground">{t.gatewayCluster.labelType}</label>
                                    <div className="flex gap-2">
                                        {(["direct", "ssh_tunnel", "tailscale"] as const).map((ct) => (
                                            <button
                                                key={ct}
                                                onClick={() => setFormType(ct)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                                    formType === ct
                                                        ? "bg-primary/10 text-primary border border-primary/25"
                                                        : "bg-black/[0.03] dark:bg-white/[0.04] text-muted-foreground border border-border/50 dark:border-white/[0.06] hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
                                                }`}
                                            >
                                                {TYPE_LABELS[ct].label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="col-span-2 space-y-1.5">
                                        <label className="text-xs font-medium text-foreground">{t.gatewayCluster.labelHost}</label>
                                        <input
                                            value={formHost}
                                            onChange={(e) => setFormHost(e.target.value)}
                                            placeholder="192.168.1.100"
                                            className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-foreground">{t.gatewayCluster.labelPort}</label>
                                        <input
                                            value={formPort}
                                            onChange={(e) => setFormPort(e.target.value)}
                                            className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-foreground">{t.gatewayCluster.labelToken}</label>
                                    <input
                                        value={formToken}
                                        onChange={(e) => setFormToken(e.target.value)}
                                        type="password"
                                        placeholder="Bearer Token"
                                        className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors">
                                        {t.common.cancel}
                                    </button>
                                    <button
                                        onClick={handleAdd}
                                        disabled={!formName.trim() || !formHost.trim()}
                                        className="px-4 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
                                    >
                                        {t.gatewayCluster.add}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
