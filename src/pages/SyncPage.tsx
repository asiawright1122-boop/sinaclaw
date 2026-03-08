import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    Cloud,
    CloudUpload,
    CloudDownload,
    Shield,
    RefreshCw,
    Clock,
    HardDrive,
    Settings,
} from "lucide-react";
import { useCloudStore } from "@/store/cloudStore";
import {
    type CloudProvider,
    CLOUD_PROVIDERS,
    uploadFile,
    downloadFile,
    formatSize,
} from "@/lib/cloud";
import IconById from "@/components/ui/IconById";
import { invoke } from "@tauri-apps/api/core";
import { useTranslate } from "@/lib/i18n";

interface SyncSnapshot {
    id: string;
    type: "config" | "conversations" | "full";
    provider: CloudProvider;
    size: number;
    createdAt: number;
    encrypted: boolean;
}


function formatTime(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" }) + " " +
        d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function SyncPage() {
    const t = useTranslate();
    const { accounts, initCloudAccounts, connectProvider, disconnectProvider } = useCloudStore();

    const SYNC_TYPE_LABELS: Record<string, { label: string; desc: string; icon: React.ElementType }> = {
        config: { label: t.sync.configBackup, desc: t.sync.configBackupDesc, icon: Settings },
        conversations: { label: t.sync.conversationBackup, desc: t.sync.conversationBackupDesc, icon: HardDrive },
        full: { label: t.sync.fullBackup, desc: t.sync.fullBackupDesc, icon: Cloud },
    };
    const [snapshots, setSnapshots] = useState<SyncSnapshot[]>([]);
    const [syncing, setSyncing] = useState(false);
    const [restoring, setRestoring] = useState<string | null>(null);
    const [useEncryption, setUseEncryption] = useState(true);
    const [activeProvider, setActiveProvider] = useState<CloudProvider | null>(null);

    useEffect(() => {
        initCloudAccounts();
    }, []);

    // 获取已连接的 provider
    const connectedProviders = (Object.keys(accounts) as CloudProvider[]).filter(
        (p) => accounts[p]?.connected
    );

    useEffect(() => {
        if (connectedProviders.length > 0 && !activeProvider) {
            setActiveProvider(connectedProviders[0]);
        }
    }, [connectedProviders.length]);

    const handleBackup = async (type: "config" | "conversations" | "full") => {
        if (!activeProvider) return;
        setSyncing(true);
        try {
            // 请求 Rust 后端导出数据到临时文件
            const tmpPath = await invoke<string>("export_sync_bundle", {
                bundleType: type,
                encrypt: useEncryption,
            });

            // 上传到云端
            const fileName = `sinaclaw-${type}-${new Date().toISOString().slice(0, 10)}.sync`;
            await uploadFile(activeProvider, tmpPath, undefined, fileName);

            const snapshot: SyncSnapshot = {
                id: crypto.randomUUID(),
                type,
                provider: activeProvider,
                size: 0,
                createdAt: Date.now(),
                encrypted: useEncryption,
            };
            setSnapshots((prev) => [snapshot, ...prev]);
        } catch (err) {
            console.error("[Sync] 备份失败:", err);
        } finally {
            setSyncing(false);
        }
    };

    const handleRestore = async (snapshot: SyncSnapshot) => {
        setRestoring(snapshot.id);
        try {
            const tmpPath = `/tmp/sinaclaw-restore-${snapshot.id}`;
            await downloadFile(snapshot.provider, snapshot.id, tmpPath);
            await invoke("import_sync_bundle", {
                path: tmpPath,
                encrypted: snapshot.encrypted,
            });
        } catch (err) {
            console.error("[Sync] 恢复失败:", err);
        } finally {
            setRestoring(null);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 overflow-y-auto p-6 space-y-6"
        >
            {/* 标题 */}
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/[0.06] border border-border/50 flex items-center justify-center">
                    <Cloud className="w-4.5 h-4.5 text-primary" />
                </div>
                <div>
                    <h1 className="text-lg font-semibold text-foreground">{t.sync.title}</h1>
                    <p className="text-[12px] text-muted-foreground">{t.sync.subtitle}</p>
                </div>
            </div>

            {/* 云盘连接 */}
            <div className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-5 space-y-4" style={{ boxShadow: 'var(--panel-shadow)' }}>
                <h3 className="text-sm font-semibold text-foreground">{t.sync.cloudConnection}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(Object.keys(CLOUD_PROVIDERS) as CloudProvider[]).map((provider) => {
                        const info = CLOUD_PROVIDERS[provider];
                        const account = accounts[provider];
                        const connected = account?.connected;

                        return (
                            <div
                                key={provider}
                                className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all duration-150 min-w-0 ${
                                    connected
                                        ? "border-emerald-500/30 bg-emerald-500/5"
                                        : "border-border/50 dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.03] hover:border-primary/20"
                                } ${activeProvider === provider ? "ring-1 ring-primary/30" : ""}`}
                                onClick={() => connected && setActiveProvider(provider)}
                                role={connected ? "button" : undefined}
                            >
                                <IconById id={info.icon} size={22} />
                                <span className="text-xs font-medium text-foreground truncate max-w-full">{info.label}</span>
                                {connected && account && (
                                    <p className="text-[10px] text-muted-foreground truncate max-w-full">{account.email}</p>
                                )}
                                {connected ? (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); disconnectProvider(provider); }}
                                        className="text-[10px] px-2 py-1 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                                    >
                                        {t.sync.disconnect}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => connectProvider(provider)}
                                        className="text-[10px] px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
                                    >
                                        {t.sync.connect}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 备份操作 */}
            <div className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-5 space-y-4" style={{ boxShadow: 'var(--panel-shadow)' }}>
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">{t.sync.createBackup}</h3>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                        <Shield className={`w-3.5 h-3.5 ${useEncryption ? "text-emerald-500" : ""}`} />
                        <span>{t.sync.e2eEncryption}</span>
                        <button
                            onClick={() => setUseEncryption(!useEncryption)}
                            className={`w-8 h-4 rounded-full relative transition-colors ${useEncryption ? "bg-emerald-500" : "bg-muted/50"}`}
                        >
                            <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${useEncryption ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                    </label>
                </div>

                {!activeProvider || connectedProviders.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground/50">
                        <Cloud className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-xs">{t.sync.connectCloudFirst}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {(["config", "conversations", "full"] as const).map((type) => {
                            const info = SYNC_TYPE_LABELS[type];
                            return (
                                <button
                                    key={type}
                                    onClick={() => handleBackup(type)}
                                    disabled={syncing}
                                    className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border/50 dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.03] hover:bg-primary/5 hover:border-primary/20 transition-all duration-150 text-center group disabled:opacity-50"
                                >
                                    {syncing ? (
                                        <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" />
                                    ) : (
                                        <CloudUpload className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                    )}
                                    <span className="text-xs font-medium text-foreground">{info.label}</span>
                                    <span className="text-[10px] text-muted-foreground">{info.desc}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 备份历史 */}
            <div className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-5 space-y-3" style={{ boxShadow: 'var(--panel-shadow)' }}>
                <h3 className="text-sm font-semibold text-foreground">{t.sync.backupHistory}</h3>
                {snapshots.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground/50">
                        <Clock className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-xs">{t.sync.noBackups}</p>
                        <p className="text-[10px] mt-1">{t.sync.noBackupsDesc}</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {snapshots.map((snap) => {
                            const typeInfo = SYNC_TYPE_LABELS[snap.type];
                            return (
                                <div key={snap.id} className="flex items-center justify-between p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.03] border border-border/40 dark:border-white/[0.06] group">
                                    <div className="flex items-center gap-3">
                                        <typeInfo.icon className="w-4 h-4 text-muted-foreground" />
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-medium text-foreground">{typeInfo.label}</span>
                                                {snap.encrypted && <Shield className="w-3 h-3 text-emerald-500" />}
                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                                    {CLOUD_PROVIDERS[snap.provider].label}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-muted-foreground">
                                                {formatTime(snap.createdAt)}
                                                {snap.size > 0 && ` · ${formatSize(snap.size)}`}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleRestore(snap)}
                                            disabled={restoring === snap.id}
                                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                        >
                                            {restoring === snap.id ? (
                                                <RefreshCw className="w-3 h-3 animate-spin" />
                                            ) : (
                                                <CloudDownload className="w-3 h-3" />
                                            )}
                                            {t.sync.restore}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </motion.div>
    );
}
