import { BaseDirectory, readDir, readTextFile, writeTextFile, exists, mkdir } from '@tauri-apps/plugin-fs';
import { Command } from '@tauri-apps/plugin-shell';
import { join } from '@tauri-apps/api/path';

export interface SkillDefinition {
    name: string;
    description: string;
    author?: string;
    icon?: string;
    version?: string;
    parameters: {
        type: string;
        properties: Record<string, any>;
        required: string[];
    };
    execution: {
        type: "shell";
        command: string;
    };
}

export interface LoadedSkill {
    id: string; // 文件夹名称
    definition: SkillDefinition;
    path: string;
    enabled: boolean;
}

const SETTINGS_FILE = 'skills/skill_settings.json';

class SkillManager {
    private skills: LoadedSkill[] = [];
    private settings: Record<string, boolean> = {};

    /**
     * 初始化：扫描并装载所有存在的 Skills
     */
    async init() {
        try {
            // 确保应用数据目录下的 skills 文件夹存在
            const hasSkillsDir = await exists('skills', { baseDir: BaseDirectory.AppData });
            if (!hasSkillsDir) {
                await mkdir('skills', { baseDir: BaseDirectory.AppData, recursive: true });
                console.log("创建了外部技能专属目录: AppData/skills/");
            }

            // 读取 disabled/enabled 状态
            if (await exists(SETTINGS_FILE, { baseDir: BaseDirectory.AppData })) {
                try {
                    const settingsContent = await readTextFile(SETTINGS_FILE, { baseDir: BaseDirectory.AppData });
                    this.settings = JSON.parse(settingsContent);
                } catch (e) {
                    console.error("解析技能配置失败:", e);
                    this.settings = {};
                }
            } else {
                this.settings = {};
                await this.saveSettings();
            }

            const entries = await readDir('skills', { baseDir: BaseDirectory.AppData });
            this.skills = [];

            for (const entry of entries) {
                if (entry.isDirectory) {
                    try {
                        const skillPath = await join('skills', entry.name, 'skill.json');
                        const hasSkillJson = await exists(skillPath, { baseDir: BaseDirectory.AppData });

                        if (hasSkillJson) {
                            const content = await readTextFile(skillPath, { baseDir: BaseDirectory.AppData });
                            const definition = JSON.parse(content) as SkillDefinition;

                            // 验证格式合法性
                            if (definition.name && definition.execution?.type === 'shell' && definition.execution.command) {
                                // 如果未在设置中声明，默认为 true (开启状态)
                                const isEnabled = this.settings[entry.name] ?? true;
                                this.skills.push({
                                    id: entry.name,
                                    definition,
                                    path: skillPath,
                                    enabled: isEnabled
                                });
                                console.log(`✓ 成功装载外部技能: [${definition.name}] (Enabled: ${isEnabled})`);
                            } else {
                                console.warn(`⚠️ 技能格式违法，名称或执行入口缺失: ${entry.name}`);
                            }
                        }
                    } catch (err) {
                        console.error(`解析技能目录 [${entry.name}] 时发生错误:`, err);
                    }
                }
            }
        } catch (error) {
            console.error("加载全局技能列表失败:", error);
        }
    }

    private async saveSettings() {
        try {
            await writeTextFile(SETTINGS_FILE, JSON.stringify(this.settings, null, 2), { baseDir: BaseDirectory.AppData });
        } catch (e) {
            console.error("保存技能配置失败:", e);
        }
    }

    /**
     * 切换技能激活状态
     */
    async toggleSkill(skillId: string, enabled: boolean) {
        this.settings[skillId] = enabled;
        await this.saveSettings();
        const skill = this.skills.find(s => s.id === skillId);
        if (skill) {
            skill.enabled = enabled;
        }
    }

    /**
     * 取出所有读取到的外部技能定义，方便大厅渲染
     */
    getAllSkills() {
        return this.skills;
    }

    /**
     * 获取开启(enabled)的技能定义，以便注入到大模型的 tools 参数中
     */
    getSkillTools() {
        return this.skills.filter(s => s.enabled).map(skill => ({
            type: "function" as const,
            function: {
                name: skill.definition.name,
                description: skill.definition.description,
                parameters: skill.definition.parameters,
            }
        }));
    }

    /**
     * 根据 name 查找对应的技能
     */
    findSkillByName(name: string): LoadedSkill | undefined {
        return this.skills.find(s => s.definition.name === name);
    }

    /**
     * 执行技能，替换变量并通过系统 Shell 运行
     */
    async executeSkill(skillName: string, args: Record<string, any>): Promise<string> {
        const skill = this.findSkillByName(skillName);
        if (!skill) {
            throw new Error(`无法路由: 未找到名为 ${skillName} 的外部技能。`);
        }
        if (!skill.enabled) {
            return `❎ 技能 [${skillName}] 已被用户禁用。`;
        }

        let runCmd = skill.definition.execution.command;

        // 简单的变量插值逻辑
        for (const [key, value] of Object.entries(args)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            // 转义 value 防止命令注入风险
            const safeValue = String(value).replace(/(["'$`\\])/g, '\\$1');
            runCmd = runCmd.replace(regex, safeValue);
        }

        console.log(`🚀 执行外部技能 [${skillName}]: ${runCmd}`);

        try {
            const cmd = Command.create('sh', ['-c', runCmd]);
            const output = await cmd.execute();

            if (output.code !== 0) {
                return `❎ 技能 [${skillName}] 执行异常，错误码 ${output.code}:\n${output.stderr}`;
            }

            return output.stdout.trim() || `✅ 技能 [${skillName}] 已成功执行。无标准输出回显。`;
        } catch (e: any) {
            return `❎ 技能 [${skillName}] 调用失败:\n${e.message || String(e)}`;
        }
    }
}

// 导出一个单例实例供全局使用
export const skillManager = new SkillManager();
