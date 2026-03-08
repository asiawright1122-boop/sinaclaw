interface GatewayInfoCardProps {
    icon: React.ElementType;
    label: string;
    value: string;
    sub?: string;
}

export default function GatewayInfoCard({ icon: Icon, label, value, sub }: GatewayInfoCardProps) {
    return (
        <div className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-4 space-y-1" style={{ boxShadow: 'var(--panel-shadow)' }}>
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Icon className="w-3.5 h-3.5" />
                {label}
            </div>
            <div className="text-lg font-semibold text-foreground truncate">{value}</div>
            {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        </div>
    );
}
