import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
    Cloud, FolderOpen, FileText, Download, Trash2,
    ChevronRight, Loader2, RefreshCw, HardDrive,
} from "lucide-react";
import CloudConnector from "@/components/cloud/CloudConnector";
import {
    type CloudProvider,
    type CloudAccount,
    type CloudFile,
    CLOUD_PROVIDERS,
    listFiles,
    downloadFile,
    deleteFile,
    getStatus,
    formatSize,
    formatDate,
} from "@/lib/cloud";

interface BreadcrumbItem {
    id: string;
    name: string;
}

export default function CloudPage() {
    const [accounts, setAccounts] = useState<Record<string, CloudAccount | null>>({
        google_drive: null,
        onedrive: null,
        dropbox: null,
    });
    const [activeProvider, setActiveProvider] = useState<CloudProvider | null>(null);
    const [files, setFiles] = useState<CloudFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
    const [error, setError] = useState("");

    // 连接成功
    const handleConnected = useCallback((provider: CloudProvider, account: CloudAccount) => {
        setAccounts((prev) => ({ ...prev, [provider]: account }));
        setActiveProvider(provider);
    }, []);

    // 断开
    const handleDisconnected = useCallback((provider: CloudProvider) => {
        setAccounts((prev) => ({ ...prev, [provider]: null }));
        if (activeProvider === provider) {
            setActiveProvider(null);
            setFiles([]);
            setBreadcrumbs([]);
        }
    }, [activeProvider]);

    // 加载文件列表
    const loadFiles = useCallback(async (provider: CloudProvider, folderId?: string) => {
        setLoading(true);
        setError("");
        try {
            const result = await listFiles(provider, folderId);
            // 排序：文件夹优先
            result.sort((a, b) => {
                if (a.is_folder !== b.is_folder) return a.is_folder ? -1 : 1;
                return a.name.localeCompare(b.name);
            });
            setFiles(result);
        } catch (err) {
            setError(String(err));
            setFiles([]);
        }
        setLoading(false);
    }, []);

    // 初始化：从后端恢复已连接的云盘状态
    useEffect(() => {
        const restoreAccounts = async () => {
            const restored: Record<string, CloudAccount | null> = {
                google_drive: null,
                onedrive: null,
                dropbox: null,
            };
            let firstConnected: CloudProvider | null = null;

            for (const provider of Object.keys(CLOUD_PROVIDERS) as CloudProvider[]) {
                try {
                    const acc = await getStatus(provider);
                    if (acc && acc.connected) {
                        restored[provider] = acc;
                        if (!firstConnected) firstConnected = provider;
                    }
                } catch {
                    // 未连接，忽略
                }
            }

            setAccounts(restored);
            if (firstConnected) {
                setActiveProvider(firstConnected);
            }
        };

        restoreAccounts();
    }, []);

    // 切换到已连接的网盘时自动加载根目录
    useEffect(() => {
        if (activeProvider && accounts[activeProvider]) {
            setBreadcrumbs([{ id: "root", name: CLOUD_PROVIDERS[activeProvider].label }]);
            loadFiles(activeProvider);
        }
    }, [activeProvider, accounts, loadFiles]);

    // 进入文件夹
    const enterFolder = (file: CloudFile) => {
        if (!activeProvider) return;
        setBreadcrumbs((prev) => [...prev, { id: file.id, name: file.name }]);
        loadFiles(activeProvider, file.id);
    };

    // 回退到面包屑
    const navigateTo = (index: number) => {
        if (!activeProvider) return;
        const crumbs = breadcrumbs.slice(0, index + 1);
        setBreadcrumbs(crumbs);
        const folderId = crumbs.length <= 1 ? undefined : crumbs[crumbs.length - 1].id;
        loadFiles(activeProvider, folderId);
    };

    // 下载
    const handleDownload = async (file: CloudFile) => {
        if (!activeProvider) return;
        try {
            const home = "/tmp";
            const localPath = `${home}/sinaclaw_downloads/${file.name}`;
            const result = await downloadFile(activeProvider, file.id, localPath);
            alert(result);
        } catch (err) {
            alert(`下载失败: ${err}`);
        }
    };

    // 删除
    const handleDelete = async (file: CloudFile) => {
        if (!activeProvider) return;
        if (!confirm(`确定删除 "${file.name}"？`)) return;
        try {
            await deleteFile(activeProvider, file.id);
            // 刷新列表
            const folderId = breadcrumbs.length <= 1 ? undefined : breadcrumbs[breadcrumbs.length - 1].id;
            loadFiles(activeProvider, folderId);
        } catch (err) {
            alert(`删除失败: ${err}`);
        }
    };

    // 检查哪些网盘已连接
    const connectedProviders = Object.entries(accounts).filter(
        ([, acc]) => acc !== null
    ) as [string, CloudAccount][];
    const hasConnected = connectedProviders.length > 0;

    return (
        <div className="flex-1 flex flex-col p-6 gap-4 min-h-0 overflow-hidden">
            {/* 标题 */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between"
            >
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
                        <Cloud className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">云存储</h1>
                        <p className="text-xs text-muted-foreground">连接你的网盘，让 AI 也能访问云端文件</p>
                    </div>
                </div>
            </motion.div>

            {/* 网盘连接区 */}
            {!hasConnected && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <CloudConnector
                        accounts={accounts}
                        onConnected={handleConnected}
                        onDisconnected={handleDisconnected}
                    />
                </motion.div>
            )}

            {/* 已连接：Tab 切换 + 文件列表 */}
            {hasConnected && (
                <div className="flex flex-col flex-1 gap-3 min-h-0">
                    {/* 网盘 Tab */}
                    <div className="flex items-center gap-2">
                        {connectedProviders.map(([provider, acc]) => {
                            const info = CLOUD_PROVIDERS[provider as CloudProvider];
                            return (
                                <button
                                    key={provider}
                                    onClick={() => setActiveProvider(provider as CloudProvider)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer border ${activeProvider === provider
                                        ? "bg-primary/20 border-primary/40 text-primary-foreground"
                                        : "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10"
                                        }`}
                                >
                                    <span>{info.icon}</span>
                                    <span>{info.label}</span>
                                    <span className="text-[10px] opacity-60">{formatSize(acc.used_space)}</span>
                                </button>
                            );
                        })}
                        {/* 添加更多网盘 */}
                        <button
                            onClick={() => {
                                setActiveProvider(null);
                            }}
                            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium border border-dashed border-white/15 text-muted-foreground/60 hover:bg-white/5 transition-colors cursor-pointer"
                        >
                            + 添加网盘
                        </button>
                    </div>

                    {/* 连接新网盘面板 */}
                    {!activeProvider && (
                        <CloudConnector
                            accounts={accounts}
                            onConnected={handleConnected}
                            onDisconnected={handleDisconnected}
                        />
                    )}

                    {/* 文件浏览器 */}
                    {activeProvider && accounts[activeProvider] && (
                        <div className="flex-1 flex flex-col glass-panel rounded-2xl overflow-hidden min-h-0">
                            {/* 面包屑 + 刷新 */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                                <div className="flex items-center gap-1 text-sm">
                                    {breadcrumbs.map((crumb, i) => (
                                        <span key={crumb.id} className="flex items-center gap-1">
                                            {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/50" />}
                                            <button
                                                onClick={() => navigateTo(i)}
                                                className={`hover:text-primary transition-colors cursor-pointer ${i === breadcrumbs.length - 1
                                                    ? "font-semibold text-foreground"
                                                    : "text-muted-foreground"
                                                    }`}
                                            >
                                                {crumb.name}
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            const folderId = breadcrumbs.length <= 1 ? undefined : breadcrumbs[breadcrumbs.length - 1].id;
                                            loadFiles(activeProvider, folderId);
                                        }}
                                        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                                        title="刷新"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                                    </button>
                                </div>
                            </div>

                            {/* 文件列表 */}
                            <div className="flex-1 overflow-y-auto">
                                {loading ? (
                                    <div className="flex items-center justify-center py-16">
                                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                    </div>
                                ) : error ? (
                                    <div className="flex items-center justify-center py-16 text-red-400 text-sm">
                                        {error}
                                    </div>
                                ) : files.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50">
                                        <HardDrive className="w-10 h-10 mb-3 opacity-30" />
                                        <p className="text-sm">此文件夹为空</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-white/5">
                                        {files.map((file) => (
                                            <motion.div
                                                key={file.id}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition-colors group"
                                            >
                                                <div
                                                    className={`flex items-center gap-3 flex-1 min-w-0 ${file.is_folder ? "cursor-pointer" : ""
                                                        }`}
                                                    onClick={() => file.is_folder && enterFolder(file)}
                                                >
                                                    {file.is_folder ? (
                                                        <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
                                                    ) : (
                                                        <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                                                    )}
                                                    <span className="text-sm truncate">{file.name}</span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-xs text-muted-foreground/50 w-16 text-right">
                                                        {file.is_folder ? "—" : formatSize(file.size)}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground/40 w-28 text-right hidden sm:block">
                                                        {formatDate(file.modified_at)}
                                                    </span>
                                                    {/* 操作按钮 */}
                                                    {!file.is_folder && (
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => handleDownload(file)}
                                                                className="p-1 rounded hover:bg-blue-500/20 hover:text-blue-400 transition-colors cursor-pointer"
                                                                title="下载"
                                                            >
                                                                <Download className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(file)}
                                                                className="p-1 rounded hover:bg-red-500/20 hover:text-red-400 transition-colors cursor-pointer"
                                                                title="删除"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
