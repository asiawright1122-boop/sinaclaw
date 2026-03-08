import { motion } from "framer-motion";
import { Trash2, FileText, File, FileCode, MessageSquare } from "lucide-react";
import type { DocumentRow } from "@/lib/db";
import { DocumentSkeleton } from "@/components/ui/Skeleton";

function getFileIcon(type: string, name: string) {
    const lowerName = name.toLowerCase();
    if (type === "application/pdf" || lowerName.endsWith(".pdf")) {
        return <FileText className="w-5 h-5 text-destructive/80" />;
    }
    if (lowerName.endsWith(".docx") || lowerName.endsWith(".doc")) {
        return <FileText className="w-5 h-5 text-primary/80" />;
    }
    if (lowerName.endsWith(".json") || lowerName.endsWith(".md") || lowerName.endsWith(".csv")) {
        return <FileCode className="w-5 h-5 text-muted-foreground" />;
    }
    return <File className="w-5 h-5 text-muted-foreground" />;
}

function formatSize(bytes: number) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

interface KnowledgeDocTableProps {
    documents: DocumentRow[];
    isLoading: boolean;
    language: string;
    onDelete: (id: string, name: string) => void;
    t: {
        tableTitle: string;
        colName: string;
        colSize: string;
        colTime: string;
        emptyTitle: string;
        emptyDesc: string;
        goChat: string;
    };
    commonManage: string;
    commonDelete: string;
}

export default function KnowledgeDocTable({
    documents,
    isLoading,
    language,
    onDelete,
    t,
    commonManage,
    commonDelete,
}: KnowledgeDocTableProps) {
    return (
        <div className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl overflow-hidden relative min-h-[400px]" style={{ boxShadow: 'var(--panel-shadow)' }}>
            <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-foreground uppercase tracking-wide flex items-center gap-2.5">
                    {t.tableTitle}
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground tabular-nums font-mono">{documents.length}</span>
                </h2>
            </div>

            {isLoading ? (
                <div className="p-6">
                    <DocumentSkeleton count={4} />
                </div>
            ) : documents.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                    <div className="w-16 h-16 rounded-3xl bg-card border border-border shadow-sm mb-6 flex items-center justify-center">
                        <MessageSquare className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <h3 className="font-sans text-[20px] text-foreground mb-2">{t.emptyTitle}</h3>
                    <p className="text-[13px] font-light max-w-sm leading-relaxed mx-auto text-muted-foreground">
                        {t.emptyDesc}
                    </p>
                    <button
                        onClick={() => window.location.href = '#/'}
                        className="mt-6 px-5 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-[13px] hover:bg-primary/90 transition-all"
                    >
                        {t.goChat}
                    </button>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="text-[11px] text-muted-foreground uppercase tracking-widest bg-black/[0.02] dark:bg-white/[0.02] border-b border-border/40 font-medium">
                            <tr>
                                <th className="px-6 py-3 font-medium">{t.colName}</th>
                                <th className="px-6 py-3 font-medium">{t.colSize}</th>
                                <th className="px-6 py-3 font-medium">{t.colTime}</th>
                                <th className="px-6 py-3 font-medium text-right">{commonManage}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30 dark:divide-white/[0.04] text-[13px]">
                            {documents.map((doc, idx) => (
                                <motion.tr
                                    key={doc.id}
                                    initial={{ opacity: 0, x: -5 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors group"
                                >
                                    <td className="px-6 py-3.5">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-muted/50 border border-border/40">
                                                {getFileIcon(doc.type, doc.name)}
                                            </div>
                                            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                                <span className="font-medium text-foreground truncate max-w-[200px] sm:max-w-[400px]" title={doc.name}>
                                                    {doc.name}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
                                                    Local File · {doc.type.split('/')[1] || 'Doc'}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-3.5 text-muted-foreground tabular-nums">
                                        {formatSize(doc.size)}
                                    </td>
                                    <td className="px-6 py-3.5 text-muted-foreground tabular-nums">
                                        {new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        }).format(new Date(doc.created_at))}
                                    </td>
                                    <td className="px-6 py-3.5 text-right">
                                        <button
                                            onClick={() => onDelete(doc.id, doc.name)}
                                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                            title={commonDelete}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
