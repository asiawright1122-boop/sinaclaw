import { useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import type { GatewayConnectionType } from "@/lib/remoteGateway";
import { useTranslate } from "@/lib/i18n";
import { Server, Terminal, Globe, Wifi } from "lucide-react";

const TYPE_LABELS: Record<GatewayConnectionType, { label: string; icon: typeof Server }> = {
    local: { label: "Local", icon: Server },
    ssh_tunnel: { label: "SSH Tunnel", icon: Terminal },
    tailscale: { label: "Tailscale", icon: Globe },
    direct: { label: "Direct", icon: Wifi },
};

interface AddGatewayDialogProps {
    onAdd: (data: { name: string; type: GatewayConnectionType; host: string; port: number; token?: string }) => void;
    onClose: () => void;
}

export default function AddGatewayDialog({ onAdd, onClose }: AddGatewayDialogProps) {
    const t = useTranslate();
    const [formName, setFormName] = useState("");
    const [formType, setFormType] = useState<GatewayConnectionType>("direct");
    const [formHost, setFormHost] = useState("");
    const [formPort, setFormPort] = useState("3778");
    const [formToken, setFormToken] = useState("");

    // Override labels with i18n
    TYPE_LABELS.local.label = t.gatewayCluster.local;
    TYPE_LABELS.direct.label = t.gatewayCluster.direct;

    const handleAdd = () => {
        if (!formName.trim() || !formHost.trim()) return;
        onAdd({
            name: formName.trim(),
            type: formType,
            host: formHost.trim(),
            port: parseInt(formPort) || 3778,
            token: formToken || undefined,
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                className="bg-card dark:bg-card border border-border/60 dark:border-white/[0.08] rounded-xl w-[420px] max-w-[90vw]" style={{ boxShadow: 'var(--panel-shadow)' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b border-border/40">
                    <h3 className="font-semibold text-foreground">{t.gatewayCluster.addGateway}</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-4 space-y-3">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">{t.gatewayCluster.labelName}</label>
                        <input
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            placeholder={t.gatewayCluster.namePlaceholder}
                            className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">{t.gatewayCluster.labelType}</label>
                        <div className="flex gap-2">
                            {(["direct", "ssh_tunnel", "tailscale"] as const).map((ct) => (
                                <button
                                    key={ct}
                                    onClick={() => setFormType(ct)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                        formType === ct
                                            ? "bg-primary/10 text-primary border border-primary/25"
                                            : "bg-black/[0.03] dark:bg-white/[0.04] text-muted-foreground border border-border/50 dark:border-white/[0.06] hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
                                    }`}
                                >
                                    {TYPE_LABELS[ct].label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2 space-y-1.5">
                            <label className="text-xs font-medium text-foreground">{t.gatewayCluster.labelHost}</label>
                            <input
                                value={formHost}
                                onChange={(e) => setFormHost(e.target.value)}
                                placeholder="192.168.1.100"
                                className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-foreground">{t.gatewayCluster.labelPort}</label>
                            <input
                                value={formPort}
                                onChange={(e) => setFormPort(e.target.value)}
                                className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">{t.gatewayCluster.labelToken}</label>
                        <input
                            value={formToken}
                            onChange={(e) => setFormToken(e.target.value)}
                            type="password"
                            placeholder="Bearer Token"
                            className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors">
                            {t.common.cancel}
                        </button>
                        <button
                            onClick={handleAdd}
                            disabled={!formName.trim() || !formHost.trim()}
                            className="px-4 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
                        >
                            {t.gatewayCluster.add}
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
