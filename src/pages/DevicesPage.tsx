import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Monitor, RefreshCw } from "lucide-react";
import { useDeviceStore, type Device } from "@/store/deviceStore";
import { useTranslate } from "@/lib/i18n";
import DeviceCard from "@/components/devices/DeviceCard";
import DeviceDetailPanel from "@/components/devices/DeviceDetailPanel";

export default function DevicesPage() {
    const t = useTranslate();
    const { devices, loading, startListening } = useDeviceStore();
    const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

    useEffect(() => {
        const unlisten = startListening();
        return unlisten;
    }, []);

    const onlineCount = devices.filter((d) => d.status === "online").length;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 overflow-y-auto p-6 space-y-6"
        >
            {/* 标题 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/[0.06] border border-border/50 flex items-center justify-center">
                        <Monitor className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-foreground">{t.devices.title}</h1>
                        <p className="text-xs text-muted-foreground">
                            {t.devices.subtitle}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                        {t.devices.onlineCount.replace('{online}', String(onlineCount)).replace('{total}', String(devices.length))}
                    </span>
                    <button
                        onClick={() => useDeviceStore.getState().fetchDevices()}
                        className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                        title={t.devices.refresh}
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            <div className="flex gap-6">
                {/* 设备列表 */}
                <div className={`space-y-2 ${selectedDevice ? "w-1/2" : "w-full"} transition-all`}>
                    {devices.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50">
                            <Monitor className="w-10 h-10 mb-3" />
                            <p className="text-sm font-medium">{t.devices.emptyDevices}</p>
                            <p className="text-xs mt-1">{t.devices.emptyDevicesDesc}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-2">
                            {devices.map((device) => (
                                <DeviceCard
                                    key={device.id}
                                    device={device}
                                    onClick={() => setSelectedDevice(device)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* 详情面板 */}
                <AnimatePresence mode="wait">
                    {selectedDevice && (
                        <div className="w-1/2 sticky top-0">
                            <DeviceDetailPanel
                                key={selectedDevice.id}
                                device={selectedDevice}
                                onClose={() => setSelectedDevice(null)}
                            />
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
