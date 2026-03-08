import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
    Play,
    Square,
    RotateCcw,
    Activity,
    Server,
    Clock,
    Wifi,
    WifiOff,
    Terminal,
    Trash2,
    ChevronDown,
    Copy,
    Check,
} from "lucide-react";
import { useGatewayStore, type GatewayLogEntry } from "@/store/gatewayStore";

function formatUptime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
}

function StatusBadge({ running, loading }: { running: boolean; loading: boolean }) {
    if (loading) {
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                处理中...
            </span>
        );
    }
    if (running) {
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                运行中
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            已停止
        </span>
    );
}

function InfoCard({ icon: Icon, label, value, sub }: {
    icon: React.ElementType;
    label: string;
    value: string;
    sub?: string;
}) {
    return (
        <div className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-4 space-y-1" style={{ boxShadow: 'var(--panel-shadow)' }}>
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Icon className="w-3.5 h-3.5" />
                {label}
            </div>
            <div className="text-lg font-semibold text-foreground truncate">{value}</div>
            {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        </div>
    );
}

function LogViewer({ logs, onClear }: { logs: GatewayLogEntry[]; onClear: () => void }) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs, autoScroll]);

    const handleScroll = () => {
        if (!scrollRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
    };

    const handleCopy = () => {
        const text = logs.map((l) => `[${l.stream}] ${l.line}`).join("\n");
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/40">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Terminal className="w-3.5 h-3.5" />
                    Gateway 日志
                    <span className="bg-muted/50 px-1.5 py-0.5 rounded text-[10px]">{logs.length}</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleCopy}
                        className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                        title="复制日志"
                    >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                        onClick={onClear}
                        className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                        title="清空日志"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => {
                            setAutoScroll(true);
                            if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                        }}
                        className={`p-1.5 rounded-lg hover:bg-muted/50 transition-colors ${autoScroll ? "text-emerald-500" : "text-muted-foreground hover:text-foreground"}`}
                        title="自动滚动"
                    >
                        <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-5 bg-black/[0.03] dark:bg-black/30 min-h-[200px] max-h-[400px]"
            >
                {logs.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground/50 text-sm">
                        暂无日志
                    </div>
                ) : (
                    logs.map((entry, i) => (
                        <div key={i} className="flex gap-2 hover:bg-muted/20 px-1 rounded">
                            <span className="text-muted-foreground/50 select-none shrink-0 w-[52px]">
                                {new Date(entry.timestamp).toLocaleTimeString("en-GB", { hour12: false })}
                            </span>
                            <span className={`shrink-0 w-[46px] ${entry.stream === "stderr" ? "text-red-400" : "text-blue-400"}`}>
                                {entry.stream === "stderr" ? "ERR" : "OUT"}
                            </span>
                            <span className="text-foreground/90 break-all">{entry.line}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default function GatewayPage() {
    const {
        status,
        logs,
        loading,
        error,
        startGateway,
        stopGateway,
        restartGateway,
        clearLogs,
        startLogListener,
        startPolling,
    } = useGatewayStore();

    useEffect(() => {
        const stopPoll = startPolling();
        let unlistenFn: (() => void) | null = null;
        startLogListener().then((fn) => { unlistenFn = fn; });
        return () => {
            stopPoll();
            unlistenFn?.();
        };
    }, []);

    const isRunning = status?.running ?? false;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 overflow-y-auto p-6 space-y-6"
        >
            {/* 标题 + 控制按钮 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/[0.06] border border-border/50 flex items-center justify-center">
                        <Server className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-foreground">Gateway 控制台</h1>
                        <p className="text-[12px] text-muted-foreground">管理 OpenClaw Gateway 进程</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <StatusBadge running={isRunning} loading={loading} />
                    <div className="flex items-center gap-1 ml-2">
                        {!isRunning ? (
                            <button
                                onClick={startGateway}
                                disabled={loading}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                            >
                                <Play className="w-3.5 h-3.5" />
                                启动
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={restartGateway}
                                    disabled={loading}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 hover:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 disabled:opacity-50 transition-colors"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    重启
                                </button>
                                <button
                                    onClick={stopGateway}
                                    disabled={loading}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 hover:bg-destructive/15 text-destructive border border-destructive/20 disabled:opacity-50 transition-colors"
                                >
                                    <Square className="w-3.5 h-3.5" />
                                    停止
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* 错误提示 */}
            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg px-4 py-3 text-sm"
                >
                    {error}
                </motion.div>
            )}

            {/* 信息卡片 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <InfoCard
                    icon={isRunning ? Wifi : WifiOff}
                    label="状态"
                    value={isRunning ? "在线" : "离线"}
                    sub={status?.hasProcess ? "Sinaclaw 管理" : isRunning ? "外部进程" : undefined}
                />
                <InfoCard
                    icon={Activity}
                    label="版本"
                    value={status?.version || "—"}
                    sub={status?.pid ? `PID ${status.pid}` : undefined}
                />
                <InfoCard
                    icon={Clock}
                    label="运行时长"
                    value={isRunning && status?.uptimeSeconds ? formatUptime(status.uptimeSeconds) : "—"}
                    sub={status?.startedAt ? `启动于 ${new Date(status.startedAt).toLocaleTimeString("en-GB", { hour12: false })}` : undefined}
                />
                <InfoCard
                    icon={Server}
                    label="端口"
                    value={`${status?.port ?? 18789}`}
                    sub="ws://127.0.0.1"
                />
            </div>

            {/* 日志面板 */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl overflow-hidden" style={{ boxShadow: 'var(--panel-shadow)' }}
            >
                <LogViewer logs={logs} onClear={clearLogs} />
            </motion.div>

            {/* Gateway 健康详情 */}
            {status?.health && typeof status.health === "object" && Object.keys(status.health).length > 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-4" style={{ boxShadow: 'var(--panel-shadow)' }}
                >
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                        <Activity className="w-3.5 h-3.5" />
                        健康检查详情
                    </div>
                    <pre className="text-xs font-mono text-foreground/80 overflow-x-auto whitespace-pre-wrap break-all">
                        {JSON.stringify(status.health, null, 2)}
                    </pre>
                </motion.div>
            )}
        </motion.div>
    );
}
