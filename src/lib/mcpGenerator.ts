/**
 * OpenClaw MCP Server 自动生成器
 * 
 * 利用大模型生成完整的 MCP Server 样板代码 (Python/TypeScript)，
 * 然后自动 scaffold (创建文件 + 安装依赖 + 启动) 并挂载到 mcpStore。
 */

import { BaseDirectory, writeTextFile, exists, mkdir } from "@tauri-apps/plugin-fs";
import { Command } from "@tauri-apps/plugin-shell";
import { appDataDir, join } from "@tauri-apps/api/path";

// ── 生成 MCP Server 代码 ─────────────────────────────────

export interface MCPGenerateResult {
    name: string;
    code: string;
    language: "python" | "typescript";
    tools: string[];
}

/**
 * 调用 LLM 生成 MCP Server 的完整代码
 */
export async function generateMCPCode(
    description: string,
    apiKey: string,
    provider: string,
    model: string
): Promise<MCPGenerateResult> {
    const { callLLMWithTools } = await import("@/lib/agent");

    const systemPrompt = `你是一个 MCP (Model Context Protocol) Server 代码生成器。
用户会描述他们想要的功能，你需要生成一个完整的 Python FastMCP Server。

规则：
1. 使用 from mcp.server.fastmcp import FastMCP
2. 每个工具用 @mcp.tool() 装饰器
3. 每个工具函数必须有完整的类型标注和 docstring
4. 工具命名使用 snake_case
5. 在文件末尾加上 if __name__ == "__main__": mcp.run()

输出格式（严格 JSON）：
{
  "name": "server_name",
  "code": "完整的 Python 代码",
  "tools": ["tool_name_1", "tool_name_2"]
}

只输出 JSON，不要其他内容。`;

    let fullText = "";
    const result = await callLLMWithTools({
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `请生成一个 MCP Server：${description}` },
        ],
        apiKey,
        provider,
        model,
        temperature: 0.3,
        maxTokens: 3000,
        onTextChunk: (chunk: string) => { fullText += chunk; },
        onError: (err: string) => { throw new Error(err); },
    });

    const text = result.content || fullText;

    // 提取 JSON
    let json = text;
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) json = match[1].trim();

    const parsed = JSON.parse(json);
    return {
        name: parsed.name || `mcp-server-${Date.now()}`,
        code: parsed.code || "",
        language: "python",
        tools: parsed.tools || [],
    };
}

// ── Scaffold & 启动 ──────────────────────────────────────

/**
 * 将生成的 MCP Server 代码写入 skills/ 目录，
 * 创建 venv，安装依赖，返回 stdio 命令字符串
 */
export async function scaffoldMCPServer(
    result: MCPGenerateResult
): Promise<{ stdioCmdUrl: string; serverPath: string }> {
    const serverDir = `skills/${result.name}`;
    const serverFile = `${serverDir}/server.py`;

    // 创建目录
    const dirExists = await exists(serverDir, { baseDir: BaseDirectory.AppData });
    if (!dirExists) {
        await mkdir(serverDir, { baseDir: BaseDirectory.AppData, recursive: true });
    }

    // 写入 server.py
    await writeTextFile(serverFile, result.code, { baseDir: BaseDirectory.AppData });

    // 获取绝对路径
    const appData = await appDataDir();
    const absServerDir = await join(appData, serverDir);
    const absServerFile = await join(appData, serverFile);

    // 创建 venv 并安装依赖
    try {
        const setupCmd = Command.create("sh", [
            "-c",
            `cd "${absServerDir}" && python3 -m venv venv && source venv/bin/activate && pip install mcp -q`
        ]);
        await setupCmd.execute();
    } catch (e) {
        console.warn("MCP venv setup warning:", e);
    }

    const stdioCmdUrl = `stdio://${absServerDir}/venv/bin/python ${absServerFile}`;

    return { stdioCmdUrl, serverPath: absServerFile };
}
