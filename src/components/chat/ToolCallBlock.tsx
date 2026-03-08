import { motion } from "framer-motion";
import { Terminal, FileText, FolderOpen, Wrench, CheckCircle, XCircle, Loader2, Globe, Camera, FileSearch } from "lucide-react";
import { useState } from "react";
import type { ToolCall } from "@/lib/agent";
import CodeOutput from "./CodeOutput";

interface ToolCallBlockProps {
    toolCall: ToolCall;
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
    run_command: <Terminal className="w-3.5 h-3.5" />,
    read_file: <FileText className="w-3.5 h-3.5" />,
    write_file: <FileText className="w-3.5 h-3.5" />,
    list_directory: <FolderOpen className="w-3.5 h-3.5" />,
    detect_environment: <Wrench className="w-3.5 h-3.5" />,
    install_dependency: <Wrench className="w-3.5 h-3.5" />,
    browser_open: <Globe className="w-3.5 h-3.5" />,
    browser_screenshot_url: <Camera className="w-3.5 h-3.5" />,
    browser_extract_text: <FileSearch className="w-3.5 h-3.5" />,
};

const TOOL_LABELS: Record<string, string> = {
    run_command: "执行命令",
    read_file: "读取文件",
    write_file: "写入文件",
    list_directory: "列出目录",
    detect_environment: "检测环境",
    install_dependency: "安装依赖",
    browser_open: "打开网页",
    browser_screenshot_url: "网页截图",
    browser_extract_text: "提取文本",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
    pending: <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />,
    running: <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />,
    done: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />,
    error: <XCircle className="w-3.5 h-3.5 text-red-400" />,
};

export default function ToolCallBlock({ toolCall }: ToolCallBlockProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const icon = TOOL_ICONS[toolCall.functionName] || <Wrench className="w-3.5 h-3.5" />;
    const label = TOOL_LABELS[toolCall.functionName] || toolCall.functionName;
    const statusIcon = STATUS_ICONS[toolCall.status];

    // 生成参数摘要
    const argSummary = getArgSummary(toolCall);

    return (
        <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="my-2 rounded-xl border border-border/50 dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.03] overflow-hidden"
        >
            {/* 头部：可点击折叠 */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors cursor-pointer"
            >
                {/* 工具图标 */}
                <span className="text-primary/80">{icon}</span>

                {/* 工具名称 */}
                <span className="text-xs font-semibold text-foreground/80">{label}</span>

                {/* 参数摘要 */}
                <span className="text-xs text-muted-foreground truncate flex-1 font-mono">
                    {argSummary}
                </span>

                {/* 状态图标 */}
                <span className="shrink-0">{statusIcon}</span>

                {/* 展开箭头 */}
                <motion.span
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    className="text-muted-foreground text-xs"
                >
                    ▾
                </motion.span>
            </button>

            {/* 展开内容：参数 + 执行结果 */}
            {isExpanded && (
                <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    className="border-t border-border/30 dark:border-white/5"
                >
                    {/* 参数 */}
                    <div className="px-3 py-2 bg-black/[0.03] dark:bg-black/20">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-1 font-bold">
                            参数
                        </div>
                        <pre className="text-xs text-foreground/70 font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                            {JSON.stringify(toolCall.arguments, null, 2)}
                        </pre>
                    </div>

                    {/* 执行结果 — 使用 CodeOutput 智能渲染 */}
                    {toolCall.result && (
                        <div className="px-3 py-2 bg-black/[0.04] dark:bg-black/30 border-t border-border/30 dark:border-white/5">
                            {isScreenshotResult(toolCall) ? (
                                <div className="flex items-center gap-2 text-xs text-emerald-400">
                                    <Camera className="w-3.5 h-3.5" />
                                    <span>{toolCall.result}</span>
                                </div>
                            ) : (
                                <CodeOutput content={toolCall.result} toolName={label} />
                            )}
                        </div>
                    )}

                    {/* 执行中 */}
                    {toolCall.status === "running" && !toolCall.result && (
                        <div className="px-3 py-3 flex items-center gap-2 text-amber-400 text-xs">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>正在执行...</span>
                        </div>
                    )}
                </motion.div>
            )}
        </motion.div>
    );
}

function isScreenshotResult(toolCall: ToolCall): boolean {
    if (toolCall.functionName !== "browser_screenshot_url" && toolCall.functionName !== "screenshot") return false;
    if (!toolCall.result) return false;
    return /\.(png|jpg|jpeg)/.test(toolCall.result);
}

function getArgSummary(toolCall: ToolCall): string {
    const args = toolCall.arguments;
    switch (toolCall.functionName) {
        case "run_command":
            return `$ ${args.command || ""}`;
        case "read_file":
        case "write_file":
            return String(args.path || "");
        case "list_directory":
            return String(args.path || ".");
        case "install_dependency":
            return `${args.package_manager} install ${(args.packages as string[])?.join(" ") || ""}`;
        case "detect_environment":
            return "扫描系统环境...";
        case "browser_open":
        case "browser_screenshot_url":
        case "browser_extract_text":
            return String(args.url || "");
        default:
            return JSON.stringify(args).slice(0, 50);
    }
}
