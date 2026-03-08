import { describe, it, expect } from "vitest";
import { cosineSimilarity, searchSimilarChunks } from "./embeddings";

describe("cosineSimilarity", () => {
    it("相同向量应返回 1", () => {
        const vec = [1, 2, 3, 4, 5];
        expect(cosineSimilarity(vec, vec)).toBeCloseTo(1.0);
    });

    it("正交向量应返回 0", () => {
        const vecA = [1, 0, 0];
        const vecB = [0, 1, 0];
        expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(0.0);
    });

    it("反方向向量应返回 -1", () => {
        const vecA = [1, 2, 3];
        const vecB = [-1, -2, -3];
        expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(-1.0);
    });

    it("零向量应返回 0", () => {
        const vecA = [0, 0, 0];
        const vecB = [1, 2, 3];
        expect(cosineSimilarity(vecA, vecB)).toBe(0);
    });

    it("不同大小的相似向量应有高相似度", () => {
        const vecA = [1, 2, 3];
        const vecB = [2, 4, 6]; // 同方向，仅尺度不同
        expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(1.0);
    });
});

describe("searchSimilarChunks", () => {
    const mockChunks = [
        { id: "1", doc_id: "d1", content: "关于 React 的内容", embedding: [1, 0, 0] },
        { id: "2", doc_id: "d1", content: "关于 Rust 的内容", embedding: [0, 1, 0] },
        { id: "3", doc_id: "d2", content: "关于 Node.js 的内容", embedding: [0.7, 0.7, 0] },
        { id: "4", doc_id: "d2", content: "无关的内容", embedding: [0, 0, 1] },
    ];

    it("应返回 topK 个最相似的结果", () => {
        const query = [1, 0, 0]; // 最接近 chunk "1"
        const results = searchSimilarChunks(query, mockChunks, 2);
        expect(results).toHaveLength(2);
        expect(results[0].id).toBe("1"); // 最相似
    });

    it("结果应按相似度降序排列", () => {
        const query = [0.5, 0.5, 0];
        const results = searchSimilarChunks(query, mockChunks, 4);
        for (let i = 0; i < results.length - 1; i++) {
            expect(results[i].similarity).toBeGreaterThanOrEqual(results[i + 1].similarity);
        }
    });

    it("空 chunks 应返回空数组", () => {
        const results = searchSimilarChunks([1, 0, 0], [], 3);
        expect(results).toHaveLength(0);
    });

    it("topK 大于 chunks 数量时只返回全部", () => {
        const results = searchSimilarChunks([1, 0, 0], mockChunks, 100);
        expect(results).toHaveLength(mockChunks.length);
    });

    it("默认 topK 应为 3", () => {
        const results = searchSimilarChunks([1, 0, 0], mockChunks);
        expect(results).toHaveLength(3);
    });
});
