import { useState, useRef, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TooltipProps {
    children: ReactNode;
    content: string;
    shortcut?: string;
    side?: "top" | "bottom";
    delay?: number;
}

export default function Tooltip({ children, content, shortcut, side = "top", delay = 400 }: TooltipProps) {
    const [visible, setVisible] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const show = useCallback(() => {
        timerRef.current = setTimeout(() => setVisible(true), delay);
    }, [delay]);

    const hide = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setVisible(false);
    }, []);

    const yOffset = side === "top" ? 4 : -4;

    return (
        <div className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
            {children}
            <AnimatePresence>
                {visible && (
                    <motion.div
                        initial={{ opacity: 0, y: yOffset, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: yOffset, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute left-1/2 -translate-x-1/2 z-[200] pointer-events-none ${
                            side === "top" ? "bottom-full mb-2" : "top-full mt-2"
                        }`}
                    >
                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-foreground text-background text-[11px] font-semibold whitespace-nowrap shadow-lg">
                            <span>{content}</span>
                            {shortcut && (
                                <kbd className="px-1.5 py-0.5 rounded bg-background/15 text-[10px] font-mono tracking-wider">
                                    {shortcut}
                                </kbd>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
