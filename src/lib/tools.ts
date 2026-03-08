/**
 * OpenClaw 工具定义 + 执行桥接层
 * 
 * 定义 Agent 可用的工具 JSON Schema (OpenAI Function Calling 格式)
 * 以及通过 Tauri invoke 调用 Rust 后端执行工具的函数
 */
import { invoke } from "@tauri-apps/api/core";
import { skillManager } from "@/lib/skills";

import { getDocuments, getAllChunks, appendCoreMemory, getAllCoreMemories, type MemoryCategory } from "@/lib/db";
import { generateEmbeddings, searchSimilarChunks } from "@/lib/embeddings";

// ── 工具执行结果类型 ────────────────────────────────────

export interface CommandResult {
    stdout: string;
    stderr: string;
    exit_code: number;
    success: boolean;
}

export interface EnvInfo {
    os: string;
    arch: string;
    tools: Record<string, { installed: boolean; version: string; path: string }>;
}

export interface DirEntry {
    name: string;
    is_dir: boolean;
    size: number;
}

// ── 工具定义 (OpenAI Function Calling JSON Schema) ──────

export const OPENCLAW_TOOLS = [
    {
        type: "function" as const,
        function: {
            name: "run_command",
            description: "在用户的系统上执行 shell 命令。用于安装依赖、检查版本、运行构建、诊断错误等。你应该主动执行命令来修复问题，而不是让用户手动操作。",
            parameters: {
                type: "object",
                properties: {
                    command: {
                        type: "string",
                        description: "要执行的 shell 命令，例如 'npm install'、'node --version'、'cargo build'",
                    },
                    cwd: {
                        type: "string",
                        description: "命令的工作目录（可选，默认为用户主目录）",
                    },
                },
                required: ["command"],
            },
        },
    },
    {
        type: "function" as const,
        function: {
            name: "read_file",
            description: "读取文件内容。用于查看配置文件、错误日志、依赖清单等，以诊断问题。",
            parameters: {
                type: "object",
                properties: {
                    path: {
                        type: "string",
                        description: "文件的绝对路径或相对路径",
                    },
                },
                required: ["path"],
            },
        },
    },
    {
        type: "function" as const,
        function: {
            name: "write_file",
            description: "创建或覆盖写入文件。用于修复配置文件、创建缺失的文件等。",
            parameters: {
                type: "object",
                properties: {
                    path: {
                        type: "string",
                        description: "文件路径",
                    },
                    content: {
                        type: "string",
                        description: "要写入的文件内容",
                    },
                },
                required: ["path", "content"],
            },
        },
    },
    {
        type: "function" as const,
        function: {
            name: "list_directory",
            description: "列出目录中的文件和子目录。用于了解项目结构。",
            parameters: {
                type: "object",
                properties: {
                    path: {
                        type: "string",
                        description: "目录路径",
                    },
                },
                required: ["path"],
            },
        },
    },
    {
        type: "function" as const,
        function: {
            name: "detect_environment",
            description: "检测用户系统的开发环境信息，包括操作系统、已安装的开发工具及其版本（Node.js、npm、yarn、pnpm、Git、Rust、Python 等）。在需要诊断环境问题时首先调用此工具。",
            parameters: {
                type: "object",
                properties: {},
                required: [],
            },
        },
    },
    {
        type: "function" as const,
        function: {
            name: "install_dependency",
            description: "使用指定的包管理器安装一个或多个依赖包。自动检测包管理器并执行安装。",
            parameters: {
                type: "object",
                properties: {
                    package_manager: {
                        type: "string",
                        enum: ["npm", "yarn", "pnpm", "cargo", "pip"],
                        description: "包管理器名称",
                    },
                    packages: {
                        type: "array",
                        items: { type: "string" },
                        description: "要安装的包名列表",
                    },
                    cwd: {
                        type: "string",
                        description: "工作目录（可选）",
                    },
                },
                required: ["package_manager", "packages"],
            },
        },
    },
    {
        type: "function" as const,
        function: {
            name: "cloud_list",
            description: "列出用户云端网盘(Google Drive/OneDrive/Dropbox)中指定目录的文件和文件夹。",
            parameters: {
                type: "object",
                properties: {
                    provider: {
                        type: "string",
                        enum: ["google_drive", "onedrive", "dropbox"],
                        description: "云存储提供商",
                    },
                    folder_id: {
                        type: "string",
                        description: "文件夹 ID（可选，不传则列出根目录）",
                    },
                },
                required: ["provider"],
            },
        },
    },
    {
        type: "function" as const,
        function: {
            name: "cloud_download",
            description: "从用户的云端网盘下载文件到本地。下载后可以用 read_file 查看内容。",
            parameters: {
                type: "object",
                properties: {
                    provider: {
                        type: "string",
                        enum: ["google_drive", "onedrive", "dropbox"],
                        description: "云存储提供商",
                    },
                    file_id: {
                        type: "string",
                        description: "要下载的文件 ID",
                    },
                    local_path: {
                        type: "string",
                        description: "保存到本地的路径",
                    },
                },
                required: ["provider", "file_id", "local_path"],
            },
        },
    },
    {
        type: "function" as const,
        function: {
            name: "cloud_upload",
            description: "将本地文件上传到用户的云端网盘。",
            parameters: {
                type: "object",
                properties: {
                    provider: {
                        type: "string",
                        enum: ["google_drive", "onedrive", "dropbox"],
                        description: "云存储提供商",
                    },
                    local_path: {
                        type: "string",
                        description: "本地文件路径",
                    },
                    remote_folder_id: {
                        type: "string",
                        description: "上传到的目标文件夹 ID（可选，默认根目录）",
                    },
                },
                required: ["provider", "local_path"],
            },
        },
    },
    {
        type: "function" as const,
        function: {
            name: "search_knowledge",
            description: "在本地知识库中搜索与查询最相关的文档片段。在用户询问已上传文档的内容时调用此工具。",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "搜索查询内容（通常是用户的问题或关键词）",
                    },
                    top_k: {
                        type: "number",
                        description: "返回的最相关片段数量（默认3个）",
                    },
                },
                required: ["query"],
            },
        },
    },
    {
        type: "function" as const,
        function: {
            name: "search_web",
            description: "使用搜索引擎在互联网上查找信息。可用于查询最新新闻、比赛比分、天气或需要从网络获取的外部知识。",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "搜索关键词",
                    },
                },
                required: ["query"],
            },
        },
    },
    {
        type: "function" as const,
        function: {
            name: "fetch_url",
            description: "读取指定网页的纯文本内容。提取网页的正文文本，去除脚本和样式。对于需要深度阅读的长网页或提取文章内容特别有用。",
            parameters: {
                type: "object",
                properties: {
                    url: {
                        type: "string",
                        description: "要访问的网页 URL (必须以 http 或 https 开头)",
                    },
                },
                required: ["url"],
            },
        },
    },
    {
        type: "function" as const,
        function: {
            name: "screenshot",
            description: "截取当前主屏幕的画面并保存到本地。返回截图的绝对路径。截屏后你可以结合其他视觉分析工具对画面进行解读。",
            parameters: {
                type: "object",
                properties: {},
                required: [],
            },
        },
    },
    {
        type: "function" as const,
        function: {
            name: "core_memory_append",
            description: "将关于用户、环境配置、偏好或项目细节的长期记忆持久化存储。当用户提供新信息或你发现需要记住的重要细节时调用此工具。请根据内容选择合适的分类。",
            parameters: {
                type: "object",
                properties: {
                    content: {
                        type: "string",
                        description: "要记住的关键事实或信息片段",
                    },
                    category: {
                        type: "string",
                        enum: ["preferences", "contacts", "projects", "learnings", "tools", "custom"],
                        description: "记忆分类: preferences=用户偏好, contacts=联系人, projects=项目信息, learnings=学到的知识, tools=工具和工作流, custom=其他",
                    },
                },
                required: ["content"],
            },
        },
    },
    {
        type: "function" as const,
        function: {
            name: "core_memory_search",
            description: "检索长期记忆中的事实。当你不确定用户的偏好、环境细节或历史记录时，调用此工具来获取相关记忆。如果不提供 query，将返回所有核心记忆。",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "搜索关键词（可选）",
                    },
                },
                required: [],
            },
        },
    },
    {
        type: "function" as const,
        function: {
            name: "delegate_to_agent",
            description: "将子任务委派给指定角色的子 Agent 执行。当一个任务需要不同领域的专家协作完成时使用此工具。子 Agent 会独立执行任务并返回结果。",
            parameters: {
                type: "object",
                properties: {
                    agent_name: {
                        type: "string",
                        description: "委派给哪个角色（如 Senior Developer、Content Writer、Data Analyst）",
                    },
                    task: {
                        type: "string",
                        description: "要委派的具体任务描述",
                    },
                },
                required: ["agent_name", "task"],
            },
        },
    },
    {
        type: "function" as const,
        function: {
            name: "browser_open",
            description: "在系统默认浏览器中打开指定 URL。用于帮助用户快速访问网页、文档、仪表盘等。",
            parameters: {
                type: "object",
                properties: {
                    url: {
                        type: "string",
                        description: "要打开的 URL (必须以 http 或 https 开头)",
                    },
                },
                required: ["url"],
            },
        },
    },
    {
        type: "function" as const,
        function: {
            name: "browser_screenshot_url",
            description: "截取指定网页的屏幕截图，保存为 PNG 文件。可用于网页视觉检查、UI 测试验证等。需要系统安装了 Chrome/Chromium。",
            parameters: {
                type: "object",
                properties: {
                    url: {
                        type: "string",
                        description: "要截图的网页 URL",
                    },
                    output_path: {
                        type: "string",
                        description: "截图保存路径（可选，默认保存到临时目录）",
                    },
                    width: {
                        type: "number",
                        description: "视口宽度像素（默认 1280）",
                    },
                    height: {
                        type: "number",
                        description: "视口高度像素（默认 800）",
                    },
                    full_page: {
                        type: "boolean",
                        description: "是否截取整个页面（默认 false）",
                    },
                },
                required: ["url"],
            },
        },
    },
    {
        type: "function" as const,
        function: {
            name: "browser_extract_text",
            description: "提取指定网页中特定 CSS 选择器匹配元素的文本内容。相比 fetch_url 更精确，可以针对性提取页面中的某个区域。",
            parameters: {
                type: "object",
                properties: {
                    url: {
                        type: "string",
                        description: "网页 URL",
                    },
                    selector: {
                        type: "string",
                        description: "CSS 选择器，如 'h1', '.content', '#main-text'",
                    },
                },
                required: ["url", "selector"],
            },
        },
    },
    {
        type: "function" as const,
        function: {
            name: "browser_run_js",
            description: "在指定网页上执行 JavaScript 代码。可用于模拟点击按钮、填写表单、提取动态内容等高级浏览器操作。需要 Chrome/Chromium。",
            parameters: {
                type: "object",
                properties: {
                    url: {
                        type: "string",
                        description: "目标网页 URL",
                    },
                    script: {
                        type: "string",
                        description: "要执行的 JavaScript 代码。可以使用 document.querySelector 等 DOM API。例如: document.querySelector('#submit').click()",
                    },
                    wait_ms: {
                        type: "number",
                        description: "页面加载后等待的毫秒数（默认 2000）",
                    },
                },
                required: ["url", "script"],
            },
        },
    },
];

