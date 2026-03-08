import { executeTool } from "@/lib/tools";
import { callLLMWithRetry } from "@/lib/agent";
import type { AgentMessage } from "@/lib/agent";

export type DeepResearchState = "Planning" | "Searching" | "Reading" | "Synthesizing" | "Iterating" | "Done" | "Error";

export interface DeepResearchParams {
    topic: string;
    apiKey: string;
    provider: string;
    model: string;
    temperature: number;
    maxTokens: number;
    onStateChange: (state: DeepResearchState, info: string) => void;
    onTextChunk: (text: string) => void;
    onDone: (finalReport: string) => void;
    onError: (error: string) => void;
    checkAbort: () => boolean; // 允许随时中断
}

/**
 * 专门用于深度研究的管线。
 * 它打破了标准 Agent 的一问一答，而是硬编码为多步状态机以最大化并发和深度提取。
 */
export async function runDeepResearch(params: DeepResearchParams): Promise<void> {
    const { topic, apiKey, provider, model, temperature, maxTokens, onStateChange, onTextChunk, onDone, onError, checkAbort } = params;

    const abortMsg = "[WARN] 深度研究已被用户中止";

    try {
        const MAX_ITERATIONS = 2;
        let iteration = 1;
        let finalContext = "";
        let allDiscoveredUrls = new Set<string>();

        while (iteration <= MAX_ITERATIONS) {
            if (checkAbort()) throw new Error(abortMsg);

            // ── 1. Planning: 制定检索计划 ──
            onStateChange(iteration === 1 ? "Planning" : "Iterating", `【第 ${iteration} 轮】正在评估当前进展与制定搜索策略...`);

            const planPrompt = `你是一个顶级深度研究员。你的任务是针对主题 "${topic}" 执行检索分析。
${iteration > 1 ? `当前已搜集的部分资料片段如下：\n---\n${finalContext.slice(0, 10000)}...\n---\n评估资料是否足够详尽以回答或覆盖该主题。如果不足，请继续给出新的独立搜索关键词。` : ""}
请输出一个 JSON 格式，如下所示：
{
    "is_sufficient": false,
    "queries": ["Query A", "Query B"]
}
说明：is_sufficient 表示信息是否足够（布尔值），如果为 true，则可将 queries 置空。最多提供 3 个搜索关键字，不要输出除 JSON 以外的任何文本。`;

            const planResult = await callLLMWithRetry({
                messages: [{ role: "user", content: planPrompt }],
                apiKey, provider, model, temperature: 0.3, maxTokens: 800,
                onTextChunk: () => { }, // 隐藏 planning 过程
                onError: (e) => console.error("Planning Error", e)
            });

            if (checkAbort()) throw new Error(abortMsg);

            let isSufficient = false;
            let queries: string[] = [];
            try {
                const jsonText = planResult.content.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
                const parsed = JSON.parse(jsonText);
                isSufficient = parsed.is_sufficient === true;
                if (Array.isArray(parsed.queries)) {
                    queries = parsed.queries;
                }
            } catch (e) {
                console.warn("解析检索计划 JSON 失败，回退到默认主题检索", e);
                if (iteration === 1) queries = [topic];
                else isSufficient = true; // 出错则不再继续循环
            }

            if (isSufficient || queries.length === 0) {
                console.log(`Deep Research: Information is sufficient after ${iteration - 1} iterations.`);
                break;
            }

            // ── 2. Searching: 批量调用 search_web ──
            onStateChange("Searching", `【第 ${iteration} 轮】正在执行 ${queries.length} 次并发搜索... ${queries.join(" | ")}`);
            if (checkAbort()) throw new Error(abortMsg);

            const searchPromises = queries.map(query =>
                executeTool("search_web", { query })
                    .catch(err => `Search error for ${query}: ${err}`)
            );
            const searchResults = await Promise.all(searchPromises);

            const urlRegex = /(https?:\/\/[^\s\)]+)/g;
            const newUrls = new Set<string>();
            searchResults.forEach(res => {
                const matches = res.match(urlRegex);
                if (matches) {
                    matches.forEach(url => {
                        if (!allDiscoveredUrls.has(url)) {
                            newUrls.add(url);
                            allDiscoveredUrls.add(url);
                        }
                    });
                }
            });

            let targetUrls = Array.from(newUrls);
            if (targetUrls.length === 0 && iteration === 1) {
                throw new Error("第一轮搜索未能提取到任何有效的参考链接。可能网络或搜索引擎服务异常。");
            }

            // 限制单轮并发抓取的数量
            const MAX_URLS_PER_ITER = 6;
            if (targetUrls.length > MAX_URLS_PER_ITER) {
                targetUrls = targetUrls.slice(0, MAX_URLS_PER_ITER);
            }

            // ── 3. Reading: 并发抓取目标网页 ──
            if (targetUrls.length > 0) {
                onStateChange("Reading", `【第 ${iteration} 轮】深度抓取并提取 ${targetUrls.length} 个网页的内容...`);
                if (checkAbort()) throw new Error(abortMsg);

                const fetchPromises = targetUrls.map(url =>
                    executeTool("fetch_url", { url })
                        .then(content => `【Source: ${url}】\n${content}`)
                        .catch(err => `【Source: ${url}】 Failed to fetch: ${err}`)
                );

                const articleContents = await Promise.all(fetchPromises);
                const block = articleContents.join("\n\n" + "=".repeat(40) + "\n\n");
                finalContext += (finalContext ? "\n\n" : "") + block;

                // 限制内容上限避免溢出
                if (finalContext.length > 150000) {
                    finalContext = finalContext.slice(0, 150000);
                }
            }

            iteration++;
        }

        // ── 4. Synthesizing: 基于所有的资料汇总出大报告 ──
        onStateChange("Synthesizing", "素材搜集完毕，正在撰写深度研究报告...");
        if (checkAbort()) throw new Error(abortMsg);

        const synthesisPrompt = `你是一个顶尖的研究员。你的任务是根据以下收集到的多份原始网页资料，就给定的主题 "${topic}" 写一份极其详尽、结构严谨的深度研究报告。
要求：
1. 请用 Markdown 格式输出，排版优美。
2. 内容务必客观客观详实，将所有材料中的重点交叉验证。
3. 请在行文中适当引用参考来源（使用内联的 markdown 链接如 [source](url)）。
4. 如果提供的素材中有矛盾，指出这种矛盾。
5. 报告字数应尽可能长、尽可能详尽。不要编造素材中没有提到的虚假事实。

=== 搜集到的素材 ===
${finalContext}
`;

        const synthesizeMessages: AgentMessage[] = [
            { role: "user", content: synthesisPrompt }
        ];

        // 这里开始直接把文本抛回给 UI 的流式输出
        const reportResult = await callLLMWithRetry({
            messages: synthesizeMessages,
            apiKey, provider, model, temperature, maxTokens,
            onTextChunk: (text) => {
                if (checkAbort()) return;
                onTextChunk(text);
            },
            onError: (e) => console.error("Synthesizing Error", e)
        });

        if (checkAbort()) throw new Error(abortMsg);

        // ── 5. Done ──
        onStateChange("Done", "深度研究完成");
        onDone(reportResult.content);

    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        onStateChange("Error", msg);
        onError(msg);
    }
}
