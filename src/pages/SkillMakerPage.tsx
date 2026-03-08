import { useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { Sparkles, ArrowLeft, Check } from "lucide-react";
import { useSettingsStore } from "@/store/settingsStore";
import { translations } from "@/lib/i18n";
import { skillManager } from "@/lib/skills";
import { BaseDirectory, writeTextFile, exists, mkdir } from "@tauri-apps/plugin-fs";
import SkillDescribeStep from "@/components/skillmaker/SkillDescribeStep";
import SkillPreviewStep from "@/components/skillmaker/SkillPreviewStep";
import SkillDeployStep from "@/components/skillmaker/SkillDeployStep";

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

    const { apiKey, provider, model, language } = useSettingsStore();
    const t = translations[language].skillMaker;

    const STEPS: { id: Step; label: string }[] = [
        { id: "describe", label: t.stepConcept },
        { id: "preview", label: t.stepSchema },
        { id: "deploy", label: t.stepDeploy },
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
        } catch (e: unknown) {
            console.error("生成失败:", e);
            alert(`Generation failed: ${e instanceof Error ? e.message : String(e)}`);
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
        } catch (e: unknown) {
            console.error("部署失败:", e);
            setDeployStatus("error");
        }
    }, [editableJson]);

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
                            <SkillDescribeStep
                                description={description}
                                onDescriptionChange={setDescription}
                                onGenerate={handleGenerate}
                                isGenerating={isGenerating}
                                hasApiKey={!!apiKey}
                                t={t}
                            />
                        )}
                        {step === "preview" && (
                            <SkillPreviewStep
                                editableJson={editableJson}
                                onJsonChange={setEditableJson}
                                onBack={() => setStep("describe")}
                                onDeploy={() => setStep("deploy")}
                                t={t}
                            />
                        )}
                        {step === "deploy" && (
                            <SkillDeployStep
                                deployStatus={deployStatus}
                                deployedName={deployedName}
                                onDeploy={handleDeploy}
                                onBackToPreview={() => setStep("preview")}
                                onFinish={onBack || handleReset}
                                onReturnEditor={() => { setDeployStatus("idle"); setStep("preview"); }}
                                hasOnBack={!!onBack}
                                t={t}
                            />
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
