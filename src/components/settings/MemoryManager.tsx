import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Brain, Pencil, Trash2 } from "lucide-react";
import { useTranslate } from "@/lib/i18n";
import { getAllCoreMemories, deleteMemory, updateMemory, type MemoryRow } from "@/lib/db";

type MemoryCategoryFilter = "all" | MemoryRow["category"];

export default function MemoryManager() {
    const t = useTranslate();
    const [memories, setMemories] = useState<MemoryRow[]>([]);
    const [filterCategory, setFilterCategory] = useState<MemoryCategoryFilter>("all");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState("");

    const categories: Array<{ id: MemoryCategoryFilter; label: string }> = [
        { id: "all", label: t.settings.memoryCatAll },
        { id: "preferences", label: t.settings.memoryCatPreferences },
        { id: "contacts", label: t.settings.memoryCatContacts },
        { id: "projects", label: t.settings.memoryCatProjects },
        { id: "learnings", label: t.settings.memoryCatLearnings },
        { id: "tools", label: t.settings.memoryCatTools },
        { id: "custom", label: t.settings.memoryCatCustom },
    ];

    const loadMemories = async () => {
        const mems = await getAllCoreMemories();
        setMemories(mems);
    };

    useEffect(() => {
        loadMemories();
    }, []);

    const filtered = filterCategory === "all"
        ? memories
        : memories.filter((m) => (m.category || "custom") === filterCategory);

    const handleDelete = async (id: string) => {
        await deleteMemory(id);
        await loadMemories();
    };

    const handleSaveEdit = async (id: string) => {
        await updateMemory(id, editContent);
        setEditingId(null);
        await loadMemories();
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
        >
            <motion.section
                className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-6 space-y-5"
                style={{ boxShadow: "var(--panel-shadow)" }}
            >
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-primary/[0.06] border border-border/50 flex items-center justify-center">
                        <Brain className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-[17px] font-bold">{t.settings.memoryTitle}</h2>
                        <p className="text-[13px] text-muted-foreground mt-0.5">
                            {t.settings.memorySubtitle.replace("{count}", String(memories.length))}
                        </p>
                    </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            onClick={() => setFilterCategory(cat.id)}
                            className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all ${filterCategory === cat.id
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "bg-black/[0.04] dark:bg-white/[0.04] text-muted-foreground hover:bg-black/[0.07] dark:hover:bg-white/[0.07]"
                                }`}
                        >
                            {cat.label}
                            {cat.id !== "all" && (
                                <span className="ml-1 opacity-60">
                                    {memories.filter((m) => (m.category || "custom") === cat.id).length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto no-scrollbar">
                    {filtered.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            {t.settings.memoryEmpty}
                        </div>
                    ) : (
                        filtered.map((mem) => (
                            <div key={mem.id} className="group p-4 rounded-xl border border-border/50 dark:border-white/[0.06] bg-card/60 dark:bg-card/40">
                                {editingId === mem.id ? (
                                    <div className="space-y-2">
                                        <textarea
                                            value={editContent}
                                            onChange={(e) => setEditContent(e.target.value)}
                                            className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg px-3 py-2 text-[13px] resize-none min-h-[60px] outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20 transition-all"
                                        />
                                        <div className="flex gap-2 justify-end">
                                            <button
                                                onClick={() => setEditingId(null)}
                                                className="px-3 py-1 text-[12px] rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
                                            >
                                                {t.common.cancel}
                                            </button>
                                            <button
                                                onClick={() => handleSaveEdit(mem.id)}
                                                className="px-3 py-1 text-[12px] rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                                            >
                                                {t.common.save}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-violet-500/15 text-violet-400 font-semibold">
                                                    {categories.find((c) => c.id === (mem.category || "custom"))?.label || t.settings.memoryCatCustom}
                                                </span>
                                                <span className="text-[11px] text-muted-foreground/50">
                                                    {new Date(mem.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <p className="text-[13px] text-foreground/80 leading-relaxed">{mem.content}</p>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                            <button
                                                onClick={() => {
                                                    setEditingId(mem.id);
                                                    setEditContent(mem.content);
                                                }}
                                                className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(mem.id)}
                                                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </motion.section>
        </motion.div>
    );
}
