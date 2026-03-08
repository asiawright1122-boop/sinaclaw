import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

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
            name.endsWith(".xlsx") || name.endsWith(".xls") ||
            type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
            type === "application/vnd.ms-excel"
        ) {
            return await parseExcel(file);
        } else if (
            name.endsWith(".pptx") ||
            type === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        ) {
            return await parsePptx(file);
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

async function parseExcel(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const parts: string[] = [];
    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        if (csv.trim()) {
            parts.push(`## Sheet: ${sheetName}\n${csv}`);
        }
    }
    return parts.join("\n\n").trim();
}

async function parsePptx(file: File): Promise<string> {
    // PPTX 是 ZIP 包含 XML slides，使用简单的文本提取
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    // 简单方式：搜索 XML 文本节点中的内容
    const decoder = new TextDecoder("utf-8", { fatal: false });
    const rawText = decoder.decode(uint8);
    // 提取 <a:t>...</a:t> 标签中的文本（PowerPoint XML 格式）
    const matches = rawText.match(/<a:t>([^<]*)<\/a:t>/g);
    if (!matches || matches.length === 0) {
        throw new Error("无法从 PPTX 文件中提取文本内容");
    }
    const texts = matches.map((m) => m.replace(/<\/?a:t>/g, "")).filter(Boolean);
    return texts.join(" ").replace(/\s{3,}/g, "  ").trim();
}
