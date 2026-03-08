import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import type { GraphNode, GraphEdge } from "@/hooks/useGraphSimulation";
import { useTranslate } from "@/lib/i18n";

interface GraphOverlayProps {
    zoom: number;
    setZoom: React.Dispatch<React.SetStateAction<number>>;
    setOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
    hoveredNode: string | null;
    nodesRef: React.RefObject<GraphNode[]>;
    edges: GraphEdge[];
}

export default function GraphOverlay({ zoom, setZoom, setOffset, hoveredNode, nodesRef, edges }: GraphOverlayProps) {
    const t = useTranslate();

    return (
        <>
            {/* 缩放控制 */}
            <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-card/80 rounded-xl border border-border/50 dark:border-white/[0.06] p-1" style={{ boxShadow: 'var(--panel-shadow)' }}>
                <button onClick={() => setZoom(z => Math.min(z * 1.2, 3))} className="p-2 hover:bg-muted/50 rounded-lg transition-colors cursor-pointer">
                    <ZoomIn className="w-4 h-4 text-muted-foreground" />
                </button>
                <span className="text-xs text-muted-foreground font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.max(z / 1.2, 0.3))} className="p-2 hover:bg-muted/50 rounded-lg transition-colors cursor-pointer">
                    <ZoomOut className="w-4 h-4 text-muted-foreground" />
                </button>
                <button onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }} className="p-2 hover:bg-muted/50 rounded-lg transition-colors cursor-pointer" title={t.knowledge.graphReset}>
                    <Maximize2 className="w-4 h-4 text-muted-foreground" />
                </button>
            </div>
            {/* 图例 */}
            <div className="absolute top-4 left-4 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-sky-500" /> {t.knowledge.graphDocument}
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-violet-400" /> {t.knowledge.graphEntity}
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-6 h-px bg-slate-400" /> {t.knowledge.graphRelation}
                </span>
            </div>
            {/* 悬浮信息 */}
            {hoveredNode && (
                <div className="absolute top-4 right-4 bg-card/90 rounded-xl border border-border/50 dark:border-white/[0.06] px-4 py-3 max-w-[200px]" style={{ boxShadow: 'var(--panel-shadow)' }}>
                    <div className="text-sm font-bold text-foreground truncate">
                        {nodesRef.current?.find(n => n.id === hoveredNode)?.label}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                        {t.knowledge.graphConnections.replace('{count}', String(edges.filter(e => e.source === hoveredNode || e.target === hoveredNode).length))}
                    </div>
                </div>
            )}
        </>
    );
}
