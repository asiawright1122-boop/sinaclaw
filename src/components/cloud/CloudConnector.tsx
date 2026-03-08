import { motion } from "framer-motion";
import { Link2, Unlink, Loader2 } from "lucide-react";
import {
    CLOUD_PROVIDERS,
    type CloudProvider,
    type CloudAccount,
    formatSize,
} from "@/lib/cloud";
import { useCloudStore } from "@/store/cloudStore";
import { useTranslate } from "@/lib/i18n";
import {
    GoogleDriveIcon,
    DropboxIcon,
    OneDriveIcon
} from "@/components/icons/ProviderIcons";

interface CloudConnectorProps {
    accounts: Record<string, CloudAccount | null>;
    onConnected?: (provider: CloudProvider, account: CloudAccount) => void;
    onDisconnected?: (provider: CloudProvider) => void;
}

export default function CloudConnector({ accounts }: CloudConnectorProps) {
    const t = useTranslate();
    const { connectProvider, disconnectProvider, loading, error } = useCloudStore();

    return (
        <div className="space-y-3">
            {(Object.keys(CLOUD_PROVIDERS) as CloudProvider[]).map((provider) => {
                const info = CLOUD_PROVIDERS[provider];
                const account = accounts[provider];

                return (
                    <motion.div
                        key={provider}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-panel rounded-xl p-4 flex items-center justify-between"
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center p-2"
                                style={{ backgroundColor: `${info.color}20` }}
                            >
                                {provider === "google_drive" && <GoogleDriveIcon className="w-full h-full" />}
                                {provider === "dropbox" && <DropboxIcon className="w-full h-full" />}
                                {provider === "onedrive" && <OneDriveIcon className="w-full h-full" />}
                            </div>
                            <div>
                                <div className="font-semibold text-sm">{info.label}</div>
                                {account ? (
                                    <div className="text-xs text-muted-foreground">
                                        {account.email} · {formatSize(account.used_space)} / {formatSize(account.total_space)}
                                    </div>
                                ) : (
                                    <div className="text-xs text-muted-foreground/50">{t.knowledge.notConnected}</div>
                                )}
                            </div>
                        </div>

                        {account ? (
                            <button
                                onClick={() => disconnectProvider(provider)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            >
                                <Unlink className="w-3 h-3" />
                                {t.knowledge.disconnect}
                            </button>
                        ) : (
                            <button
                                onClick={() => connectProvider(provider)}
                                disabled={loading}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-primary/30 text-primary hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-50"
                            >
                                {loading ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                    <Link2 className="w-3 h-3" />
                                )}
                                {t.knowledge.connect}
                            </button>
                        )}
                    </motion.div>
                );
            })}

            {/* 全局错误提示 */}
            {error && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2.5"
                >
                    {error}
                </motion.div>
            )}
        </div>
    );
}
