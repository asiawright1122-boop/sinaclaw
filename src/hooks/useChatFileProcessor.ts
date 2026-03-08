import { useState, useRef } from "react";
import { extractTextFromFile } from "@/lib/parsers";
import { splitText } from "@/lib/textSplitter";
import { generateEmbeddings } from "@/lib/embeddings";
import { saveDocument, saveChunks } from "@/lib/db";
import { useToastStore } from "@/store/toastStore";
import { useTranslate } from "@/lib/i18n";

export function useChatFileProcessor() {
    const t = useTranslate();
    const { addToast } = useToastStore();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const [isProcessingFile, setIsProcessingFile] = useState(false);
    const [processStatus, setProcessStatus] = useState("");
    const [pendingImages, setPendingImages] = useState<string[]>([]);

    const processFile = async (file: File) => {
        setIsProcessingFile(true);
        try {
            setProcessStatus(t.chat.parsingFile.replace('{name}', file.name));
            const text = await extractTextFromFile(file);

            setProcessStatus(t.chat.chunking);
            const chunks = splitText(text, { chunkSize: 800, overlap: 150 });

            setProcessStatus(t.chat.generatingEmbeddings.replace('{count}', String(chunks.length)));
            const embeddings = await generateEmbeddings(chunks);

            setProcessStatus(t.chat.savingKnowledge);
            const doc = await saveDocument(file.name, file.type || "text/plain", file.size);

            const chunksToSave = chunks.map((content, i) => ({
                content,
                embedding: embeddings[i]
            }));
            await saveChunks(doc.id, chunksToSave);

            addToast(t.chat.fileAddedToKnowledge.replace('{name}', file.name), "success");
        } catch (error) {
            console.error("处理文件失败:", error);
            addToast(t.common.error + ": " + (error instanceof Error ? error.message : String(error)), "error");
        } finally {
            setIsProcessingFile(false);
            setProcessStatus("");
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) await processFile(file);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const fileToDataUrl = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        for (const file of Array.from(files)) {
            if (!file.type.startsWith("image/")) continue;
            const dataUrl = await fileToDataUrl(file);
            setPendingImages(prev => [...prev, dataUrl]);
        }
        if (imageInputRef.current) imageInputRef.current.value = "";
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of Array.from(items)) {
            if (item.type.startsWith("image/")) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    const dataUrl = await fileToDataUrl(file);
                    setPendingImages(prev => [...prev, dataUrl]);
                }
            }
        }
    };

    const removePendingImage = (index: number) => {
        setPendingImages(prev => prev.filter((_, idx) => idx !== index));
    };

    const clearPendingImages = () => {
        setPendingImages([]);
    };

    return {
        fileInputRef,
        imageInputRef,
        isProcessingFile,
        processStatus,
        pendingImages,
        processFile,
        handleFileSelect,
        handleImageSelect,
        handlePaste,
        removePendingImage,
        clearPendingImages,
    };
}
