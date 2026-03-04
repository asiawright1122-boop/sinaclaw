import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";

// 配置 pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * 提取 File 对象中的文本内容
 */
export async function extractTextFromFile(file: File): Promise<string> {
    const type = file.type;
    const name = file.name.toLowerCase();

    try {
        if (type === "application/pdf" || name.endsWith(".pdf")) {
            return await parsePdf(file);
        } else if (
            type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
            name.endsWith(".docx")
        ) {
            return await parseDocx(file);
        } else if (
            type.startsWith("text/") ||
            name.endsWith(".txt") ||
            name.endsWith(".md") ||
            name.endsWith(".json") ||
            name.endsWith(".csv")
        ) {
            return await parseText(file);
        } else {
            throw new Error(`不支持的文件类型: ${type || name}`);
        }
    } catch (e) {
        console.error(`解析文件 ${name} 失败:`, e);
        throw new Error(`解析失败: ${e instanceof Error ? e.message : String(e)}`);
    }
}

// ── 各种格式解析实现 ──────────────────────────────────────────

async function parseText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) || "");
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}

async function parsePdf(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
            .map((item: any) => item.str)
            .join(" ");
        fullText += pageText + "\\n\\n";
    }

    // 简单清理多余空格
    return fullText.replace(/\\s{3,}/g, "  ").trim();
}

async function parseDocx(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
}
