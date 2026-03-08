import { useRef, useEffect, useState, useCallback } from "react";
import { getDocuments, type DocumentRow } from "@/lib/db";
import { useTranslate } from "@/lib/i18n";

export interface GraphNode {
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

export interface GraphEdge {
    source: string;
    target: string;
    label: string;
}

export const GRAPH_COLORS = {
    document: "#0ea5e9",
    entity: "#a78bfa",
    edge: "rgba(148, 163, 184, 0.15)",
    edgeHover: "rgba(139, 92, 246, 0.5)",
    text: "#e2e8f0",
    bg: "#0f172a",
};

export function useGraphSimulation() {
    const t = useTranslate();
    const [nodes, setNodes] = useState<GraphNode[]>([]);
    const [edges, setEdges] = useState<GraphEdge[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const nodesRef = useRef<GraphNode[]>([]);
    const animFrameRef = useRef<number>(0);

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
                    label: doc.name.length > 20 ? doc.name.slice(0, 18) + "\u2026" : doc.name,
                    x: 400 + Math.cos(angle) * radius + (Math.random() - 0.5) * 50,
                    y: 300 + Math.sin(angle) * radius + (Math.random() - 0.5) * 50,
                    vx: 0,
                    vy: 0,
                    radius: 28,
                    color: GRAPH_COLORS.document,
                    type: "document",
                });

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
                        color: GRAPH_COLORS.entity,
                        type: "entity",
                    });
                }
                graphEdges.push({
                    source: `doc_${doc.id}`,
                    target: `type_${ext}`,
                    label: "type",
                });
            });

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
            console.error("\u56fe\u8c31\u6784\u5efa\u5931\u8d25:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        buildGraph();
    }, [buildGraph]);

    // Force simulation
    useEffect(() => {
        if (nodes.length === 0) return;
        nodesRef.current = [...nodes];

        const simulate = () => {
            const ns = nodesRef.current;
            const centerX = 400, centerY = 300;

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

            for (const n of ns) {
                n.vx += (centerX - n.x) * 0.001;
                n.vy += (centerY - n.y) * 0.001;
            }

            for (const n of ns) {
                n.vx *= 0.85;
                n.vy *= 0.85;
                n.x += n.vx;
                n.y += n.vy;
            }

            animFrameRef.current = requestAnimationFrame(simulate);
        };

        animFrameRef.current = requestAnimationFrame(simulate);
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [nodes.length, edges]);

    return { nodes, edges, isLoading, nodesRef };
}
