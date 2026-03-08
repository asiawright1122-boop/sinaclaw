import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Radio,
    Search,
    ExternalLink,
    ChevronRight,
    X,
    Save,
    TestTube,
    Trash2,
    Eye,
    EyeOff,
    Loader2,
    AlertCircle,
    ArrowDownUp,
    Clock,
    MessageSquare,
} from "lucide-react";
import {
    useChannelStore,
    CHANNEL_DEFINITIONS,
    type ChannelDef,
    type ChannelInstance,
    type ChannelStatus,
} from "@/store/channelStore";
import { useGatewayStore } from "@/store/gatewayStore";

function StatusDot({ status }: { status: ChannelStatus }) {
    const cls = {
        connected: "bg-emerald-500",
        disconnected: "bg-gray-400",
        error: "bg-red-500",
        unknown: "bg-gray-300",
    }[status];
    return <span className={`w-2 h-2 rounded-full ${cls} ${status === "connected" ? "animate-pulse" : ""}`} />;
}

function formatTimeAgo(ts?: number): string {
    if (!ts) return "—";
    const diff = Date.now() - ts;
    if (diff < 60_000) return "刚刚";
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}分钟前`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}小时前`;
    return `${Math.floor(diff / 86400_000)}天前`;
}

function ChannelCard({
    def,
    instance,
    onClick,
}: {
    def: ChannelDef;
    instance?: ChannelInstance;
    onClick: () => void;
}) {
    const status = instance?.status ?? "disconnected";
    const totalMsgs = (instance?.messageCountIn ?? 0) + (instance?.messageCountOut ?? 0);
    return (
        <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={onClick}
            className="w-full text-left bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-4 hover:border-primary/20 transition-all duration-150 group" style={{ boxShadow: 'var(--panel-shadow)' }}
        >
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{def.icon}</span>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground">{def.name}</span>
                            <StatusDot status={status} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{def.description}</p>
                    </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0 mt-1" />
            </div>
            {instance && status === "connected" && (
                <div className="flex items-center gap-4 mt-2.5 ml-11 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTimeAgo(instance.lastActive)}</span>
                    <span className="flex items-center gap-1"><ArrowDownUp className="w-3 h-3" />{instance.messageCountIn}↓ {instance.messageCountOut}↑</span>
                    {totalMsgs > 0 && <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />共 {totalMsgs}</span>}
                </div>
            )}
        </motion.button>
    );
}

