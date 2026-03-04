import { Plus, Image as ImageIcon, Mic, Send, StopCircle, Loader2 } from "lucide-react";
import { useChatStore } from "@/store/chatStore";
import { useRef, useState } from "react";
import { extractTextFromFile } from "@/lib/parsers";
import { splitText } from "@/lib/textSplitter";
import { generateEmbeddings } from "@/lib/embeddings";
import { saveDocument, saveChunks } from "@/lib/db";
import { useToastStore } from "@/store/toastStore";
import { useTranslate } from "@/lib/i18n";

interface ChatInputProps {
    onSend: (message: string) => void;
}

export default function ChatInput({ onSend }: ChatInputProps) {
    const t = useTranslate();
    const { inputValue, setInputValue, isGenerating } = useChatStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { addToast } = useToastStore();

    // 文件处理状态
    const [isProcessingFile, setIsProcessingFile] = useState(false);
    const [processStatus, setProcessStatus] = useState("");
    const [isDragging, setIsDragging] = useState(false);

    const handleSend = () => {
        if (!inputValue.trim() || isGenerating || isProcessingFile) return;
        onSend(inputValue.trim());
        setInputValue("");
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) await processFile(file);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const processFile = async (file: File) => {
        setIsProcessingFile(true);
        try {
            const parsingText = t.common.loading === "加载中..." ? `正在解析 ${file.name}...` : `Parsing ${file.name}...`;
            setProcessStatus(parsingText);
            const text = await extractTextFromFile(file);

            const chunkingText = t.common.loading === "加载中..." ? `正在分块...` : `Chunking...`;
            setProcessStatus(chunkingText);
            const chunks = splitText(text, { chunkSize: 800, overlap: 150 });

            const embeddingText = t.common.loading === "加载中..."
                ? `正在生成向量 (${chunks.length} 块)...`
                : `Generating embeddings (${chunks.length} chunks)...`;
            setProcessStatus(embeddingText);
            const embeddings = await generateEmbeddings(chunks);

            const savingText = t.common.loading === "加载中..." ? `正在保存知识库...` : `Saving knowledge...`;
            setProcessStatus(savingText);
            const doc = await saveDocument(file.name, file.type || "text/plain", file.size);

            const chunksToSave = chunks.map((content, i) => ({
                content,
                embedding: embeddings[i]
            }));

            await saveChunks(doc.id, chunksToSave);

            const successText = t.common.loading === "加载中..."
                ? `文件 ${file.name} 已成功加入知识库！`
                : `File ${file.name} added to knowledge base!`;
            addToast(successText, "success");

        } catch (error) {
            console.error("处理文件失败:", error);
            const failText = t.common.error + ": " + (error instanceof Error ? error.message : String(error));
            addToast(failText, "error");
        } finally {
            setIsProcessingFile(false);
            setProcessStatus("");
        }
    };

    return (
        <div
            className="p-4 w-full max-w-4xl mx-auto mb-2"
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) processFile(file);
            }}
        >
            <div className={`bg-card/60 dark:bg-card/40 backdrop-blur-3xl border border-white/40 dark:border-white/10 rounded-[2rem] p-3 relative flex flex-col transition-all duration-300 shadow-xl focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/40 ${isDragging ? "ring-2 ring-primary border-primary bg-primary/5 scale-[1.02]" : ""}`}>

                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".pdf,.docx,.txt,.md,.json,.csv"
                    onChange={handleFileSelect}
                />

                {isProcessingFile && (
                    <div className="absolute top-0 left-0 right-0 -translate-y-full pb-3">
                        <div className="bg-card/90 backdrop-blur-3xl border border-white/20 dark:border-white/10 rounded-2xl px-5 py-3 flex items-center gap-3 text-sm text-primary shadow-lg mx-auto w-max max-w-[90%]">
                            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                            <span className="truncate font-medium">{processStatus}</span>
                        </div>
                    </div>
                )}
                <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t.chat.inputPlaceholder}
                    className="w-full bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50 resize-none px-4 pt-4 pb-2 min-h-[80px] text-[15px] font-medium focus:ring-0 leading-relaxed no-scrollbar"
                    rows={2}
                    disabled={isGenerating}
                />

                <div className="flex items-center justify-between px-2 pb-1 mt-2">
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2.5 rounded-xl bg-white/5 dark:bg-white/5 border border-white/10 dark:border-white/5 hover:bg-white/20 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all duration-200 group relative shadow-sm"
                            disabled={isProcessingFile}
                        >
                            <Plus className="w-4 h-4" />
                            <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-foreground text-background text-xs font-semibold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none shadow-md">
                                {t.chat.attachContext}
                            </span>
                        </button>
                        <button className="p-2.5 rounded-xl bg-transparent hover:bg-white/10 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all duration-200">
                            <ImageIcon className="w-4 h-4" />
                        </button>
                        <button className="p-2.5 rounded-xl bg-transparent hover:bg-white/10 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground transition-all duration-200">
                            <Mic className="w-4 h-4" />
                        </button>
                    </div>

                    {isGenerating ? (
                        <button
                            onClick={() => { }} // Stop logic can be added later
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-5 py-2.5 rounded-[14px] font-semibold flex items-center space-x-2 transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-[1px] active:translate-y-0"
                        >
                            <StopCircle className="w-4 h-4" />
                            <span>{t.chat.stop}</span>
                        </button>
                    ) : (
                        <button
                            onClick={handleSend}
                            disabled={!inputValue.trim() || isProcessingFile}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-[14px] font-semibold flex items-center space-x-2 transition-all duration-200 shadow-md disabled:opacity-50 disabled:hover:scale-100 hover:shadow-lg hover:-translate-y-[1px] active:translate-y-0 active:shadow-sm"
                        >
                            <span>{t.chat.send}</span>
                            <Send className="w-4 h-4 ml-1" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
