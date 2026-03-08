import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, Search, AlertCircle } from "lucide-react";
import {
    useChannelStore,
    CHANNEL_DEFINITIONS,
    type ChannelDef,
    type ChannelInstance,
} from "@/store/channelStore";
import { useGatewayStore } from "@/store/gatewayStore";
import { useTranslate } from "@/lib/i18n";
import ChannelCard from "@/components/channels/ChannelCard";
import ChannelConfigPanel from "@/components/channels/ChannelConfigPanel";

export default function ChannelsPage() {
    const t = useTranslate();
    const { channels, startMonitoring } = useChannelStore();
    const { status: gwStatus } = useGatewayStore();
    const [search, setSearch] = useState("");
    const [selectedChannel, setSelectedChannel] = useState<ChannelDef | null>(null);

    useEffect(() => {
        const unlisten = startMonitoring();
        return unlisten;
    }, []);

    const gwRunning = gwStatus?.running ?? false;

    const filtered = CHANNEL_DEFINITIONS.filter(
        (d) =>
            d.name.toLowerCase().includes(search.toLowerCase()) ||
            d.id.toLowerCase().includes(search.toLowerCase()) ||
            d.description.includes(search)
    );

    const getInstance = (channelId: string): ChannelInstance | undefined => {
        return channels.find((c) => c.channelId === channelId);
    };

    const connectedCount = channels.filter((c) => c.status === "connected").length;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 overflow-y-auto p-6 space-y-6"
        >
            {/* 标题 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/[0.06] border border-border/50 flex items-center justify-center">
                        <Radio className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-foreground">{t.channels.title}</h1>
                        <p className="text-xs text-muted-foreground">
                            {t.channels.subtitle.replace('{count}', String(CHANNEL_DEFINITIONS.length))}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                        {t.channels.connectedCount.replace('{count}', String(connectedCount))}
                    </span>
                    {!gwRunning && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <AlertCircle className="w-3 h-3" />
                            {t.channels.gwNotRunning}
                        </span>
                    )}
                </div>
            </div>

            {/* 搜索 */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={`${t.channels.title}...`}
                    className="w-full bg-black/[0.03] dark:bg-white/[0.04] border border-border/50 dark:border-white/[0.06] rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
                />
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* 通道列表 */}
                <div className={`space-y-2 ${selectedChannel ? "lg:w-1/2" : "w-full"} transition-all`}>
                    <div className="grid grid-cols-1 gap-2">
                        {filtered.map((def) => (
                            <ChannelCard
                                key={def.id}
                                def={def}
                                instance={getInstance(def.id)}
                                onClick={() => setSelectedChannel(def)}
                            />
                        ))}
                    </div>
                    {filtered.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground text-sm">
                            {t.channels.emptyChannelsDesc}
                        </div>
                    )}
                </div>

                {/* 配置面板 */}
                <AnimatePresence mode="wait">
                    {selectedChannel && (
                        <div className="w-full lg:w-1/2 lg:sticky lg:top-0">
                            <ChannelConfigPanel
                                key={selectedChannel.id}
                                def={selectedChannel}
                                instance={getInstance(selectedChannel.id)}
                                onClose={() => setSelectedChannel(null)}
                            />
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
