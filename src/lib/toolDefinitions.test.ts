import { describe, it, expect } from "vitest";
import { OPENCLAW_TOOLS } from "./toolDefinitions";

describe("OPENCLAW_TOOLS", () => {
    it("应包含至少 10 个工具定义", () => {
        expect(OPENCLAW_TOOLS.length).toBeGreaterThanOrEqual(10);
    });

    it("每个工具应有 type=function 和 function 属性", () => {
        for (const tool of OPENCLAW_TOOLS) {
            expect(tool.type).toBe("function");
            expect(tool.function).toBeDefined();
            expect(tool.function.name).toBeTruthy();
            expect(tool.function.description).toBeTruthy();
            expect(tool.function.parameters).toBeDefined();
        }
    });

    it("工具名称应唯一", () => {
        const names = OPENCLAW_TOOLS.map(t => t.function.name);
        const unique = new Set(names);
        expect(unique.size).toBe(names.length);
    });

    it("每个工具参数应有 type=object", () => {
        for (const tool of OPENCLAW_TOOLS) {
            expect(tool.function.parameters.type).toBe("object");
            expect(tool.function.parameters.properties).toBeDefined();
        }
    });

    it("required 字段应存在于 properties 中", () => {
        for (const tool of OPENCLAW_TOOLS) {
            const props = Object.keys(tool.function.parameters.properties);
            const required = tool.function.parameters.required || [];
            for (const req of required) {
                expect(props).toContain(req);
            }
        }
    });

    it("应包含核心工具 run_command/read_file/write_file", () => {
        const names = OPENCLAW_TOOLS.map(t => t.function.name);
        expect(names).toContain("run_command");
        expect(names).toContain("read_file");
        expect(names).toContain("write_file");
    });
});
