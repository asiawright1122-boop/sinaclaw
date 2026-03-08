import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Database, Trash2, FileText, File, FileCode, Loader2, Book, ShieldCheck, Zap, MessageSquare, ArrowRight, Plus, Network, Cloud } from "lucide-react";
import { getDocuments, deleteDocument, saveDocument, saveChunks, type DocumentRow } from "@/lib/db";
import { useToastStore } from "@/store/toastStore";
import { useSettingsStore } from "@/store/settingsStore";
import { translations } from "@/lib/i18n";
import { extractTextFromFile } from "@/lib/parsers";
import { splitText } from "@/lib/textSplitter";
import { generateEmbeddings } from "@/lib/embeddings";
import CloudImportModal from "@/components/knowledge/CloudImportModal";
import GraphView from "@/components/knowledge/GraphView";
import { DocumentSkeleton } from "@/components/ui/Skeleton";

export default function KnowledgePage() {
    const [documents, setDocuments] = useState<DocumentRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
    const [activeView, setActiveView] = useState<"documents" | "graph">("documents");
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    const isMounted = useRef(false);

    useEffect(() => {
        if (!isMounted.current) {
            loadDocuments();
            isMounted.current = true;
        }
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
            console.error("Delete document failed:", error);
            addToast(translations[language].common.error, "error");
        }
    };

    const processFile = async (file: File) => {
        setIsProcessing(true);
        addToast(`Parsing file: ${file.name}...`, "info");
        try {
            const text = await extractTextFromFile(file);
            if (!text.trim()) throw new Error("No textual content extracted from file");

            addToast(`Chunking and building vector index...`, "info");

            const chunks = splitText(text, { chunkSize: 800, overlap: 100 });
            const embeddings = await generateEmbeddings(chunks);
            const doc = await saveDocument(file.name, file.type || "text/plain", file.size);

            const chunkRows = chunks.map((content: string, idx: number) => ({
                content,
                embedding: embeddings[idx]
            }));
            await saveChunks(doc.id, chunkRows);

            addToast(`Document [${file.name}] added to Knowledge Base (${chunks.length} chunks)`, "success");
            loadDocuments();
        } catch (error) {
            console.error("File processing failed:", error);
            addToast(`Import failed: ${error instanceof Error ? error.message : String(error)}`, "error");
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            await processFile(file);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const file = e.dataTransfer.files?.[0];
        if (file) {
            await processFile(file);
        }
    };

    const getFileIcon = (type: string, name: string) => {
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
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    };

    return (
        <div
            className={`h-full bg-background flex flex-col font-sans text-foreground selection:bg-primary/20 transition-colors overflow-hidden ${isDragging ? "bg-card/80" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Drag Overlay */}
            {isDragging && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-md transition-all">
                    <div className="p-5 bg-foreground text-stone-100 dark:text-stone-900 rounded-2xl mb-4 shadow-xl">
                        <Plus className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-sans text-foreground tracking-wide">{t.dragToUpload}</h2>
                    <p className="text-muted-foreground mt-2 font-light">{t.supportFormats}</p>
                </div>
            )}

            {/* Top Navigation Bar: Premium Minimalist */}
            <div className="flex items-center justify-between px-6 py-3.5 flex-shrink-0 border-b border-border/40 z-10 shrink-0">
                <div className="flex-1" />
                <div className="flex items-center gap-4">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".pdf,.doc,.docx,.txt,.md,.json,.csv,.xlsx,.xls,.pptx"
                        onChange={handleFileUpload}
                    />
                    <button
                        onClick={() => setIsCloudModalOpen(true)}
                        disabled={isProcessing}
                        className="flex items-center gap-2 px-4 py-1.5 text-[13px] font-medium bg-card border border-border/60 dark:border-white/[0.08] text-foreground/80 hover:bg-muted/50 rounded-lg transition-colors hidden sm:flex disabled:opacity-40"
                    >
                        <Cloud className="w-4 h-4" />
                        <span>{t.cloudImport}</span>
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isProcessing}
                        className={`flex items-center gap-2 px-5 py-1.5 text-[13px] font-medium rounded-lg transition-all ${isProcessing
                            ? 'bg-muted text-muted-foreground cursor-not-allowed'
                            : 'bg-primary text-primary-foreground hover:bg-primary/90'
                            }`}
                    >
                        {isProcessing ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> {translations[language].common.loading}</>
                        ) : (
                            <><Plus className="w-4 h-4" /> <span>{t.uploadDoc}</span></>
                        )}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 pb-12 relative min-h-0">
                {/* Ambient Glow */}

                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="max-w-6xl mx-auto pt-8 relative z-10 space-y-12"
                >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 border-b border-border/40 pb-6">
                        <div className="flex flex-col gap-1.5">
                            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/[0.06] border border-border/50 flex shrink-0">
                                    <Database className="w-5 h-5 text-foreground/70" />
                                </div>
                                {t.title}
                            </h1>
                            <p className="text-muted-foreground text-[13px] max-w-2xl leading-relaxed">
                                {t.subtitle}
                            </p>
                        </div>

                        {/* View Tabs */}
                        <div className="flex gap-0.5 bg-black/[0.04] dark:bg-white/[0.04] border border-border/40 p-0.5 rounded-lg shrink-0">
                            {[
                                { id: "documents", label: t.docList, icon: Database },
                                { id: "graph", label: t.knowledgeGraph, icon: Network }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveView(tab.id as any)}
                                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-all duration-150 ${activeView === tab.id
                                        ? "bg-card dark:bg-white/[0.08] text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                        }`}
                                >
                                    <tab.icon className="w-3.5 h-3.5" />
                                    <span>{tab.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {activeView === "graph" ? (
                        <div className="h-[550px] bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl overflow-hidden" style={{ boxShadow: 'var(--panel-shadow)' }}>
                            <GraphView />
                        </div>
                    ) : (
                        <>
                            {/* Onboarding Cards: Liquid Glass */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                                {[
                                    { icon: Book, title: t.card1Title, desc: t.card1Desc },
                                    { icon: Zap, title: t.card2Title, desc: t.card2Desc },
                                    { icon: ShieldCheck, title: t.card3Title, desc: t.card3Desc }
                                ].map((card, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.1 + idx * 0.1 }}
                                        className="bg-card/80 dark:bg-card/50 p-5 rounded-xl border border-border/50 dark:border-white/[0.06] flex flex-col gap-3.5 group hover:border-border/80 dark:hover:border-white/[0.12] transition-colors" style={{ boxShadow: 'var(--panel-shadow)' }}
                                    >
                                        <div className="w-9 h-9 rounded-lg bg-primary/[0.06] dark:bg-primary/10 border border-border/40 flex items-center justify-center text-muted-foreground">
                                            <card.icon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-foreground mb-1 text-[14px]">{card.title}</h3>
                                            <p className="text-[12px] text-muted-foreground leading-relaxed">
                                                {card.desc}
                                            </p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Workflow Indicator */}
                            <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-border/40 rounded-xl px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                                <div className="flex items-center flex-wrap gap-3.5 text-[12px] font-semibold text-foreground/70 tracking-wide uppercase">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] shrink-0">1</div>
                                        <span>{t.step1}</span>
                                    </div>
                                    <ArrowRight className="w-3.5 h-3.5 opacity-40 hidden sm:block" />
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] shrink-0">2</div>
                                        <span>{t.step2}</span>
                                    </div>
                                    <ArrowRight className="w-3.5 h-3.5 opacity-40 hidden sm:block" />
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] shrink-0 font-bold">3</div>
                                        <span className="text-foreground">{t.step3}</span>
                                    </div>
                                </div>
                                <div className="text-[11px] text-muted-foreground hidden lg:block">
                                    {t.tip.split('@filename')[0]}<code className="bg-black/[0.04] dark:bg-white/[0.06] border border-border/40 px-1.5 py-0.5 rounded text-foreground font-mono text-[10px] mx-1">@filename</code>{t.tip.split('@filename')[1]}
                                </div>
                            </div>

                            {/* Document Table Area */}
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
                                                    <th className="px-6 py-3 font-medium text-right">{translations[language].common.manage}</th>
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
                                                                onClick={() => handleDelete(doc.id, doc.name)}
                                                                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                                title={translations[language].common.delete}
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
                        </>
                    )}
                </motion.div>
            </div>

            <CloudImportModal
                isOpen={isCloudModalOpen}
                onClose={() => setIsCloudModalOpen(false)}
                onImport={async (file) => { await processFile(file); }}
            />
        </div>
    );
}
