import { motion } from "framer-motion";

export default function TypingIndicator() {
    return (
        <div className="flex gap-4 px-4 py-6 bg-white/[0.02]">
            <div className="shrink-0 mt-1">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center icon-glow" style={{ boxShadow: 'var(--panel-shadow)' }}>
                    <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="w-4 h-4 rounded-full bg-white/80"
                    />
                </div>
            </div>
            <div className="flex-1 min-w-0 flex items-center">
                <div className="flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
                            transition={{
                                repeat: Infinity,
                                duration: 1.2,
                                delay: i * 0.2,
                                ease: "easeInOut",
                            }}
                            className="w-2 h-2 rounded-full bg-primary/60"
                        />
                    ))}
                    <span className="ml-2 text-sm text-muted-foreground">正在思考…</span>
                </div>
            </div>
        </div>
    );
}
