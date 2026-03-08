interface PublishJsonModalProps {
    json: string;
    onCopy: () => void;
    onClose: () => void;
}

export default function PublishJsonModal({ json, onCopy, onClose }: PublishJsonModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-card dark:bg-card rounded-2xl p-6 max-w-lg w-full mx-4 border border-border/60 dark:border-white/[0.08]" style={{ boxShadow: 'var(--panel-shadow)' }} onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-semibold text-foreground mb-1.5">Export Schema</h3>
                <p className="text-[13px] text-muted-foreground mb-5 leading-relaxed">
                    Submit this JSON payload to your designated repository or sharing channel to initiate deployment across the grid.
                </p>
                <div className="relative group">
                    <pre className="bg-black/[0.03] dark:bg-white/[0.03] p-4 rounded-lg text-[11px] font-mono text-foreground/80 overflow-auto max-h-64 mb-5 border border-border/40">
                        {json}
                    </pre>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={onCopy}
                        className="flex-1 py-2 rounded-lg text-[13px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                    >
                        Copy Payload
                    </button>
                    <button
                        onClick={onClose}
                        className="px-5 py-2 rounded-lg text-[13px] text-muted-foreground border border-border/50 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-all"
                    >
                        Dismiss
                    </button>
                </div>
            </div>
        </div>
    );
}
