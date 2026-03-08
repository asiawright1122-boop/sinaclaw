import { create } from "zustand";
import { persist } from "zustand/middleware";
import { OPENCLAW_SYSTEM_PROMPT } from "@/lib/prompts";

export interface AgentConfig {
    id: string;
    name: string;
    description: string;
    avatar: string; // Emoji or URL
    systemPrompt: string;
    model: string; // e.g., 'gpt-4o', 'claude-3-5-sonnet'
    enabledTools: string[]; // List of tool names enabled for this agent
    role: "primary" | "sub"; // 主 Agent 或子 Agent
    parentAgentId?: string; // 子 Agent 关联的父 Agent ID
    createdAt: number;
}

interface AgentState {
    agents: AgentConfig[];
    activeAgentId: string;
    addAgent: (agent: Omit<AgentConfig, "id" | "createdAt">) => void;
    updateAgent: (id: string, updates: Partial<Omit<AgentConfig, "id" | "createdAt">>) => void;
    removeAgent: (id: string) => void;
    setActiveAgent: (id: string) => void;
    spawnSubAgent: (parentId: string, config: Omit<AgentConfig, "id" | "createdAt" | "role" | "parentAgentId">) => string;
    getSubAgents: (parentId: string) => AgentConfig[];
}

const DEFAULT_AGENT: AgentConfig = {
    id: "default-sinaclaw",
    name: "Sinaclaw Core",
    description: "The default powerful assistant with full system capabilities.",
    avatar: "bot",
    systemPrompt: OPENCLAW_SYSTEM_PROMPT,
    model: "claude-3-5-sonnet-20241022",
    enabledTools: ["*"],
    role: "primary",
    createdAt: Date.now(),
};

// Preset Agents
const PROGRAMMER_AGENT: AgentConfig = {
    id: "preset-programmer",
    name: "Senior Developer",
    description: "Expert software engineer focusing on clean, robust code.",
    avatar: "code",
    systemPrompt: "You are an expert Senior Software Developer. Focus on writing clean, efficient, and well-documented code. Always consider performance, security, and edge cases. When modifying code, explain your reasoning clearly.",
    model: "claude-3-5-sonnet-20241022",
    enabledTools: ["*"],
    role: "primary",
    createdAt: Date.now(),
};

const WRITER_AGENT: AgentConfig = {
    id: "preset-writer",
    name: "Content Writer",
    description: "Creative writer for crafting engaging copy and articles.",
    avatar: "pen-tool",
    systemPrompt: "You are a professional Content Writer. Craft engaging, clear, and persuasive copy tailored to the specified audience. Focus on tone, structure, and clarity.",
    model: "claude-3-5-sonnet-20241022",
    enabledTools: ["search_web", "fetch_url", "core_memory_append", "core_memory_search"],
    role: "primary",
    createdAt: Date.now(),
};

export const useAgentStore = create<AgentState>()(
    persist(
        (set, get) => ({
            agents: [DEFAULT_AGENT, PROGRAMMER_AGENT, WRITER_AGENT],
            activeAgentId: DEFAULT_AGENT.id,

            addAgent: (agent) => {
                const id = crypto.randomUUID();
                set((state) => ({
                    agents: [...state.agents, { ...agent, id, createdAt: Date.now() }],
                }));
            },
            updateAgent: (id, updates) => {
                set((state) => ({
                    agents: state.agents.map((a) => (a.id === id ? { ...a, ...updates } : a)),
                }));
            },
            removeAgent: (id) => {
                set((state) => ({
                    agents: state.agents.filter((a) => a.id !== id),
                    activeAgentId: state.activeAgentId === id ? DEFAULT_AGENT.id : state.activeAgentId
                }));
            },
            setActiveAgent: (id) => {
                set({ activeAgentId: id });
            },

            // ── Multi-Agent: 子 Agent 管理 ──────────────
            spawnSubAgent: (parentId, config) => {
                const id = `sub-${crypto.randomUUID().slice(0, 8)}`;
                const subAgent: AgentConfig = {
                    ...config,
                    id,
                    role: "sub",
                    parentAgentId: parentId,
                    createdAt: Date.now(),
                };
                set((state) => ({
                    agents: [...state.agents, subAgent],
                }));
                return id;
            },
            getSubAgents: (parentId): AgentConfig[] => {
                return get().agents.filter(
                    (a: AgentConfig) => a.role === "sub" && a.parentAgentId === parentId
                );
            },
        }),
        {
            name: "sinaclaw-agent-storage",
        }
    )
);
