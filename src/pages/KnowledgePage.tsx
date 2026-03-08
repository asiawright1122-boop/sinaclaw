import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Database, Loader2, Plus, Network, Cloud } from "lucide-react";
import { getDocuments, deleteDocument, saveDocument, saveChunks, type DocumentRow } from "@/lib/db";
import { useToastStore } from "@/store/toastStore";
import { useSettingsStore } from "@/store/settingsStore";
import { translations } from "@/lib/i18n";
import { extractTextFromFile } from "@/lib/parsers";
import { splitText } from "@/lib/textSplitter";
import { generateEmbeddings } from "@/lib/embeddings";
import CloudImportModal from "@/components/knowledge/CloudImportModal";
import GraphView from "@/components/knowledge/GraphView";
import KnowledgeOnboarding from "@/components/knowledge/KnowledgeOnboarding";
import KnowledgeDocTable from "@/components/knowledge/KnowledgeDocTable";

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
                            {([
                                { id: "documents", label: t.docList, icon: Database },
                                { id: "graph", label: t.knowledgeGraph, icon: Network }
                            ] as const).map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveView(tab.id)}
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
                            <KnowledgeOnboarding t={t} />
                            <KnowledgeDocTable
                                documents={documents}
                                isLoading={isLoading}
                                language={language}
                                onDelete={handleDelete}
                                t={t}
                                commonManage={translations[language].common.manage}
                                commonDelete={translations[language].common.delete}
                            />
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
