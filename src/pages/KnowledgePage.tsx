import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Database, Trash2, FileText, File, FileCode, Loader2, Book, ShieldCheck, Zap, MessageSquare, ArrowRight } from "lucide-react";
import { getDocuments, deleteDocument, type DocumentRow } from "@/lib/db";
import { useToastStore } from "@/store/toastStore";
import { useSettingsStore } from "@/store/settingsStore";
import { translations } from "@/lib/i18n";

export default function KnowledgePage() {
    const [documents, setDocuments] = useState<DocumentRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { addToast } = useToastStore();
    const { language } = useSettingsStore();
    const t = translations[language].knowledge;

    const loadDocuments = async () => {
        setIsLoading(true);
        try {
            const docs = await getDocuments();
            setDocuments(docs);
        } catch (error) {
            console.error(t.loadError, error);
            addToast(t.loadError, "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadDocuments();
    }, []);

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(t.deleteConfirm.replace("{name}", name))) {
            return;
        }

        try {
            await deleteDocument(id);
            addToast(t.deleteSuccess.replace("{name}", name), "success");
            loadDocuments();
        } catch (error) {
            console.error("删除文档失败:", error);
            addToast("删除文档失败", "error");
        }
    };

    const getFileIcon = (type: string, name: string) => {
        const lowerName = name.toLowerCase();
        if (type === "application/pdf" || lowerName.endsWith(".pdf")) {
            return <FileText className="w-5 h-5 text-red-400" />;
        }
        if (lowerName.endsWith(".docx") || lowerName.endsWith(".doc")) {
            return <FileText className="w-5 h-5 text-blue-400" />;
        }
        if (lowerName.endsWith(".json") || lowerName.endsWith(".md") || lowerName.endsWith(".csv")) {
            return <FileCode className="w-5 h-5 text-yellow-400" />;
        }
        return <File className="w-5 h-5 text-gray-400" />;
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 relative z-10 no-scrollbar">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="max-w-6xl mx-auto space-y-10 pb-12"
            >
                {/* Header & Intro */}
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-3xl sm:text-4xl font-black text-foreground flex items-center gap-3 sm:gap-4 tracking-tight">
                            <div className="p-2 sm:p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-inner">
                                <Database className="w-6 h-6 sm:w-8 h-8 text-emerald-500" />
                            </div>
                            Knowledge Base
                        </h1>
                        <p className="text-[15px] font-medium text-muted-foreground max-w-2xl">
                            {t.subtitle}
                        </p>
                    </div>

                    {/* Onboarding Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[
                            {
                                icon: <Book className="w-5 h-5 text-blue-500" />,
                                title: t.card1Title,
                                desc: t.card1Desc
                            },
                            {
                                icon: <Zap className="w-5 h-5 text-amber-500" />,
                                title: t.card2Title,
                                desc: t.card2Desc
                            },
                            {
                                icon: <ShieldCheck className="w-5 h-5 text-emerald-500" />,
                                title: t.card3Title,
                                desc: t.card3Desc
                            }
                        ].map((card, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 + idx * 0.1 }}
                                className="bg-card/40 dark:bg-card/20 backdrop-blur-xl p-5 rounded-2xl border border-white/20 dark:border-white/5 flex flex-col gap-3 shadow-sm"
                            >
                                <div className="p-2 w-fit rounded-xl bg-white/50 dark:bg-white/5 border border-white/20 dark:border-white/10 shadow-inner">
                                    {card.icon}
                                </div>
                                <h3 className="font-bold text-[15px]">{card.title}</h3>
                                <p className="text-[12.5px] leading-relaxed text-muted-foreground/80 font-medium">
                                    {card.desc}
                                </p>
                            </motion.div>
                        ))}
                    </div>

                    {/* Workflow Indicator */}
                    <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-6 overflow-hidden">
                        <div className="flex items-center flex-wrap gap-3 sm:gap-4 text-[13px] font-bold text-primary shrink-0 px-2">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[11px] shrink-0">1</div>
                                <span>{t.step1}</span>
                            </div>
                            <ArrowRight className="w-4 h-4 opacity-50 hidden sm:block" />
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[11px] shrink-0">2</div>
                                <span>{t.step2}</span>
                            </div>
                            <ArrowRight className="w-4 h-4 opacity-50 hidden sm:block" />
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[11px] shrink-0">3</div>
                                <span>{t.step3}</span>
                            </div>
                        </div>
                        <div className="text-[12px] text-muted-foreground font-medium hidden lg:block truncate">
                            {t.tip.split('@filename')[0]}<code className="bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded text-primary">@filename</code>{t.tip.split('@filename')[1]}
                        </div>
                    </div>
                </div>

                {/* Document Table Area */}
                <div className="bg-card/60 dark:bg-card/40 backdrop-blur-3xl rounded-[2.5rem] border border-white/40 dark:border-white/10 overflow-hidden relative min-h-[400px] shadow-2xl">
                    <div className="px-8 py-6 border-b border-white/20 dark:border-white/5 flex items-center justify-between bg-white/20 dark:bg-black/20">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            {t.tableTitle}
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{documents.length}</span>
                        </h2>
                    </div>

                    {isLoading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <span className="font-medium animate-pulse">{t.syncing}</span>
                        </div>
                    ) : documents.length === 0 ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground p-12 text-center">
                            <div className="p-6 rounded-3xl bg-black/5 dark:bg-white/5 mb-6 ring-1 ring-white/10">
                                <MessageSquare className="w-12 h-12 opacity-30 text-primary" />
                            </div>
                            <h3 className="font-bold text-xl text-foreground">{t.emptyTitle}</h3>
                            <p className="text-[14px] opacity-70 mt-2 max-w-sm leading-relaxed">
                                {t.emptyDesc}
                            </p>
                            <button
                                onClick={() => window.location.href = '#/'}
                                className="mt-6 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-[14px] hover:scale-105 transition-all shadow-lg active:scale-95 cursor-pointer"
                            >
                                {t.goChat}
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-[12px] text-muted-foreground font-bold uppercase tracking-wider bg-white/40 dark:bg-black/30">
                                    <tr>
                                        <th className="px-8 py-5">{t.colName}</th>
                                        <th className="px-8 py-5">{t.colSize}</th>
                                        <th className="px-8 py-5">{t.colTime}</th>
                                        <th className="px-8 py-5 text-right">{translations[language].common.manage}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/10 dark:divide-white/5">
                                    {documents.map((doc, idx) => (
                                        <motion.tr
                                            key={doc.id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className="hover:bg-white/50 dark:hover:bg-white/5 transition-all group"
                                        >
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-3 rounded-2xl bg-white/80 dark:bg-black/40 border border-white/40 dark:border-white/10 shadow-sm group-hover:scale-110 transition-transform">
                                                        {getFileIcon(doc.type, doc.name)}
                                                    </div>
                                                    <div className="flex flex-col gap-0.5 min-w-0">
                                                        <span className="font-bold text-[15px] text-foreground truncate max-w-[150px] sm:max-w-[320px]" title={doc.name}>
                                                            {doc.name}
                                                        </span>
                                                        <span className="text-[11px] text-muted-foreground font-medium uppercase opacity-60">
                                                            LOCAL FILE · {doc.type.split('/')[1] || 'DOC'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-[13px] font-bold text-muted-foreground/80 tabular-nums">
                                                {formatSize(doc.size)}
                                            </td>
                                            <td className="px-8 py-5 text-[13px] font-medium text-muted-foreground/60 tabular-nums">
                                                {new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                }).format(new Date(doc.created_at))}
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <button
                                                    onClick={() => handleDelete(doc.id, doc.name)}
                                                    className="p-3 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100 shadow-sm"
                                                    title="删除索引"
                                                >
                                                    <Trash2 className="w-4.5 h-4.5" />
                                                </button>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
