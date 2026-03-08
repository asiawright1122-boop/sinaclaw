import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useTranslate } from "@/lib/i18n";

interface CreateTokenModalProps {
    open: boolean;
    onClose: () => void;
    onCreate: (name: string, perms: string[]) => void;
}

export default function CreateTokenModal({ open, onClose, onCreate }: CreateTokenModalProps) {
    const t = useTranslate();
    const [name, setName] = useState("");
    const [perms, setPerms] = useState<string[]>(["read"]);

    const handleCreate = () => {
        if (!name.trim()) return;
        onCreate(name.trim(), perms);
        setName("");
        setPerms(["read"]);
    };

    return (
        <AnimatePresence>
            {open && (
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
                        className="bg-card dark:bg-card border border-border/60 dark:border-white/[0.08] rounded-xl w-[400px] max-w-[90vw]" style={{ boxShadow: 'var(--panel-shadow)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-border/40">
                            <h3 className="font-semibold text-foreground">{t.security.createTokenTitle}</h3>
                            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-foreground">{t.security.labelName}</label>
                                <input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder={t.security.tokenPlaceholder}
                                    className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-foreground">{t.security.labelPerms}</label>
                                <div className="flex gap-2">
                                    {["read", "write", "admin"].map((perm) => (
                                        <button
                                            key={perm}
                                            onClick={() =>
                                                setPerms((prev) =>
                                                    prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
                                                )
                                            }
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                                perms.includes(perm)
                                                    ? "bg-primary/10 text-primary border border-primary/25"
                                                    : "bg-black/[0.03] dark:bg-white/[0.04] text-muted-foreground border border-border/50 dark:border-white/[0.06] hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
                                            }`}
                                        >
                                            {perm}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors">
                                    {t.common.cancel}
                                </button>
                                <button
                                    onClick={handleCreate}
                                    disabled={!name.trim()}
                                    className="px-4 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
                                >
                                    {t.security.create}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
