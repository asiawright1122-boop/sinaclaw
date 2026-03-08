import {
    Bot, Code, PenTool, Headphones, Globe, BarChart3, FileText,
    Search, Lightbulb, Wrench, Cpu, User, Sparkles, type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
    bot: Bot,
    code: Code,
    "pen-tool": PenTool,
    headphones: Headphones,
    globe: Globe,
    "bar-chart": BarChart3,
    "file-text": FileText,
    search: Search,
    lightbulb: Lightbulb,
    wrench: Wrench,
    cpu: Cpu,
    user: User,
    sparkles: Sparkles,
};

interface AgentAvatarProps {
    avatar: string;
    size?: number;
    className?: string;
}

export default function AgentAvatar({ avatar, size = 20, className = "" }: AgentAvatarProps) {
    const Icon = ICON_MAP[avatar] || Bot;
    return <Icon style={{ width: size, height: size }} className={className} />;
}
