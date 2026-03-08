import { useState } from "react";
import { motion } from "framer-motion";
import { Monitor, Wifi, WifiOff, Camera, MapPin, ScreenShare, Unlink, Send, X } from "lucide-react";
import { useDeviceStore, type Device } from "@/store/deviceStore";
import { useTranslate } from "@/lib/i18n";
import { DEVICE_ICONS, DEVICE_LABELS, formatLastSeen } from "./DeviceCard";

interface DeviceDetailPanelProps {
    device: Device;
    onClose: () => void;
}

export default function DeviceDetailPanel({ device, onClose }: DeviceDetailPanelProps) {
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
                            {device.ip && ` \u00b7 ${device.ip}`}
                            {device.version && ` \u00b7 v${device.version}`}
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
