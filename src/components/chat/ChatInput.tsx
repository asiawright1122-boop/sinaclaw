import { Plus, Image as ImageIcon, Mic, Send, StopCircle } from "lucide-react";
import { useChatStore } from "@/store/chatStore";

interface ChatInputProps {
    onSend: (message: string) => void;
}

export default function ChatInput({ onSend }: ChatInputProps) {
    const { inputValue, setInputValue, isGenerating } = useChatStore();

    const handleSend = () => {
        if (!inputValue.trim() || isGenerating) return;
        onSend(inputValue.trim());
        setInputValue("");
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="p-4 w-full max-w-3xl mx-auto">
            <div className="glass-input rounded-2xl p-2 relative flex flex-col">
                <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="输入你的问题…（Shift+Enter 换行）"
                    className="w-full bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50 resize-none p-4 min-h-[80px] text-base rounded-xl focus:ring-0"
                    rows={2}
                    disabled={isGenerating}
                />

                <div className="flex items-center justify-between px-2 pb-2 mt-1">
                    <div className="flex items-center space-x-1">
                        <button className="p-2 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
                            <Plus className="w-4 h-4" />
                        </button>
                        <button className="p-2 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
                            <ImageIcon className="w-4 h-4" />
                        </button>
                        <button className="p-2 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
                            <Mic className="w-4 h-4" />
                        </button>
                    </div>

                    {isGenerating ? (
                        <button className="bg-destructive/80 text-white hover:bg-destructive px-4 py-2 rounded-xl font-bold flex items-center space-x-2 transition-transform hover:scale-105 active:scale-95 shadow-lg">
                            <StopCircle className="w-4 h-4" />
                            <span>停止</span>
                        </button>
                    ) : (
                        <button
                            onClick={handleSend}
                            disabled={!inputValue.trim()}
                            className="bg-foreground text-background hover:bg-foreground/90 px-4 py-2 rounded-xl font-bold flex items-center space-x-2 transition-transform hover:scale-105 active:scale-95 shadow-lg disabled:opacity-40 disabled:hover:scale-100"
                        >
                            <span>发送</span>
                            <Send className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
