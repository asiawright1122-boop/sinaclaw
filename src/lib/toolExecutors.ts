/**
 * OpenClaw 工具执行桥接层
 * 
 * 通过 Tauri invoke 调用 Rust 后端执行工具
 */
import { invoke } from "@tauri-apps/api/core";
import { skillManager } from "@/lib/skills";
import { getDocuments, getAllChunks, appendCoreMemory, getAllCoreMemories, type MemoryCategory } from "@/lib/db";
import { generateEmbeddings, searchSimilarChunks } from "@/lib/embeddings";
import type { CommandResult, EnvInfo, DirEntry } from "./toolDefinitions";

export async function executeTool(
    name: string,
    args: Record<string, unknown>
): Promise<string> {
    try {
        switch (name) {
            case "core_memory_append": {
                const { content, category } = args as { content: string; category?: string };
                if (!content) throw new Error("缺少 content 参数");
                const cat = (category || 'custom') as MemoryCategory;
                await appendCoreMemory(content, cat);
                const catNames: Record<string, string> = { preferences: '偏好', contacts: '联系人', projects: '项目', learnings: '学习', tools: '工具', custom: '通用' };
                return `[OK] 核心记忆已保存 [${catNames[cat] || cat}]: ${content}`;
            }
            case "core_memory_search": {
                const { query } = args as { query?: string };
                const memories = await getAllCoreMemories();
                if (memories.length === 0) return "[WARN] 核心记忆库为空。";

                let matches = memories;
                if (query) {
                    const lowerQuery = query.toLowerCase();
                    matches = memories.filter(m => m.content.toLowerCase().includes(lowerQuery));
                }

                if (matches.length === 0) return `[WARN] 没有找到与 "${query}" 相关的记忆。`;
                return `[Memory] 检索到的核心记忆：\n` + matches.map((m, i) => `${i + 1}. [${new Date(m.created_at).toLocaleString()}] ${m.content}`).join("\n");
            }
            case "run_command": {
                const result = await invoke<CommandResult>("tool_run_command", {
                    command: args.command as string,
                    cwd: (args.cwd as string) || null,
                });
                let output = "";
                if (result.stdout) output += result.stdout;
                if (result.stderr) output += (output ? "\n" : "") + result.stderr;
                if (!output.trim()) output = result.success ? "(命令成功，无输出)" : "(命令失败，无输出)";
                return `[exit_code: ${result.exit_code}]\n${output}`;
            }
            case "read_file": {
                const content = await invoke<string>("tool_read_file", {
                    path: args.path as string,
                });
                return content;
            }
            case "write_file": {
                const result = await invoke<string>("tool_write_file", {
                    path: args.path as string,
                    content: args.content as string,
                });
                return result;
            }
            case "list_directory": {
                const entries = await invoke<DirEntry[]>("tool_list_dir", {
                    path: args.path as string,
                });
                return entries
                    .map((e) => `${e.is_dir ? "[DIR]" : "[FILE]"} ${e.name}${e.is_dir ? "/" : ""} (${formatSize(e.size)})`)
                    .join("\n");
            }
            case "detect_environment": {
                const info = await invoke<EnvInfo>("tool_detect_env");
                let report = `OS: ${info.os} (${info.arch})\n\n`;
                for (const [name, status] of Object.entries(info.tools)) {
                    const icon = status.installed ? "[OK]" : "[MISSING]";
                    report += `${icon} ${name}: ${status.installed ? status.version : "未安装"}\n`;
                }
                return report;
            }
            case "install_dependency": {
                const result = await invoke<CommandResult>("tool_install_dependency", {
                    packageManager: args.package_manager as string,
                    packages: args.packages as string[],
                    cwd: (args.cwd as string) || null,
                });
                let output = "";
                if (result.stdout) output += result.stdout;
                if (result.stderr) output += (output ? "\n" : "") + result.stderr;
                return result.success
                    ? `[OK] 安装成功\n${output}`
                    : `[ERROR] 安装失败 (exit: ${result.exit_code})\n${output}`;
            }
            case "cloud_list": {
                interface CloudFileResult {
                    id: string; name: string; is_folder: boolean; size: number; modified_at: string;
                }
                const files = await invoke<CloudFileResult[]>("cloud_list_files", {
                    provider: args.provider as string,
                    folderId: (args.folder_id as string) || null,
                });
                if (files.length === 0) return "(目录为空)";
                return files
                    .map((f) => `${f.is_folder ? "[DIR]" : "[FILE]"} ${f.name} (${formatSize(f.size)})`)
                    .join("\n");
            }
            case "cloud_download": {
                const result = await invoke<string>("cloud_download", {
                    provider: args.provider as string,
                    fileId: args.file_id as string,
                    localPath: args.local_path as string,
                });
                return result;
            }
            case "cloud_upload": {
                interface CloudUploadResult {
                    id: string; name: string; size: number;
                }
                const result = await invoke<CloudUploadResult>("cloud_upload", {
                    provider: args.provider as string,
                    localPath: args.local_path as string,
                    remoteFolderId: (args.remote_folder_id as string) || null,
                    fileName: null,
                });
                return `[OK] 已上传: ${result.name} (${formatSize(result.size)})`;
            }
            case "search_knowledge": {
                const query = args.query as string;
                if (!query) return "[ERROR] 缺少 query 参数";
                const topK = (args.top_k as number) || 3;

                try {
                    const chunks = await getAllChunks();
                    if (chunks.length === 0) {
                        return "知识库为空。请提示用户先上传文档。";
                    }
                    const docs = await getDocuments();
                    const docMap = new Map(docs.map(d => [d.id, d.name]));

                    const [queryEmbedding] = await generateEmbeddings([query]);

                    const parsedChunks = chunks.map(c => ({
                        id: c.id,
                        doc_id: c.doc_id,
                        content: c.content,
                        embedding: JSON.parse(c.embedding) as number[]
                    }));

                    const results = searchSimilarChunks(queryEmbedding, parsedChunks, topK);

                    if (results.length === 0) return "未找到相关内容。";

                    let output = `**知识库搜索结果** (Query: "${query}")\n\n`;
                    for (let i = 0; i < results.length; i++) {
                        const r = results[i];
                        const docName = docMap.get(r.doc_id) || `Unknown Doc (${r.doc_id})`;
                        output += `【来源 ${i + 1}: ${docName} (相似度: ${(r.similarity * 100).toFixed(1)}%)】\n`;
                        output += `${r.content}\n\n`;
                    }

                    return output.trim();
                } catch (e) {
                    return `[ERROR] 知识库搜索失败: ${e instanceof Error ? e.message : String(e)}`;
                }
            }
            case "search_web": {
                const query = args.query as string;
                if (!query) return "[ERROR] 缺少 query 参数";
                const result = await invoke<string>("tool_search_web", { query });
                return result;
            }
            case "fetch_url": {
                const url = args.url as string;
                if (!url) return "[ERROR] 缺少 url 参数";
                const result = await invoke<string>("tool_fetch_url", { url });
                return result;
            }
            case "screenshot": {
                const result = await invoke<string>("tool_screenshot");
                return `[OK] 截屏成功，保存路径已返回（可进行后续多模态分析）: ${result}`;
            }
            case "browser_open": {
                const url = args.url as string;
                if (!url) return "[ERROR] 缺少 url 参数";
                const { openUrl } = await import("@tauri-apps/plugin-opener");
                await openUrl(url);
                return `[OK] 已在浏览器中打开: ${url}`;
            }
            case "browser_screenshot_url": {
                const url = args.url as string;
                if (!url) return "[ERROR] 缺少 url 参数";
                const result = await invoke<string>("tool_browser_screenshot", {
                    url,
                    outputPath: (args.output_path as string) || null,
                    width: (args.width as number) || null,
                    height: (args.height as number) || null,
                });
                return result;
            }
            case "browser_extract_text": {
                const url = args.url as string;
                const selector = args.selector as string;
                if (!url || !selector) return "[ERROR] 缺少 url 或 selector 参数";
                const html = await invoke<string>("tool_fetch_url", { url });
                return `已获取页面内容。请在返回的 HTML 文本中查找选择器 "${selector}" 对应的内容：\n\n${html.slice(0, 3000)}`;
            }
            case "browser_run_js": {
                const url = args.url as string;
                const script = args.script as string;
                if (!url || !script) return "[ERROR] 缺少 url 或 script 参数";
                const result = await invoke<string>("tool_browser_run_js", {
                    url,
                    script,
                    waitMs: (args.wait_ms as number) || null,
                });
                return result;
            }
            default: {
                // 1. 尝试路由到 MCP 工具 (格式: mcp__server_id__tool_name)
                if (name.startsWith("mcp__")) {
                    const parts = name.split("__");
                    if (parts.length >= 3) {
                        const serverId = parts[1];
                        const toolName = parts.slice(2).join("__");
                        const result = await invoke<unknown>("mcp_call_tool", {
                            serverId,
                            toolName,
                            arguments: args,
                        });
                        return JSON.stringify(result, null, 2);
                    }
                }

                // 2. 尝试路由到外部本地技能引擎
                if (skillManager.findSkillByName(name)) {
                    return await skillManager.executeSkill(name, args as Record<string, string>);
                }

                return `[ERROR] 未知工具: ${name}`;
            }
        }
    } catch (error) {
        return `[ERROR] 工具执行失败: ${error instanceof Error ? error.message : String(error)}`;
    }
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
