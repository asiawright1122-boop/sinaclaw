import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useCloudStore } from "@/store/cloudStore";
import { useMCPStore } from "@/store/mcpStore";
import { MCP_PRESETS } from "@/store/mcpStore";
import SettingsNavSidebar, { VALID_TABS, type SettingsTabId } from "@/components/settings/SettingsNavSidebar";
import SettingsContent from "@/components/settings/SettingsContent";
import AddExtensionModal from "@/components/settings/AddExtensionModal";

export default function SettingsPage() {
    // 弹窗状态
    const [isAddExtModalOpen, setIsAddExtModalOpen] = useState(false);
    const [customUrl, setCustomUrl] = useState("");
    const [customName, setCustomName] = useState("");

    // Tabs 逻辑
    const [searchParams] = useSearchParams();
    const initialTab = useMemo(() => {
        const t = searchParams.get("tab");
        return (t && (VALID_TABS as readonly string[]).includes(t)) ? t as SettingsTabId : "api";
    }, []);
    const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);

    const { initCloudAccounts } = useCloudStore();
    useEffect(() => { initCloudAccounts(); }, [initCloudAccounts]);

    const handleAddPreset = async (preset: typeof MCP_PRESETS[0]) => {
        await useMCPStore.getState().addServer(preset);
        setIsAddExtModalOpen(false);
    };

    const handleAddCustom = async () => {
        if (!customUrl || !customName) return;
        await useMCPStore.getState().addServer({
            name: customName,
            url: customUrl,
            type: "sse"
        });
        setCustomUrl("");
        setCustomName("");
        setIsAddExtModalOpen(false);
    };

    return (
        <div className="flex-1 flex h-full overflow-hidden">
            <SettingsNavSidebar activeTab={activeTab} onTabChange={setActiveTab} />
            <SettingsContent activeTab={activeTab} onOpenAddExtModal={() => setIsAddExtModalOpen(true)} />
            <AddExtensionModal
                isOpen={isAddExtModalOpen}
                customName={customName}
                customUrl={customUrl}
                onClose={() => setIsAddExtModalOpen(false)}
                onCustomNameChange={setCustomName}
                onCustomUrlChange={setCustomUrl}
                onAddCustom={handleAddCustom}
                onAddPreset={handleAddPreset}
            />
        </div>
    );
}
