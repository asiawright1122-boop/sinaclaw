import { motion, AnimatePresence } from "framer-motion";
import { Link2, Unlink, Loader2, ClipboardPaste } from "lucide-react";
import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
    CLOUD_PROVIDERS,
    type CloudProvider,
    type CloudAccount,
    getAuthUrl,
    authExchange,
    disconnect,
    formatSize,
} from "@/lib/cloud";

// ── OAuth 凭据（从设置中读取，不要硬编码到源码中）──────────
// 在设置页面配置你的 OAuth App 凭据
const OAUTH_CREDENTIALS: Record<CloudProvider, { clientId: string; clientSecret: string }> = {
    google_drive: {
        clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "",
        clientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET ?? "",
    },
    onedrive: {
        clientId: import.meta.env.VITE_AZURE_CLIENT_ID ?? "",
        clientSecret: import.meta.env.VITE_AZURE_CLIENT_SECRET ?? "",
    },
    dropbox: {
        clientId: import.meta.env.VITE_DROPBOX_APP_KEY ?? "",
        clientSecret: import.meta.env.VITE_DROPBOX_APP_SECRET ?? "",
    },
};

interface CloudConnectorProps {
    accounts: Record<string, CloudAccount | null>;
    onConnected: (provider: CloudProvider, account: CloudAccount) => void;
    onDisconnected: (provider: CloudProvider) => void;
}

export default function CloudConnector({ accounts, onConnected, onDisconnected }: CloudConnectorProps) {
    const [activeProvider, setActiveProvider] = useState<CloudProvider | null>(null);
    const [loading, setLoading] = useState(false);
    const [waitingCode, setWaitingCode] = useState(false);
    const [authCode, setAuthCode] = useState("");
    const [error, setError] = useState("");

    // 一键连接：点击立即打开浏览器
    const handleConnect = async (provider: CloudProvider) => {
        setActiveProvider(provider);
        setLoading(true);
        setError("");
        try {
            const creds = OAUTH_CREDENTIALS[provider];
            const url = await getAuthUrl(provider, creds.clientId);
            await openUrl(url);
            setWaitingCode(true);
        } catch (err) {
            setError(String(err));
        }
        setLoading(false);
    };

    // 提交授权码
    const handleSubmitCode = async () => {
        if (!activeProvider || !authCode.trim()) return;
        setLoading(true);
        setError("");
        try {
            const creds = OAUTH_CREDENTIALS[activeProvider];
            const account = await authExchange(
                activeProvider,
                creds.clientId,
                creds.clientSecret,
                authCode.trim()
            );
            onConnected(activeProvider, account);
            handleCancel();
        } catch (err) {
            setError(String(err));
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setActiveProvider(null);
        setLoading(false);
        setWaitingCode(false);
        setAuthCode("");
        setError("");
    };

    const handleDisconnect = async (provider: CloudProvider) => {
        try {
            await disconnect(provider);
            onDisconnected(provider);
        } catch (err) {
            console.error("断开失败:", err);
        }
    };

    return (
        <div className="space-y-3">
            {(Object.keys(CLOUD_PROVIDERS) as CloudProvider[]).map((provider) => {
                const info = CLOUD_PROVIDERS[provider];
                const account = accounts[provider];
                const isThis = activeProvider === provider;

                return (
                    <motion.div
                        key={provider}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-panel rounded-xl p-4 flex items-center justify-between"
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                                style={{ backgroundColor: `${info.color}20` }}
                            >
                                {info.icon}
                            </div>
                            <div>
                                <div className="font-semibold text-sm">{info.label}</div>
                                {account ? (
                                    <div className="text-xs text-muted-foreground">
                                        {account.email} · {formatSize(account.used_space)} / {formatSize(account.total_space)}
                                    </div>
                                ) : (
                                    <div className="text-xs text-muted-foreground/50">未连接</div>
                                )}
                            </div>
                        </div>

                        {account ? (
                            <button
                                onClick={() => handleDisconnect(provider)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            >
                                <Unlink className="w-3 h-3" />
                                断开
                            </button>
                        ) : (
                            <button
                                onClick={() => handleConnect(provider)}
                                disabled={loading && isThis}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-primary/30 text-primary hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-50"
                            >
                                {loading && isThis ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                    <Link2 className="w-3 h-3" />
                                )}
                                连接
                            </button>
                        )}
                    </motion.div>
                );
            })}

            {/* 授权码粘贴面板 — 浏览器授权完成后出现 */}
            <AnimatePresence>
                {waitingCode && activeProvider && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="glass-panel rounded-xl p-5 space-y-3 border border-primary/20"
                    >
                        <p className="text-sm text-muted-foreground">
                            浏览器已打开 <strong>{CLOUD_PROVIDERS[activeProvider].label}</strong> 授权页面，
                            完成登录后将授权码粘贴到下方：
                        </p>
                        <div className="flex gap-2">
                            <input
                                value={authCode}
                                onChange={(e) => setAuthCode(e.target.value)}
                                placeholder="粘贴授权码..."
                                className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary/50 transition-colors font-mono"
                                autoFocus
                            />
                            <button
                                onClick={handleSubmitCode}
                                disabled={!authCode.trim() || loading}
                                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium bg-primary/20 text-primary hover:bg-primary/30 transition-colors cursor-pointer disabled:opacity-40"
                            >
                                {loading ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <ClipboardPaste className="w-3.5 h-3.5" />
                                )}
                                确认
                            </button>
                            <button
                                onClick={handleCancel}
                                className="px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors cursor-pointer"
                            >
                                取消
                            </button>
                        </div>

                        {error && (
                            <div className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2.5">
                                ❌ {error}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
