import { describe, it, expect } from "vitest";
import { ROLE_PERMISSIONS, type UserRole } from "./accessControl";

describe("ROLE_PERMISSIONS", () => {
    const roles: UserRole[] = ["admin", "operator", "viewer"];

    it("应覆盖所有三种角色", () => {
        for (const role of roles) {
            expect(ROLE_PERMISSIONS[role]).toBeDefined();
        }
    });

    it("admin 应拥有全部权限", () => {
        const admin = ROLE_PERMISSIONS.admin;
        expect(admin.canManageUsers).toBe(true);
        expect(admin.canManageGateway).toBe(true);
        expect(admin.canManageChannels).toBe(true);
        expect(admin.canManageAgents).toBe(true);
        expect(admin.canChat).toBe(true);
        expect(admin.canViewAudit).toBe(true);
        expect(admin.canExportData).toBe(true);
    });

    it("operator 不应有用户管理和网关管理权限", () => {
        const op = ROLE_PERMISSIONS.operator;
        expect(op.canManageUsers).toBe(false);
        expect(op.canManageGateway).toBe(false);
        expect(op.canManageChannels).toBe(true);
        expect(op.canChat).toBe(true);
    });

    it("viewer 只应有聊天权限", () => {
        const viewer = ROLE_PERMISSIONS.viewer;
        expect(viewer.canManageUsers).toBe(false);
        expect(viewer.canManageGateway).toBe(false);
        expect(viewer.canManageChannels).toBe(false);
        expect(viewer.canManageAgents).toBe(false);
        expect(viewer.canChat).toBe(true);
        expect(viewer.canViewAudit).toBe(false);
        expect(viewer.canExportData).toBe(false);
    });

    it("所有角色都应有 label 和 description", () => {
        for (const role of roles) {
            expect(ROLE_PERMISSIONS[role].label).toBeTruthy();
            expect(ROLE_PERMISSIONS[role].description).toBeTruthy();
        }
    });
});
