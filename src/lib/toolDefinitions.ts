/**
 * OpenClaw 工具定义 (OpenAI Function Calling JSON Schema)
 */

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
