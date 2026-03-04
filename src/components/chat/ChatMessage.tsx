import { motion } from "framer-motion";
import { Bot, User, Copy, Check } from "lucide-react";
import { useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark-dimmed.css";
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
                            className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-xs text-muted-foreground"
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
                            className="px-1.5 py-0.5 rounded-md bg-white/10 text-primary/90 text-sm font-mono"
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
                    <div className="overflow-x-auto my-3 rounded-xl border border-white/10">
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
                        className="px-4 py-2 text-left font-semibold bg-white/5 border-b border-white/10"
                        {...props}
                    >
                        {children}
                    </th>
                );
            },
            td({ children, ...props }: any) {
                return (
                    <td
                        className="px-4 py-2 border-b border-white/5"
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
            className={`flex gap-5 px-6 py-6 mb-5 rounded-[2rem] group transition-all duration-300 ${isUser ? "bg-transparent hover:bg-black/[0.02] dark:hover:bg-white/[0.02]" : "bg-card/60 dark:bg-card/30 backdrop-blur-3xl border border-white/40 dark:border-white/10 shadow-xl"
                }`}
        >
            {/* 头像 */}
            <div className="shrink-0 mt-1">
                {isUser ? (
                    <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-md">
                        <User className="w-5 h-5 text-white" />
                    </div>
                ) : (
                    <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg icon-glow">
                        <Bot className="w-5 h-5 text-white" />
                    </div>
                )}
            </div>

            {/* 内容 */}
            <div className="flex-1 min-w-0 space-y-3">
                <div className="flex items-center gap-3">
                    <span className="text-[15px] font-bold text-foreground">
                        {isUser ? "You" : "Sinaclaw"}
                    </span>
                    <span className="text-[11px] font-semibold text-muted-foreground/50">
                        {new Date(message.timestamp).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                        })}
                    </span>
                </div>

                {isUser ? (
                    /* 用户消息：纯文本 */
                    <div className="prose prose-invert prose-sm max-w-none text-foreground leading-relaxed whitespace-pre-wrap break-words font-medium text-[15px]">
                        {message.content}
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
                {!isUser && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-2">
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                        >
                            {copied ? (
                                <>
                                    <Check className="w-3.5 h-3.5 text-green-400" />
                                    <span className="text-green-400">
                                        已复制
                                    </span>
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
