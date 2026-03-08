import { describe, it, expect } from "vitest";
import { splitText } from "./textSplitter";

describe("splitText", () => {
    it("短文本不应被拆分", () => {
        const text = "这是一段简短的文本。";
        const chunks = splitText(text, { chunkSize: 100, overlap: 20 });
        expect(chunks).toHaveLength(1);
        expect(chunks[0]).toBe(text);
    });

    it("空文本应返回空数组", () => {
        const chunks = splitText("", { chunkSize: 100, overlap: 20 });
        expect(chunks).toHaveLength(0);
    });

    it("应按段落分隔符拆分长文本", () => {
        const text = "第一段内容在这里。\n\n第二段内容在这里。\n\n第三段内容在这里。";
        const chunks = splitText(text, { chunkSize: 20, overlap: 5 });
        expect(chunks.length).toBeGreaterThan(1);
        // 每个 chunk 都不应超过 chunkSize（允许一定误差，因为有重叠）
        for (const chunk of chunks) {
            expect(chunk.length).toBeLessThanOrEqual(25); // chunkSize + 容差
        }
    });

    it("所有 chunk 合并后应覆盖原始文本的关键内容", () => {
        const text = "这是第一句话。这是第二句话。这是第三句话。这是第四句话。这是第五句话。";
        const chunks = splitText(text, { chunkSize: 20, overlap: 5 });
        const combined = chunks.join("");
        // 关键内容都应在合并后的结果中出现
        expect(combined).toContain("第一句话");
        expect(combined).toContain("第五句话");
    });

    it("每个 chunk 应非空", () => {
        const text = "A".repeat(500);
        const chunks = splitText(text, { chunkSize: 100, overlap: 20 });
        for (const chunk of chunks) {
            expect(chunk.trim().length).toBeGreaterThan(0);
        }
    });

    it("chunkSize <= 0 应返回原始文本", () => {
        const text = "Hello World";
        const chunks = splitText(text, { chunkSize: 0, overlap: 0 });
        expect(chunks).toHaveLength(1);
        expect(chunks[0]).toBe(text);
    });

    it("支持英文文本按句号进行拆分", () => {
        const text = "First sentence here. Second sentence here. Third sentence here. Fourth sentence is longer than the rest.";
        const chunks = splitText(text, { chunkSize: 50, overlap: 10 });
        expect(chunks.length).toBeGreaterThan(1);
    });

    it("使用默认参数时应正常工作", () => {
        const text = "A".repeat(2000);
        const chunks = splitText(text);
        expect(chunks.length).toBeGreaterThan(1);
    });
});