// ── 工具执行函数 ────────────────────────────────────────

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
                    // 读取所有文档和片段
                    const chunks = await getAllChunks();
                    if (chunks.length === 0) {
                        return "知识库为空。请提示用户先上传文档。";
                    }
                    const docs = await getDocuments();
                    const docMap = new Map(docs.map(d => [d.id, d.name]));

                    // 生成查询的向量
                    const [queryEmbedding] = await generateEmbeddings([query]);

                    // 将数据库格式转换为需要的数组对象格式
                    const parsedChunks = chunks.map(c => ({
                        id: c.id,
                        doc_id: c.doc_id,
                        content: c.content,
                        embedding: JSON.parse(c.embedding) as number[]
                    }));

                    // 搜索 Top-K
                    const results = searchSimilarChunks(queryEmbedding, parsedChunks, topK);

                    if (results.length === 0) return "未找到相关内容。";

                    // 格式化输出
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
                        const result = await invoke<any>("mcp_call_tool", {
                            serverId,
                            toolName,
                            arguments: args,
                        });
                        return JSON.stringify(result, null, 2);
                    }
                }

                // 2. 尝试路由到外部本地技能引擎
                if (skillManager.findSkillByName(name)) {
                    return await skillManager.executeSkill(name, args as Record<string, any>);
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
