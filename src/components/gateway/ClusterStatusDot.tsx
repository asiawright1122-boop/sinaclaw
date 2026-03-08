import type { GatewayEndpoint } from "@/lib/remoteGateway";

interface ClusterStatusDotProps {
    status: GatewayEndpoint["status"];
}

export default function ClusterStatusDot({ status }: ClusterStatusDotProps) {
    const colors: Record<string, string> = {
        online: "bg-emerald-500 shadow-emerald-500/40",
        offline: "bg-muted-foreground/30",
        connecting: "bg-amber-500 animate-pulse shadow-amber-500/40",
        error: "bg-red-500 shadow-red-500/40",
    };
    return <span className={`w-2.5 h-2.5 rounded-full shadow-sm ${colors[status] || colors.offline}`} />;
}
