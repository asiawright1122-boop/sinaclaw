import { useSettingsStore, type AIProvider } from "@/store/settingsStore";

// 各家模型对应的默认 Embedding 模型名称
const EMBEDDING_MODELS: Record<AIProvider, string> = {
    openai: "text-embedding-3-small",
    anthropic: "", // Anthropic 官方目前使用 voyage-ai，为了简化这里暂不支持纯 anthropic embedding，可备用 openai
    google: "text-embedding-004",
    deepseek: "", // DeepSeek 暂无专门的 embedding API 对外网关暴露，推荐用 OpenAI
    minimax: "",
    zhipu: "embedding-2",
    local: "nomic-embed-text", // 假设本地 Ollama 跑 nomic-embed-text
};

/**
 * 将文本片段转换为向量
 */
export async function generateEmbeddings(textChunks: string[]): Promise<number[][]> {
    if (textChunks.length === 0) return [];

    const settings = useSettingsStore.getState();
    const provider = settings.provider;
    const apiKey = settings.apiKey;
    const baseUrl = getBaseUrl(provider);

    // 对于不支持 Embedding 的 Provider，我们在此提示建议更换，或者强制回退
    if (provider === "anthropic" || provider === "deepseek" || provider === "minimax") {
        throw new Error(`当前模型提供商 (${provider}) 不支持或未配置嵌入模型 API，请切换至 OpenAI、Google、智谱 或 Local`);
    }

    const modelInfo = EMBEDDING_MODELS[provider];
    if (!modelInfo) {
        throw new Error(`未找到 ${provider} 对应的 Embedding 模型配置`);
    }

    // OpenAI 兼容格式 (智谱 / Local / OpenAI)
    if (provider === "openai" || provider === "zhipu" || provider === "local") {
        return await fetchOpenAIEmbeddings(baseUrl, apiKey, modelInfo, textChunks);
    }
    // Google Gemini 格式
    else if (provider === "google") {
        return await fetchGoogleEmbeddings(baseUrl, apiKey, modelInfo, textChunks);
    }

    throw new Error(`不支持的 Embedding Provider: ${provider}`);
}

// ── 余弦相似度计算 ──────────────────────────────────────────

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function searchSimilarChunks(
    queryEmbedding: number[],
    allChunks: { id: string; doc_id: string; content: string; embedding: number[] }[],
    topK: number = 3
) {
    return allChunks
        .map(chunk => ({
            ...chunk,
            similarity: cosineSimilarity(queryEmbedding, chunk.embedding)
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);
}

// ── 内部辅助 API 调用 ──────────────────────────────────────

function getBaseUrl(provider: AIProvider): string {
    const urls: Record<string, string> = {
        openai: "https://api.openai.com/v1/embeddings",
        zhipu: "https://open.bigmodel.cn/api/paas/v4/embeddings",
        local: "http://localhost:11434/api/embeddings", // Ollama API
        google: "https://generativelanguage.googleapis.com/v1beta", // 拼凑路径
    };
    return urls[provider] || "";
}

async function fetchOpenAIEmbeddings(baseUrl: string, apiKey: string, model: string, input: string[]): Promise<number[][]> {
    const isLocal = baseUrl.includes("localhost");

    // 如果是 Ollama，它的 /api/embeddings 目前通常只接收单条输入 "prompt"，返回 "embedding"
    // 因此我们需要做一个 Promise.all 循环
    if (isLocal) {
        const results = await Promise.all(
            input.map(async text => {
                const res = await fetch(baseUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ model, prompt: text })
                });
                if (!res.ok) throw new Error(`Ollama Embedding API Error: ${await res.text()}`);
                const data = await res.json();
                return data.embedding as number[];
            })
        );
        return results;
    }

    // 标准 OpenAI 格式接收数组
    const res = await fetch(baseUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({ model, input })
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Embedding Error [${res.status}]: ${err}`);
    }

    const data = await res.json();
    // 确保顺序正确
    const sorted = [...data.data].sort((a: any, b: any) => a.index - b.index);
    return sorted.map((item: any) => item.embedding as number[]);
}

async function fetchGoogleEmbeddings(baseUrl: string, apiKey: string, model: string, input: string[]): Promise<number[][]> {
    // Google Gemini 的 batchEmbedContents API
    const url = `${baseUrl}/models/${model}:batchEmbedContents?key=${apiKey}`;

    const requests = input.map(text => ({
        model: `models/${model}`,
        content: { parts: [{ text }] }
    }));

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requests })
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Google Embedding Error [${res.status}]: ${err}`);
    }

    const data = await res.json();
    return data.embeddings.map((item: any) => item.values as number[]);
}
