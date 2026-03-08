import { describe, it, expect } from "vitest";
import { formatSize } from "./toolExecutors";

describe("formatSize", () => {
    it("字节级别应显示 B", () => {
        expect(formatSize(0)).toBe("0B");
        expect(formatSize(512)).toBe("512B");
        expect(formatSize(1023)).toBe("1023B");
    });

    it("KB 级别应显示 KB", () => {
        expect(formatSize(1024)).toBe("1.0KB");
        expect(formatSize(1536)).toBe("1.5KB");
        expect(formatSize(10240)).toBe("10.0KB");
        expect(formatSize(1048575)).toBe("1024.0KB");
    });

    it("MB 级别应显示 MB", () => {
        expect(formatSize(1048576)).toBe("1.0MB");
        expect(formatSize(5242880)).toBe("5.0MB");
        expect(formatSize(10485760)).toBe("10.0MB");
    });
});
