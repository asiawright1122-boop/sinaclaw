import { useState } from "react";
import { Trash2, Pin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useChatStore } from "@/store/chatStore";

interface Conversation {
    id: string;
    title: string;
    pinned?: boolean;
}

interface SidebarConvItemProps {
    conv: Conversation;
    isActive: boolean;
    onContextMenu: (id: string, x: number, y: number) => void;
}

export default function SidebarConvItem({ conv, isActive, onContextMenu }: SidebarConvItemProps) {
    const navigate = useNavigate();
    const { setActiveConversation, deleteConversation, renameConversation } = useChatStore();
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState("");

    return (
        <div
            className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-[13px] transition-all duration-200 cursor-pointer group active:scale-[0.98] ${isActive
                ? "bg-secondary/60 text-foreground font-medium"
                : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                }`}
            onClick={() => { setActiveConversation(conv.id); navigate("/"); }}
            onDoubleClick={() => {
                setIsEditing(true);
                setEditTitle(conv.title);
            }}
            onContextMenu={(e) => {
                e.preventDefault();
                onContextMenu(conv.id, e.clientX, e.clientY);
            }}
        >
            <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                {conv.pinned && <Pin className="w-3 h-3 text-primary/60 shrink-0" />}
                {isEditing ? (
                    <input
                        className="bg-transparent border-b border-primary outline-none text-foreground text-[13px] w-full py-0.5"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && editTitle.trim()) {
                                renameConversation(conv.id, editTitle.trim());
                                setIsEditing(false);
                            } else if (e.key === "Escape") {
                                setIsEditing(false);
                            }
                        }}
                        onBlur={() => {
                            if (editTitle.trim() && editTitle !== conv.title) {
                                renameConversation(conv.id, editTitle.trim());
                            }
                            setIsEditing(false);
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <span className="truncate">{conv.title}</span>
                )}
            </div>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conv.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors shrink-0"
                title="Delete"
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}
