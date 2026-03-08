import { getCurrentWindow } from "@tauri-apps/api/window";
import { useMemo } from "react";

export default function TitleBar() {
    const isMac = useMemo(() => navigator.userAgent.includes("Mac"), []);

    const appWindow = getCurrentWindow();
    const handleClose = () => appWindow.close();
    const handleMinimize = () => appWindow.minimize();
    const handleMaximize = () => appWindow.toggleMaximize();

    return (
        <div
            data-tauri-drag-region
            className="titlebar px-5 bg-transparent select-none z-50"
        >
            {/* macOS 红绿灯 (左侧) */}
            {isMac ? (
                <div className="flex items-center space-x-2 pointer-events-none mt-1">
                    <div onClick={handleClose} className="w-3 h-3 rounded-full bg-[#FF5F56] border border-black/10 hover:bg-[#FF5F56]/80 transition-colors pointer-events-auto cursor-pointer" />
                    <div onClick={handleMinimize} className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-black/10 hover:bg-[#FFBD2E]/80 transition-colors pointer-events-auto cursor-pointer" />
                    <div onClick={handleMaximize} className="w-3 h-3 rounded-full bg-[#27C93F] border border-black/10 hover:bg-[#27C93F]/80 transition-colors pointer-events-auto cursor-pointer" />
                </div>
            ) : <div className="w-12" />}

            <div className="text-[13px] font-semibold tracking-wide text-foreground/40 pointer-events-none">
                Sinaclaw
            </div>

            {/* Windows 窗口按钮 (右侧) */}
            {!isMac ? (
                <div className="flex items-center space-x-1 pointer-events-auto">
                    <button onClick={handleMinimize} className="w-8 h-7 flex items-center justify-center rounded hover:bg-muted/50 transition-colors text-foreground/60 hover:text-foreground text-sm">─</button>
                    <button onClick={handleMaximize} className="w-8 h-7 flex items-center justify-center rounded hover:bg-muted/50 transition-colors text-foreground/60 hover:text-foreground text-sm">□</button>
                    <button onClick={handleClose} className="w-8 h-7 flex items-center justify-center rounded hover:bg-red-500 hover:text-white transition-colors text-foreground/60 text-sm">✕</button>
                </div>
            ) : <div className="flex items-center w-12" />}
        </div>
    );
}
