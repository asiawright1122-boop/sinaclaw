/**
 * CodeOutput — 代码执行结果渲染组件
 * 
 * 能够智能检测 MCP 工具返回的内容类型并inline展示：
 * - base64 PNG 图表 → <img> 渲染
 * - Markdown 表格 → react-markdown 渲染  
 * - 错误信息 → 红色面板
 * - 普通文本 → 代码块
 */

import { useState } from "react";
import { ChevronDown, ChevronUp, Image, Table, AlertCircle, Terminal } from "lucide-react";

interface CodeOutputProps {
    content: string;
    toolName?: string;
}

export default function CodeOutput({ content, toolName }: CodeOutputProps) {
    const [expanded, setExpanded] = useState(true);

    // ── 检测内容类型 ──────────────────────────────────────

    const isBase64Image = content.startsWith("data:image/");
    const isError = content.startsWith("[ERROR]");
    const isMarkdownTable = content.includes("|") && content.includes("---");

    // ── 渲染 ─────────────────────────────────────────────

    // Base64 图片
    if (isBase64Image) {
        return (
            <div className="my-3 rounded-xl overflow-hidden border border-border/50 dark:border-white/[0.06] bg-black/[0.03] dark:bg-white/[0.03]">
                <div className="flex items-center justify-between px-4 py-2 bg-black/[0.02] dark:bg-white/[0.02] border-b border-border/30">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                        <Image className="w-3.5 h-3.5 text-blue-400" />
                        <span>{toolName || "图表输出"}</span>
                    </div>
                </div>
                <div className="p-3 flex justify-center bg-white dark:bg-black/20 rounded-b-2xl">
                    <img
                        src={content}
                        alt="Generated chart"
                        className="max-w-full max-h-[500px] object-contain rounded-lg"
                    />
                </div>
            </div>
        );
    }

    // 错误信息
    if (isError) {
        return (
            <div className="my-3 rounded-xl overflow-hidden border border-red-500/20 bg-red-500/5">
                <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border-b border-red-500/10">
                    <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-xs font-medium text-red-400">{toolName || "执行错误"}</span>
                </div>
                <pre className="p-4 text-xs text-red-300 font-mono whitespace-pre-wrap overflow-x-auto">
                    {content}
                </pre>
            </div>
        );
    }

    // Markdown 表格或普通输出
    const Icon = isMarkdownTable ? Table : Terminal;
    const label = isMarkdownTable ? "数据表格" : (toolName || "执行结果");

    return (
        <div className="my-3 rounded-xl overflow-hidden border border-border/50 dark:border-white/[0.06] bg-black/[0.03] dark:bg-white/[0.03]">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between px-4 py-2 bg-black/[0.02] dark:bg-white/[0.02] border-b border-border/30 hover:bg-muted/30 transition-colors"
            >
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                    <Icon className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{label}</span>
                </div>
                {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
            {expanded && (
                <pre className="p-4 text-xs text-foreground/80 font-mono whitespace-pre-wrap overflow-x-auto max-h-[400px] overflow-y-auto">
                    {content}
                </pre>
            )}
        </div>
    );
}
