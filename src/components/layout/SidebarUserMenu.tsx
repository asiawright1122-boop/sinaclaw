import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Languages, Moon, Crown, BookText, Info, LogOut, ChevronRight, ChevronLeft, Sun, Monitor, Check } from "lucide-react";
import { useSettingsStore } from "@/store/settingsStore";
import { translations } from "@/lib/i18n";

export default function SidebarUserMenu() {
    const { theme, language, setTheme, setLanguage } = useSettingsStore();
    const t = translations[language];

    const [isOpen, setIsOpen] = useState(false);
    const [menuView, setMenuView] = useState<"main" | "language" | "theme">("main");
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setMenuView("main");
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="mt-2 relative" ref={menuRef}>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="absolute bottom-full left-0 w-full mb-3 bg-card dark:bg-card border border-border/60 dark:border-white/[0.08] rounded-xl p-2 py-3 overflow-hidden z-50 origin-bottom" style={{ boxShadow: 'var(--panel-shadow)' }}
                    >
                        <div className="overflow-hidden">
                            <AnimatePresence mode="wait">
                                {menuView === "main" && (
                                    <motion.div
                                        key="main"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="space-y-1"
                                    >
                                        {([
                                            { icon: Languages, label: t.sidebar.language, hasArrow: true, view: "language" },
                                            { icon: Moon, label: t.sidebar.theme, hasArrow: true, view: "theme" },
                                        ] as const).map((item, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setMenuView(item.view)}
                                                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] font-medium text-foreground/80 hover:bg-muted/40 hover:text-foreground transition-all duration-200"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <item.icon className="w-4 h-4" />
                                                    <span>{item.label}</span>
                                                </div>
                                                {item.hasArrow && <ChevronRight className="w-3.5 h-3.5 opacity-40" />}
                                            </button>
                                        ))}

                                        <div className="h-px bg-border/40 my-2 mx-1" />

                                        {[
                                            { icon: Crown, label: t.sidebar.plan },
                                            { icon: BookText, label: t.sidebar.docs },
                                            { icon: Info, label: t.sidebar.aboutUs },
                                        ].map((item, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setIsOpen(false)}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-foreground/80 hover:bg-muted/40 hover:text-foreground transition-all duration-200"
                                            >
                                                <item.icon className="w-4 h-4" />
                                                <span>{item.label}</span>
                                            </button>
                                        ))}

                                        <div className="h-px bg-border/40 my-2 mx-1" />

                                        <button
                                            onClick={() => setIsOpen(false)}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
                                        >
                                            <LogOut className="w-4 h-4" />
                                            <span>{t.sidebar.logout}</span>
                                        </button>
                                    </motion.div>
                                )}

                                {menuView === "language" && (
                                    <motion.div
                                        key="language"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="space-y-1"
                                    >
                                        <button
                                            onClick={() => setMenuView("main")}
                                            className="w-full flex items-center gap-3 px-3 py-2 mb-2 text-[12px] font-bold text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                            <span>{t.common.back}</span>
                                        </button>
                                        {([
                                            { id: "zh", label: "简体中文" },
                                            { id: "en", label: "English" }
                                        ] as const).map((lang) => (
                                            <button
                                                key={lang.id}
                                                onClick={() => setLanguage(lang.id)}
                                                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] font-medium text-foreground/80 hover:bg-muted/40 transition-all duration-200"
                                            >
                                                <span>{lang.label}</span>
                                                {language === lang.id && <Check className="w-4 h-4 text-primary" />}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}

                                {menuView === "theme" && (
                                    <motion.div
                                        key="theme"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="space-y-1"
                                    >
                                        <button
                                            onClick={() => setMenuView("main")}
                                            className="w-full flex items-center gap-3 px-3 py-2 mb-2 text-[12px] font-bold text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                            <span>{t.common.back}</span>
                                        </button>
                                        {([
                                            { id: "light", label: t.sidebar.light, icon: Sun },
                                            { id: "dark", label: t.sidebar.dark, icon: Moon },
                                            { id: "system", label: t.sidebar.system, icon: Monitor }
                                        ] as const).map((mode) => (
                                            <button
                                                key={mode.id}
                                                onClick={() => setTheme(mode.id)}
                                                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] font-medium text-foreground/80 hover:bg-muted/40 transition-all duration-200"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <mode.icon className="w-4 h-4" />
                                                    <span>{mode.label}</span>
                                                </div>
                                                {theme === mode.id && <Check className="w-4 h-4 text-primary" />}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`p-2 rounded-xl border transition-all duration-200 cursor-pointer group flex items-center gap-2.5 ${isOpen
                    ? "bg-black/[0.04] dark:bg-white/[0.06] border-primary/20"
                    : "bg-transparent border-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                    }`}
            >
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-sm font-semibold text-white shrink-0">
                    K
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-semibold text-foreground truncate">Kaka wah</span>
                    <span className="text-[10px] text-muted-foreground truncate">Pro trial Plan</span>
                </div>
            </div>
        </div>
    );
}
