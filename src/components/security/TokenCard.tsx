import { useState } from "react";
import { Key, Copy, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import type { GatewayToken } from "@/lib/security";
import { useTranslate } from "@/lib/i18n";

function formatTime(ts: number): string {
    if (!ts) return "—";
    const d = new Date(ts);
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" }) + " " +
        d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

interface TokenCardProps {
    token: GatewayToken;
    onRevoke: () => void;
}

export default function TokenCard({ token, onRevoke }: TokenCardProps) {
    const t = useTranslate();
    const [showToken, setShowToken] = useState(false);
    const [copied, setCopied] = useState(false);
    const expired = token.expiresAt ? token.expiresAt < Date.now() : false;

    const handleCopy = () => {
        navigator.clipboard.writeText(token.token);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-150 group ${
            expired ? "border-destructive/20 bg-destructive/5" : "border-border/50 dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.03]"
        }`}>
            <div className="flex items-center gap-3 min-w-0">
                <Key className={`w-4 h-4 shrink-0 ${expired ? "text-red-400" : "text-primary"}`} />
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground">{token.name}</span>
                        {expired && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-medium">{t.security.expired}</span>}
                        <div className="flex gap-1">
                            {token.permissions.map((p) => (
                                <span key={p} className="text-[9px] px-1 py-0.5 rounded bg-muted/30 text-muted-foreground">{p}</span>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <code className="text-[10px] text-muted-foreground font-mono">
                            {showToken ? token.token : token.token.slice(0, 8) + "••••••••"}
                        </code>
                        <button onClick={() => setShowToken(!showToken)} className="text-muted-foreground/50 hover:text-foreground">
                            {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                        <button onClick={handleCopy} className="text-muted-foreground/50 hover:text-foreground">
                            {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                    </div>
                    <div className="text-[10px] text-muted-foreground/50 mt-0.5">
                        {t.security.createdAt.replace('{time}', formatTime(token.createdAt))}
                        {token.lastUsed && ` · ${t.security.lastUsed.replace('{time}', formatTime(token.lastUsed))}`}
                    </div>
                </div>
            </div>
            <button
                onClick={onRevoke}
                className="px-2 py-1 rounded-lg text-[10px] font-medium text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
            >
                {t.security.revoke}
            </button>
        </div>
    );
}
