import { Terminal, ArrowUpRight } from "lucide-react";
import type { LoadedSkill } from "@/lib/skills";
import { exportSkillForPublish } from "@/lib/skillRegistry";
import IconById from "@/components/ui/IconById";

interface LocalSkillGridProps {
    skills: LoadedSkill[];
    onToggle: (skillId: string, currentEnabled: boolean) => void;
    onExport: (json: string) => void;
    onExportError: (msg: string) => void;
    t: {
        other: string;
        empty: string;
        emptyDesc: string;
    };
    exportFailedTemplate: string;
}

export default function LocalSkillGrid({ skills, onToggle, onExport, onExportError, t, exportFailedTemplate }: LocalSkillGridProps) {
    return (
        <div>
            <h3 className="text-[11px] font-semibold text-muted-foreground dark:text-muted-foreground tracking-widest uppercase mb-4 px-1 flex items-center gap-2">
                {t.other} <span className="lowercase opacity-70">({skills.length})</span>
            </h3>
            {skills.length === 0 ? (
                <div className="border border-dashed border-border rounded-2xl p-12 flex flex-col items-center justify-center text-center bg-transparent">
                    <div className="w-12 h-12 rounded-full border border-border flex items-center justify-center mb-4">
                        <Terminal className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <h4 className="text-[14px] font-medium text-foreground tracking-wide mb-1">{t.empty}</h4>
                    <p className="text-[13px] text-muted-foreground max-w-sm font-light mt-2">
                        {t.emptyDesc}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {skills.map(skill => (
                        <div key={skill.id} className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-4.5 flex flex-col hover:border-border/80 dark:hover:border-white/[0.12] transition-all duration-150 group" style={{ boxShadow: 'var(--panel-shadow)' }}>
                            <div className="flex items-center justify-between mb-3 text-foreground">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className={`w-9 h-9 rounded-lg bg-primary/[0.06] dark:bg-primary/10 flex items-center justify-center shrink-0 border border-border/40 ${!skill.enabled ? 'grayscale opacity-60' : ''}`}>
                                        <IconById id={skill.definition.icon || 'wrench'} size={20} />
                                    </div>
                                    <h4 className={`font-semibold text-[13px] truncate ${!skill.enabled ? 'text-muted-foreground' : ''}`}>
                                        {skill.definition.name}
                                    </h4>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggle(skill.id, skill.enabled);
                                    }}
                                    className={`w-10 h-5 rounded-full shrink-0 relative transition-colors duration-200 ${skill.enabled ? 'bg-primary' : 'bg-muted'}`}
                                >
                                    <div className={`absolute top-0.5 w-4 h-4 bg-card dark:bg-card rounded-full transition-transform duration-300 shadow-sm ${skill.enabled ? 'translate-x-5' : 'translate-x-0.5'}`}>
                                    </div>
                                </button>
                            </div>
                            <p className={`text-[12px] line-clamp-2 leading-relaxed flex-1 ${skill.enabled ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                                {skill.definition.description}
                            </p>
                            <button
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                        const { registryEntry } = await exportSkillForPublish(skill.id);
                                        onExport(JSON.stringify(registryEntry, null, 2));
                                    } catch (err) {
                                        onExportError(exportFailedTemplate.replace('{error}', err instanceof Error ? err.message : String(err)));
                                    }
                                }}
                                className="mt-3 w-full py-1.5 rounded-lg text-[11px] font-medium bg-black/[0.03] dark:bg-white/[0.04] text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors duration-150 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5"
                            >
                                <ArrowUpRight className="w-3.5 h-3.5" /> Share / Export
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
