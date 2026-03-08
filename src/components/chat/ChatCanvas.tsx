import { motion } from "framer-motion";
import { X } from "lucide-react";

interface ChatCanvasProps {
    onClose: () => void;
}

export default function ChatCanvas({ onClose }: ChatCanvasProps) {
    return (
        <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: '50%', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="border-l border-border/60 dark:border-white/[0.08] overflow-hidden"
        >
            <div className="h-full flex flex-col">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 shrink-0">
                    <span className="text-sm font-medium text-foreground">Canvas</span>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex-1 overflow-hidden">
                    <iframe
                        src="http://127.0.0.1:18789/__openclaw__/canvas/"
                        className="w-full h-full border-0"
                        title="Canvas"
                    />
                </div>
            </div>
        </motion.div>
    );
}
