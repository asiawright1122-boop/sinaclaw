/**
 * LLM 自动标题生成
 */
import { updateConversationTitle } from "@/lib/db";
import { sendMessage, onStreamChunk } from "@/lib/tauri";
import { useSettingsStore, PROVIDER_INFO } from "@/store/settingsStore";

export async function generateSmartTitle(
    conversationId: string,
    userMessage: string,
    onTitleGenerated: (title: string) => void
) {
    try {
        const settings = useSettingsStore.getState();
        if (!settings.apiKey || !settings.provider) return;

        const providerInfo = PROVIDER_INFO[settings.provider];
        if (!providerInfo) return;

        let generatedTitle = "";

        const unlisten = await onStreamChunk((chunk) => {
            if (chunk.done) {
                unlisten();
                // 清理标题（去掉引号和多余空白）
                const title = generatedTitle.replace(/["""'']/g, "").trim().slice(0, 20);
                if (title.length >= 2) {
                    updateConversationTitle(conversationId, title).catch(console.error);
                    onTitleGenerated(title);
                }
                return;
            }
            if (chunk.content) {
                generatedTitle += chunk.content;
            }
        });

        await sendMessage({
            messages: [
                {
                    role: "system",
                    content: "你是一个标题生成器。给用户的消息生成一个简短的中文标题，不超过15个字。只输出标题本身，不要加引号、标点或解释。",
                },
                { role: "user", content: userMessage.slice(0, 200) },
            ],
            api_key: settings.apiKey,
            provider: settings.provider,
            model: settings.model,
            temperature: 0.3,
            max_tokens: 30,
        });
    } catch (e) {
        // LLM 调用失败时静默降级（截断标题已设置）
        console.warn("标题生成失败:", e);
    }
}
