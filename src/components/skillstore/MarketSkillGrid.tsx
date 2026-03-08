import { Check, Loader2, Download } from "lucide-react";
import type { RemoteSkill } from "@/lib/skillRegistry";
import IconById from "@/components/ui/IconById";

interface MarketSkillGridProps {
    skills: RemoteSkill[];
    searchQuery: string;
    installedIds: Set<string>;
    installingId: string | null;
    onInstall: (skill: RemoteSkill) => void;
    nameMap: Record<string, string>;
    descMap: Record<string, string>;
    officialExchangeLabel: string;
}

export default function MarketSkillGrid({
    skills,
    searchQuery,
    installedIds,
    installingId,
    onInstall,
    nameMap,
    descMap,
    officialExchangeLabel,
}: MarketSkillGridProps) {
    const filtered = skills.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div>
            <h3 className="text-[11px] font-semibold text-muted-foreground dark:text-muted-foreground tracking-widest uppercase mb-4 px-1 flex items-center gap-2">
                {officialExchangeLabel} <span className="lowercase opacity-70">({skills.length})</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map(skill => (
                    <div key={skill.id} className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-4.5 flex flex-col hover:border-border/80 dark:hover:border-white/[0.12] transition-all duration-150 relative group" style={{ boxShadow: 'var(--panel-shadow)' }}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-9 h-9 rounded-lg bg-primary/[0.06] dark:bg-primary/10 border border-border/40 flex items-center justify-center text-lg shrink-0">
                                <IconById id={skill.icon || 'pkg'} size={20} />
                            </div>
                            <div className="overflow-hidden">
                                <h4 className="font-semibold text-[13px] truncate text-foreground">{nameMap[skill.id] || skill.name}</h4>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-widest font-medium mt-0.5">
                                    <span>{skill.author}</span>
                                    <span>·</span>
                                    <span>v{skill.version}</span>
                                </div>
                            </div>
                        </div>
                        <p className="text-[12px] text-muted-foreground line-clamp-2 leading-relaxed flex-1 mb-3">
                            {descMap[skill.id] || skill.description}
                        </p>
                        {skill.trigger && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-500 font-mono mb-3 self-start">
                                {skill.trigger.type}: {skill.trigger.pattern.slice(0, 30)}
                            </span>
                        )}

                        <button
                            onClick={() => onInstall(skill)}
                            disabled={installedIds.has(skill.id) || installingId === skill.id}
                            className={`w-full py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150 ${installedIds.has(skill.id)
                                ? 'bg-muted border border-border/40 text-muted-foreground cursor-default'
                                : installingId === skill.id
                                    ? 'bg-muted border border-border/40 text-muted-foreground cursor-wait'
                                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                }`}
                        >
                            {installedIds.has(skill.id) ? (
                                <span className="flex items-center justify-center gap-1.5"><Check className="w-3.5 h-3.5" /> Installed</span>
                            ) : installingId === skill.id ? (
                                <span className="flex items-center justify-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Fetching...</span>
                            ) : (
                                <span className="flex items-center justify-center gap-1.5"><Download className="w-3.5 h-3.5" /> Install</span>
                            )}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
