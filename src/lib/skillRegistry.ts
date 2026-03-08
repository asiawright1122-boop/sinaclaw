/**
 * 在线技能市场 — 远程技能注册表客户端
 * 
 * 从 GitHub raw 内容拉取技能列表并支持一键安装到本地 AppData/skills/ 目录。
 */

import { BaseDirectory, writeTextFile, readTextFile, exists, mkdir } from '@tauri-apps/plugin-fs';

// ── 类型定义 ─────────────────────────────────────────────

export interface SkillTrigger {
    type: 'keyword' | 'phrase' | 'regex' | 'always';
    pattern: string;
}

export interface RemoteSkill {
    id: string;
    name: string;
    description: string;
    author: string;
    version: string;
    icon?: string;
    tags?: string[];
    downloads?: number;
    skillJson: string;
    trigger?: SkillTrigger;
    depends?: string[];
    stateEnabled?: boolean;
}

export interface SkillRegistry {
    version: string;
    skills: RemoteSkill[];
}

// ── 配置 ─────────────────────────────────────────────────

// 默认注册表地址（可替换为自建服务器）
const DEFAULT_REGISTRY_URL =
    "https://raw.githubusercontent.com/sinaclaw/skill-registry/main/registry.json";

// 内置的示例技能注册表（离线 fallback）
const BUILTIN_REGISTRY: SkillRegistry = {
    version: "1.0.0",
    skills: [
        {
            id: "git-commit-helper",
            name: "Git 提交助手",
            description: "根据代码 diff 自动生成符合 Conventional Commits 规范的提交消息。",
            author: "sinaclaw",
            version: "1.0.0",
            icon: "wrench",
            tags: ["git", "开发工具"],
            downloads: 128,
            skillJson: "https://raw.githubusercontent.com/sinaclaw/skill-registry/main/skills/git-commit-helper/skill.json",
            trigger: { type: "keyword", pattern: "git commit|提交代码|生成commit" },
        },
        {
            id: "web-search",
            name: "网络搜索",
            description: "通过 DuckDuckGo API 搜索互联网信息并返回结果摘要。",
            author: "sinaclaw",
            version: "1.0.0",
            icon: "search",
            tags: ["搜索", "信息获取"],
            downloads: 256,
            skillJson: "https://raw.githubusercontent.com/sinaclaw/skill-registry/main/skills/web-search/skill.json",
            trigger: { type: "keyword", pattern: "搜索|search|查一下|帮我查" },
        },
        {
            id: "image-compressor",
            name: "图片压缩器",
            description: "使用 sharp/ffmpeg 对本地图片进行专业级无损或有损压缩。",
            author: "sinaclaw",
            version: "1.0.0",
            icon: "image",
            tags: ["图片", "优化"],
            downloads: 89,
            skillJson: "https://raw.githubusercontent.com/sinaclaw/skill-registry/main/skills/image-compressor/skill.json",
        },
        {
            id: "markdown-to-pdf",
            name: "Markdown 转 PDF",
            description: "将 Markdown 文件通过 Pandoc 转换为排版精美的 PDF 文档。",
            author: "sinaclaw",
            version: "1.0.0",
            icon: "file",
            tags: ["文档", "转换"],
            downloads: 67,
            skillJson: "https://raw.githubusercontent.com/sinaclaw/skill-registry/main/skills/markdown-to-pdf/skill.json",
        },
        {
            id: "code-reviewer",
            name: "代码审查",
            description: "对指定文件进行静态分析并给出安全性、性能、可读性改进建议。",
            author: "community",
            version: "0.9.0",
            icon: "microscope",
            tags: ["开发工具", "代码质量"],
            downloads: 45,
            skillJson: "https://raw.githubusercontent.com/sinaclaw/skill-registry/main/skills/code-reviewer/skill.json",
        },
    ],
};

// ── 注册表 API ───────────────────────────────────────────

/**
 * 获取远程技能注册表（带 fallback 到内置列表）
 */
export async function fetchRegistry(registryUrl?: string): Promise<SkillRegistry> {
    const url = registryUrl || DEFAULT_REGISTRY_URL;

    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return data as SkillRegistry;
    } catch (err) {
        console.warn("远程注册表获取失败，使用内置列表:", err);
        return BUILTIN_REGISTRY;
    }
}

/**
 * 安装远程技能到本地 AppData/skills/ 目录
 */
