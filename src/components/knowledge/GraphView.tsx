import { useRef, useEffect, useState, useCallback } from "react";
import { Loader2, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { getDocuments, type DocumentRow } from "@/lib/db";
import { useTranslate } from "@/lib/i18n";

interface GraphNode {
    id: string;
    label: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    color: string;
    type: "document" | "entity";
}

interface GraphEdge {
    source: string;
    target: string;
    label: string;
}

const COLORS = {
    document: "#0ea5e9",  // sky-500
    entity: "#a78bfa",    // violet-400
    edge: "rgba(148, 163, 184, 0.15)",
    edgeHover: "rgba(139, 92, 246, 0.5)",
    text: "#e2e8f0",
    bg: "#0f172a",
};

export default function GraphView() {
    const t = useTranslate();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [nodes, setNodes] = useState<GraphNode[]>([]);
    const [edges, setEdges] = useState<GraphEdge[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const animFrameRef = useRef<number>(0);
    const nodesRef = useRef<GraphNode[]>([]);

    // 加载文档并构建图谱
    const buildGraph = useCallback(async () => {
        setIsLoading(true);
        try {
            const docs = await getDocuments();
            const graphNodes: GraphNode[] = [];
            const graphEdges: GraphEdge[] = [];
            const entitySet = new Set<string>();

            docs.forEach((doc: DocumentRow, i: number) => {
                const angle = (2 * Math.PI * i) / Math.max(docs.length, 1);
                const radius = 200;
                graphNodes.push({
                    id: `doc_${doc.id}`,
                    label: doc.name.length > 20 ? doc.name.slice(0, 18) + "…" : doc.name,
                    x: 400 + Math.cos(angle) * radius + (Math.random() - 0.5) * 50,
                    y: 300 + Math.sin(angle) * radius + (Math.random() - 0.5) * 50,
                    vx: 0,
                    vy: 0,
                    radius: 28,
                    color: COLORS.document,
                    type: "document",
                });

                // 从文件名和类型提取实体
                const ext = doc.name.split(".").pop()?.toUpperCase() || "FILE";
                if (!entitySet.has(ext)) {
                    entitySet.add(ext);
                    graphNodes.push({
                        id: `type_${ext}`,
                        label: ext,
                        x: 400 + Math.cos(angle + 0.3) * (radius + 120) + (Math.random() - 0.5) * 80,
                        y: 300 + Math.sin(angle + 0.3) * (radius + 120) + (Math.random() - 0.5) * 80,
                        vx: 0,
                        vy: 0,
                        radius: 18,
                        color: COLORS.entity,
                        type: "entity",
                    });
                }
                graphEdges.push({
                    source: `doc_${doc.id}`,
                    target: `type_${ext}`,
                    label: "type",
                });
            });

            // 文档之间根据上传时间距产生关联
            for (let i = 0; i < docs.length; i++) {
                for (let j = i + 1; j < docs.length; j++) {
                    const timeDiff = Math.abs(
                        new Date(docs[i].created_at).getTime() - new Date(docs[j].created_at).getTime()
                    );
                    if (timeDiff < 24 * 60 * 60 * 1000) {
                        graphEdges.push({
                            source: `doc_${docs[i].id}`,
                            target: `doc_${docs[j].id}`,
                            label: t.knowledge.graphUploaded,
                        });
                    }
                }
            }

            setNodes(graphNodes);
            setEdges(graphEdges);
            nodesRef.current = graphNodes;
        } catch (err) {
            console.error("图谱构建失败:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        buildGraph();
    }, [buildGraph]);

    // 力导向仿真
    useEffect(() => {
        if (nodes.length === 0) return;
        nodesRef.current = [...nodes];

        const simulate = () => {
            const ns = nodesRef.current;
            const centerX = 400, centerY = 300;

            // 斥力（节点之间）
            for (let i = 0; i < ns.length; i++) {
                for (let j = i + 1; j < ns.length; j++) {
                    const dx = ns[j].x - ns[i].x;
                    const dy = ns[j].y - ns[i].y;
                    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
                    const force = 3000 / (dist * dist);
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;
                    ns[i].vx -= fx;
                    ns[i].vy -= fy;
                    ns[j].vx += fx;
                    ns[j].vy += fy;
                }
            }

            // 引力（连接的节点）
            for (const edge of edges) {
                const s = ns.find(n => n.id === edge.source);
                const t = ns.find(n => n.id === edge.target);
                if (!s || !t) continue;
                const dx = t.x - s.x;
                const dy = t.y - s.y;
                const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
                const force = (dist - 120) * 0.01;
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                s.vx += fx;
                s.vy += fy;
                t.vx -= fx;
                t.vy -= fy;
            }

            // 向心力
            for (const n of ns) {
                n.vx += (centerX - n.x) * 0.001;
                n.vy += (centerY - n.y) * 0.001;
            }

            // 应用速度 + 阻尼
            for (const n of ns) {
                n.vx *= 0.85;
                n.vy *= 0.85;
                n.x += n.vx;
                n.y += n.vy;
            }

            draw(ns);
            animFrameRef.current = requestAnimationFrame(simulate);
        };

        animFrameRef.current = requestAnimationFrame(simulate);
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [nodes.length, edges]);

    // Canvas 绘制
    const draw = useCallback((ns: GraphNode[]) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        ctx.save();
        ctx.translate(offset.x, offset.y);
        ctx.scale(zoom, zoom);

        // 绘制边
        for (const edge of edges) {
            const s = ns.find(n => n.id === edge.source);
            const t = ns.find(n => n.id === edge.target);
            if (!s || !t) continue;

            const isHovered = hoveredNode === s.id || hoveredNode === t.id;
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(t.x, t.y);
            ctx.strokeStyle = isHovered ? COLORS.edgeHover : COLORS.edge;
            ctx.lineWidth = isHovered ? 2 : 1;
            ctx.stroke();
        }

        // 绘制节点
        for (const n of ns) {
            const isHov = hoveredNode === n.id;

            // 辉光效果
            if (isHov) {
                ctx.beginPath();
                ctx.arc(n.x, n.y, n.radius + 8, 0, Math.PI * 2);
                ctx.fillStyle = n.color.replace(")", ", 0.15)").replace("rgb", "rgba");
                ctx.fill();
            }

            // 节点圆
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
            const gradient = ctx.createRadialGradient(n.x - 4, n.y - 4, 0, n.x, n.y, n.radius);
            gradient.addColorStop(0, n.color);
            gradient.addColorStop(1, n.color.replace(")", ", 0.7)").replace("rgb", "rgba"));
            ctx.fillStyle = gradient;
            ctx.fill();

            ctx.strokeStyle = isHov ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.1)";
            ctx.lineWidth = isHov ? 2 : 1;
            ctx.stroke();

            // 标签
            ctx.fillStyle = COLORS.text;
            ctx.font = `${isHov ? "bold " : ""}${n.type === "document" ? 11 : 10}px system-ui`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(n.label, n.x, n.y + n.radius + 14);
        }

        ctx.restore();
    }, [edges, hoveredNode, zoom, offset]);

    // 鼠标交互
    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left - offset.x) / zoom;
        const my = (e.clientY - rect.top - offset.y) / zoom;

        const ns = nodesRef.current;
        let found: string | null = null;
        for (const n of ns) {
            const dx = mx - n.x;
            const dy = my - n.y;
            if (dx * dx + dy * dy < n.radius * n.radius) {
                found = n.id;
                break;
            }
        }
        setHoveredNode(found);
        if (canvas) canvas.style.cursor = found ? "pointer" : "default";
    }, [zoom, offset]);

    // 画布尺寸同步
    useEffect(() => {
        const resize = () => {
            const canvas = canvasRef.current;
            const container = containerRef.current;
            if (canvas && container) {
                canvas.width = container.clientWidth;
                canvas.height = container.clientHeight;
            }
        };
        resize();
        window.addEventListener("resize", resize);
        return () => window.removeEventListener("resize", resize);
    }, []);

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mb-3" />
                <span className="text-sm font-medium">{t.knowledge.graphBuilding}</span>
            </div>
        );
    }

    if (nodes.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <span className="text-sm">{t.knowledge.graphEmpty}</span>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="flex-1 relative bg-[#0a0f1e] rounded-2xl overflow-hidden border border-white/5">
            <canvas
                ref={canvasRef}
                className="w-full h-full"
                onMouseMove={handleMouseMove}
            />
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
                        {nodesRef.current.find(n => n.id === hoveredNode)?.label}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                        {t.knowledge.graphConnections.replace('{count}', String(edges.filter(e => e.source === hoveredNode || e.target === hoveredNode).length))}
                    </div>
                </div>
            )}
        </div>
    );
}
