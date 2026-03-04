use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
use tauri::Manager;
use tauri::Emitter;
use serde::{Deserialize, Serialize};
use reqwest::Client;
use futures::StreamExt;
use tauri_plugin_sql::{Migration, MigrationKind};

mod tools;
mod cloud;
mod tools_extended;
mod mcp;

// ── 数据结构 ──────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    #[serde(default)]
    pub content: Option<String>,
    // Function Calling 支持
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SendMessageRequest {
    pub messages: Vec<ChatMessage>,
    pub api_key: String,
    pub provider: String,
    pub model: String,
    pub temperature: f64,
    pub max_tokens: u32,
    #[serde(default)]
    pub tools: Option<Vec<serde_json::Value>>,
    #[serde(default)]
    pub tool_choice: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Clone)]
pub struct StreamChunk {
    pub content: String,
    pub done: bool,
    // tool_calls 新增字段
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCallChunk>>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ToolCallChunk {
    pub id: String,
    pub function_name: String,
    pub arguments: String,
}

// ── OpenAI 兼容格式流式请求 ──────────────────────────────
// 适用于: OpenAI, DeepSeek, MiniMax, 智谱GLM, 本地Ollama

fn get_openai_compatible_url(provider: &str) -> &'static str {
    match provider {
        "openai" => "https://api.openai.com/v1/chat/completions",
        "deepseek" => "https://api.deepseek.com/v1/chat/completions",
        "minimax" => "https://api.minimax.io/v1/chat/completions",
        "zhipu" => "https://open.bigmodel.cn/api/paas/v4/chat/completions",
        "local" => "http://localhost:11434/v1/chat/completions",
        _ => "https://api.openai.com/v1/chat/completions",
    }
}

async fn stream_openai_compatible(
    window: tauri::WebviewWindow,
    req: SendMessageRequest,
) -> Result<(), String> {
    let client = Client::new();
    let url = get_openai_compatible_url(&req.provider);

    let messages: Vec<serde_json::Value> = req
        .messages
        .iter()
        .map(|m| {
            let mut msg = serde_json::json!({
                "role": m.role,
            });
            if let Some(ref content) = m.content {
                msg["content"] = serde_json::Value::String(content.clone());
            }
            if let Some(ref tool_calls) = m.tool_calls {
                msg["tool_calls"] = serde_json::Value::Array(tool_calls.clone());
            }
            if let Some(ref tool_call_id) = m.tool_call_id {
                msg["tool_call_id"] = serde_json::Value::String(tool_call_id.clone());
            }
            if let Some(ref name) = m.name {
                msg["name"] = serde_json::Value::String(name.clone());
            }
            msg
        })
        .collect();

    let mut body = serde_json::json!({
        "model": req.model,
        "messages": messages,
        "temperature": req.temperature,
        "max_tokens": req.max_tokens,
        "stream": true,
    });

    // 如果有工具定义，加入请求体
    if let Some(ref tools) = req.tools {
        body["tools"] = serde_json::Value::Array(tools.clone());
    }
    if let Some(ref tool_choice) = req.tool_choice {
        body["tool_choice"] = tool_choice.clone();
    }

    let response = client
        .post(url)
        .header("Authorization", format!("Bearer {}", req.api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_body = response.text().await.unwrap_or_default();
        return Err(format!("API 错误 ({}): {}", status, error_body));
    }

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("流式读取错误: {}", e))?;
        let text = String::from_utf8_lossy(&chunk);
        buffer.push_str(&text);

        while let Some(pos) = buffer.find('\n') {
            let line = buffer[..pos].trim().to_string();
            buffer = buffer[pos + 1..].to_string();

            if line.is_empty() || line.starts_with(':') {
                continue;
            }

            if let Some(data) = line.strip_prefix("data: ") {
                if data.trim() == "[DONE]" {
                    let _ = window.emit("chat-stream", StreamChunk {
                        content: String::new(),
                        done: true,
                        tool_calls: None,
                    });
                    return Ok(());
                }

                if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                    let delta = &json["choices"][0]["delta"];

                    // 处理普通文本内容
                    if let Some(content) = delta["content"].as_str() {
                        let _ = window.emit("chat-stream", StreamChunk {
                            content: content.to_string(),
                            done: false,
                            tool_calls: None,
                        });
                    }

                    // 处理 tool_calls
                    if let Some(tool_calls) = delta["tool_calls"].as_array() {
                        let mut chunks: Vec<ToolCallChunk> = Vec::new();
                        for tc in tool_calls {
                            let id = tc["id"].as_str().unwrap_or("").to_string();
                            let func_name = tc["function"]["name"].as_str().unwrap_or("").to_string();
                            let arguments = tc["function"]["arguments"].as_str().unwrap_or("").to_string();
                            chunks.push(ToolCallChunk {
                                id,
                                function_name: func_name,
                                arguments,
                            });
                        }
                        if !chunks.is_empty() {
                            let _ = window.emit("chat-stream", StreamChunk {
                                content: String::new(),
                                done: false,
                                tool_calls: Some(chunks),
                            });
                        }
                    }
                }
            }
        }
    }

    let _ = window.emit("chat-stream", StreamChunk {
        content: String::new(),
        done: true,
        tool_calls: None,
    });

    Ok(())
}

// ── Anthropic 流式请求 ───────────────────────────────────

