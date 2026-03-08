import { useState, useRef } from "react";
import { useToastStore } from "@/store/toastStore";
import { useTranslate } from "@/lib/i18n";
import { useSettingsStore } from "@/store/settingsStore";
import { useChatStore } from "@/store/chatStore";

export function useChatVoiceInput() {
    const t = useTranslate();
    const { addToast } = useToastStore();
    const { apiKey } = useSettingsStore();
    const { inputValue, setInputValue } = useChatStore();

    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcribeStatus, setTranscribeStatus] = useState("");
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const transcribeAudio = async (blob: Blob) => {
        if (!apiKey) {
            addToast(t.chat.configureApiKeyFirst, "error");
            return;
        }

        setIsTranscribing(true);
        setTranscribeStatus(t.chat.transcribing);

        try {
            const formData = new FormData();
            formData.append("file", blob, "recording.webm");
            formData.append("model", "whisper-1");

            const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                },
                body: formData
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || t.chat.transcriptionFailed);
            }

            const data = await response.json();
            if (data.text) {
                setInputValue(inputValue ? inputValue + " " + data.text : data.text);
            }
        } catch (error) {
            console.error("STT Error:", error);
            addToast(t.chat.sttFailed.replace('{error}', error instanceof Error ? error.message : String(error)), "error");
        } finally {
            setIsTranscribing(false);
            setTranscribeStatus("");
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);

            audioChunksRef.current = [];
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await transcribeAudio(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            recorder.start();
            setMediaRecorder(recorder);
            setIsRecording(true);
        } catch (err) {
            console.error("无法开启录音:", err);
            addToast(t.chat.cannotAccessMic, "error");
        }
    };

    const stopRecording = () => {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            setIsRecording(false);
            setMediaRecorder(null);
        }
    };

    return {
        isRecording,
        isTranscribing,
        transcribeStatus,
        startRecording,
        stopRecording,
    };
}
