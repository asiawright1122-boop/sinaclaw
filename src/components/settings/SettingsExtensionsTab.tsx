import { motion } from "framer-motion";
import { Trash2, Zap } from "lucide-react";
import { useTranslate } from "@/lib/i18n";
import type { MCPServerConfig } from "@/store/mcpStore";

interface SettingsExtensionsTabProps {
    servers: MCPServerConfig[];
    onToggleServer: (id: string) => void | Promise<void>;
    onRemoveServer: (id: string) => void;
    onOpenAddModal: () => void;
}

export default function SettingsExtensionsTab({
    servers,
    onToggleServer,
    onRemoveServer,
    onOpenAddModal,
}: SettingsExtensionsTabProps) {
    const t = useTranslate();

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
        >
            <motion.section
                className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-6 space-y-5"
                style={{ boxShadow: "var(--panel-shadow)" }}
            >
                <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/[0.06] border border-border/50 flex items-center justify-center">
                            <Zap className="w-4.5 h-4.5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-[17px] font-bold">{t.extensions.title}</h2>
                            <p className="text-[13px] text-muted-foreground mt-0.5">{t.extensions.subtitle}</p>
                        </div>
                    </div>
                    <button
                        onClick={onOpenAddModal}
                        className="px-4 py-2 rounded-xl text-[13px] font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-2"
                    >
                        <Zap className="w-3.5 h-3.5" />
                        {t.extensions.addServer}
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {servers.length > 0 ? (
                        servers.map((s) => (
                            <div key={s.id} className="flex items-center justify-between p-5 rounded-xl border border-border/50 dark:border-white/[0.06] bg-card/60 dark:bg-card/40 group">
                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-colors shrink-0 ${s.status === "active" ? "bg-primary/10 border-primary/20 text-primary" : "bg-muted/20 border-border/50 text-muted-foreground"}`}>
                                        <Zap className="w-6 h-6" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-[16px]">{s.name}</span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${s.status === "active" ? "bg-green-500/20 text-green-600" : "bg-red-500/10 text-muted-foreground"}`}>
                                                {s.status === "active" ? t.extensions.active : t.extensions.inactive}
                                            </span>
                                        </div>
                                        <div className="text-[12px] text-muted-foreground font-mono mt-0.5 opacity-60 truncate max-w-[300px]">{s.url}</div>
                                        <div className="text-[11px] font-bold text-primary mt-1">{t.extensions.toolsFound.replace("{count}", s.toolCount.toString())}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => onToggleServer(s.id)}
                                        className={`px-4 py-2 rounded-lg text-[13px] font-bold transition-all cursor-pointer ${s.status === "active" ? "bg-muted/50 text-foreground hover:bg-muted/70" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
                                    >
                                        {s.status === "active" ? t.extensions.inactive : t.extensions.active}
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (confirm(t.common.delete + "?")) onRemoveServer(s.id);
                                        }}
                                        className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-12 bg-black/[0.02] dark:bg-white/[0.02] rounded-xl border border-dashed border-border/50">
                            <p className="text-muted-foreground font-medium">{t.extensions.empty}</p>
                        </div>
                    )}
                </div>
            </motion.section>
        </motion.div>
    );
}
