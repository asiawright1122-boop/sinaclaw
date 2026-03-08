import { useState } from "react";
import { motion } from "framer-motion";
import {
    PanelLeft,
    Maximize2,
    Minimize2,
    RefreshCw,
    ExternalLink,
    Code,
    Eye,
    Loader2,
} from "lucide-react";
import { useGatewayStore } from "@/store/gatewayStore";
import { useTranslate } from "@/lib/i18n";

const GATEWAY_PORT = 18789;
const CANVAS_URL = `http://127.0.0.1:${GATEWAY_PORT}/__openclaw__/canvas/`;

type Tab = "canvas" | "artifact";

export default function CanvasPage() {
    const t = useTranslate();
    const { status } = useGatewayStore();
    const [tab, setTab] = useState<Tab>("canvas");
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [iframeKey, setIframeKey] = useState(0);
    const [artifactCode, setArtifactCode] = useState(`${t.canvas.defaultCode}\n<h1>Hello from Sinaclaw</h1>`);
    const [artifactView, setArtifactView] = useState<"code" | "preview">("preview");

    const gwRunning = status?.running ?? false;

    const reload = () => setIframeKey((k) => k + 1);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col overflow-hidden"
        >
            {/* 工具栏 */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 shrink-0">
                <div className="flex items-center gap-1">
                    {([
                        { id: "canvas" as Tab, label: "Canvas", icon: PanelLeft },
                        { id: "artifact" as Tab, label: "Artifacts", icon: Code },
                    ]).map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                tab === t.id
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                            }`}
                        >
                            <t.icon className="w-3.5 h-3.5" />
                            {t.label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-1">
                    {tab === "canvas" && (
                        <>
                            <button onClick={reload} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title={t.canvas.refresh}>
                                <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                            <a href={CANVAS_URL} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title={t.canvas.openInBrowser}>
                                <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                        </>
                    )}
                    {tab === "artifact" && (
                        <div className="flex items-center gap-0.5 bg-black/[0.04] dark:bg-white/[0.04] border border-border/40 rounded-lg p-0.5">
                            <button
                                onClick={() => setArtifactView("code")}
                                className={`p-1.5 rounded-md transition-colors ${artifactView === "code" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                <Code className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => setArtifactView("preview")}
                                className={`p-1.5 rounded-md transition-colors ${artifactView === "preview" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                <Eye className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                    <button
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                        title={isFullscreen ? t.canvas.exitFullscreen : t.canvas.fullscreen}
                    >
                        {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </button>
                </div>
            </div>

            {/* 内容区 */}
            <div className="flex-1 relative overflow-hidden">
                {tab === "canvas" && (
                    gwRunning ? (
                        <iframe
                            key={iframeKey}
                            src={CANVAS_URL}
                            className="w-full h-full border-0 bg-white"
                            title="OpenClaw Canvas"
                            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50">
                            <Loader2 className="w-8 h-8 mb-3 animate-spin" />
                            <p className="text-sm font-medium">{t.canvas.gwNotRunning}</p>
                            <p className="text-xs mt-1">{t.canvas.canvasNeedsGw}</p>
                        </div>
                    )
                )}

                {tab === "artifact" && (
                    <div className="flex h-full">
                        {artifactView === "code" ? (
                            <textarea
                                value={artifactCode}
                                onChange={(e) => setArtifactCode(e.target.value)}
                                className="flex-1 bg-transparent resize-none p-4 font-mono text-sm text-foreground focus:outline-none"
                                spellCheck={false}
                            />
                        ) : (
                            <iframe
                                srcDoc={artifactCode}
                                className="flex-1 border-0 bg-white"
                                title="Artifact Preview"
                                sandbox="allow-scripts"
                            />
                        )}
                    </div>
                )}
            </div>
        </motion.div>
    );
}
