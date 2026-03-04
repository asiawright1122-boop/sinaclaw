import { motion } from "framer-motion";
import { FolderOpen, Clock, ChevronRight, Sparkles } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useSettingsStore } from "@/store/settingsStore";
import { translations } from "@/lib/i18n";

export default function WelcomePage() {
    const { openFolder, recentPaths, setWorkspace, isSelecting } = useWorkspaceStore();
    const { language } = useSettingsStore();
    const t = translations[language].welcome;

    return (
        <div className="flex-1 flex items-center justify-center p-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="max-w-lg w-full text-center space-y-8"
            >
                {/* Logo */}
                <div className="flex justify-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-2xl icon-glow">
                        <Sparkles className="w-8 h-8 text-white" />
                    </div>
                </div>

                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                        {t.title}
                    </h1>
                    <p className="mt-3 text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
                        {t.subtitle}
                    </p>
                </div>

                {/* 打开文件夹按钮 */}
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={openFolder}
                    disabled={isSelecting}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-gradient-to-r from-primary/80 to-accent/80 hover:from-primary hover:to-accent text-white font-semibold text-base shadow-lg shadow-primary/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                >
                    <FolderOpen className="w-5 h-5" />
                    {isSelecting ? t.selecting : t.openFolder}
                </motion.button>

                {/* 最近项目 */}
                {recentPaths.length > 0 && (
                    <div className="space-y-3 text-left">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/70 px-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{t.recentProjects}</span>
                        </div>
                        <div className="space-y-1">
                            {recentPaths.slice(0, 5).map((p) => {
                                const name = p.split("/").pop() || p;
                                return (
                                    <button
                                        key={p}
                                        onClick={() => setWorkspace(p)}
                                        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-foreground/80 text-sm transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <FolderOpen className="w-4 h-4 text-primary/70 shrink-0" />
                                            <div className="text-left overflow-hidden">
                                                <div className="font-medium truncate">{name}</div>
                                                <div className="text-xs text-muted-foreground/50 truncate">{p}</div>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors shrink-0" />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
