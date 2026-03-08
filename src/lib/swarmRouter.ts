/**
 * OpenClaw Swarm Router — 多智能体任务编排引擎
 * 
 * 核心能力：
 * 1. 接收一个宏大任务 → 调用 Manager Agent 分解为子任务
 * 2. 按依赖关系串行/并行调度子 Agent
 * 3. 汇总各子 Agent 结果 → 返回给父 Agent 做最终总结
 */

// ── 类型定义 ──────────────────────────────────────────────

export interface SubTask {
    id: string;
    description: string;
    assignedAgentName: string;
    dependsOn: string[]; // 依赖的其他子任务 ID
    status: "pending" | "running" | "done" | "error";
    result?: string;
}

export interface SwarmPlan {
    originalTask: string;
    subtasks: SubTask[];
    status: "planning" | "executing" | "done" | "error";
}

export type SwarmEventCallback = (event: {
    type: "plan_ready" | "subtask_start" | "subtask_done" | "subtask_error" | "all_done";
    plan: SwarmPlan;
    subtaskId?: string;
}) => void;

// ── Swarm Router ─────────────────────────────────────────

export class SwarmRouter {
    private plan: SwarmPlan | null = null;
    private onEvent: SwarmEventCallback;

    constructor(onEvent: SwarmEventCallback) {
        this.onEvent = onEvent;
    }

    /**
     * 第一步：让 Manager Agent 分解任务
     * 返回结构化的子任务列表
     */
    async planTasks(
        taskDescription: string,
        apiKey: string,
        provider: string,
        model: string
    ): Promise<SwarmPlan> {
        const { callLLMWithTools } = await import("@/lib/agent");

        const planningPrompt = `你是一个任务分解专家。将下面的任务拆分成多个独立的子任务。

规则：
1. 每个子任务应该足够具体，可以独立执行
2. 标注子任务之间的依赖关系
3. 为每个子任务推荐最适合的角色

输出格式（严格 JSON）：
{
  "subtasks": [
    {
      "id": "task_1",
      "description": "具体的子任务描述",
      "assignedAgentName": "Senior Developer | Content Writer | Sinaclaw Core",
      "dependsOn": []
    }
  ]
}

只输出 JSON。`;

        let fullText = "";
        const result = await callLLMWithTools({
            messages: [
                { role: "system", content: planningPrompt },
                { role: "user", content: taskDescription },
            ],
            apiKey,
            provider,
            model,
            temperature: 0.3,
            maxTokens: 2000,
            onTextChunk: (chunk: string) => { fullText += chunk; },
            onError: (err: string) => { throw new Error(err); },
        });

        const text = result.content || fullText;
        let json = text;
        const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match) json = match[1].trim();

        const parsed = JSON.parse(json);
        const subtasks: SubTask[] = (parsed.subtasks || []).map((st: any) => ({
            ...st,
            status: "pending" as const,
        }));

        this.plan = {
            originalTask: taskDescription,
            subtasks,
            status: "planning",
        };

        this.onEvent({ type: "plan_ready", plan: this.plan });
        return this.plan;
    }

    /**
     * 第二步：按依赖顺序执行子任务
     * 无依赖的子任务并行执行，有依赖的等待前置完成
     */
    async executePlan(
        _apiKey: string,
        _provider: string,
        _model: string,
        executeSubTask: (subtask: SubTask, context: string) => Promise<string>
    ): Promise<SwarmPlan> {
        if (!this.plan) throw new Error("请先调用 planTasks()");

        this.plan.status = "executing";

        // 简单拓扑排序执行
        const completed = new Set<string>();
        const results = new Map<string, string>();

        while (completed.size < this.plan.subtasks.length) {
            // 找出所有依赖已满足的 pending 子任务
            const ready = this.plan.subtasks.filter(
                (st) =>
                    st.status === "pending" &&
                    st.dependsOn.every((dep) => completed.has(dep))
            );

            if (ready.length === 0 && completed.size < this.plan.subtasks.length) {
                this.plan.status = "error";
                break;
            }

            // 并行执行 ready 子任务
            await Promise.all(
                ready.map(async (subtask) => {
                    subtask.status = "running";
                    this.onEvent({ type: "subtask_start", plan: this.plan!, subtaskId: subtask.id });

                    try {
                        // 构建上下文：包含已完成子任务的结果
                        const contextParts = subtask.dependsOn
                            .map((depId) => `[${depId} 结果]: ${results.get(depId) || "无"}`)
                            .join("\n");

                        const result = await executeSubTask(subtask, contextParts);
                        subtask.result = result;
                        subtask.status = "done";
                        completed.add(subtask.id);
                        results.set(subtask.id, result);
                        this.onEvent({ type: "subtask_done", plan: this.plan!, subtaskId: subtask.id });
                    } catch (e: any) {
                        subtask.status = "error";
                        subtask.result = e.message;
                        completed.add(subtask.id);
                        this.onEvent({ type: "subtask_error", plan: this.plan!, subtaskId: subtask.id });
                    }
                })
            );
        }

        if (this.plan.subtasks.every((st) => st.status === "done")) {
            this.plan.status = "done";
        }

        this.onEvent({ type: "all_done", plan: this.plan });
        return this.plan;
    }

    getPlan(): SwarmPlan | null {
        return this.plan;
    }
}
