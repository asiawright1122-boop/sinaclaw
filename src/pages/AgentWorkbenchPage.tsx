import { useState, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Bot,
    Plus,
    Trash2,
    Copy,
    Star,
    Zap,
    X,
    Save,
    Users,
    ArrowRightLeft,
    GitBranch,
    Timer,
} from "lucide-react";
import { useAgentStore, type AgentConfig } from "@/store/agentStore";
import AgentAvatar from "@/components/ui/AgentAvatar";

const AutomationPage = lazy(() => import("@/pages/AutomationPage"));

// ── Agent 模板 ──
const AGENT_TEMPLATES: Omit<AgentConfig, "id" | "createdAt">[] = [
    {
        name: "客服助手",
        description: "专业客户服务，回答问题并解决投诉",
        avatar: "headphones",
        systemPrompt: "你是一名专业的客服人员。用友好、耐心的语气回答用户问题，尝试解决他们的问题。遇到无法解决的问题时，告知用户将转交给人工处理。",
        model: "gpt-4o",
        enabledTools: ["search_web", "core_memory_search"],
        role: "primary",
    },
    {
        name: "翻译专家",
        description: "多语言翻译，支持中英日韩等主流语言",
        avatar: "globe",
        systemPrompt: "你是一名资深翻译专家，精通中文、英文、日语、韩语等多种语言。翻译时注重准确性、流畅性和文化适应性。保持原文语义的同时，让译文读起来自然流畅。",
        model: "gpt-4o",
        enabledTools: [],
        role: "primary",
    },
    {
        name: "数据分析师",
        description: "擅长数据分析、图表解读和报告撰写",
        avatar: "bar-chart",
        systemPrompt: "你是一名资深数据分析师。擅长从数据中发现洞察，解读图表和统计结果，撰写清晰的分析报告。使用数据驱动的方式回答问题。",
        model: "claude-3-5-sonnet-20241022",
        enabledTools: ["*"],
        role: "primary",
    },
    {
        name: "摘要生成器",
        description: "提炼长文本的核心要点，生成简洁摘要",
        avatar: "file-text",
        systemPrompt: "你是一个高效的文本摘要助手。你的任务是：1) 提取文本的核心论点和关键信息 2) 按重要性排序 3) 用简洁清晰的语言生成结构化摘要。保持客观，不添加主观评价。",
        model: "gpt-4o-mini",
        enabledTools: [],
        role: "primary",
    },
    {
        name: "代码审查员",
        description: "审查代码质量、安全性和性能问题",
        avatar: "search",
        systemPrompt: "你是一名严格的高级代码审查员。审查代码时关注：1) 安全漏洞 2) 性能问题 3) 代码风格和可维护性 4) 边界条件和错误处理。给出具体的改进建议和示例代码。",
        model: "claude-3-5-sonnet-20241022",
        enabledTools: ["*"],
        role: "primary",
    },
    {
        name: "创意策划",
        description: "头脑风暴、创意生成和营销策划",
        avatar: "lightbulb",
        systemPrompt: "你是一名富有创造力的策划专家。擅长头脑风暴、创意发散和营销策划。在回答中提供多个方案和角度，用生动的语言描述创意。",
        model: "gpt-4o",
        enabledTools: ["search_web"],
        role: "primary",
    },
];

