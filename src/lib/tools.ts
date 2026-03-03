/**
 * OpenClaw 工具定义 + 执行桥接层
 * 
 * 定义 Agent 可用的工具 JSON Schema (OpenAI Function Calling 格式)
 * 以及通过 Tauri invoke 调用 Rust 后端执行工具的函数
 */
import { invoke } from "@tauri-apps/api/core";

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
];

// ── 工具执行函数 ────────────────────────────────────────

export async function executeTool(
    name: string,
    args: Record<string, unknown>
): Promise<string> {
    try {
        switch (name) {
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
                    .map((e) => `${e.is_dir ? "📁" : "📄"} ${e.name}${e.is_dir ? "/" : ""} (${formatSize(e.size)})`)
                    .join("\n");
            }
            case "detect_environment": {
                const info = await invoke<EnvInfo>("tool_detect_env");
                let report = `🖥️ OS: ${info.os} (${info.arch})\n\n`;
                for (const [name, status] of Object.entries(info.tools)) {
                    const icon = status.installed ? "✅" : "❌";
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
                    ? `✅ 安装成功\n${output}`
                    : `❌ 安装失败 (exit: ${result.exit_code})\n${output}`;
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
                    .map((f) => `${f.is_folder ? "📁" : "📄"} ${f.name} (${formatSize(f.size)})`)
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
                return `✅ 已上传: ${result.name} (${formatSize(result.size)})`;
            }
            default:
                return `❌ 未知工具: ${name}`;
        }
    } catch (error) {
        return `❌ 工具执行失败: ${error instanceof Error ? error.message : String(error)}`;
    }
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