export async function installSkill(skill: RemoteSkill): Promise<void> {
    const skillDir = `skills/${skill.id}`;
    const skillFilePath = `${skillDir}/skill.json`;

    // 确保目录存在
    const dirExists = await exists(skillDir, { baseDir: BaseDirectory.AppData });
    if (!dirExists) {
        await mkdir(skillDir, { baseDir: BaseDirectory.AppData, recursive: true });
    }

    // 下载 skill.json
    const response = await fetch(skill.skillJson, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
        throw new Error(`下载失败: HTTP ${response.status}`);
    }
    const skillJsonContent = await response.text();

    // 验证 JSON 格式
    JSON.parse(skillJsonContent);

    // 保存到本地
    await writeTextFile(skillFilePath, skillJsonContent, { baseDir: BaseDirectory.AppData });

    console.log(`[OK] 技能 [${skill.name}] 已安装到 AppData/${skillDir}/`);
}

/**
 * 检查技能是否已安装
 */
export async function isSkillInstalled(skillId: string): Promise<boolean> {
    const skillFilePath = `skills/${skillId}/skill.json`;
    return exists(skillFilePath, { baseDir: BaseDirectory.AppData });
}

/**
 * 搜索注册表中的技能（关键词匹配名称、描述、标签）
 */
export async function searchRegistry(
    query: string,
    registryUrl?: string
): Promise<RemoteSkill[]> {
    const registry = await fetchRegistry(registryUrl);
    if (!query.trim()) return registry.skills;

    const q = query.toLowerCase();
    return registry.skills.filter(
        (s) =>
            s.name.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q) ||
            s.tags?.some((t) => t.toLowerCase().includes(q))
    );
}

/**
 * 将本地技能打包为可分享的 RemoteSkill 元数据
 * 返回一段可复制的 JSON，用户粘贴到自己的 GitHub Registry 即可上架
 */
export async function exportSkillForPublish(skillId: string): Promise<{
    registryEntry: RemoteSkill;
    skillJsonContent: string;
}> {
    const skillFilePath = `skills/${skillId}/skill.json`;
    const content = await readTextFile(skillFilePath, { baseDir: BaseDirectory.AppData });
    const parsed = JSON.parse(content);

    const registryEntry: RemoteSkill = {
        id: skillId,
        name: parsed.name || skillId,
        description: parsed.description || "",
        author: parsed.author || "community",
        version: parsed.version || "1.0.0",
        icon: parsed.icon || "puzzle",
        tags: [],
        downloads: 0,
        skillJson: `https://raw.githubusercontent.com/YOUR_USERNAME/skill-registry/main/skills/${skillId}/skill.json`,
    };

    return { registryEntry, skillJsonContent: content };
}

/**
 * 匹配消息文本与技能触发器
 */
export function matchTrigger(message: string, trigger: SkillTrigger): boolean {
    const lowerMsg = message.toLowerCase();
    switch (trigger.type) {
        case 'keyword': {
            const keywords = trigger.pattern.split('|').map(k => k.trim().toLowerCase());
            return keywords.some(k => lowerMsg.includes(k));
        }
        case 'phrase': {
            return lowerMsg.includes(trigger.pattern.toLowerCase());
        }
        case 'regex': {
            try {
                const regex = new RegExp(trigger.pattern, 'i');
                return regex.test(message);
            } catch {
                return false;
            }
        }
        case 'always':
            return true;
        default:
            return false;
    }
}

/**
 * 在所有已注册的远程技能中查找匹配消息的技能
 */
export async function findMatchingSkills(message: string): Promise<RemoteSkill[]> {
    const registry = await fetchRegistry();
    return registry.skills.filter(skill => {
        if (!skill.trigger) return false;
        return matchTrigger(message, skill.trigger);
    });
}

/**
 * 技能状态持久化
 */
export async function saveSkillState(skillId: string, state: Record<string, unknown>): Promise<void> {
    const statePath = `skills/${skillId}/state.json`;
    const dirPath = `skills/${skillId}`;
    
    const dirExists = await exists(dirPath, { baseDir: BaseDirectory.AppData });
    if (!dirExists) {
        await mkdir(dirPath, { baseDir: BaseDirectory.AppData, recursive: true });
    }
    
    await writeTextFile(statePath, JSON.stringify(state, null, 2), { baseDir: BaseDirectory.AppData });
}

export async function loadSkillState(skillId: string): Promise<Record<string, unknown> | null> {
    const statePath = `skills/${skillId}/state.json`;
    try {
        const content = await readTextFile(statePath, { baseDir: BaseDirectory.AppData });
        return JSON.parse(content);
    } catch {
        return null;
    }
}

/**
 * 解析技能依赖链并返回有序执行列表
 */
export async function resolveSkillChain(skillId: string): Promise<RemoteSkill[]> {
    const registry = await fetchRegistry();
    const visited = new Set<string>();
    const chain: RemoteSkill[] = [];

    function resolve(id: string) {
        if (visited.has(id)) return;
        visited.add(id);
        
        const skill = registry.skills.find(s => s.id === id);
        if (!skill) return;
        
        if (skill.depends) {
            for (const dep of skill.depends) {
                resolve(dep);
            }
        }
        chain.push(skill);
    }

    resolve(skillId);
    return chain;
}
