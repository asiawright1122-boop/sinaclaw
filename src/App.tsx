import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import ChatPage from "@/pages/ChatPage";
import SettingsPage from "@/pages/SettingsPage";
import CloudPage from "@/pages/CloudPage";

function App() {
  return (
    <BrowserRouter>
      <div className="w-full h-screen overflow-hidden bg-transparent">
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<ChatPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="cloud" element={<CloudPage />} />
          </Route>
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
