import { useRef, useEffect } from "react";
import { Settings, Trash2, Pin, Archive } from "lucide-react";
import { useChatStore } from "@/store/chatStore";
import { translations } from "@/lib/i18n";
import { useSettingsStore } from "@/store/settingsStore";

interface ContextMenuState {
    id: string;
    x: number;
    y: number;
}

interface SidebarContextMenuProps {
    contextMenu: ContextMenuState;
    onClose: () => void;
    onStartRename: (id: string, title: string) => void;
}

export default function SidebarContextMenu({ contextMenu, onClose, onStartRename }: SidebarContextMenuProps) {
    const language = useSettingsStore((s) => s.language);
    const t = translations[language];
    const { conversations, pinConversation, archiveConversation, deleteConversation } = useChatStore();
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [onClose]);

    const conv = conversations.find(c => c.id === contextMenu.id);

    return (
        <div
            ref={menuRef}
            className="fixed z-[100] bg-card dark:bg-card border border-border/60 dark:border-white/[0.08] rounded-xl py-1.5 min-w-[140px]"
            style={{ left: contextMenu.x, top: contextMenu.y, boxShadow: 'var(--panel-shadow)' }}
        >
            <button
                onClick={() => { pinConversation(contextMenu.id, !conv?.pinned); onClose(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-foreground/80 hover:bg-muted/50 transition-colors"
            >
                <Pin className="w-3.5 h-3.5" />
                {conv?.pinned ? t.sidebar.unpin : t.sidebar.pinned}
            </button>
            <button
                onClick={() => { archiveConversation(contextMenu.id); onClose(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-foreground/80 hover:bg-muted/50 transition-colors"
            >
                <Archive className="w-3.5 h-3.5" />
                {t.sidebar.archive}
            </button>
            <button
                onClick={() => { onStartRename(contextMenu.id, conv?.title ?? ""); onClose(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-foreground/80 hover:bg-muted/50 transition-colors"
            >
                <Settings className="w-3.5 h-3.5" />
                {t.sidebar.rename}
            </button>
            <div className="h-px bg-border/40 my-1 mx-1" />
            <button
                onClick={() => { deleteConversation(contextMenu.id); onClose(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
                <Trash2 className="w-3.5 h-3.5" />
                {t.sidebar.delete}
            </button>
        </div>
    );
}