function ChannelConfigPanel({
    def,
    instance,
    onClose,
}: {
    def: ChannelDef;
    instance?: ChannelInstance;
    onClose: () => void;
}) {
    const { saveChannelConfig, testChannel, removeChannel, loading } = useChannelStore();
    const [config, setConfig] = useState<Record<string, string>>({});
    const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
    const [testResult, setTestResult] = useState<string | null>(null);
    const [testing, setTesting] = useState(false);

    const allFields = [...def.requiredFields, ...(def.optionalFields ?? [])];

    const handleSave = async () => {
        await saveChannelConfig(def.id, config);
    };

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        const result = await testChannel(def.id);
        setTestResult(result);
        setTesting(false);
    };

    const handleRemove = async () => {
        await removeChannel(def.id);
        onClose();
    };

    const togglePassword = (key: string) => {
        setShowPasswords((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl overflow-hidden" style={{ boxShadow: 'var(--panel-shadow)' }}
        >
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-border/40">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{def.icon}</span>
                    <div>
                        <h3 className="font-semibold text-foreground">{def.name}</h3>
                        <p className="text-xs text-muted-foreground">{def.description}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <a
                        href={def.docsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                        title="查看文档"
                    >
                        <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* 配置表单 */}
            <div className="p-4 space-y-4">
                {allFields.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-4 text-center">
                        此通道无需配置，Gateway 启动后自动可用。
                    </div>
                ) : (
                    allFields.map((field) => (
                        <div key={field.key} className="space-y-1.5">
                            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                {field.label}
                                {field.envVar && (
                                    <span className="text-[10px] text-muted-foreground/60 font-mono">
                                        {field.envVar}
                                    </span>
                                )}
                            </label>
                            {field.type === "password" ? (
                                <div className="relative">
                                    <input
                                        type={showPasswords[field.key] ? "text" : "password"}
                                        value={config[field.key] ?? ""}
                                        onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
                                        placeholder={field.placeholder}
                                        className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 pr-9 transition-all"
                                    />
                                    <button
                                        onClick={() => togglePassword(field.key)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                                    >
                                        {showPasswords[field.key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    </button>
                                </div>
                            ) : (
                                <input
                                    type="text"
                                    value={config[field.key] ?? ""}
                                    onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
                                    placeholder={field.placeholder}
                                    className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                                />
                            )}
                        </div>
                    ))
                )}

                {/* 测试结果 */}
                {testResult && (
                    <div className="bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg p-3 text-xs font-mono text-foreground/80 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                        {testResult}
                    </div>
                )}

                {/* 操作按钮 */}
                <div className="flex items-center gap-2 pt-2">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        保存配置
                    </button>
                    <button
                        onClick={handleTest}
                        disabled={testing}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/15 disabled:opacity-50 transition-colors"
                    >
                        {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TestTube className="w-3.5 h-3.5" />}
                        测试连接
                    </button>
                    <button
                        onClick={handleRemove}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/15 transition-colors ml-auto"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        移除
                    </button>
                </div>

                {/* 监控信息 */}
                {instance && instance.status === "connected" && (
                    <div className="mt-4 pt-4 border-t border-border/40 space-y-2">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">运行状态</h4>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-muted/20 rounded-lg p-2 text-center">
                                <div className="text-lg font-bold text-foreground">{instance.messageCountIn}</div>
                                <div className="text-[10px] text-muted-foreground">收到消息</div>
                            </div>
                            <div className="bg-muted/20 rounded-lg p-2 text-center">
                                <div className="text-lg font-bold text-foreground">{instance.messageCountOut}</div>
                                <div className="text-[10px] text-muted-foreground">发送消息</div>
                            </div>
                            <div className="bg-muted/20 rounded-lg p-2 text-center">
                                <div className="text-sm font-medium text-foreground">{formatTimeAgo(instance.lastActive)}</div>
                                <div className="text-[10px] text-muted-foreground">最后活跃</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 错误日志 */}
                {instance && instance.errors.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border/40 space-y-2">
                        <h4 className="text-xs font-bold text-destructive uppercase tracking-wider flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> 错误日志 ({instance.errors.length})
                        </h4>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                            {instance.errors.slice().reverse().map((err, i) => (
                                <div key={i} className="text-[11px] bg-red-500/5 border border-red-500/10 rounded-lg px-2.5 py-1.5">
                                    <span className="text-muted-foreground/60 mr-2">
                                        {new Date(err.time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                                    </span>
                                    <span className="text-red-400">{err.message}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
}

export default function ChannelsPage() {
    const { channels, startMonitoring } = useChannelStore();
    const { status: gwStatus } = useGatewayStore();
    const [search, setSearch] = useState("");
    const [selectedChannel, setSelectedChannel] = useState<ChannelDef | null>(null);

    useEffect(() => {
        const unlisten = startMonitoring();
        return unlisten;
    }, []);

    const gwRunning = gwStatus?.running ?? false;

    const filtered = CHANNEL_DEFINITIONS.filter(
        (d) =>
            d.name.toLowerCase().includes(search.toLowerCase()) ||
            d.id.toLowerCase().includes(search.toLowerCase()) ||
            d.description.includes(search)
    );

    const getInstance = (channelId: string): ChannelInstance | undefined => {
        return channels.find((c) => c.channelId === channelId);
    };

    const connectedCount = channels.filter((c) => c.status === "connected").length;

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
                        <Radio className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-foreground">通道管理</h1>
                        <p className="text-xs text-muted-foreground">
                            配置和管理 {CHANNEL_DEFINITIONS.length} 个消息通道
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                        {connectedCount} 个已连接
                    </span>
                    {!gwRunning && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <AlertCircle className="w-3 h-3" />
                            Gateway 未运行
                        </span>
                    )}
                </div>
            </div>

            {/* 搜索 */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="搜索通道..."
                    className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                />
            </div>

            <div className="flex gap-6">
                {/* 通道列表 */}
                <div className={`space-y-2 ${selectedChannel ? "w-1/2" : "w-full"} transition-all`}>
                    <div className="grid grid-cols-1 gap-2">
                        {filtered.map((def) => (
                            <ChannelCard
                                key={def.id}
                                def={def}
                                instance={getInstance(def.id)}
                                onClick={() => setSelectedChannel(def)}
                            />
                        ))}
                    </div>
                    {filtered.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground text-sm">
                            未找到匹配的通道
                        </div>
                    )}
                </div>

                {/* 配置面板 */}
                <AnimatePresence mode="wait">
                    {selectedChannel && (
                        <div className="w-1/2 sticky top-0">
                            <ChannelConfigPanel
                                key={selectedChannel.id}
                                def={selectedChannel}
                                instance={getInstance(selectedChannel.id)}
                                onClose={() => setSelectedChannel(null)}
                            />
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
