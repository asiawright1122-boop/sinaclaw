import { describe, it, expect } from "vitest";
import { toMessageRole } from "./chatTypes";

describe("toMessageRole", () => {
    it("有效角色应原样返回", () => {
        expect(toMessageRole("user")).toBe("user");
        expect(toMessageRole("assistant")).toBe("assistant");
        expect(toMessageRole("system")).toBe("system");
    });

    it("无效角色应回退为 assistant", () => {
        expect(toMessageRole("tool")).toBe("assistant");
        expect(toMessageRole("function")).toBe("assistant");
        expect(toMessageRole("")).toBe("assistant");
        expect(toMessageRole("unknown")).toBe("assistant");
    });
});
