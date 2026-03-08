import { cn } from "@/lib/utils";

interface SkeletonProps {
    className?: string;
    style?: React.CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
    return (
        <div
            className={cn(
                "animate-pulse rounded-lg bg-black/[0.06] dark:bg-white/[0.06]",
                className
            )}
            style={style}
        />
    );
}

/** 对话列表骨架屏 */
export function ConversationSkeleton({ count = 5 }: { count?: number }) {
    return (
        <div className="space-y-1 px-1">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl">
                    <Skeleton className="w-4 h-4 rounded shrink-0" />
                    <Skeleton className="h-3.5 flex-1 rounded-md" style={{ maxWidth: `${60 + Math.random() * 30}%` }} />
                </div>
            ))}
        </div>
    );
}

/** Agent 卡片骨架屏 */
export function AgentCardSkeleton({ count = 4 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl p-4" style={{ boxShadow: 'var(--panel-shadow)' }}>
                    <div className="flex items-start gap-3">
                        <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-3.5 w-24 rounded-md" />
                            <Skeleton className="h-3 w-full rounded-md" />
                            <div className="flex gap-2 mt-1">
                                <Skeleton className="h-4 w-16 rounded" />
                                <Skeleton className="h-4 w-12 rounded" />
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

/** 知识库文档列表骨架屏 */
export function DocumentSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-card/80 dark:bg-card/50 border border-border/50 dark:border-white/[0.06] rounded-xl" style={{ boxShadow: 'var(--panel-shadow)' }}>
                    <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-40 rounded-md" />
                        <Skeleton className="h-3 w-24 rounded-md" />
                    </div>
                    <Skeleton className="h-8 w-16 rounded-lg shrink-0" />
                </div>
            ))}
        </div>
    );
}
