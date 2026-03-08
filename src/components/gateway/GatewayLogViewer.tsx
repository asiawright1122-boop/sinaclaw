import { useEffect, useRef, useState } from "react";
import { Terminal, Trash2, ChevronDown, Copy, Check } from "lucide-react";
import type { GatewayLogEntry } from "@/store/gatewayStore";
import { useTranslate } from "@/lib/i18n";

interface GatewayLogViewerProps {
    logs: GatewayLogEntry[];
    onClear: () => void;
}

export default function GatewayLogViewer({ logs, onClear }: GatewayLogViewerProps) {
    const t = useTranslate();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs, autoScroll]);

    const handleScroll = () => {
        if (!scrollRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
    };

    const handleCopy = () => {
        const text = logs.map((l) => `[${l.stream}] ${l.line}`).join("\n");
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/40">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Terminal className="w-3.5 h-3.5" />
                    {t.gateway.logs}
                    <span className="bg-muted/50 px-1.5 py-0.5 rounded text-[10px]">{logs.length}</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleCopy}
                        className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                        title={t.gateway.copyLogs}
                    >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                        onClick={onClear}
                        className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                        title={t.gateway.clearLogs}
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => {
                            setAutoScroll(true);
                            if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                        }}
                        className={`p-1.5 rounded-lg hover:bg-muted/50 transition-colors ${autoScroll ? "text-emerald-500" : "text-muted-foreground hover:text-foreground"}`}
                        title={t.gateway.autoScroll}
                    >
                        <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-5 bg-black/[0.03] dark:bg-black/30 min-h-[200px] max-h-[400px]"
            >
                {logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40 gap-1.5">
                        <Terminal className="w-5 h-5" />
                        <span className="text-xs font-medium">{t.gateway.noLogs}</span>
                    </div>
                ) : (
                    logs.map((entry, i) => (
                        <div key={i} className="flex gap-2 hover:bg-muted/20 px-1 rounded">
                            <span className="text-muted-foreground/50 select-none shrink-0 w-[52px]">
                                {new Date(entry.timestamp).toLocaleTimeString("en-GB", { hour12: false })}
                            </span>
                            <span className={`shrink-0 w-[46px] ${entry.stream === "stderr" ? "text-red-400" : "text-blue-400"}`}>
                                {entry.stream === "stderr" ? "ERR" : "OUT"}
                            </span>
                            <span className="text-foreground/90 break-all">{entry.line}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
