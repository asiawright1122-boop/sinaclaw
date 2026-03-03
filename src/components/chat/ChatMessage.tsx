import { motion } from "framer-motion";
import { Bot, User, Copy, Check } from "lucide-react";
import { useState } from "react";
import type { Message } from "@/store/chatStore";

interface ChatMessageProps {
    message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
    const [copied, setCopied] = useState(false);
    const isUser = message.role === "user";

    const handleCopy = () => {
        navigator.clipboard.writeText(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`flex gap-4 px-4 py-6 group ${isUser ? "" : "bg-white/[0.02]"
                }`}
        >
            {/* 头像 */}
            <div className="shrink-0 mt-1">
                {isUser ? (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center shadow-inner">
                        <User className="w-4 h-4 text-white" />
                    </div>
                ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg icon-glow">
                        <Bot className="w-4 h-4 text-white" />
                    </div>
                )}
            </div>

            {/* 内容 */}
            <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground/80">
                        {isUser ? "你" : "Sinaclaw"}
                    </span>
                    <span className="text-xs text-muted-foreground/50">
                        {new Date(message.timestamp).toLocaleTimeString("zh-CN", {
                            hour: "2-digit",
                            minute: "2-digit",
                        })}
                    </span>
                </div>

                <div className="prose prose-invert prose-sm max-w-none text-foreground/90 leading-relaxed whitespace-pre-wrap break-words">
                    {message.content}
                </div>

                {/* 操作栏（hover 显示） */}
                {!isUser && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-2">
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                        >
                            {copied ? (
                                <>
                                    <Check className="w-3.5 h-3.5 text-green-400" />
                                    <span className="text-green-400">已复制</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>复制</span>
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
