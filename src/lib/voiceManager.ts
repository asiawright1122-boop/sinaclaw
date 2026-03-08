/**
 * Voice Manager — 语音输入/输出管理
 *
 * 核心能力：
 * 1. 麦克风录音 → Whisper API 转写（云端/本地）
 * 2. TTS 语音合成（OpenAI TTS / ElevenLabs / 系统 TTS）
 * 3. VoiceWake 集成（通过 Gateway）
 */

import { openclawBridge } from "@/lib/openclawBridge";

// ── 类型定义 ──

export type STTProvider = "openai" | "local_whisper";
export type TTSProvider = "openai" | "elevenlabs" | "system";
export type TTSVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

export interface VoiceConfig {
    sttProvider: STTProvider;
    ttsProvider: TTSProvider;
    ttsVoice: TTSVoice;
    ttsSpeed: number; // 0.25 - 4.0
    autoPlayTTS: boolean;
    voiceWakeEnabled: boolean;
    voiceWakePhrase: string;
}

export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
    sttProvider: "openai",
    ttsProvider: "system",
    ttsVoice: "nova",
    ttsSpeed: 1.0,
    autoPlayTTS: false,
    voiceWakeEnabled: false,
    voiceWakePhrase: "hey openclaw",
};

// ── 录音管理 ──

let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let recordingStream: MediaStream | null = null;

export async function startRecording(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordingStream = stream;
    audioChunks = [];

    mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus"
            : "audio/webm",
    });

    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.start(100); // 每100ms收集一次数据
}

export async function stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
        if (!mediaRecorder) {
            reject(new Error("未在录音"));
            return;
        }

        mediaRecorder.onstop = () => {
            const blob = new Blob(audioChunks, { type: "audio/webm" });
            // 清理流
            if (recordingStream) {
                recordingStream.getTracks().forEach((t) => t.stop());
                recordingStream = null;
            }
            mediaRecorder = null;
            audioChunks = [];
            resolve(blob);
        };

        mediaRecorder.stop();
    });
}

export function isRecording(): boolean {
    return mediaRecorder?.state === "recording";
}

// ── STT: 语音转文字 ──

export async function transcribeAudio(
    audioBlob: Blob,
    apiKey: string,
    provider: STTProvider = "openai"
): Promise<string> {
    if (provider === "local_whisper") {
        return transcribeLocal(audioBlob);
    }
    return transcribeOpenAI(audioBlob, apiKey);
}

async function transcribeOpenAI(audioBlob: Blob, apiKey: string): Promise<string> {
    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");
    formData.append("model", "whisper-1");
    formData.append("language", "zh");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Whisper API 错误: ${res.status} — ${err}`);
    }

    const data = await res.json();
    return data.text || "";
}

async function transcribeLocal(audioBlob: Blob): Promise<string> {
    // 通过本地 Whisper 服务（127.0.0.1:9000）
    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");

    const res = await fetch("http://127.0.0.1:9000/v1/audio/transcriptions", {
        method: "POST",
        body: formData,
    });

    if (!res.ok) throw new Error(`本地 Whisper 错误: ${res.status}`);
    const data = await res.json();
    return data.text || "";
}

// ── TTS: 文字转语音 ──

let currentAudio: HTMLAudioElement | null = null;

export async function speak(
    text: string,
    config: Pick<VoiceConfig, "ttsProvider" | "ttsVoice" | "ttsSpeed">,
    apiKey?: string
): Promise<void> {
    // 停止正在播放的音频
    stopSpeaking();

    if (config.ttsProvider === "system") {
        return speakSystem(text, config.ttsSpeed);
    }
    if (config.ttsProvider === "openai" && apiKey) {
        return speakOpenAI(text, config.ttsVoice, config.ttsSpeed, apiKey);
    }
    if (config.ttsProvider === "elevenlabs" && apiKey) {
        return speakElevenLabs(text, apiKey);
    }

    // 回退到系统 TTS
    return speakSystem(text, config.ttsSpeed);
}

export function stopSpeaking(): void {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    speechSynthesis.cancel();
}

export function isSpeaking(): boolean {
    return (currentAudio !== null && !currentAudio.paused) || speechSynthesis.speaking;
}

function speakSystem(text: string, speed: number): Promise<void> {
    return new Promise((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = speed;
        utterance.lang = "zh-CN";
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        speechSynthesis.speak(utterance);
    });
}

async function speakOpenAI(text: string, voice: TTSVoice, speed: number, apiKey: string): Promise<void> {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "tts-1",
            input: text.slice(0, 4096),
            voice,
            speed,
        }),
    });

    if (!res.ok) throw new Error(`OpenAI TTS 错误: ${res.status}`);

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    return new Promise((resolve) => {
        currentAudio = new Audio(url);
        currentAudio.onended = () => { currentAudio = null; URL.revokeObjectURL(url); resolve(); };
        currentAudio.onerror = () => { currentAudio = null; URL.revokeObjectURL(url); resolve(); };
        currentAudio.play();
    });
}

async function speakElevenLabs(text: string, apiKey: string): Promise<void> {
    const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel — 默认
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            text: text.slice(0, 5000),
            model_id: "eleven_multilingual_v2",
        }),
    });

    if (!res.ok) throw new Error(`ElevenLabs 错误: ${res.status}`);

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    return new Promise((resolve) => {
        currentAudio = new Audio(url);
        currentAudio.onended = () => { currentAudio = null; URL.revokeObjectURL(url); resolve(); };
        currentAudio.onerror = () => { currentAudio = null; URL.revokeObjectURL(url); resolve(); };
        currentAudio.play();
    });
}

// ── VoiceWake 集成 ──

export function enableVoiceWake(phrase: string): boolean {
    return openclawBridge.sendChannelMessage("__voicewake__", "config", JSON.stringify({
        command: "enable",
        phrase,
    }));
}

export function disableVoiceWake(): boolean {
    return openclawBridge.sendChannelMessage("__voicewake__", "config", JSON.stringify({
        command: "disable",
    }));
}
