import { create } from "zustand";
import { load } from "@tauri-apps/plugin-store";

export type AIProvider = "openai" | "anthropic" | "google" | "deepseek" | "minimax" | "zhipu" | "local";

export interface SettingsState {
  apiKey: string;
  provider: AIProvider;
  model: string;
  temperature: number;
  maxTokens: number;
  language: "zh" | "en";
  theme: "light" | "dark" | "system";
  _hydrated: boolean;

  // Actions
  hydrate: () => Promise<void>;
  setApiKey: (key: string) => void;
  setProvider: (provider: AIProvider) => void;
  setModel: (model: string) => void;
  setTemperature: (temp: number) => void;
  setMaxTokens: (tokens: number) => void;
  setLanguage: (lang: "zh" | "en") => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
}

export const PROVIDER_INFO: Record<AIProvider, { label: string; emoji: string; apiUrl: string; format: "openai" | "anthropic" | "google" }> = {
  openai: {
    label: "OpenAI",
    emoji: "🟢",
    apiUrl: "https://api.openai.com/v1/chat/completions",
    format: "openai",
  },
  anthropic: {
    label: "Anthropic",
    emoji: "🟣",
    apiUrl: "https://api.anthropic.com/v1/messages",
    format: "anthropic",
  },
  google: {
    label: "Google Gemini",
    emoji: "🔵",
    apiUrl: "https://generativelanguage.googleapis.com/v1beta",
    format: "google",
  },
  deepseek: {
    label: "DeepSeek",
    emoji: "🟠",
    apiUrl: "https://api.deepseek.com/v1/chat/completions",
    format: "openai",
  },
  minimax: {
    label: "MiniMax",
    emoji: "🔴",
    apiUrl: "https://api.minimax.io/v1/chat/completions",
    format: "openai",
  },
  zhipu: {
    label: "智谱 GLM",
    emoji: "🟤",
    apiUrl: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    format: "openai",
  },
  local: {
    label: "本地模型",
    emoji: "⚪",
    apiUrl: "http://localhost:11434/api/chat",
    format: "openai",
  },
};