// ── Agent 卡片 ──
function AgentCard({
    agent,
    isActive,
    onClick,
    onActivate,
}: {
    agent: AgentConfig;
    isActive: boolean;
    onClick: () => void;
    onActivate: () => void;
}) {
    return (
        <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className={`relative bg-card/80 dark:bg-card/50 border rounded-xl p-4 cursor-pointer transition-all duration-150 group ${
                isActive
                    ? "border-primary/30 ring-1 ring-primary/15"
                    : "border-border/50 dark:border-white/[0.06] hover:border-primary/20"
            }`}
            style={{ boxShadow: 'var(--panel-shadow)' }}
            onClick={onClick}
        >
            {isActive && (
                <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-primary border-2 border-card" />
            )}
            <div className="flex items-start gap-3">
                <AgentAvatar avatar={agent.avatar} size={24} className="text-foreground/70" />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground truncate">{agent.name}</span>
                        {agent.role === "sub" && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-medium">子Agent</span>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{agent.description}</p>
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                        <span className="px-1.5 py-0.5 rounded bg-muted/30 font-mono">{agent.model.split("-").slice(0, 2).join("-")}</span>
                        <span>{agent.enabledTools.length === 1 && agent.enabledTools[0] === "*" ? "全部工具" : `${agent.enabledTools.length} 个工具`}</span>
                    </div>
                </div>
            </div>
            <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={(e) => { e.stopPropagation(); onActivate(); }}
                    className="px-2 py-1 rounded-lg text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                    激活
                </button>
            </div>
        </motion.div>
    );
}

// ── Agent 编辑面板 ──
function AgentEditPanel({
    agent,
    onClose,
}: {
    agent: AgentConfig;
    onClose: () => void;
}) {
    const { updateAgent, removeAgent, setActiveAgent } = useAgentStore();
    const [form, setForm] = useState({
        name: agent.name,
        description: agent.description,
        avatar: agent.avatar,
        systemPrompt: agent.systemPrompt,
        model: agent.model,
    });

    const handleSave = () => {
        updateAgent(agent.id, form);
    };

    const handleDelete = () => {
        removeAgent(agent.id);
        onClose();
    };

    const isPreset = agent.id.startsWith("default-") || agent.id.startsWith("preset-");

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl overflow-hidden"
            style={{ boxShadow: 'var(--panel-shadow)' }}
        >
            <div className="flex items-center justify-between p-4 border-b border-border/40">
                <div className="flex items-center gap-3">
                    <AgentAvatar avatar={agent.avatar} size={24} className="text-foreground/70" />
                    <div>
                        <h3 className="font-semibold text-foreground">{agent.name}</h3>
                        <p className="text-xs text-muted-foreground">{agent.role === "sub" ? "子 Agent" : "主 Agent"}</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">名称</label>
                        <input
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">头像图标</label>
                        <input
                            value={form.avatar}
                            onChange={(e) => setForm({ ...form, avatar: e.target.value })}
                            placeholder="bot, code, pen-tool, wrench..."
                            className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">描述</label>
                    <input
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">模型</label>
                    <select
                        value={form.model}
                        onChange={(e) => setForm({ ...form, model: e.target.value })}
                        className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                    >
                        <option value="gpt-4o">GPT-4o</option>
                        <option value="gpt-4o-mini">GPT-4o Mini</option>
                        <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                        <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                        <option value="deepseek-chat">DeepSeek Chat</option>
                        <option value="deepseek-reasoner">DeepSeek Reasoner</option>
                    </select>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">系统提示词</label>
                    <textarea
                        value={form.systemPrompt}
                        onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                        rows={6}
                        className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all font-mono text-xs leading-relaxed"
                    />
                </div>

                <div className="flex items-center gap-2 pt-2">
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                        <Save className="w-3.5 h-3.5" />
                        保存
                    </button>
                    <button
                        onClick={() => setActiveAgent(agent.id)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-accent/10 text-accent border border-accent/20 hover:bg-accent/15 transition-colors"
                    >
                        <Zap className="w-3.5 h-3.5" />
                        设为活跃
                    </button>
                    {!isPreset && (
                        <button
                            onClick={handleDelete}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/15 transition-colors ml-auto"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            删除
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

// ── Swarm 编排面板 ──
function SwarmPanel({ agents }: { agents: AgentConfig[] }) {
    const primaryAgents = agents.filter((a) => a.role === "primary");
    const { spawnSubAgent } = useAgentStore();

    return (
        <div className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-5 space-y-4" style={{ boxShadow: 'var(--panel-shadow)' }}>
            <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm text-foreground">Swarm 编排</h3>
            </div>
            <p className="text-xs text-muted-foreground">
                配置 Agent 之间的任务委托关系。主 Agent 可以将子任务分配给子 Agent。
            </p>

            <div className="space-y-3">
                {primaryAgents.map((agent) => {
                    const subs = agents.filter((a) => a.role === "sub" && a.parentAgentId === agent.id);
                    return (
                        <div key={agent.id} className="bg-muted/20 rounded-xl p-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <AgentAvatar avatar={agent.avatar} size={18} className="text-foreground/70" />
                                    <span className="text-xs font-medium text-foreground">{agent.name}</span>
                                </div>
                                <button
                                    onClick={() =>
                                        spawnSubAgent(agent.id, {
                                            name: `${agent.name} 的子Agent`,
                                            description: "自动创建的子Agent",
                                            avatar: "wrench",
                                            systemPrompt: "你是一个辅助子Agent。",
                                            model: agent.model,
                                            enabledTools: [],
                                        })
                                    }
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors"
                                >
                                    <Plus className="w-3 h-3" />
                                    添加子Agent
                                </button>
                            </div>
                            {subs.length > 0 && (
                                <div className="mt-2 ml-6 space-y-1.5 border-l-2 border-primary/20 pl-3">
                                    {subs.map((sub) => (
                                        <div key={sub.id} className="flex items-center gap-2 text-[11px]">
                                            <ArrowRightLeft className="w-3 h-3 text-muted-foreground" />
                                            <AgentAvatar avatar={sub.avatar} size={12} className="text-muted-foreground" />
                                            <span className="text-foreground">{sub.name}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── 主页面 ──
export default function AgentWorkbenchPage() {
    const [topTab, setTopTab] = useState<"agents" | "automation">("agents");

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* 顶部 Tab */}
            <div className="px-6 pt-6 pb-0">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-lg bg-primary/[0.06] border border-border/50 flex items-center justify-center">
                        <Bot className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-foreground">Agent</h1>
                        <p className="text-[12px] text-muted-foreground">管理 Agent 和自动化任务</p>
                    </div>
                </div>
                <div className="flex gap-0.5 bg-black/[0.04] dark:bg-white/[0.04] border border-border/40 rounded-lg p-0.5 w-fit mb-4">
                    <button
                        onClick={() => setTopTab("agents")}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                            topTab === "agents"
                                ? "bg-card dark:bg-white/[0.08] shadow-sm text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <Bot className="w-3.5 h-3.5" />
                        Agent 管理
                    </button>
                    <button
                        onClick={() => setTopTab("automation")}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                            topTab === "automation"
                                ? "bg-card dark:bg-white/[0.08] shadow-sm text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <Timer className="w-3.5 h-3.5" />
                        自动化
                    </button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto">
                {topTab === "agents" ? (
                    <AgentWorkbenchContent />
                ) : (
                    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}>
                        <AutomationPage />
                    </Suspense>
                )}
            </div>
        </div>
    );
}

function AgentWorkbenchContent() {
    const { agents, activeAgentId, addAgent, setActiveAgent } = useAgentStore();
    const [selectedAgent, setSelectedAgent] = useState<AgentConfig | null>(null);
    const [view, setView] = useState<"agents" | "templates" | "swarm">("agents");

    const handleAddFromTemplate = (template: typeof AGENT_TEMPLATES[0]) => {
        addAgent(template);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 space-y-6"
        >
            {/* 操作栏 */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">共 {agents.length} 个 Agent</p>
                <button
                    onClick={() => addAgent({
                        name: "新 Agent",
                        description: "自定义 Agent",
                        avatar: "bot",
                        systemPrompt: "你是一个有用的 AI 助手。",
                        model: "gpt-4o",
                        enabledTools: [],
                        role: "primary",
                    })}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                    <Plus className="w-3.5 h-3.5" />
                    创建 Agent
                </button>
            </div>

            {/* 视图切换 */}
            <div className="flex items-center gap-0.5 bg-black/[0.04] dark:bg-white/[0.04] border border-border/40 rounded-lg p-0.5 w-fit">
                {([
                    { id: "agents" as const, label: "我的 Agent", icon: Users },
                    { id: "templates" as const, label: "模板市场", icon: Star },
                    { id: "swarm" as const, label: "Swarm 编排", icon: GitBranch },
                ]).map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setView(t.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                            view === t.id
                                ? "bg-card dark:bg-white/[0.08] text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <t.icon className="w-3.5 h-3.5" />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* 内容区 */}
            {view === "agents" && (
                <div className="flex flex-col lg:flex-row gap-6">
                    <div className={`${selectedAgent ? "lg:w-1/2" : "w-full"} transition-all`}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {agents.map((agent) => (
                                <AgentCard
                                    key={agent.id}
                                    agent={agent}
                                    isActive={agent.id === activeAgentId}
                                    onClick={() => setSelectedAgent(agent)}
                                    onActivate={() => setActiveAgent(agent.id)}
                                />
                            ))}
                        </div>
                    </div>
                    <AnimatePresence mode="wait">
                        {selectedAgent && (
                            <div className="w-full lg:w-1/2 lg:sticky lg:top-0">
                                <AgentEditPanel
                                    key={selectedAgent.id}
                                    agent={selectedAgent}
                                    onClose={() => setSelectedAgent(null)}
                                />
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {view === "templates" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {AGENT_TEMPLATES.map((tpl, idx) => (
                        <motion.div
                            key={idx}
                            whileHover={{ scale: 1.01 }}
                            className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-4 group" style={{ boxShadow: 'var(--panel-shadow)' }}
                        >
                            <div className="flex items-start gap-3">
                <AgentAvatar avatar={tpl.avatar} size={24} className="text-foreground/70" />
                                <div className="flex-1 min-w-0">
                                    <span className="font-semibold text-sm text-foreground">{tpl.name}</span>
                                    <p className="text-xs text-muted-foreground mt-0.5">{tpl.description}</p>
                                    <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                                        <span className="px-1.5 py-0.5 rounded bg-muted font-mono">{tpl.model.split("-").slice(0, 2).join("-")}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mt-3">
                                <button
                                    onClick={() => handleAddFromTemplate(tpl)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                >
                                    <Plus className="w-3 h-3" />
                                    添加
                                </button>
                                <button
                                    onClick={() => handleAddFromTemplate(tpl)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
                                >
                                    <Copy className="w-3 h-3" />
                                    复制为新Agent
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {view === "swarm" && <SwarmPanel agents={agents} />}
        </motion.div>
    );
}
