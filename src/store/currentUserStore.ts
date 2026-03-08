/**
 * 当前用户状态管理
 *
 * 单用户场景下默认 admin，多用户场景下从 DB 加载
 */
import { create } from "zustand";
import { type UserProfile, type UserRole, ROLE_PERMISSIONS } from "@/lib/accessControl";

interface CurrentUserState {
    user: UserProfile;
    setUser: (user: UserProfile) => void;
    setRole: (role: UserRole) => void;
    can: (permission: keyof typeof ROLE_PERMISSIONS.admin) => boolean;
}

const DEFAULT_USER: UserProfile = {
    id: "local-admin",
    name: "Admin",
    email: "",
    role: "admin",
    allowedChannels: [],
    allowedAgents: [],
    createdAt: Date.now(),
};

export const useCurrentUserStore = create<CurrentUserState>((set, get) => ({
    user: DEFAULT_USER,

    setUser: (user) => set({ user }),

    setRole: (role) => set((s) => ({ user: { ...s.user, role } })),

    can: (permission) => {
        const { user } = get();
        return ROLE_PERMISSIONS[user.role][permission] as boolean;
    },
}));
