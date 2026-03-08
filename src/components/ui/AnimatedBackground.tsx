

export default function AnimatedBackground() {
    return (
        <div className="fixed inset-0 z-[-1] overflow-hidden bg-background">
            {/* Base Grid Texture for a mechanical/tech feel combined with glass */}
            <div
                className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02]"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }}
            />

            {/* Animated Blobs / Orbs */}
            <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-primary/10 dark:bg-primary/15 blur-[150px] rounded-full animate-blob" />
            <div
                className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-blue-400/8 dark:bg-indigo-500/12 blur-[150px] rounded-full animate-blob"
                style={{ animationDelay: '2s' }}
            />
            <div
                className="absolute top-1/4 left-1/4 w-1/3 h-1/3 bg-violet-400/6 dark:bg-violet-500/10 blur-[120px] rounded-full animate-blob"
                style={{ animationDelay: '4s' }}
            />

            {/* Subtle Noise overlay for premium texture */}
            <div
                className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03] mix-blend-overlay pointer-events-none"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                }}
            />
        </div>
    );
}
