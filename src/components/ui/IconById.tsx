import {
    MessageSquare, Send, Hash, Gamepad2, Shield, Apple, Phone,
    Link, Radio, Bird, Square, Globe, Tv, Diamond, Cloud,
    Package, HardDrive, Settings, Lock, AlertTriangle, Calendar,
    Bug, Wrench, Search, Image, FileText, Microscope, Puzzle,
    FolderOpen, Box, type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
    // Channel icons
    whatsapp: MessageSquare,
    telegram: Send,
    slack: Hash,
    discord: Gamepad2,
    googlechat: MessageSquare,
    signal: Shield,
    bluebubbles: Apple,
    imessage: Phone,
    msteams: Square,
    matrix: Link,
    irc: Radio,
    feishu: Bird,
    line: Square,
    mattermost: MessageSquare,
    nostr: Globe,
    twitch: Tv,
    zalo: Diamond,
    nextcloud: Cloud,
    synology: HardDrive,
    webchat: Globe,
    msg: MessageSquare,

    // Cloud provider icons
    drive: FolderOpen,
    cloud: Cloud,
    box: Box,

    // Scanner health icons
    gear: Settings,
    folder: FolderOpen,
    lock: Lock,
    alert: AlertTriangle,
    calendar: Calendar,
    crab: Bug,
    snake: Bug,

    // Skill icons
    wrench: Wrench,
    search: Search,
    image: Image,
    file: FileText,
    microscope: Microscope,
    puzzle: Puzzle,
    pkg: Package,
};

interface IconByIdProps {
    id: string;
    size?: number;
    className?: string;
}

export default function IconById({ id, size = 16, className = "" }: IconByIdProps) {
    const Icon = ICON_MAP[id] || MessageSquare;
    return <Icon style={{ width: size, height: size }} className={className} />;
}
