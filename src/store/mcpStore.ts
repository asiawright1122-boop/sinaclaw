import { create } from "zustand";
import { persist } from "zustand/middleware";
import { invoke } from "@tauri-apps/api/core";

export interface MCPTool {
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
}

export interface MCPServerConfig {
    id: string;
    name: string;
    url: string; // SSE URL or command for stdio
    type: "sse" | "stdio";
    status: "active" | "inactive" | "error";
    toolCount: number;
    tools?: MCPTool[];
}

// 常规 MCP 预设数据
export const MCP_PRESETS: Array<Omit<MCPServerConfig, "id" | "status" | "toolCount">> = [
    {
        name: "Notion",
        url: "http://localhost:3001", // 典型默认 SSE 地址
        type: "sse"
    },
    {
        name: "GitHub",
        url: "http://localhost:3002",
        type: "sse"
    },
    {
        name: "Slack",
        url: "http://localhost:3003",
        type: "sse"
    },
    {
        name: "PostgreSQL",
        url: "http://localhost:3004",
        type: "sse"
    },
    {
        name: "Google Maps",
        url: "http://localhost:3005",
        type: "sse"
    },
    {
        name: "Browser Fetch",
        url: "http://localhost:3006",
        type: "sse"
    },
    {
        name: "Local SQLite (Stdio)",
        url: "stdio://npx -y @modelcontextprotocol/server-sqlite --db test.db",
        type: "stdio"
    },
    {
        name: "OpenClaw Interpreter",
        url: "stdio://python3 skills/openclaw-interpreter/server.py",
        type: "stdio"
    },
    {
        name: "OpenClaw RAG Engine",
        url: "stdio://python3 skills/openclaw-rag-engine/server.py",
        type: "stdio"
    }
];

interface MCPState {
    servers: MCPServerConfig[];
    addServer: (server: Omit<MCPServerConfig, "id" | "status" | "toolCount">) => void;
    removeServer: (id: string) => void;
    toggleServer: (id: string) => Promise<void>;
    getActiveToolsAsSchema: () => any[];
}

export const useMCPStore = create<MCPState>()(
    persist(
        (set, get) => ({
            servers: [
                {
                    id: "notion-mcp",
                    name: "Notion",
                    url: "http://localhost:3001",
                    type: "sse",
                    status: "inactive",
                    toolCount: 0,
                },
            ],
            addServer: (server) => {
                const id = crypto.randomUUID();
                set((state) => ({
                    servers: [...state.servers, { ...server, id, status: "inactive", toolCount: 0 }],
                }));
            },
            removeServer: (id) => {
                set((state) => ({
                    servers: state.servers.filter((s) => s.id !== id),
                }));
            },
            toggleServer: async (id) => {
                const { servers } = get();
                const server = servers.find((s) => s.id === id);
                if (!server) return;

                const newStatus = server.status === "active" ? "inactive" : "active";

                if (newStatus === "active") {
                    try {
                        // Call Tauri backend to connect and fetch tools
                        const tools = await invoke<any[]>("mcp_connect", {
                            id: server.id,
                            name: server.name,
                            url: server.url,
                        });

                        set((state) => ({
                            servers: state.servers.map((s) =>
                                s.id === id ? { ...s, status: "active", toolCount: tools.length, tools } : s
                            ),
                        }));
                    } catch (error) {
                        console.error("MCP connection failed:", error);
                        set((state) => ({
                            servers: state.servers.map((s) =>
                                s.id === id ? { ...s, status: "error" } : s
                            ),
                        }));
                    }
                } else {
                    set((state) => ({
                        servers: state.servers.map((s) =>
                            s.id === id ? { ...s, status: "inactive" } : s
                        ),
                    }));
                }
            },
            getActiveToolsAsSchema: () => {
                const { servers } = get();
                const activeTools: any[] = [];

                servers.forEach((server) => {
                    if (server.status === "active" && server.tools) {
                        server.tools.forEach((tool) => {
                            activeTools.push({
                                type: "function",
                                function: {
                                    name: `mcp__${server.id}__${tool.name}`, // Namespaced
                                    description: `[MCP: ${server.name}] ${tool.description}`,
                                    parameters: tool.input_schema || { type: "object", properties: {} },
                                },
                            });
                        });
                    }
                });

                return activeTools;
            },
        }),
        {
            name: "sinaclaw-mcp-storage",
        }
    )
);
