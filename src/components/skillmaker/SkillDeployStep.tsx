import { motion } from "framer-motion";
import { Rocket, ArrowLeft, Save, Check, Loader2 } from "lucide-react";

type DeployStatus = "idle" | "saving" | "done" | "error";

interface SkillDeployStepProps {
    deployStatus: DeployStatus;
    deployedName: string;
    onDeploy: () => void;
    onBackToPreview: () => void;
    onFinish: () => void;
    onReturnEditor: () => void;
    hasOnBack: boolean;
    t: {
        finalizeTitle: string;
        finalizeDesc: string;
        btnInstall: string;
        btnCancel: string;
        deployStatusSecuring: string;
        deployTitleSuccess: string;
        deployDescSuccess: string;
        btnReturnMarket: string;
        btnCreateAnother: string;
        btnRestart: string;
        deployException: string;
        deployExceptionDesc: string;
        btnReturnEditor: string;
    };
}

export default function SkillDeployStep({
    deployStatus,
    deployedName,
    onDeploy,
    onBackToPreview,
    onFinish,
    onReturnEditor,
    hasOnBack,
    t,
}: SkillDeployStepProps) {
    return (
        <motion.div
            key="deploy"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-md mx-auto"
        >
            <div className="bg-white/80 dark:bg-white/[0.04] backdrop-blur-2xl rounded-[1.75rem] overflow-hidden shadow-[0_4px_30px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_30px_rgba(0,0,0,0.4)] ring-1 ring-black/[0.04] dark:ring-white/[0.06] p-12 flex flex-col items-center text-center">

                {deployStatus === "idle" && (
                    <div className="w-full space-y-8 flex flex-col items-center">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/5 ring-1 ring-primary/10 flex items-center justify-center">
                            <Save className="w-8 h-8 text-primary/70" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight">{t.finalizeTitle}</h2>
                            <p className="text-[14px] text-muted-foreground/80 mt-3 leading-relaxed">
                                {t.finalizeDesc}
                            </p>
                        </div>
                        <div className="w-full pt-4 space-y-3">
                            <button
                                onClick={onDeploy}
                                className="w-full flex justify-center items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-primary to-primary/85 text-white hover:from-primary/90 hover:to-primary/75 rounded-xl text-[14px] font-bold transition-all shadow-[0_2px_12px_rgba(8,145,178,0.25)] hover:shadow-[0_4px_20px_rgba(8,145,178,0.35)] hover:-translate-y-0.5 active:translate-y-0"
                            >
                                <Rocket className="w-4 h-4" /> {t.btnInstall}
                            </button>
                            <button
                                onClick={onBackToPreview}
                                className="w-full px-6 py-3 text-[13px] font-semibold text-muted-foreground hover:text-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.06] rounded-xl transition-colors"
                            >
                                {t.btnCancel}
                            </button>
                        </div>
                    </div>
                )}

                {deployStatus === "saving" && (
                    <div className="py-16 space-y-8 flex flex-col items-center">
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/30 rounded-full blur-2xl animate-pulse"></div>
                            <Loader2 className="w-10 h-10 text-primary animate-spin relative z-10" />
                        </div>
                        <p className="text-[12px] text-muted-foreground/70 tracking-[0.15em] uppercase font-bold">{t.deployStatusSecuring}</p>
                    </div>
                )}

                {deployStatus === "done" && (
                    <div className="w-full space-y-8 flex flex-col items-center">
                        <div className="relative">
                            <div className="absolute inset-0 bg-green-500/30 rounded-full blur-2xl animate-pulse"></div>
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500/10 to-green-500/5 ring-1 ring-green-500/20 flex items-center justify-center relative z-10">
                                <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight">{t.deployTitleSuccess}</h2>
                            <p className="text-[14px] text-muted-foreground/80 mt-3 leading-relaxed">
                                <span className="text-foreground font-semibold px-2.5 py-1 bg-primary/[0.06] ring-1 ring-primary/10 rounded-lg mx-1">{deployedName}</span> {t.deployDescSuccess}.
                            </p>
                        </div>
                        <div className="w-full pt-4 space-y-3">
                            <button
                                onClick={onFinish}
                                className="w-full px-6 py-3.5 bg-gradient-to-r from-primary to-primary/85 text-white hover:from-primary/90 hover:to-primary/75 rounded-xl text-[14px] font-bold transition-all shadow-[0_2px_12px_rgba(8,145,178,0.25)] hover:-translate-y-0.5 active:translate-y-0"
                            >
                                {hasOnBack ? t.btnReturnMarket : t.btnCreateAnother}
                            </button>
                            {!hasOnBack && (
                                <button
                                    onClick={onFinish}
                                    className="w-full px-6 py-3 text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {t.btnRestart}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {deployStatus === "error" && (
                    <div className="w-full py-10 space-y-8 flex flex-col items-center">
                        <div className="w-16 h-16 rounded-2xl bg-destructive/[0.06] ring-1 ring-destructive/15 flex items-center justify-center text-destructive text-3xl font-bold">
                            !
                        </div>
                        <div>
                            <p className="text-[17px] text-foreground font-bold">{t.deployException}</p>
                            <p className="text-[13px] text-muted-foreground/70 mt-2">{t.deployExceptionDesc}</p>
                        </div>
                        <button
                            onClick={onReturnEditor}
                            className="w-full mt-2 flex items-center justify-center gap-2 px-6 py-3.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.06] rounded-xl text-[14px] font-semibold text-foreground/70 transition-all ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
                        >
                            <ArrowLeft className="w-4 h-4" /> {t.btnReturnEditor}
                        </button>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
