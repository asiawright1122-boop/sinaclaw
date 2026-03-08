import { describe, it, expect } from "vitest";
import {
    setActiveGateway,
    getActiveGateway,
    addGateway,
    removeGateway,
    updateGateway,
    formatUptime,
    type GatewayEndpoint,
} from "./remoteGateway";

const mockGateways: GatewayEndpoint[] = [
    { id: "local", name: "本地", type: "local", host: "127.0.0.1", port: 3778, isActive: true, status: "online" },
    { id: "remote1", name: "远程1", type: "direct", host: "10.0.0.1", port: 3778, isActive: false, status: "offline" },
];

describe("remoteGateway — Gateway 管理", () => {
    it("setActiveGateway switches active", () => {
        const result = setActiveGateway(mockGateways, "remote1");
        expect(result.find((g) => g.id === "remote1")?.isActive).toBe(true);
        expect(result.find((g) => g.id === "local")?.isActive).toBe(false);
    });

    it("getActiveGateway returns active", () => {
        const active = getActiveGateway(mockGateways);
        expect(active?.id).toBe("local");
    });

    it("getActiveGateway falls back to first", () => {
        const noActive = mockGateways.map((g) => ({ ...g, isActive: false }));
        expect(getActiveGateway(noActive)?.id).toBe("local");
    });

    it("addGateway appends a new gateway", () => {
        const result = addGateway(mockGateways, {
            name: "新服务器",
            type: "ssh_tunnel",
            host: "192.168.1.100",
            port: 3778,
        });
        expect(result).toHaveLength(3);
        expect(result[2].name).toBe("新服务器");
        expect(result[2].isActive).toBe(false);
        expect(result[2].status).toBe("offline");
    });

    it("removeGateway removes non-local", () => {
        const result = removeGateway(mockGateways, "remote1");
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("local");
    });

    it("removeGateway cannot remove local", () => {
        const result = removeGateway(mockGateways, "local");
        expect(result).toHaveLength(2);
    });

    it("removeGateway re-activates first if active was removed", () => {
        const gws = setActiveGateway(mockGateways, "remote1");
        const result = removeGateway(gws, "remote1");
        expect(result[0].isActive).toBe(true);
    });

    it("updateGateway updates fields", () => {
        const result = updateGateway(mockGateways, "remote1", { name: "已更新", port: 9999 });
        const updated = result.find((g) => g.id === "remote1");
        expect(updated?.name).toBe("已更新");
        expect(updated?.port).toBe(9999);
    });

    it("formatUptime formats correctly", () => {
        expect(formatUptime(30)).toBe("30s");
        expect(formatUptime(120)).toBe("2m");
        expect(formatUptime(3700)).toBe("1h 1m");
        expect(formatUptime(90000)).toBe("1d 1h");
    });
});
