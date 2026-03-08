import { motion, AnimatePresence } from "framer-motion";
import { Bot, User, Copy, Check, RefreshCw } from "lucide-react";
import { useState, useMemo } from "react";
import AgentAvatar from "@/components/ui/AgentAvatar";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark-dimmed.css";
import type { Message } from "@/store/chatStore";

interface ChatMessageProps {
    message: Message;
    onRetry?: () => void;
}

export default function ChatMessage({ message, onRetry }: ChatMessageProps) {
    const [copied, setCopied] = useState(false);
    const isUser = message.role === "user";

    const handleCopy = () => {
        navigator.clipboard.writeText(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Markdown 组件映射：自定义代码块带复制按钮
    const components = useMemo(
        () => ({
            // 代码块
            pre({ children, ...props }: any) {
                return (
                    <div className="relative group/code my-3">
                        <pre
                            className="rounded-xl bg-[#0d1117] border border-white/5 p-4 overflow-x-auto text-sm leading-relaxed"
                            {...props}
                        >
                            {children}
                        </pre>
                        <button
                            onClick={() => {
                                const text =
                                    (children as any)?.props?.children || "";
                                navigator.clipboard.writeText(
                                    typeof text === "string" ? text : ""
                                );
                            }}
                            className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity px-2 py-1 rounded-md bg-muted/50 hover:bg-muted/70 text-xs text-muted-foreground"
                        >
                            复制
                        </button>
                    </div>
                );
            },
            // 内联代码
            code({
                className,
                children,
                ...props
            }: any) {
                const isInline = !className;
                if (isInline) {
                    return (
                        <code
                            className="px-1.5 py-0.5 rounded-md bg-black/[0.06] dark:bg-white/10 text-primary/90 text-sm font-mono"
                            {...props}
                        >
                            {children}
                        </code>
                    );
                }
                return (
                    <code className={className} {...props}>
                        {children}
                    </code>
                );
            },
            // 表格
            table({ children, ...props }: any) {
                return (
                    <div className="overflow-x-auto my-3 rounded-lg border border-border/60 dark:border-white/[0.08]">
                        <table
                            className="w-full text-sm"
                            {...props}
                        >
                            {children}
                        </table>
                    </div>
                );
            },
            th({ children, ...props }: any) {
                return (
                    <th
                        className="px-4 py-2 text-left font-semibold bg-black/[0.03] dark:bg-white/[0.04] border-b border-border/60 dark:border-white/[0.08]"
                        {...props}
                    >
                        {children}
                    </th>
                );
            },
            td({ children, ...props }: any) {
                return (
                    <td
                        className="px-4 py-2 border-b border-border/30 dark:border-white/5"
                        {...props}
                    >
                        {children}
                    </td>
                );
            },
            // 链接
            a({ children, href, ...props }: any) {
                return (
                    <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                        {...props}
                    >
                        {children}
                    </a>
                );
            },
            // 引用块
            blockquote({ children, ...props }: any) {
                return (
                    <blockquote
                        className="border-l-4 border-primary/40 pl-4 my-3 text-foreground/70 italic"
                        {...props}
                    >
                        {children}
                    </blockquote>
                );
            },
        }),
        []
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`flex gap-3 sm:gap-4 px-4 py-4 sm:px-5 sm:py-5 mb-3 rounded-2xl group transition-all duration-200 ${isUser ? "bg-transparent hover:bg-black/[0.02] dark:hover:bg-white/[0.02]" : "bg-card/70 dark:bg-card/40 border border-border/40 dark:border-white/[0.06]"
                }`}
            style={!isUser ? { boxShadow: 'var(--panel-shadow)' } : undefined}
        >
            {/* 头像 */}
            <div className="shrink-0 mt-1">
                {isUser ? (
                    <div className="w-8 h-8 rounded-lg bg-primary/80 flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                    </div>
                ) : message.agentAvatar ? (
                    <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center relative">
                        <AgentAvatar avatar={message.agentAvatar} size={18} className="text-violet-400" />
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-accent rounded-full border-2 border-card" />
                    </div>
                ) : (
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                        <Bot className="w-4 h-4 text-white" />
                    </div>
                )}
            </div>

            {/* 内容 */}
            <div className="flex-1 min-w-0 space-y-3">
                <div className="flex items-center gap-3">
                    <span className="text-[14px] font-semibold text-foreground">
                        {isUser ? "You" : (message.agentName || "Sinaclaw")}
                    </span>
                    {message.agentName && !isUser && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20">
                            Sub-Agent
                        </span>
                    )}
                    <span className="text-[11px] font-semibold text-muted-foreground/50">
                        {new Date(message.timestamp).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                        })}
                    </span>
                </div>


                {isUser ? (
                    <div className="space-y-3">
                        {message.images && message.images.length > 0 && (
                            <div className="flex gap-2 flex-wrap">
                                {message.images.map((img, i) => (
                                    <img
                                        key={i}
                                        src={img}
                                        alt=""
                                        className="max-w-[200px] max-h-[200px] object-cover rounded-xl border border-border/60 dark:border-white/[0.12] shadow-md cursor-pointer hover:scale-105 transition-transform"
                                        onClick={() => window.open(img, '_blank')}
                                    />
                                ))}
                            </div>
                        )}
                        <div className="prose prose-invert prose-sm max-w-none text-foreground leading-relaxed whitespace-pre-wrap break-words font-medium text-[15px]">
                            {message.content}
                        </div>
                    </div>
                ) : (
                    /* AI 回复：Markdown 渲染 */
                    <div className="prose prose-invert prose-sm max-w-none text-foreground/90 leading-relaxed break-words [&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-4">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeHighlight]}
                            components={components}
                        >
                            {message.content}
                        </ReactMarkdown>
                    </div>
                )}

                {/* 操作栏（hover 显示） */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-2">
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                    >
                        <AnimatePresence mode="wait">
                            {copied ? (
                                <motion.span
                                    key="copied"
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.8, opacity: 0 }}
                                    className="flex items-center gap-1.5 text-green-500"
                                >
                                    <Check className="w-3.5 h-3.5" />
                                    已复制
                                </motion.span>
                            ) : (
                                <motion.span
                                    key="copy"
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.8, opacity: 0 }}
                                    className="flex items-center gap-1.5"
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                    复制
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </button>
                    {!isUser && onRetry && (
                        <button
                            onClick={onRetry}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            重试
                        </button>
                    )}
                </div>
            </div>
        </motion.div >
    );
}
