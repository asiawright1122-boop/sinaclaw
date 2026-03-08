import { motion } from "framer-motion";
import { Monitor, Smartphone, Globe, Server, Camera, MapPin, ScreenShare, ChevronRight } from "lucide-react";
import type { Device } from "@/store/deviceStore";
import { useTranslate } from "@/lib/i18n";

export const DEVICE_ICONS: Record<Device["type"], React.ElementType> = {
    macos: Monitor,
    ios: Smartphone,
    android: Smartphone,
    headless: Server,
    browser: Globe,
    unknown: Monitor,
};

export const DEVICE_LABELS: Record<Device["type"], string> = {
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

export function formatLastSeen(ts: number, t: ReturnType<typeof useTranslate>): string {
    const diff = Date.now() - ts;
    if (diff < 60_000) return t.devices.justNow;
    if (diff < 3600_000) return t.devices.minutesAgo.replace('{n}', String(Math.floor(diff / 60_000)));
    if (diff < 86400_000) return t.devices.hoursAgo.replace('{n}', String(Math.floor(diff / 3600_000)));
    return t.devices.daysAgo.replace('{n}', String(Math.floor(diff / 86400_000)));
}

interface DeviceCardProps {
    device: Device;
    onClick: () => void;
}

export default function DeviceCard({ device, onClick }: DeviceCardProps) {
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
                            <span>&middot; {formatLastSeen(device.lastSeen, t)}</span>
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
