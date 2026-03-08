import { Plus, Image as ImageIcon, Mic, Send, StopCircle, Loader2, FileSpreadsheet, Sparkles } from "lucide-react";
import { useChatStore } from "@/store/chatStore";
import { useState } from "react";
import { useToastStore } from "@/store/toastStore";
import { useTranslate } from "@/lib/i18n";
import Tooltip from "@/components/ui/Tooltip";
import { useChatFileProcessor } from "@/hooks/useChatFileProcessor";
import { useChatVoiceInput } from "@/hooks/useChatVoiceInput";
import ChatMentionDropdown from "@/components/chat/ChatMentionDropdown";

// 数据文件扩展名
const DATA_FILE_EXTENSIONS = [".csv", ".xlsx", ".xls", ".tsv"];

interface ChatInputProps {
    onSend: (message: string, imageDataUrls?: string[]) => void;
}

export default function ChatInput({ onSend }: ChatInputProps) {
    const t = useTranslate();
    const { inputValue, setInputValue, isGenerating } = useChatStore();
    const { addToast } = useToastStore();

    const {
        fileInputRef,
        imageInputRef,
        isProcessingFile,
        processStatus,
        pendingImages,
        processFile,
        handleFileSelect,
        handleImageSelect,
        handlePaste,
        removePendingImage,
        clearPendingImages,
    } = useChatFileProcessor();

    const { isRecording, isTranscribing, transcribeStatus, startRecording, stopRecording } = useChatVoiceInput();

    const [isDragging, setIsDragging] = useState(false);
    const [showMentions, setShowMentions] = useState(false);
    const [mentionFilter, setMentionFilter] = useState("");
    const [isDeepResearchMode, setIsDeepResearchMode] = useState(false);

    const isBusy = isProcessingFile || isTranscribing;
    const statusText = processStatus || transcribeStatus;

    const handleSend = () => {
        if ((!inputValue.trim() && pendingImages.length === 0) || isGenerating || isBusy) return;

        let finalMessage = inputValue.trim();
        if (isDeepResearchMode && !finalMessage.startsWith("/research ") && !finalMessage.startsWith("/deep ")) {
            finalMessage = `/research ${finalMessage}`;
        }

        onSend(finalMessage, pendingImages.length > 0 ? pendingImages : undefined);
        setInputValue("");
        clearPendingImages();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "@" || (e.key === "@" && !e.shiftKey)) {
            setTimeout(() => {
                const val = (e.target as HTMLTextAreaElement).value;
                const lastAt = val.lastIndexOf("@");
                if (lastAt >= 0) {
                    setShowMentions(true);
                    setMentionFilter(val.slice(lastAt + 1));
                }
            }, 0);
        }
        if (showMentions && e.key === "Escape") {
            setShowMentions(false);
            return;
        }
        if (e.key === "Enter" && !e.shiftKey && !showMentions) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div
            className="p-4 w-full max-w-4xl mx-auto mb-2"
            onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
            }}
            onDragLeave={() => { setIsDragging(false); }}
            onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) {
                    const ext = "." + file.name.split(".").pop()?.toLowerCase();
                    if (DATA_FILE_EXTENSIONS.includes(ext)) {
                        const prompt = t.chat.analyzeFilePrompt.replace('{name}', file.name);
                        setInputValue(prompt);
                        processFile(file);
                        addToast(t.chat.dataFileDetected.replace('{name}', file.name), "info");
                    } else {
                        processFile(file);
                    }
                }
            }}
        >
            <div className={`bg-card/90 dark:bg-card/70 backdrop-blur-2xl border border-border/60 dark:border-white/[0.08] rounded-2xl p-3 relative flex flex-col transition-all duration-200 focus-within:ring-2 focus-within:ring-primary/15 focus-within:border-primary/30 ${isDragging ? "ring-2 ring-primary border-primary bg-primary/5 scale-[1.01]" : ""} ${isDeepResearchMode ? "border-primary/20 ring-1 ring-primary/10" : ""}`} style={{ boxShadow: 'var(--panel-shadow)' }}>

                {/* 模式切换胶囊 */}
                <div className="absolute top-0 right-4 -translate-y-[60%] flex items-center bg-card dark:bg-card backdrop-blur-xl border border-border/60 dark:border-white/[0.08] rounded-full p-0.5 shadow-sm z-10 transition-all">
                    <button
                        onClick={() => setIsDeepResearchMode(false)}
                        className={`text-[11px] font-semibold px-3 py-1 rounded-full transition-all duration-200 ${!isDeepResearchMode ? "bg-black/[0.05] dark:bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground/80"}`}
                    >
                        {t.chat.modes?.standard || "Standard"}
                    </button>
                    <button
                        onClick={() => setIsDeepResearchMode(true)}
                        className={`text-[11px] font-semibold px-3 py-1 rounded-full transition-all duration-200 flex items-center gap-1.5 ${isDeepResearchMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground/80"}`}
                    >
                        <Sparkles className="w-3 h-3" />
                        {t.chat.modes?.deepResearch || "Deep Research"}
                    </button>
                </div>

                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".pdf,.docx,.txt,.md,.json,.csv"
                    onChange={handleFileSelect}
                />
                <input
                    type="file"
                    ref={imageInputRef}
                    className="hidden"
                    accept="image/*"
                    multiple
                    onChange={handleImageSelect}
                />

                {isBusy && (
                    <div className="absolute top-0 left-0 right-0 -translate-y-full pb-3">
                        <div className="bg-card/90 border border-border/60 dark:border-white/[0.08] rounded-xl px-5 py-3 flex items-center gap-3 text-sm text-primary mx-auto w-max max-w-[90%]" style={{ boxShadow: 'var(--panel-shadow)' }}>
                            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                            <span className="truncate font-medium">{statusText}</span>
                        </div>
                    </div>
                )}
                {/* 图片预览 */}
                {pendingImages.length > 0 && (
                    <div className="flex gap-2 px-4 pt-2 flex-wrap">
                        {pendingImages.map((img, i) => (
                            <div key={i} className="relative group">
                                <img src={img} alt="" className="w-16 h-16 object-cover rounded-xl border border-border/60 dark:border-white/[0.12]" />
                                <button
                                    onClick={() => removePendingImage(i)}
                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >×</button>
                            </div>
                        ))}
                    </div>
                )}

                <textarea
                    value={inputValue}
                    onChange={(e) => {
                        setInputValue(e.target.value);
                        const val = e.target.value;
                        const lastAt = val.lastIndexOf("@");
                        if (lastAt >= 0 && showMentions) {
                            setMentionFilter(val.slice(lastAt + 1));
                        } else if (lastAt < 0) {
                            setShowMentions(false);
                        }
                    }}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder={isDeepResearchMode ? (t.chat.modes?.deepResearchPlaceholder || "Enter research topic... (Shift+Enter for new line)") : t.chat.inputPlaceholder}
                    className="w-full bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50 resize-none px-4 pt-4 pb-2 min-h-[80px] text-[15px] font-medium focus:ring-0 leading-relaxed no-scrollbar"
                    rows={2}
                    disabled={isGenerating}
                />

                {/* @Agent 提及下拉面板 */}
                {showMentions && (
                    <ChatMentionDropdown mentionFilter={mentionFilter} onClose={() => setShowMentions(false)} />
                )}

                <div className="flex items-center justify-between px-2 pb-1 mt-2">
                    <div className="flex items-center space-x-2">
                        <Tooltip content={t.chat.attachContext}>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="p-2 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition-all duration-150 active:scale-[0.90]"
                                disabled={isBusy}
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </Tooltip>
                        <Tooltip content={t.chat.addImage}>
                            <button className="p-2 rounded-lg bg-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.05] text-muted-foreground hover:text-foreground transition-all duration-150"
                                onClick={() => imageInputRef.current?.click()}
                            >
                                <ImageIcon className="w-4 h-4" />
                            </button>
                        </Tooltip>
                        {/* 数据分析快捷入口 */}
                        <Tooltip content={t.chat.dataAnalysis}>
                            <button
                                className="p-2 rounded-lg bg-transparent hover:bg-accent/10 text-muted-foreground hover:text-accent transition-all duration-150"
                                onClick={() => {
                                    fileInputRef.current?.setAttribute("accept", ".csv,.xlsx,.xls,.tsv");
                                    fileInputRef.current?.click();
                                    setTimeout(() => fileInputRef.current?.setAttribute("accept", ".pdf,.docx,.txt,.md,.json,.csv,.xlsx,.xls,.tsv"), 1000);
                                }}
                            >
                                <FileSpreadsheet className="w-4 h-4" />
                            </button>
                        </Tooltip>
                        <Tooltip content={t.chat.holdToSpeak}>
                            <button
                                onMouseDown={startRecording}
                                onMouseUp={stopRecording}
                                onMouseLeave={stopRecording}
                                className={`p-2 rounded-lg transition-all duration-150 ${isRecording ? "bg-primary text-primary-foreground animate-pulse scale-105" : "bg-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.05] text-muted-foreground hover:text-foreground"}`}
                            >
                                <Mic className="w-4 h-4" />
                            </button>
                        </Tooltip>
                    </div>

                    {isGenerating ? (
                        <button
                            onClick={() => { }} // Stop logic can be added later
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-xl font-semibold text-sm flex items-center space-x-2 transition-all duration-150 active:scale-[0.95]"
                        >
                            <StopCircle className="w-4 h-4" />
                            <span>{t.chat.stop}</span>
                        </button>
                    ) : (
                        <button
                            onClick={handleSend}
                            disabled={(!inputValue.trim() && pendingImages.length === 0) || isBusy}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-xl font-semibold text-sm flex items-center space-x-2 transition-all duration-150 shadow-sm disabled:opacity-40 active:scale-[0.95]"
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
