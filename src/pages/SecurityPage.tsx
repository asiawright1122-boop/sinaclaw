import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    Shield,
    Key,
    FileDown,
    Trash2,
    Plus,
    AlertTriangle,
    ScrollText,
} from "lucide-react";
import {
    type GatewayToken,
    type AuditEntry,
    listGatewayTokens,
    createGatewayToken,
    revokeGatewayToken,
    getAuditLog,
    logAudit,
    exportAllData,
    deleteAllData,
} from "@/lib/security";
import { useTranslate } from "@/lib/i18n";
import TokenCard from "@/components/security/TokenCard";
import CreateTokenModal from "@/components/security/CreateTokenModal";

function formatTime(ts: number): string {
    if (!ts) return "—";
    const d = new Date(ts);
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" }) + " " +
        d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function SecurityPage() {
    const t = useTranslate();
    const AUDIT_LABELS: Record<string, string> = {
        login: t.security.auditLogin,
        api_key_changed: t.security.auditApiKeyChanged,
        api_key_viewed: t.security.auditApiKeyViewed,
        agent_activated: t.security.auditAgentActivated,
        channel_connected: t.security.auditChannelConnected,
        channel_disconnected: t.security.auditChannelDisconnected,
        data_exported: t.security.auditDataExported,
        data_deleted: t.security.auditDataDeleted,
        token_created: t.security.auditTokenCreated,
        token_revoked: t.security.auditTokenRevoked,
        settings_changed: t.security.auditSettingsChanged,
        skill_installed: t.security.auditSkillInstalled,
        model_pulled: t.security.auditModelPulled,
        backup_created: t.security.auditBackupCreated,
        backup_restored: t.security.auditBackupRestored,
    };
    const [tab, setTab] = useState<"tokens" | "audit" | "gdpr">("tokens");
    const [tokens, setTokens] = useState<GatewayToken[]>([]);
    const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
    const [showCreateToken, setShowCreateToken] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        loadTokens();
        loadAudit();
    }, []);

    const loadTokens = async () => {
        const list = await listGatewayTokens();
        setTokens(list);
    };

    const loadAudit = async () => {
        const entries = await getAuditLog(200);
        setAuditEntries(entries);
    };

    const handleCreateToken = async (name: string, perms: string[]) => {
        try {
            await createGatewayToken(name, perms, 90);
            await logAudit("token_created", name);
            await loadTokens();
            setShowCreateToken(false);
        } catch (err) {
            console.error("[Security] Token 创建失败:", err);
        }
    };

    const handleRevokeToken = async (id: string, name: string) => {
        if (!confirm(t.security.revokeConfirm.replace('{name}', name))) return;
        try {
            await revokeGatewayToken(id);
            await logAudit("token_revoked", name);
            await loadTokens();
        } catch (err) {
            console.error("[Security] Token 撤销失败:", err);
        }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const data = await exportAllData();
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `sinaclaw-export-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("[Security] 数据导出失败:", err);
        } finally {
            setExporting(false);
        }
    };

    const handleDeleteAll = async () => {
        try {
            await deleteAllData();
            setConfirmDelete(false);
            window.location.reload();
        } catch (err) {
            console.error("[Security] 数据删除失败:", err);
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
                    <Shield className="w-4.5 h-4.5 text-primary" />
                </div>
                <div>
                    <h1 className="text-lg font-semibold text-foreground">{t.security.title}</h1>
                    <p className="text-[12px] text-muted-foreground">{t.security.subtitle}</p>
                </div>
            </div>

            {/* 标签页 */}
            <div className="flex items-center gap-0.5 bg-black/[0.04] dark:bg-white/[0.04] border border-border/40 rounded-lg p-0.5 w-fit">
                {([
                    { id: "tokens" as const, label: t.security.tabTokens, icon: Key },
                    { id: "audit" as const, label: `${t.security.tabAudit} (${auditEntries.length})`, icon: ScrollText },
                    { id: "gdpr" as const, label: t.security.tabData, icon: Shield },
                ]).map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setTab(item.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                            tab === item.id ? "bg-card dark:bg-white/[0.08] text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <item.icon className="w-3.5 h-3.5" />
                        {item.label}
                    </button>
                ))}
            </div>

            {/* Gateway Token */}
            {tab === "tokens" && (
                <div className="space-y-3">
                    <div className="flex justify-end">
                        <button
                            onClick={() => setShowCreateToken(true)}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            {t.security.createToken}
                        </button>
                    </div>
                    {tokens.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50">
                            <Key className="w-10 h-10 mb-3" />
                            <p className="text-sm font-medium">{t.security.emptyTokens}</p>
                            <p className="text-xs mt-1">{t.security.emptyTokensDesc}</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {tokens.map((tk) => (
                                <TokenCard key={tk.id} token={tk} onRevoke={() => handleRevokeToken(tk.id, tk.name)} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 审计日志 */}
            {tab === "audit" && (
                <div className="space-y-2">
                    {auditEntries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50">
                            <ScrollText className="w-10 h-10 mb-3" />
                            <p className="text-sm font-medium">{t.security.emptyAudit}</p>
                            <p className="text-xs mt-1">{t.security.emptyAuditDesc}</p>
                        </div>
                    ) : (
                        auditEntries.map((entry) => (
                            <div key={entry.id} className="flex items-center gap-3 px-3 py-2.5 bg-card/60 dark:bg-card/40 border border-border/40 dark:border-white/[0.06] rounded-lg">
                                <div className={`w-2 h-2 rounded-full shrink-0 ${
                                    entry.action.includes("delete") || entry.action.includes("revoke") ? "bg-red-400" :
                                    entry.action.includes("create") || entry.action.includes("connect") ? "bg-emerald-400" :
                                    "bg-muted-foreground/40"
                                }`} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-foreground">
                                            {AUDIT_LABELS[entry.action] || entry.action}
                                        </span>
                                    </div>
                                    {entry.detail && (
                                        <p className="text-[10px] text-muted-foreground truncate">{entry.detail}</p>
                                    )}
                                </div>
                                <span className="text-[10px] text-muted-foreground/60 shrink-0">{formatTime(entry.timestamp)}</span>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* GDPR 数据管理 */}
            {tab === "gdpr" && (
                <div className="space-y-4">
                    <div className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-5" style={{ boxShadow: 'var(--panel-shadow)' }}>
                        <div className="flex items-start gap-3">
                            <FileDown className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <h3 className="text-sm font-semibold text-foreground">{t.security.exportTitle}</h3>
                                <p className="text-xs text-muted-foreground mt-1">{t.security.exportDesc}</p>
                                <button
                                    onClick={handleExport}
                                    disabled={exporting}
                                    className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 transition-colors disabled:opacity-50"
                                >
                                    <FileDown className="w-3.5 h-3.5" />
                                    {exporting ? t.security.exporting : t.security.exportAll}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-card/80 dark:bg-card/50 border border-destructive/20 rounded-xl p-5" style={{ boxShadow: 'var(--panel-shadow)' }}>
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <h3 className="text-sm font-semibold text-foreground">{t.security.deleteTitle}</h3>
                                <p className="text-xs text-muted-foreground mt-1">{t.security.deleteDesc}</p>
                                {!confirmDelete ? (
                                    <button
                                        onClick={() => setConfirmDelete(true)}
                                        className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/15 transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        {t.security.deleteAll}
                                    </button>
                                ) : (
                                    <div className="mt-3 flex items-center gap-2">
                                        <button
                                            onClick={handleDeleteAll}
                                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                                        >
                                            {t.security.confirmDelete}
                                        </button>
                                        <button
                                            onClick={() => setConfirmDelete(false)}
                                            className="px-4 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
                                        >
                                            {t.common.cancel}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <CreateTokenModal
                open={showCreateToken}
                onClose={() => setShowCreateToken(false)}
                onCreate={handleCreateToken}
            />
        </motion.div>
    );
}
