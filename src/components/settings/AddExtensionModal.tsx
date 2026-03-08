import { AnimatePresence, motion } from "framer-motion";
import { Plus, Server, X, Zap } from "lucide-react";
import { useTranslate } from "@/lib/i18n";
import { MCP_PRESETS } from "@/store/mcpStore";
import {
    NotionIcon,
    GithubIcon,
    SlackIcon,
    PostgresIcon,
    WorldIcon,
} from "@/components/icons/ProviderIcons";

type MCPPreset = (typeof MCP_PRESETS)[number];

interface AddExtensionModalProps {
    isOpen: boolean;
    customName: string;
    customUrl: string;
    onClose: () => void;
    onCustomNameChange: (value: string) => void;
    onCustomUrlChange: (value: string) => void;
    onAddCustom: () => void;
    onAddPreset: (preset: MCPPreset) => void;
}

export default function AddExtensionModal({
    isOpen,
    customName,
    customUrl,
    onClose,
    onCustomNameChange,
    onCustomUrlChange,
    onAddCustom,
    onAddPreset,
}: AddExtensionModalProps) {
    const t = useTranslate();

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-xl bg-card border border-border/60 dark:border-white/[0.08] rounded-2xl overflow-hidden"
                        style={{ boxShadow: "var(--panel-shadow)" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-8 space-y-8">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-black tracking-tight">{t.extensions.addServer}</h2>
                                    <p className="text-sm text-muted-foreground mt-1">{t.extensions.addServerDesc}</p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-full hover:bg-muted/50 transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider px-1">{t.extensions.presets}</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {MCP_PRESETS.map((p) => (
                                        <button
                                            key={p.name}
                                            onClick={() => onAddPreset(p)}
                                            className="flex items-center gap-3 p-4 rounded-xl border border-border/50 dark:border-white/[0.06] bg-card/60 dark:bg-card/40 hover:bg-card/80 dark:hover:bg-card/60 hover:border-border/80 transition-all text-left group"
                                        >
                                            <div className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center p-2 group-hover:scale-110 transition-transform">
                                                {p.name === "Notion" && <NotionIcon className="w-full h-full" />}
                                                {p.name === "GitHub" && <GithubIcon className="w-full h-full" />}
                                                {p.name === "Slack" && <SlackIcon className="w-full h-full" />}
                                                {p.name === "PostgreSQL" && <PostgresIcon className="w-full h-full" />}
                                                {p.name === "Browser Fetch" && <WorldIcon className="w-full h-full font-bold" />}
                                                {p.name === "OpenClaw Interpreter" && <Zap className="w-full h-full p-1 text-emerald-400" />}
                                                {![
                                                    "Notion",
                                                    "GitHub",
                                                    "Slack",
                                                    "PostgreSQL",
                                                    "Browser Fetch",
                                                    "OpenClaw Interpreter",
                                                ].includes(p.name) && <Server className="w-full h-full p-1" />}
                                            </div>
                                            <div>
                                                <div className="font-bold text-[14px]">{p.name}</div>
                                                <div className="text-[11px] text-muted-foreground line-clamp-1 opacity-60">
                                                    {p.name === "Notion" ? t.extensions.notionDesc
                                                        : p.name === "GitHub" ? t.extensions.githubDesc
                                                            : p.name === "Slack" ? t.extensions.slackDesc
                                                                : p.name === "Browser Fetch" ? t.extensions.fetchDesc
                                                                    : p.name === "PostgreSQL" ? t.extensions.postgresDesc
                                                                        : p.name === "OpenClaw Interpreter" ? t.extensions.interpreterDesc : ""}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4 pt-2">
                                <h3 className="text-[13px] font-bold text-muted-foreground uppercase tracking-wider px-1">{t.extensions.custom}</h3>
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        placeholder={t.extensions.serverName}
                                        value={customName}
                                        onChange={(e) => onCustomNameChange(e.target.value)}
                                        className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-4 py-3 text-sm focus:border-primary/50 outline-none transition-all"
                                    />
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder={t.extensions.serverUrl}
                                            value={customUrl}
                                            onChange={(e) => onCustomUrlChange(e.target.value)}
                                            className="flex-1 bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-4 py-3 text-sm focus:border-primary/50 outline-none transition-all"
                                        />
                                        <button
                                            onClick={onAddCustom}
                                            disabled={!customUrl || !customName}
                                            className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
                                        >
                                            <Plus className="w-4 h-4" />
                                            {t.common.add}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
