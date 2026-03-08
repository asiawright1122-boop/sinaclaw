import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import ChatPage from "@/pages/ChatPage";
import Onboarding from "@/components/Onboarding";
import { useSettingsStore } from "@/store/settingsStore";

// 路由级懒加载 — 非首屏页面按需加载以减少初始 Bundle 体积
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const InboxPage = lazy(() => import("@/pages/InboxPage"));
const CanvasPage = lazy(() => import("@/pages/CanvasPage"));
const SkillMakerPage = lazy(() => import("@/pages/SkillMakerPage"));

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

function App() {
  const setupCompleted = useSettingsStore((s) => s.setupCompleted);
  const hydrated = useSettingsStore((s) => s._hydrated);

  return (
    <BrowserRouter>
      <div className="w-full h-screen overflow-hidden bg-transparent">
        {hydrated && !setupCompleted && <Onboarding />}
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<ChatPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="skill-maker" element={<SkillMakerPage />} />
              <Route path="inbox" element={<InboxPage />} />
              <Route path="canvas" element={<CanvasPage />} />
              {/* 重定向 — 已合并到设置页对应 Tab */}
              <Route path="knowledge" element={<Navigate to="/settings?tab=knowledge" replace />} />
              <Route path="skills" element={<Navigate to="/settings?tab=skills" replace />} />
              <Route path="connections" element={<Navigate to="/settings?tab=connections" replace />} />
              <Route path="agents" element={<Navigate to="/settings?tab=agents" replace />} />
              <Route path="gateway" element={<Navigate to="/settings?tab=connections" replace />} />
              <Route path="channels" element={<Navigate to="/settings?tab=connections" replace />} />
              <Route path="devices" element={<Navigate to="/settings?tab=connections" replace />} />
              <Route path="automation" element={<Navigate to="/settings?tab=agents" replace />} />
              <Route path="usage" element={<Navigate to="/settings?tab=usage" replace />} />
              <Route path="cloud" element={<Navigate to="/settings?tab=sync" replace />} />
              <Route path="sync" element={<Navigate to="/settings?tab=sync" replace />} />
              <Route path="models" element={<Navigate to="/settings?tab=api" replace />} />
              <Route path="security" element={<Navigate to="/settings?tab=security" replace />} />
              <Route path="gateway-cluster" element={<Navigate to="/settings?tab=connections" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  );
}

export default App;
