import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import ChatPage from "@/pages/ChatPage";
import SettingsPage from "@/pages/SettingsPage";
import KnowledgePage from "@/pages/KnowledgePage";
import SkillStorePage from "@/pages/SkillStorePage";

function App() {
  return (
    <BrowserRouter>
      <div className="w-full h-screen overflow-hidden bg-transparent">
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<ChatPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="knowledge" element={<KnowledgePage />} />
            <Route path="skills" element={<SkillStorePage />} />
          </Route>
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
