import { useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useTranslate } from "@/lib/i18n";

interface CreateCronDialogProps {
    onClose: () => void;
    onCreate: (job: { name: string; schedule: string; command: string; enabled: boolean }) => void;
}

export default function CreateCronDialog({ onClose, onCreate }: CreateCronDialogProps) {
    const t = useTranslate();
    const CRON_TEMPLATES = [
        { label: t.automation.tplDailySummary, schedule: "0 9 * * *", command: "send '\u8bf7\u751f\u6210\u4eca\u65e5\u65b0\u95fb\u6458\u8981'" },
        { label: t.automation.tplHourlyCheck, schedule: "0 * * * *", command: "send '\u68c0\u67e5\u6240\u6709\u901a\u9053\u72b6\u6001'" },
        { label: t.automation.tplWeekdayReminder, schedule: "0 8 * * 1-5", command: "send '\u65e9\u5b89\uff01\u4eca\u5929\u6709\u4ec0\u4e48\u5b89\u6392\uff1f'" },
        { label: t.automation.tplWeeklyReport, schedule: "0 18 * * 5", command: "send '\u8bf7\u751f\u6210\u672c\u5468\u5de5\u4f5c\u603b\u7ed3'" },
    ];
    const [name, setName] = useState("");
    const [schedule, setSchedule] = useState("");
    const [command, setCommand] = useState("");

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={onClose}
        >
            <div className="bg-card dark:bg-card border border-border/60 dark:border-white/[0.08] rounded-2xl w-[440px] max-w-[90vw]" style={{ boxShadow: 'var(--panel-shadow)' }} onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-border/40">
                    <h3 className="font-semibold text-foreground">{t.automation.createCronTitle}</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-4 space-y-3">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">{t.automation.labelName}</label>
                        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.automation.cronNamePlaceholder} className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">{t.automation.labelCron}</label>
                        <input value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="0 9 * * *" className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">{t.automation.labelCommand}</label>
                        <input value={command} onChange={(e) => setCommand(e.target.value)} placeholder={t.automation.cronCommandPlaceholder} className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all" />
                    </div>
                    {/* 快捷模板 */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">{t.automation.quickTemplates}</label>
                        <div className="flex flex-wrap gap-1.5">
                            {CRON_TEMPLATES.map((tpl) => (
                                <button
                                    key={tpl.label}
                                    onClick={() => { setName(tpl.label); setSchedule(tpl.schedule); setCommand(tpl.command); }}
                                    className="px-2 py-1 rounded-lg text-[10px] font-medium bg-muted/30 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                                >
                                    {tpl.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors">
                            {t.common.cancel}
                        </button>
                        <button
                            onClick={() => { if (name && schedule && command) onCreate({ name, schedule, command, enabled: true }); }}
                            disabled={!name || !schedule || !command}
                            className="px-4 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
                        >
                            {t.automation.createCron}
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
