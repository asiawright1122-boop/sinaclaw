import { describe, it, expect, vi } from "vitest";
import { SwarmRouter, type SubTask, type SwarmPlan, type SwarmEventCallback } from "./swarmRouter";

function makeRouter() {
    const events: { type: string; subtaskId?: string }[] = [];
    const onEvent: SwarmEventCallback = (e) => events.push({ type: e.type, subtaskId: e.subtaskId });
    const router = new SwarmRouter(onEvent);
    return { router, events };
}

function injectPlan(router: SwarmRouter, subtasks: SubTask[]) {
    // 直接设置 plan 以跳过 LLM 调用
    (router as unknown as { plan: SwarmPlan }).plan = {
        originalTask: "测试任务",
        subtasks,
        status: "planning",
    };
}

describe("SwarmRouter.executePlan", () => {
    it("无依赖的子任务应全部并行执行", async () => {
        const { router, events } = makeRouter();
        injectPlan(router, [
            { id: "t1", description: "任务1", assignedAgentName: "A", dependsOn: [], status: "pending" },
            { id: "t2", description: "任务2", assignedAgentName: "B", dependsOn: [], status: "pending" },
        ]);

        const exec = vi.fn(async (st: SubTask) => `${st.id} 完成`);
        const plan = await router.executePlan("", "", "", exec);

        expect(plan.status).toBe("done");
        expect(exec).toHaveBeenCalledTimes(2);
        expect(plan.subtasks.every(st => st.status === "done")).toBe(true);
        expect(events.map(e => e.type)).toContain("all_done");
    });

    it("有依赖的子任务应按顺序执行", async () => {
        const { router } = makeRouter();
        injectPlan(router, [
            { id: "t1", description: "先做", assignedAgentName: "A", dependsOn: [], status: "pending" },
            { id: "t2", description: "后做", assignedAgentName: "B", dependsOn: ["t1"], status: "pending" },
        ]);

        const order: string[] = [];
        const exec = vi.fn(async (st: SubTask) => {
            order.push(st.id);
            return `${st.id} 完成`;
        });

        const plan = await router.executePlan("", "", "", exec);
        expect(order).toEqual(["t1", "t2"]);
        expect(plan.status).toBe("done");
    });

    it("子任务失败应标记为 error 但继续其他任务", async () => {
        const { router, events } = makeRouter();
        injectPlan(router, [
            { id: "t1", description: "会失败", assignedAgentName: "A", dependsOn: [], status: "pending" },
            { id: "t2", description: "会成功", assignedAgentName: "B", dependsOn: [], status: "pending" },
        ]);

        const exec = vi.fn(async (st: SubTask) => {
            if (st.id === "t1") throw new Error("执行失败");
            return "成功";
        });

        const plan = await router.executePlan("", "", "", exec);
        expect(plan.subtasks.find(st => st.id === "t1")?.status).toBe("error");
        expect(plan.subtasks.find(st => st.id === "t2")?.status).toBe("done");
        expect(events.some(e => e.type === "subtask_error")).toBe(true);
    });

    it("无 plan 时应抛出错误", async () => {
        const { router } = makeRouter();
        await expect(router.executePlan("", "", "", async () => "")).rejects.toThrow("请先调用 planTasks()");
    });

    it("getPlan 应返回当前 plan", () => {
        const { router } = makeRouter();
        expect(router.getPlan()).toBeNull();
        injectPlan(router, []);
        expect(router.getPlan()).not.toBeNull();
    });

    it("子任务上下文应包含依赖任务的结果", async () => {
        const { router } = makeRouter();
        injectPlan(router, [
            { id: "t1", description: "先做", assignedAgentName: "A", dependsOn: [], status: "pending" },
            { id: "t2", description: "依赖 t1", assignedAgentName: "B", dependsOn: ["t1"], status: "pending" },
        ]);

        let capturedContext = "";
        const exec = vi.fn(async (st: SubTask, ctx: string) => {
            if (st.id === "t2") capturedContext = ctx;
            return `${st.id} 的结果`;
        });

        await router.executePlan("", "", "", exec);
        expect(capturedContext).toContain("t1 结果");
        expect(capturedContext).toContain("t1 的结果");
    });
});
