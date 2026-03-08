import { AtSign } from "lucide-react";
import { useTranslate } from "@/lib/i18n";
import { useAgentStore } from "@/store/agentStore";
import { useChatStore } from "@/store/chatStore";
import AgentAvatar from "@/components/ui/AgentAvatar";

interface ChatMentionDropdownProps {
    mentionFilter: string;
    onClose: () => void;
}

export default function ChatMentionDropdown({ mentionFilter, onClose }: ChatMentionDropdownProps) {
    const t = useTranslate();
    const agents = useAgentStore(state => state.agents);
    const { inputValue, setInputValue } = useChatStore();

    const filtered = agents
        .filter(a => a.role === "primary")
        .filter(a => a.name.toLowerCase().includes(mentionFilter.toLowerCase()));

    return (
        <div className="absolute bottom-full mb-2 left-4 right-4 bg-card dark:bg-card border border-border/60 dark:border-white/[0.08] rounded-xl overflow-hidden z-50 animate-in slide-in-from-bottom-2 duration-200" style={{ boxShadow: 'var(--panel-shadow)' }}>
            <div className="px-3 py-2 border-b border-border/40 flex items-center gap-2">
                <AtSign className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-muted-foreground">{t.chat.selectAgent}</span>
            </div>
            <div className="max-h-48 overflow-y-auto">
                {filtered.map(agent => (
                    <button
                        key={agent.id}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors cursor-pointer text-left"
                        onClick={() => {
                            const lastAt = inputValue.lastIndexOf("@");
                            const newVal = inputValue.slice(0, lastAt) + `@${agent.name} `;
                            setInputValue(newVal);
                            onClose();
                        }}
                    >
                        <AgentAvatar avatar={agent.avatar} size={18} className="text-foreground/70" />
                        <div>
                            <div className="text-sm font-semibold text-foreground">{agent.name}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">{agent.description}</div>
                        </div>
                    </button>
                ))}
                {filtered.length === 0 && (
                    <div className="px-4 py-3 text-xs text-muted-foreground text-center">{t.chat.noMatchingAgent}</div>
                )}
            </div>
        </div>
    );
}
