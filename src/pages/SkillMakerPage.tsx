import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Wand2, Sparkles, Code2, Rocket, ArrowLeft,
    Check, Copy, Loader2, Save
} from "lucide-react";
import { useSettingsStore } from "@/store/settingsStore";
import { translations } from "@/lib/i18n";
import { skillManager } from "@/lib/skills";
import { BaseDirectory, writeTextFile, exists, mkdir } from "@tauri-apps/plugin-fs";

async function callLLMForSkillGen(
    systemPrompt: string,
    userPrompt: string,
    apiKey: string,
    provider: string,
    model: string
): Promise<string> {
    const { callLLMWithTools } = await import("@/lib/agent");
    let fullText = "";
    const result = await callLLMWithTools({
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ],
        apiKey,
        provider,
        model,
        temperature: 0.3,
        maxTokens: 1500,
        onTextChunk: (chunk: string) => { fullText += chunk; },
        onError: (err: string) => { throw new Error(err); },
    });
    return result.content || fullText;
}

type Step = "describe" | "preview" | "deploy";

export default function SkillMakerPage({ onBack }: { onBack?: () => void }) {
    const [step, setStep] = useState<Step>("describe");
    const [description, setDescription] = useState("");
    const [editableJson, setEditableJson] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [deployStatus, setDeployStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
    const [deployedName, setDeployedName] = useState("");
    const [copied, setCopied] = useState(false);

    const { apiKey, provider, model, language } = useSettingsStore();
    const t = translations[language].skillMaker;

    const STEPS: { id: Step; label: string; icon: any }[] = [
        { id: "describe", label: t.stepConcept, icon: Sparkles },
        { id: "preview", label: t.stepSchema, icon: Code2 },
        { id: "deploy", label: t.stepDeploy, icon: Rocket },
    ];

    const handleGenerate = useCallback(async () => {
        if (!description.trim() || !apiKey) return;
        setIsGenerating(true);

        try {
            const systemPrompt = `你是一个 OpenClaw Skill 生成器。用户会描述他们想要的工具功能，你需要生成一个标准的 skill.json。只输出 JSON。格式如下：
{
  "name": "snake_case_name",
  "description": "中文描述",
  "author": "user",
  "version": "1.0.0",
  "icon": "一个合适的 emoji",
  "parameters": {
    "type": "object",
    "properties": {
      "param1": { "type": "string", "description": "描述" }
    },
    "required": ["param1"]
  },
  "execution": {
    "type": "shell",
    "command": "实际要执行的 shell 命令，参数用 {{param1}} 占位"
  }
}`;

            const result = await callLLMForSkillGen(
                systemPrompt,
                `请为我生成一个技能：${description}`,
                apiKey,
                provider,
                model
            );

            let json = result;
            const match = result.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (match) json = match[1].trim();

            JSON.parse(json);
            setEditableJson(json);
            setStep("preview");
        } catch (e: any) {
            console.error("生成失败:", e);
            alert(`Generation failed: ${e.message || e}`);
        } finally {
            setIsGenerating(false);
        }
    }, [description, apiKey, provider, model]);

    const handleDeploy = useCallback(async () => {
        setDeployStatus("saving");
        try {
            const parsed = JSON.parse(editableJson);
            const skillId = parsed.name?.replace(/\s+/g, "-").toLowerCase() || `skill-${Date.now()}`;
            const skillDir = `skills/${skillId}`;

            const dirExists = await exists(skillDir, { baseDir: BaseDirectory.AppData });
            if (!dirExists) {
                await mkdir(skillDir, { baseDir: BaseDirectory.AppData, recursive: true });
            }

            await writeTextFile(
                `${skillDir}/skill.json`,
                JSON.stringify(parsed, null, 2),
                { baseDir: BaseDirectory.AppData }
            );

            await skillManager.init();

            setDeployedName(parsed.name || skillId);
            setDeployStatus("done");
        } catch (e: any) {
            console.error("部署失败:", e);
            setDeployStatus("error");
        }
    }, [editableJson]);

    const handleCopy = () => {
        navigator.clipboard.writeText(editableJson);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleReset = () => {
        setStep("describe");
        setDescription("");
        setEditableJson("");
        setDeployStatus("idle");
        setDeployedName("");
    };

    const currentStepIndex = STEPS.findIndex((s) => s.id === step);

    return (
        <div className="absolute inset-0 z-50 bg-gradient-to-b from-background via-background to-primary/[0.03] overflow-y-auto font-sans selection:bg-primary/20">
            <div className="fixed inset-0 overflow-hidden pointer-events-none isolate z-0">
                <div className="absolute top-[5%] right-[5%] w-[400px] h-[400px] bg-primary/[0.07] rounded-full blur-[120px]" />
                <div className="absolute bottom-[10%] left-[10%] w-[350px] h-[350px] bg-secondary/[0.05] rounded-full blur-[100px]" />
            </div>

            <div className="relative min-h-full flex flex-col max-w-4xl mx-auto px-6 py-12 z-10 w-full text-foreground">
                {/* Top Nav */}
                <div className="flex items-center justify-between mb-16">
                    <div className="flex items-center gap-4">
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                        )}
                        <h1 className="text-lg font-bold tracking-tight flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-sm">
                                <Sparkles className="w-3.5 h-3.5 text-white" />
                            </div>
                            {t.title}
                        </h1>
                    </div>

                    <div className="hidden md:flex items-center gap-1 bg-card/80 dark:bg-card/50 px-2 py-1.5 rounded-xl border border-border/50 dark:border-white/[0.06]">
                        {STEPS.map((s, i) => {
                            const isActive = i === currentStepIndex;
                            const isPast = i < currentStepIndex;
                            return (
                                <div key={s.id} className="flex items-center gap-1">
                                    <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-[12px] font-semibold transition-all duration-300 ${isActive
                                        ? "bg-primary text-white shadow-sm"
                                        : isPast
                                            ? "text-primary"
                                            : "text-muted-foreground/50"
                                        }`}
                                    >
                                        <span className="w-4 h-4 flex items-center justify-center">
                                            {isPast ? <Check className="w-3.5 h-3.5" /> : i + 1}
                                        </span>
                                        {s.label}
                                    </div>
                                    {i < STEPS.length - 1 && (
                                        <div className={`w-5 h-[1.5px] rounded-full mx-0.5 ${isPast ? "bg-primary/40" : "bg-foreground/10"}`} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center w-full">
                    <AnimatePresence mode="wait">
                        {step === "describe" && (
                            <motion.div
                                key="describe"
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                                className="w-full max-w-2xl"
                            >
                                <div className="text-center mb-12 space-y-4">
                                    <h2 className="text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
                                        {t.heroTitle}
                                    </h2>
                                    <p className="text-[15px] text-muted-foreground/80 max-w-lg mx-auto leading-relaxed">
                                        {t.heroDesc}
                                    </p>
                                </div>

                                <div className="group relative">
                                    <div className="absolute -inset-1 bg-gradient-to-br from-primary/15 via-transparent to-secondary/10 rounded-[1.75rem] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
                                    <div className="relative bg-white/80 dark:bg-white/[0.04] backdrop-blur-2xl rounded-[1.5rem] overflow-hidden shadow-[0_2px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_20px_rgba(0,0,0,0.3)] ring-1 ring-black/[0.04] dark:ring-white/[0.06] transition-all group-focus-within:shadow-[0_8px_40px_rgba(8,145,178,0.08)] group-focus-within:ring-primary/20">
                                        <textarea
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder={t.placeholder}
                                            className="w-full h-40 p-7 bg-transparent text-foreground placeholder:text-muted-foreground/40 text-[15px] resize-none focus:outline-none leading-relaxed"
                                            spellCheck={false}
                                        />
                                        <div className="px-7 py-4 bg-gradient-to-r from-black/[0.015] to-transparent dark:from-white/[0.02] flex items-center justify-between border-t border-black/[0.04] dark:border-white/[0.06]">
                                            <span className="text-[11px] font-semibold text-muted-foreground/50 tracking-[0.15em] uppercase">{t.inputLabel}</span>
                                            <button
                                                onClick={handleGenerate}
                                                disabled={!description.trim() || !apiKey || isGenerating}
                                                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary to-primary/85 text-white hover:from-primary/90 hover:to-primary/75 rounded-xl text-[13px] font-semibold transition-all duration-300 disabled:opacity-40 disabled:grayscale shadow-[0_2px_12px_rgba(8,145,178,0.25)] hover:shadow-[0_4px_20px_rgba(8,145,178,0.35)] disabled:shadow-none hover:-translate-y-0.5 active:translate-y-0"
                                            >
                                                {isGenerating ? (
                                                    <><Loader2 className="w-4 h-4 animate-spin" /> {t.btnGenerating}</>
                                                ) : (
                                                    <><Wand2 className="w-4 h-4" /> {t.btnGenerate}</>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                {!apiKey && (
                                    <p className="text-center text-[12px] text-destructive/70 mt-6 tracking-wide font-medium bg-destructive/[0.04] py-2.5 rounded-xl w-full ring-1 ring-destructive/10">
                                        {t.reqApiKey}
                                    </p>
                                )}
                            </motion.div>
                        )}

                        {step === "preview" && (
                            <motion.div
                                key="preview"
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                                className="w-full max-w-3xl"
                            >
                                <div className="bg-white/80 dark:bg-white/[0.04] backdrop-blur-2xl rounded-[1.5rem] overflow-hidden shadow-[0_2px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_20px_rgba(0,0,0,0.3)] ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
                                    <div className="px-7 py-4 flex items-center justify-between bg-gradient-to-r from-black/[0.015] to-transparent dark:from-white/[0.02] border-b border-black/[0.04] dark:border-white/[0.06]">
                                        <div className="flex items-center gap-2.5">
                                            <Code2 className="w-4 h-4 text-primary/60" />
                                            <h3 className="text-[13px] font-bold tracking-[0.08em] uppercase text-foreground/70">{t.schemaReview}</h3>
                                        </div>
                                        <button
                                            onClick={handleCopy}
                                            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.06] transition-colors"
                                        >
                                            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                            {copied ? t.copied : t.copySource}
                                        </button>
                                    </div>

                                    <textarea
                                        value={editableJson}
                                        onChange={(e) => setEditableJson(e.target.value)}
                                        className="w-full h-[450px] p-7 bg-transparent font-mono text-[13px] text-foreground/75 resize-none focus:outline-none transition-all leading-loose"
                                        spellCheck={false}
                                    />

                                    <div className="px-7 py-5 bg-gradient-to-r from-black/[0.015] to-transparent dark:from-white/[0.02] border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between">
                                        <button
                                            onClick={() => setStep("describe")}
                                            className="text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors tracking-wide px-5 py-2.5 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
                                        >
                                            {t.reviseConcept}
                                        </button>
                                        <button
                                            onClick={() => {
                                                try {
                                                    JSON.parse(editableJson);
                                                    setStep("deploy");
                                                } catch {
                                                    alert("Invalid JSON format.");
                                                }
                                            }}
                                            className="px-8 py-2.5 bg-gradient-to-r from-primary to-primary/85 text-white hover:from-primary/90 hover:to-primary/75 rounded-xl text-[13px] font-bold tracking-wide transition-all shadow-[0_2px_12px_rgba(8,145,178,0.25)] hover:shadow-[0_4px_20px_rgba(8,145,178,0.35)] hover:-translate-y-0.5 active:translate-y-0"
                                        >
                                            {t.proceedDeploy}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === "deploy" && (
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
                                                    onClick={handleDeploy}
                                                    className="w-full flex justify-center items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-primary to-primary/85 text-white hover:from-primary/90 hover:to-primary/75 rounded-xl text-[14px] font-bold transition-all shadow-[0_2px_12px_rgba(8,145,178,0.25)] hover:shadow-[0_4px_20px_rgba(8,145,178,0.35)] hover:-translate-y-0.5 active:translate-y-0"
                                                >
                                                    <Rocket className="w-4 h-4" /> {t.btnInstall}
                                                </button>
                                                <button
                                                    onClick={() => setStep("preview")}
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
                                                    onClick={onBack || handleReset}
                                                    className="w-full px-6 py-3.5 bg-gradient-to-r from-primary to-primary/85 text-white hover:from-primary/90 hover:to-primary/75 rounded-xl text-[14px] font-bold transition-all shadow-[0_2px_12px_rgba(8,145,178,0.25)] hover:-translate-y-0.5 active:translate-y-0"
                                                >
                                                    {onBack ? t.btnReturnMarket : t.btnCreateAnother}
                                                </button>
                                                {!onBack && (
                                                    <button
                                                        onClick={handleReset}
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
                                                onClick={() => {
                                                    setDeployStatus("idle");
                                                    setStep("preview");
                                                }}
                                                className="w-full mt-2 flex items-center justify-center gap-2 px-6 py-3.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.06] rounded-xl text-[14px] font-semibold text-foreground/70 transition-all ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
                                            >
                                                <ArrowLeft className="w-4 h-4" /> {t.btnReturnEditor}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