async fn stream_anthropic(
    window: tauri::WebviewWindow,
    req: SendMessageRequest,
) -> Result<(), String> {
    let client = Client::new();

    let messages: Vec<serde_json::Value> = req
        .messages
        .iter()
        .filter(|m| m.role != "system")
        .map(|m| {
            serde_json::json!({
                "role": m.role,
                "content": m.content.clone().unwrap_or_default(),
            })
        })
        .collect();

    let system_msg = req
        .messages
        .iter()
        .find(|m| m.role == "system")
        .and_then(|m| m.content.clone())
        .unwrap_or_default();

    let mut body = serde_json::json!({
        "model": req.model,
        "messages": messages,
        "max_tokens": req.max_tokens,
        "stream": true,
    });

    if !system_msg.is_empty() {
        body["system"] = serde_json::Value::String(system_msg);
    }

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &req.api_key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_body = response.text().await.unwrap_or_default();
        return Err(format!("API 错误 ({}): {}", status, error_body));
    }

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("流式读取错误: {}", e))?;
        let text = String::from_utf8_lossy(&chunk);
        buffer.push_str(&text);

        while let Some(pos) = buffer.find('\n') {
            let line = buffer[..pos].trim().to_string();
            buffer = buffer[pos + 1..].to_string();

            if line.is_empty() || line.starts_with(':') {
                continue;
            }

            if let Some(data) = line.strip_prefix("data: ") {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                    let event_type = json["type"].as_str().unwrap_or("");

                    match event_type {
                        "content_block_delta" => {
                            if let Some(text) = json["delta"]["text"].as_str() {
                                let _ = window.emit("chat-stream", StreamChunk {
                                    content: text.to_string(),
                                    done: false,
                                    tool_calls: None,
                                });
                            }
                        }
                        "message_stop" => {
                            let _ = window.emit("chat-stream", StreamChunk {
                                content: String::new(),
                                done: true,
                                tool_calls: None,
                            });
                            return Ok(());
                        }
                        _ => {}
                    }
                }
            }
        }
    }

    let _ = window.emit("chat-stream", StreamChunk {
        content: String::new(),
        done: true,
        tool_calls: None,
    });

    Ok(())
}

// ── Google Gemini 流式请求 ────────────────────────────────

async fn stream_google(
    window: tauri::WebviewWindow,
    req: SendMessageRequest,
) -> Result<(), String> {
    let client = Client::new();

    let contents: Vec<serde_json::Value> = req
        .messages
        .iter()
        .map(|m| {
            let role = match m.role.as_str() {
                "assistant" => "model",
                _ => &m.role,
            };
            serde_json::json!({
                "role": role,
                "parts": [{ "text": m.content.clone().unwrap_or_default() }]
            })
        })
        .collect();

    let body = serde_json::json!({
        "contents": contents,
        "generationConfig": {
            "temperature": req.temperature,
            "maxOutputTokens": req.max_tokens,
        }
    });

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:streamGenerateContent?alt=sse&key={}",
        req.model, req.api_key
    );

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_body = response.text().await.unwrap_or_default();
        return Err(format!("API 错误 ({}): {}", status, error_body));
    }

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("流式读取错误: {}", e))?;
        let text = String::from_utf8_lossy(&chunk);
        buffer.push_str(&text);

        while let Some(pos) = buffer.find('\n') {
            let line = buffer[..pos].trim().to_string();
            buffer = buffer[pos + 1..].to_string();

            if line.is_empty() || line.starts_with(':') {
                continue;
            }

            if let Some(data) = line.strip_prefix("data: ") {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(text) = json["candidates"][0]["content"]["parts"][0]["text"].as_str() {
                        let _ = window.emit("chat-stream", StreamChunk {
                            content: text.to_string(),
                            done: false,
                            tool_calls: None,
                        });
                    }
                }
            }
        }
    }

    let _ = window.emit("chat-stream", StreamChunk {
        content: String::new(),
        done: true,
        tool_calls: None,
    });

    Ok(())
}

// ── Tauri Commands ───────────────────────────────────────

#[tauri::command]
async fn send_message(
    window: tauri::WebviewWindow,
    request: SendMessageRequest,
) -> Result<(), String> {
    match request.provider.as_str() {
        "anthropic" => stream_anthropic(window, request).await,
        "google" => stream_google(window, request).await,
        // OpenAI 兼容格式: openai, deepseek, minimax, zhipu, local
        _ => stream_openai_compatible(window, request).await,
    }
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// ── 入口 ─────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: include_str!("../migrations/01_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_cloud_tokens_table",
            sql: include_str!("../migrations/02_cloud_tokens.sql"),
            kind: MigrationKind::Up,
        }
    ];

    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            #[cfg(target_os = "macos")]
            apply_vibrancy(&window, NSVisualEffectMaterial::Menu, None, None)
                .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");

            Ok(())
        })
        .plugin(tauri_plugin_sql::Builder::default().add_migrations("sqlite:chat.db", migrations).build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            send_message,
            tools::tool_run_command,
            tools::tool_read_file,
            tools::tool_write_file,
            tools::tool_list_dir,
            tools::tool_detect_env,
            tools::tool_install_dependency,
            cloud::cloud_auth_url,
            cloud::cloud_auth_exchange,
            cloud::cloud_start_auth,
            cloud::cloud_list_files,
            cloud::cloud_download,
            cloud::cloud_upload,
            cloud::cloud_delete,
            cloud::cloud_get_status,
            cloud::cloud_disconnect,
            tools::set_workspace,
            tools::get_workspace,
            tools::pick_folder,
            tools_extended::tool_search_web,
            tools_extended::tool_screenshot,
            mcp::mcp_connect,
            mcp::mcp_call_tool,
            mcp::mcp_get_active_tools,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
