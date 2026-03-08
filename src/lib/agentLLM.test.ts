import { describe, it, expect } from "vitest";
import { isRetryableError } from "./agentLLM";

describe("isRetryableError", () => {
    it("网络错误应可重试", () => {
        expect(isRetryableError("Network Error")).toBe(true);
        expect(isRetryableError("Request timeout")).toBe(true);
        expect(isRetryableError("ECONNRESET")).toBe(true);
        expect(isRetryableError("ECONNREFUSED")).toBe(true);
        expect(isRetryableError("fetch failed")).toBe(true);
    });

    it("5xx 错误应可重试", () => {
        expect(isRetryableError("500 Internal Server Error")).toBe(true);
        expect(isRetryableError("502 Bad Gateway")).toBe(true);
        expect(isRetryableError("503 Service Unavailable")).toBe(true);
    });

    it("EOF 错误应可重试", () => {
        expect(isRetryableError("unexpected eof")).toBe(true);
        expect(isRetryableError("stream eof")).toBe(true);
    });

    it("429 速率限制应可重试", () => {
        expect(isRetryableError("429 Too Many Requests")).toBe(true);
        expect(isRetryableError("Rate limit exceeded")).toBe(true);
    });

    it("协议错误应可重试", () => {
        expect(isRetryableError("protocol error")).toBe(true);
    });

    it("4xx 认证/参数错误不应重试", () => {
        expect(isRetryableError("401 Unauthorized")).toBe(false);
        expect(isRetryableError("403 Forbidden")).toBe(false);
        expect(isRetryableError("404 Not Found")).toBe(false);
        expect(isRetryableError("Invalid API key")).toBe(false);
    });

    it("未知错误不应重试", () => {
        expect(isRetryableError("Something went wrong")).toBe(false);
        expect(isRetryableError("")).toBe(false);
    });

    it("大小写不敏感", () => {
        expect(isRetryableError("NETWORK ERROR")).toBe(true);
        expect(isRetryableError("Bad Gateway")).toBe(true);
        expect(isRetryableError("TIMEOUT")).toBe(true);
    });
});