export const MODEL_OPTIONS: Record<AIProvider, { id: string; name: string; tag?: string }[]> = {
  openai: [
    { id: "gpt-5.2", name: "GPT-5.2", tag: "最强" },
    { id: "gpt-5", name: "GPT-5" },
    { id: "gpt-5-mini", name: "GPT-5 mini", tag: "高性价比" },
    { id: "o3", name: "o3", tag: "推理" },
    { id: "o3-mini", name: "o3 mini" },
    { id: "o4-mini", name: "o4 mini" },
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "gpt-4o-mini", name: "GPT-4o mini" },
    { id: "gpt-4.1", name: "GPT-4.1" },
  ],
  anthropic: [
    { id: "claude-opus-4-6", name: "Claude Opus 4.6", tag: "最强" },
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", tag: "推荐" },
    { id: "claude-opus-4-5-20251101", name: "Claude Opus 4.5" },
    { id: "claude-sonnet-4-5-20250929", name: "Claude Sonnet 4.5" },
    { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", tag: "极速" },
    { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
    { id: "claude-opus-4-20250514", name: "Claude Opus 4" },
  ],
  google: [
    { id: "gemini-3.1-pro", name: "Gemini 3.1 Pro", tag: "最强" },
    { id: "gemini-3-pro-preview", name: "Gemini 3 Pro" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", tag: "推荐" },
    { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", tag: "极速" },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
  ],
  deepseek: [
    { id: "deepseek-chat", name: "DeepSeek V3", tag: "通用" },
    { id: "deepseek-reasoner", name: "DeepSeek R1", tag: "推理" },
  ],
  minimax: [
    { id: "MiniMax-M2.5", name: "MiniMax M2.5", tag: "最强" },
    { id: "MiniMax-M2.5-highspeed", name: "MiniMax M2.5 极速", tag: "极速" },
    { id: "MiniMax-M2.1", name: "MiniMax M2.1" },
    { id: "MiniMax-M2", name: "MiniMax M2" },
  ],
  zhipu: [
    { id: "glm-5", name: "GLM-5", tag: "最强" },
    { id: "glm-4.7", name: "GLM-4.7" },
    { id: "glm-4.7-flash", name: "GLM-4.7 Flash", tag: "免费" },
    { id: "glm-4.6", name: "GLM-4.6" },
    { id: "glm-4-plus", name: "GLM-4 Plus" },
    { id: "glm-4-flash", name: "GLM-4 Flash", tag: "极速" },
  ],
  local: [
    { id: "llama3.3", name: "Llama 3.3" },
    { id: "qwen2.5", name: "Qwen 2.5" },
    { id: "deepseek-r1:14b", name: "DeepSeek R1 14B" },
    { id: "mistral", name: "Mistral" },
    { id: "codellama", name: "Code Llama" },
  ],
};

// 根据模型自动设定最优参数
function getOptimalParams(modelId: string): { temperature: number; maxTokens: number } {
  // 推理模型：低 temperature，高 token
  if (/o3|o4|reasoner|r1/i.test(modelId)) {
    return { temperature: 0.3, maxTokens: 8192 };
  }
  // 旗舰模型：适中 temperature，高 token
  if (/opus|5\.2|pro|glm-5(?!-)|M2\.5(?!-h)/i.test(modelId)) {
    return { temperature: 0.7, maxTokens: 8192 };
  }
  // 极速/轻量模型：适中 temperature，适中 token
  if (/mini|flash|lite|haiku|highspeed|air/i.test(modelId)) {
    return { temperature: 0.7, maxTokens: 4096 };
  }
  // 默认
  return { temperature: 0.7, maxTokens: 4096 };
}

// 持久化帮助函数
async function persistSettings(data: Partial<SettingsState>) {
  try {
    const store = await load("settings.json");
    for (const [key, value] of Object.entries(data)) {
      if (!key.startsWith("_") && typeof value !== "function") {
        await store.set(key, value);
      }
    }
  } catch (e) {
    console.error("持久化设置失败:", e);
  }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  apiKey: "",
  provider: "openai",
  model: "gpt-5.2",
  temperature: 0.7,
  maxTokens: 8192,
  language: "zh",
  theme: "system",
  _hydrated: false,

  // 从本地存储恢复设置
  hydrate: async () => {
    try {
      const store = await load("settings.json");
      const apiKey = (await store.get<string>("apiKey")) ?? "";
      const provider = (await store.get<AIProvider>("provider")) ?? "openai";
      const model = (await store.get<string>("model")) ?? MODEL_OPTIONS[provider as AIProvider][0].id;
      const temperature = (await store.get<number>("temperature")) ?? 0.7;
      const maxTokens = (await store.get<number>("maxTokens")) ?? 8192;
      const language = (await store.get<"zh" | "en">("language")) ?? "zh";
      const theme = (await store.get<"light" | "dark" | "system">("theme")) ?? "system";
      set({ apiKey, provider, model, temperature, maxTokens, language, theme, _hydrated: true });
    } catch {
      set({ _hydrated: true });
    }
  },

  setApiKey: (key) => {
    set({ apiKey: key });
    persistSettings({ apiKey: key });
  },
  setProvider: (provider) => {
    const newModel = MODEL_OPTIONS[provider][0].id;
    const params = getOptimalParams(newModel);
    const data = { provider, model: newModel, ...params };
    set(data);
    persistSettings(data);
  },
  setModel: (model) => {
    const params = getOptimalParams(model);
    const data = { model, ...params };
    set(data);
    persistSettings(data);
  },
  setTemperature: (temp) => {
    set({ temperature: temp });
    persistSettings({ temperature: temp });
  },
  setMaxTokens: (tokens) => {
    set({ maxTokens: tokens });
    persistSettings({ maxTokens: tokens });
  },
  setLanguage: (lang) => {
    set({ language: lang });
    persistSettings({ language: lang });
  },
  setTheme: (theme) => {
    set({ theme });
    persistSettings({ theme });
  },
}));
