import { Plus, Image as ImageIcon, Mic, Send, StopCircle, Loader2, FileSpreadsheet, AtSign, Sparkles } from "lucide-react";
import { useChatStore } from "@/store/chatStore";
import { useRef, useState } from "react";
import { extractTextFromFile } from "@/lib/parsers";
import { splitText } from "@/lib/textSplitter";
import { generateEmbeddings } from "@/lib/embeddings";
import { saveDocument, saveChunks } from "@/lib/db";
import { useToastStore } from "@/store/toastStore";
import { useTranslate } from "@/lib/i18n";
import { useSettingsStore } from "@/store/settingsStore";
import { useAgentStore } from "@/store/agentStore";
import Tooltip from "@/components/ui/Tooltip";
import AgentAvatar from "@/components/ui/AgentAvatar";

// 数据文件扩展名
const DATA_FILE_EXTENSIONS = [".csv", ".xlsx", ".xls", ".tsv"];

interface ChatInputProps {
    onSend: (message: string, imageDataUrls?: string[]) => void;
}

export default function ChatInput({ onSend }: ChatInputProps) {
    const t = useTranslate();
    const { inputValue, setInputValue, isGenerating } = useChatStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const { addToast } = useToastStore();

    // 文件处理状态
    const [isProcessingFile, setIsProcessingFile] = useState(false);
    const [processStatus, setProcessStatus] = useState("");
    const [isDragging, setIsDragging] = useState(false);

    // 录音状态
    const [isRecording, setIsRecording] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const { apiKey } = useSettingsStore();
    // 图片附件状态
    const [pendingImages, setPendingImages] = useState<string[]>([]);

    // @Agent 提及状态
    const [showMentions, setShowMentions] = useState(false);
    const [mentionFilter, setMentionFilter] = useState("");
    const agents = useAgentStore(state => state.agents);

    // Deep Research 快捷切换状态
    const [isDeepResearchMode, setIsDeepResearchMode] = useState(false);

    // 数据文件拖入状态


    const handleSend = () => {
        if ((!inputValue.trim() && pendingImages.length === 0) || isGenerating || isProcessingFile) return;

        // 如果开启了深研模式且内容未以/research打头，则自动前缀
        let finalMessage = inputValue.trim();
        if (isDeepResearchMode && !finalMessage.startsWith("/research ") && !finalMessage.startsWith("/deep ")) {
            finalMessage = `/research ${finalMessage}`;
        }

        onSend(finalMessage, pendingImages.length > 0 ? pendingImages : undefined);
        setInputValue("");
        setPendingImages([]);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // @Agent 提及触发
        if (e.key === "@" || (e.key === "@" && !e.shiftKey)) {
            // 下一个 tick 检测 @ 符号
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

    // 图片选择处理
    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        for (const file of Array.from(files)) {
            if (!file.type.startsWith("image/")) continue;
            const dataUrl = await fileToDataUrl(file);
            setPendingImages(prev => [...prev, dataUrl]);
        }
        if (imageInputRef.current) imageInputRef.current.value = "";
    };

    // 将文件转为 base64 data URL
    const fileToDataUrl = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    // 监听粘贴图片
    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of Array.from(items)) {
            if (item.type.startsWith("image/")) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    const dataUrl = await fileToDataUrl(file);
                    setPendingImages(prev => [...prev, dataUrl]);
                }
            }
        }
    };

    // 录音逻辑实现
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);

            audioChunksRef.current = [];
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await transcribeAudio(audioBlob);
                // 停止所有轨道以清除麦克风图标
                stream.getTracks().forEach(track => track.stop());
            };

            recorder.start();
            setMediaRecorder(recorder);
            setIsRecording(true);
        } catch (err) {
            console.error("无法开启录音:", err);
            addToast("无法访问麦克风", "error");
        }
    };

    const stopRecording = () => {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            setIsRecording(false);
            setMediaRecorder(null);
        }
    };

    const transcribeAudio = async (blob: Blob) => {
        if (!apiKey) {
            addToast("请先在设置中配置 API Key", "error");
            return;
        }

        setIsProcessingFile(true);
        setProcessStatus("正在转录语音...");

        try {
            const formData = new FormData();
            formData.append("file", blob, "recording.webm");
            formData.append("model", "whisper-1");

            // 这里默认使用 OpenAI 的 Whisper 接口格式，大部分兼容 Provider 也支持
            const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                },
                body: formData
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || "转录失败");
            }

            const data = await response.json();
            if (data.text) {
                setInputValue(inputValue ? inputValue + " " + data.text : data.text);
            }
        } catch (error) {
            console.error("STT Error:", error);
            addToast("语音转文字失败: " + (error instanceof Error ? error.message : String(error)), "error");
        } finally {
            setIsProcessingFile(false);
            setProcessStatus("");
        }
    };

    return (
        <div
            className="p-4 w-full max-w-4xl mx-auto mb-2"
            onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
                // 检测是否为数据文件
                const items = e.dataTransfer?.items;
                if (items && items.length > 0) {
                    // 预留检测逻辑
                }
            }}
            onDragLeave={() => { setIsDragging(false); }}
            onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) {
                    const ext = "." + file.name.split(".").pop()?.toLowerCase();
                    if (DATA_FILE_EXTENSIONS.includes(ext)) {
                        // 数据文件 → 自动提示分析
                        const prompt = `请分析这个数据文件: ${file.name}`;
                        setInputValue(prompt);
                        processFile(file);
                        addToast(`检测到数据文件 ${file.name}，已自动开启分析模式`, "info");
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
                        {t.chat.modes?.standard || "标准模式"}
                    </button>
                    <button
                        onClick={() => setIsDeepResearchMode(true)}
                        className={`text-[11px] font-semibold px-3 py-1 rounded-full transition-all duration-200 flex items-center gap-1.5 ${isDeepResearchMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground/80"}`}
                    >
                        <Sparkles className="w-3 h-3" />
                        {t.chat.modes?.deepResearch || "深研模式"}
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

                {isProcessingFile && (
                    <div className="absolute top-0 left-0 right-0 -translate-y-full pb-3">
                        <div className="bg-card/90 border border-border/60 dark:border-white/[0.08] rounded-xl px-5 py-3 flex items-center gap-3 text-sm text-primary mx-auto w-max max-w-[90%]" style={{ boxShadow: 'var(--panel-shadow)' }}>
                            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                            <span className="truncate font-medium">{processStatus}</span>
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
                                    onClick={() => setPendingImages(prev => prev.filter((_, idx) => idx !== i))}
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
                        // @Agent 提及过滤
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
                    placeholder={isDeepResearchMode ? (t.chat.modes?.deepResearchPlaceholder || "输入研究主题，Agent 将自动分步计划并多管齐下... (Shift+Enter 换行)") : t.chat.inputPlaceholder}
                    className="w-full bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50 resize-none px-4 pt-4 pb-2 min-h-[80px] text-[15px] font-medium focus:ring-0 leading-relaxed no-scrollbar"
                    rows={2}
                    disabled={isGenerating}
                />

                {/* @Agent 提及下拉面板 */}
                {showMentions && (
                    <div className="absolute bottom-full mb-2 left-4 right-4 bg-card dark:bg-card border border-border/60 dark:border-white/[0.08] rounded-xl overflow-hidden z-50 animate-in slide-in-from-bottom-2 duration-200" style={{ boxShadow: 'var(--panel-shadow)' }}>
                        <div className="px-3 py-2 border-b border-border/40 flex items-center gap-2">
                            <AtSign className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs font-semibold text-muted-foreground">选择 Agent</span>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                            {agents
                                .filter(a => a.role === "primary")
                                .filter(a => a.name.toLowerCase().includes(mentionFilter.toLowerCase()))
                                .map(agent => (
                                    <button
                                        key={agent.id}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors cursor-pointer text-left"
                                        onClick={() => {
                                            const lastAt = inputValue.lastIndexOf("@");
                                            const newVal = inputValue.slice(0, lastAt) + `@${agent.name} `;
                                            setInputValue(newVal);
                                            setShowMentions(false);
                                        }}
                                    >
                                        <AgentAvatar avatar={agent.avatar} size={18} className="text-foreground/70" />
                                        <div>
                                            <div className="text-sm font-semibold text-foreground">{agent.name}</div>
                                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">{agent.description}</div>
                                        </div>
                                    </button>
                                ))}
                            {agents.filter(a => a.role === "primary" && a.name.toLowerCase().includes(mentionFilter.toLowerCase())).length === 0 && (
                                <div className="px-4 py-3 text-xs text-muted-foreground text-center">无匹配的 Agent</div>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between px-2 pb-1 mt-2">
                    <div className="flex items-center space-x-2">
                        <Tooltip content={t.chat.attachContext}>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="p-2 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition-all duration-150 active:scale-[0.90]"
                                disabled={isProcessingFile}
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </Tooltip>
                        <Tooltip content="添加图片">
                            <button className="p-2 rounded-lg bg-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.05] text-muted-foreground hover:text-foreground transition-all duration-150"
                                onClick={() => imageInputRef.current?.click()}
                            >
                                <ImageIcon className="w-4 h-4" />
                            </button>
                        </Tooltip>
                        {/* 数据分析快捷入口 */}
                        <Tooltip content="数据分析">
                            <button
                                className="p-2 rounded-lg bg-transparent hover:bg-accent/10 text-muted-foreground hover:text-accent transition-all duration-150"
                                onClick={() => {
                                    fileInputRef.current?.setAttribute("accept", ".csv,.xlsx,.xls,.tsv");
                                    fileInputRef.current?.click();
                                    // 恢复全格式 accept
                                    setTimeout(() => fileInputRef.current?.setAttribute("accept", ".pdf,.docx,.txt,.md,.json,.csv,.xlsx,.xls,.tsv"), 1000);
                                }}
                            >
                                <FileSpreadsheet className="w-4 h-4" />
                            </button>
                        </Tooltip>
                        <Tooltip content="按住说话">
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
                            disabled={(!inputValue.trim() && pendingImages.length === 0) || isProcessingFile}
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
