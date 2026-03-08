import { useRef, useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useTranslate } from "@/lib/i18n";
import { useGraphSimulation, GRAPH_COLORS, type GraphNode } from "@/hooks/useGraphSimulation";
import GraphOverlay from "./GraphOverlay";

export default function GraphView() {
    const t = useTranslate();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    const { nodes, edges, isLoading, nodesRef } = useGraphSimulation();

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
            ctx.strokeStyle = isHovered ? GRAPH_COLORS.edgeHover : GRAPH_COLORS.edge;
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
            ctx.fillStyle = GRAPH_COLORS.text;
            ctx.font = `${isHov ? "bold " : ""}${n.type === "document" ? 11 : 10}px system-ui`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(n.label, n.x, n.y + n.radius + 14);
        }

        ctx.restore();
    }, [edges, hoveredNode, zoom, offset]);

    // 渲染循环
    useEffect(() => {
        if (nodes.length === 0) return;
        let raf = 0;
        const loop = () => {
            draw(nodesRef.current);
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [nodes.length, draw]);

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
            <GraphOverlay
                zoom={zoom}
                setZoom={setZoom}
                setOffset={setOffset}
                hoveredNode={hoveredNode}
                nodesRef={nodesRef}
                edges={edges}
            />
        </div>
    );
}
