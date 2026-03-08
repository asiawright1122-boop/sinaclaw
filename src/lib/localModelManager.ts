/**
 * 本地模型管理器 — Ollama 集成
 *
 * 核心能力：
 * 1. 检测本地 Ollama 服务运行状态
 * 2. 列出/拉取/删除模型
 * 3. 获取模型详情（大小、参数量、量化等级）
 */

const OLLAMA_BASE = "http://127.0.0.1:11434";

export interface OllamaModel {
    name: string;
    tag: string;
    size: number; // bytes
    digest: string;
    modifiedAt: string;
    parameterSize?: string;
    quantization?: string;
    family?: string;
}

export interface PullProgress {
    status: string;
    digest?: string;
    total?: number;
    completed?: number;
    percent: number;
}

export type PullCallback = (progress: PullProgress) => void;

// ── 服务检测 ──

export async function isOllamaRunning(): Promise<boolean> {
    try {
        const res = await fetch(`${OLLAMA_BASE}/api/version`, { signal: AbortSignal.timeout(2000) });
        return res.ok;
    } catch {
        return false;
    }
}

export async function getOllamaVersion(): Promise<string> {
    try {
        const res = await fetch(`${OLLAMA_BASE}/api/version`);
        if (!res.ok) return "";
        const data = await res.json();
        return data.version || "";
    } catch {
        return "";
    }
}

// ── 模型列表 ──

export async function listModels(): Promise<OllamaModel[]> {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`);
    if (!res.ok) throw new Error(`Ollama API error: ${res.status}`);
    const data = await res.json();
    if (!data.models || !Array.isArray(data.models)) return [];

    return data.models.map((m: any) => {
        const parts = m.name.split(":");
        return {
            name: parts[0],
            tag: parts[1] || "latest",
            size: m.size || 0,
            digest: m.digest || "",
            modifiedAt: m.modified_at || "",
            parameterSize: m.details?.parameter_size || "",
            quantization: m.details?.quantization_level || "",
            family: m.details?.family || "",
        };
    });
}

// ── 模型详情 ──

export async function showModel(name: string): Promise<Record<string, unknown>> {
    const res = await fetch(`${OLLAMA_BASE}/api/show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(`Show model failed: ${res.status}`);
    return res.json();
}

// ── 拉取模型（流式进度） ──

export async function pullModel(name: string, onProgress: PullCallback): Promise<void> {
    const res = await fetch(`${OLLAMA_BASE}/api/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, stream: true }),
    });

    if (!res.ok) throw new Error(`Pull failed: ${res.status}`);
    if (!res.body) throw new Error("No response body");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const json = JSON.parse(line);
                const total = json.total || 0;
                const completed = json.completed || 0;
                onProgress({
                    status: json.status || "",
                    digest: json.digest,
                    total,
                    completed,
                    percent: total > 0 ? (completed / total) * 100 : 0,
                });
            } catch {}
        }
    }
}

// ── 删除模型 ──

export async function deleteModel(name: string): Promise<void> {
    const res = await fetch(`${OLLAMA_BASE}/api/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}

// ── 工具函数 ──

export function formatModelSize(bytes: number): string {
    if (bytes === 0) return "—";
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
}
