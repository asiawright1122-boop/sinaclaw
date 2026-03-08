import { useState } from "react";
import { motion } from "framer-motion";
import {
    ExternalLink, X, Save, TestTube, Trash2,
    Eye, EyeOff, Loader2, AlertCircle,
} from "lucide-react";
import { useChannelStore, type ChannelDef, type ChannelInstance } from "@/store/channelStore";
import IconById from "@/components/ui/IconById";
import { useTranslate } from "@/lib/i18n";

function formatTimeAgo(ts: number | undefined, t: ReturnType<typeof useTranslate>): string {
    if (!ts) return "—";
    const diff = Date.now() - ts;
    if (diff < 60_000) return t.channels.justNow;
    if (diff < 3600_000) return t.channels.minutesAgo.replace('{n}', String(Math.floor(diff / 60_000)));
    if (diff < 86400_000) return t.channels.hoursAgo.replace('{n}', String(Math.floor(diff / 3600_000)));
    return t.channels.daysAgo.replace('{n}', String(Math.floor(diff / 86400_000)));
}

interface ChannelConfigPanelProps {
    def: ChannelDef;
    instance?: ChannelInstance;
    onClose: () => void;
}

export default function ChannelConfigPanel({ def, instance, onClose }: ChannelConfigPanelProps) {
    const t = useTranslate();
    const channelDesc = t.channelDesc as Record<string, string>;
    const { saveChannelConfig, testChannel, removeChannel, loading } = useChannelStore();
    const [config, setConfig] = useState<Record<string, string>>({});
    const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
    const [testResult, setTestResult] = useState<string | null>(null);
    const [testing, setTesting] = useState(false);

    const FIELD_LABEL_MAP: Record<string, string> = {
        Phone: channelDesc.labelPhone,
        Password: channelDesc.labelPassword,
        Server: channelDesc.labelServer,
        Nickname: channelDesc.labelNickname,
        Username: channelDesc.labelUsername,
        Channel: channelDesc.labelChannel,
    };
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
                    <div className="w-9 h-9 rounded-lg bg-primary/[0.06] dark:bg-primary/10 border border-border/40 flex items-center justify-center shrink-0">
                        <IconById id={def.icon} size={20} className="text-foreground/70" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground">{def.id === 'feishu' ? channelDesc.feishuName : def.name}</h3>
                        <p className="text-xs text-muted-foreground">{channelDesc[def.id] || def.description}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <a
                        href={def.docsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                        title={t.channels.viewDocs}
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
                        {t.channels.noConfig}
                    </div>
                ) : (
                    allFields.map((field) => (
                        <div key={field.key} className="space-y-1.5">
                            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                {FIELD_LABEL_MAP[field.label] || field.label}
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
                        {t.channels.saveConfig}
                    </button>
                    <button
                        onClick={handleTest}
                        disabled={testing}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/15 disabled:opacity-50 transition-colors"
                    >
                        {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TestTube className="w-3.5 h-3.5" />}
                        {t.channels.testConnection}
                    </button>
                    <button
                        onClick={handleRemove}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/15 transition-colors ml-auto"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t.channels.remove}
                    </button>
                </div>

                {/* 监控信息 */}
                {instance && instance.status === "connected" && (
                    <div className="mt-4 pt-4 border-t border-border/40 space-y-2">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t.channels.runningStatus}</h4>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-muted/20 rounded-lg p-2 text-center">
                                <div className="text-lg font-bold text-foreground">{instance.messageCountIn}</div>
                                <div className="text-[10px] text-muted-foreground">{t.channels.messagesIn}</div>
                            </div>
                            <div className="bg-muted/20 rounded-lg p-2 text-center">
                                <div className="text-lg font-bold text-foreground">{instance.messageCountOut}</div>
                                <div className="text-[10px] text-muted-foreground">{t.channels.messagesOut}</div>
                            </div>
                            <div className="bg-muted/20 rounded-lg p-2 text-center">
                                <div className="text-sm font-medium text-foreground">{formatTimeAgo(instance.lastActive, t)}</div>
                                <div className="text-[10px] text-muted-foreground">{t.channels.lastActive}</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 错误日志 */}
                {instance && instance.errors.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border/40 space-y-2">
                        <h4 className="text-xs font-bold text-destructive uppercase tracking-wider flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {t.channels.errorLogs} ({instance.errors.length})
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
