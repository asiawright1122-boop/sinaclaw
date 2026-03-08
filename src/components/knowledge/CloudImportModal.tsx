import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Cloud, Loader2, Folder, File as FileIcon, ChevronRight, Download } from "lucide-react";
import { useCloudStore } from "@/store/cloudStore";
import { CLOUD_PROVIDERS, type CloudProvider, type CloudFile, listFiles, downloadFile } from "@/lib/cloud";
import IconById from "@/components/ui/IconById";
import { readFile } from "@tauri-apps/plugin-fs";
import { documentDir, join } from "@tauri-apps/api/path";

interface CloudImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (file: File) => Promise<void>;
}

export default function CloudImportModal({ isOpen, onClose, onImport }: CloudImportModalProps) {
    const { accounts } = useCloudStore();
    const connectedProviders = Object.entries(accounts).filter(([, acc]) => acc !== null).map(([p]) => p as CloudProvider);

    const [selectedProvider, setSelectedProvider] = useState<CloudProvider | null>(null);
    const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
    const [folderStack, setFolderStack] = useState<{ id?: string, name: string }[]>([]);

    const [files, setFiles] = useState<CloudFile[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    // 回到主视图
    useEffect(() => {
        if (isOpen && connectedProviders.length > 0 && !selectedProvider) {
            setSelectedProvider(connectedProviders[0]);
        }
    }, [isOpen]);

    // 加载文件列表
    useEffect(() => {
        if (!selectedProvider) return;
        let isCurrent = true;
        setIsLoading(true);
        listFiles(selectedProvider, currentFolderId)
            .then(res => {
                if (isCurrent) setFiles(res);
            })
            .catch(err => {
                console.error("Failed to list cloud files", err);
            })
            .finally(() => {
                if (isCurrent) setIsLoading(false);
            });

        return () => { isCurrent = false; };
    }, [selectedProvider, currentFolderId]);

    const handleImportFile = async (cloudFile: CloudFile) => {
        if (!selectedProvider) return;
        setDownloadingId(cloudFile.id);
        try {
            // 下载到本地的特定目录（比如 Documents）
            const docsPath = await documentDir();
            const tempPath = await join(docsPath, cloudFile.name);
            await downloadFile(selectedProvider, cloudFile.id, tempPath);

            // 读取成二进制并构造成 File 对象
            const uint8Array = await readFile(tempPath);
            const blob = new Blob([uint8Array], { type: cloudFile.mime_type || "application/octet-stream" });
            const localFile = new File([blob], cloudFile.name, { type: cloudFile.mime_type, lastModified: Date.now() });

            // 调用父组件导入逻辑
            await onImport(localFile);
            onClose();
        } catch (e) {
            console.error("云盘导入失败:", e);
            alert("下载失败，请检查网络或后端日志。");
        } finally {
            setDownloadingId(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-2xl bg-card border border-border/50 dark:border-white/[0.08] rounded-2xl overflow-hidden flex flex-col max-h-[80vh]" style={{ boxShadow: 'var(--panel-shadow)' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-border/40 flex items-center justify-between shrink-0 bg-black/[0.02] dark:bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                            <Cloud className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">从云端导入</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">直接从 Google Drive, OneDrive 或 Dropbox 拉取文档</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-muted/50 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar Providers */}
                    <div className="w-48 border-r border-border/40 bg-black/[0.02] dark:bg-white/[0.02] p-3 flex flex-col gap-2 shrink-0 overflow-y-auto">
                        {connectedProviders.length === 0 ? (
                            <div className="text-xs text-muted-foreground p-3 text-center opacity-70">
                                还没有绑定任何云盘。<br />请前往设置连接。
                            </div>
                        ) : (
                            connectedProviders.map(p => (
                                <button
                                    key={p}
                                    onClick={() => {
                                        setSelectedProvider(p);
                                        setCurrentFolderId(undefined);
                                        setFolderStack([]);
                                    }}
                                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${selectedProvider === p ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted/40 text-foreground/80"}`}
                                >
                                    <IconById id={CLOUD_PROVIDERS[p].icon} size={16} />
                                    <span>{CLOUD_PROVIDERS[p].label}</span>
                                </button>
                            ))
                        )}
                    </div>

                    {/* File List Area */}
                    <div className="flex-1 flex flex-col overflow-hidden relative">
                        {/* Breadcrumbs */}
                        {selectedProvider && (
                            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border/30 dark:border-white/5 bg-muted/20 dark:bg-white/[0.03] text-[13px] font-medium shrink-0 overflow-x-auto no-scrollbar">
                                <button
                                    className="hover:text-primary transition-colors text-foreground/70"
                                    onClick={() => {
                                        setCurrentFolderId(undefined);
                                        setFolderStack([]);
                                    }}
                                >
                                    根目录
                                </button>
                                {folderStack.map((f, idx) => (
                                    <div key={f.id || idx} className="flex items-center gap-1.5 shrink-0 text-foreground/70">
                                        <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                                        <button
                                            className="hover:text-primary transition-colors"
                                            onClick={() => {
                                                setCurrentFolderId(f.id);
                                                setFolderStack(prev => prev.slice(0, idx + 1));
                                            }}
                                        >
                                            {f.name}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Loading / Empty / Files */}
                        <div className="flex-1 p-2 overflow-y-auto no-scrollbar">
                            {!selectedProvider ? (
                                <div className="h-full flex items-center justify-center text-sm text-muted-foreground opacity-50">
                                    请在左侧选择云盘
                                </div>
                            ) : isLoading ? (
                                <div className="h-full flex items-center justify-center">
                                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                </div>
                            ) : files.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-sm text-muted-foreground opacity-50">
                                    此文件夹是空的
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {files.map(f => (
                                        <div
                                            key={f.id}
                                            className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/30 transition-colors group cursor-pointer"
                                            onClick={() => {
                                                if (f.is_folder) {
                                                    setCurrentFolderId(f.id);
                                                    setFolderStack(prev => [...prev, { id: f.id, name: f.name }]);
                                                }
                                            }}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="text-muted-foreground opacity-80 shrink-0">
                                                    {f.is_folder ? <Folder className="w-5 h-5 text-blue-400" fill="currentColor" fillOpacity={0.2} /> : <FileIcon className="w-5 h-5" />}
                                                </div>
                                                <span className="truncate text-[14px] font-medium">
                                                    {f.name}
                                                </span>
                                            </div>
                                            {!f.is_folder && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleImportFile(f);
                                                    }}
                                                    disabled={downloadingId !== null}
                                                    className="opacity-0 group-hover:opacity-100 p-2 text-primary hover:bg-primary/10 rounded-lg transition-all focus:opacity-100 disabled:opacity-50"
                                                >
                                                    {downloadingId === f.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
