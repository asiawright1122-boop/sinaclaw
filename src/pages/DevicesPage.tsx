import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Monitor,
    Smartphone,
    Globe,
    Server,
    Wifi,
    WifiOff,
    Camera,
    MapPin,
    ScreenShare,
    Unlink,
    RefreshCw,
    Send,
    ChevronRight,
    X,
} from "lucide-react";
import { useDeviceStore, type Device } from "@/store/deviceStore";
import { useTranslate } from "@/lib/i18n";

const DEVICE_ICONS: Record<Device["type"], React.ElementType> = {
    macos: Monitor,
    ios: Smartphone,
    android: Smartphone,
    headless: Server,
    browser: Globe,
    unknown: Monitor,
};

const DEVICE_LABELS: Record<Device["type"], string> = {
    macos: "macOS",
    ios: "iOS",
    android: "Android",
    headless: "Headless",
    browser: "Browser",
    unknown: "Unknown",
};

const CAP_ICONS: Record<string, React.ElementType> = {
    camera: Camera,
    screen: ScreenShare,
    location: MapPin,
    canvas: Globe,
};

const CAP_LABEL_KEYS: Record<string, string> = {
    camera: "capCamera",
    screen: "capScreen",
    location: "capLocation",
    canvas: "canvas",
};

function formatLastSeen(ts: number, t: ReturnType<typeof useTranslate>): string {
    const diff = Date.now() - ts;
    if (diff < 60_000) return t.devices.justNow;
    if (diff < 3600_000) return t.devices.minutesAgo.replace('{n}', String(Math.floor(diff / 60_000)));
    if (diff < 86400_000) return t.devices.hoursAgo.replace('{n}', String(Math.floor(diff / 3600_000)));
    return t.devices.daysAgo.replace('{n}', String(Math.floor(diff / 86400_000)));
}

function DeviceCard({
    device,
    onClick,
}: {
    device: Device;
    onClick: () => void;
}) {
    const t = useTranslate();
    const Icon = DEVICE_ICONS[device.type] || Monitor;
    const statusColor = device.status === "online" ? "text-emerald-500" : device.status === "busy" ? "text-amber-500" : "text-muted-foreground/40";
    const statusBg = device.status === "online" ? "bg-emerald-500" : device.status === "busy" ? "bg-amber-500" : "bg-gray-400";

    return (
        <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={onClick}
            className="w-full text-left bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-4 hover:border-primary/20 transition-all duration-150 group" style={{ boxShadow: 'var(--panel-shadow)' }}
        >
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-muted/20 border border-border/50 dark:border-white/[0.06] flex items-center justify-center">
                        <Icon className={`w-4.5 h-4.5 ${statusColor}`} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground">{device.name}</span>
                            <span className={`w-2 h-2 rounded-full ${statusBg} ${device.status === "online" ? "animate-pulse" : ""}`} />
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                            <span>{DEVICE_LABELS[device.type]}</span>
                            {device.version && <span>v{device.version}</span>}
                            <span>· {formatLastSeen(device.lastSeen, t)}</span>
                        </div>
                    </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0 mt-1" />
            </div>
            {device.capabilities.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2.5 ml-[52px]">
                    {device.capabilities.map((cap) => {
                        const CapIcon = CAP_ICONS[cap];
                        const labelKey = CAP_LABEL_KEYS[cap];
                        const label = labelKey && (t.devices as Record<string, string>)[labelKey] || cap;
                        if (!CapIcon) return <span key={cap} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/20 text-muted-foreground">{cap}</span>;
                        return (
                            <span key={cap} className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-muted/20 text-muted-foreground">
                                <CapIcon className="w-2.5 h-2.5" />
                                {label}
                            </span>
                        );
                    })}
                </div>
            )}
        </motion.button>
    );
}

function DeviceDetailPanel({
    device,
    onClose,
}: {
    device: Device;
    onClose: () => void;
}) {
    const t = useTranslate();
    const { sendCommand, unpairDevice } = useDeviceStore();
    const [commandResult, setCommandResult] = useState<string | null>(null);
    const Icon = DEVICE_ICONS[device.type] || Monitor;

    const handleCommand = (cmd: string) => {
        const sent = sendCommand(device.id, cmd);
        setCommandResult(sent ? t.devices.commandSent.replace('{cmd}', cmd) : t.devices.commandFailed);
    };

    const handleUnpair = async () => {
        await unpairDevice(device.id);
        onClose();
    };

    const quickCommands = [
        { cmd: "screenshot", label: t.devices.cmdScreenshot, icon: Camera },
        { cmd: "screencast", label: t.devices.cmdScreencast, icon: ScreenShare },
        { cmd: "location", label: t.devices.cmdLocation, icon: MapPin },
    ].filter((c) => device.capabilities.includes(c.cmd.replace("cast", "")) || device.capabilities.length === 0);

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl overflow-hidden" style={{ boxShadow: 'var(--panel-shadow)' }}
        >
            <div className="flex items-center justify-between p-4 border-b border-border/40">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-muted/20 border border-border/50 dark:border-white/[0.06] flex items-center justify-center">
                        <Icon className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground">{device.name}</h3>
                        <p className="text-xs text-muted-foreground">
                            {DEVICE_LABELS[device.type]}
                            {device.ip && ` · ${device.ip}`}
                            {device.version && ` · v${device.version}`}
                        </p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="p-4 space-y-4">
                {/* 状态信息 */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-muted/20 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                            {device.status === "online" ? (
                                <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                                <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                            <span className="text-xs font-medium text-foreground">
                                {device.status === "online" ? t.devices.online : device.status === "busy" ? t.devices.busy : t.devices.offline}
                            </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{formatLastSeen(device.lastSeen, t)}</span>
                    </div>
                    <div className="bg-muted/20 rounded-lg p-3">
                        <div className="text-xs font-medium text-foreground mb-1">{t.devices.capabilities}</div>
                        <span className="text-[10px] text-muted-foreground">
                            {device.capabilities.length > 0 ? device.capabilities.join(", ") : t.devices.noCap}
                        </span>
                    </div>
                </div>

                {/* 快捷命令 */}
                {quickCommands.length > 0 && device.status === "online" && (
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t.devices.quickCommands}</h4>
                        <div className="flex flex-wrap gap-2">
                            {quickCommands.map((c) => (
                                <button
                                    key={c.cmd}
                                    onClick={() => handleCommand(c.cmd)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                                >
                                    <c.icon className="w-3.5 h-3.5" />
                                    {c.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* 自定义命令 */}
                {device.status === "online" && (
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t.devices.sendCommand}</h4>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder={t.devices.commandPlaceholder}
                                className="flex-1 bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        const input = e.currentTarget;
                                        if (input.value.trim()) {
                                            handleCommand(input.value.trim());
                                            input.value = "";
                                        }
                                    }
                                }}
                            />
                            <button className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                                <Send className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* 命令结果 */}
                {commandResult && (
                    <div className="bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg p-2.5 text-xs font-mono text-foreground/80">
                        {commandResult}
                    </div>
                )}

                {/* 取消配对 */}
                <div className="pt-2 border-t border-border/40">
                    <button
                        onClick={handleUnpair}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/15 transition-colors"
                    >
                        <Unlink className="w-3.5 h-3.5" />
                        {t.devices.unpair}
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

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
