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
mod gateway;

// ── 数据结构 ──────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    #[serde(default)]
    pub content: Option<serde_json::Value>, // String 或 [{type:"text",text:"..."},{type:"image_url",...}]
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
                msg["content"] = content.clone(); // 直接传递：String 或 Array (OpenAI 原生支持)
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

    let mut request_builder = client
        .post(url)
        .header("Content-Type", "application/json");

    if !req.api_key.is_empty() {
        request_builder = request_builder.header("Authorization", format!("Bearer {}", req.api_key));
    }

    let response = request_builder
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
            // Anthropic 多模态: 将 OpenAI 格式转为 Anthropic 格式
            let content_val = match &m.content {
                Some(serde_json::Value::Array(parts)) => {
                    let converted: Vec<serde_json::Value> = parts.iter().map(|part| {
                        if part["type"] == "image_url" {
                            // 将 OpenAI image_url 格式转为 Anthropic image source 格式
                            let url = part["image_url"]["url"].as_str().unwrap_or("");
                            if let Some(base64_data) = url.strip_prefix("data:image/") {
                                let (media_type_suffix, data) = base64_data.split_once(";base64,").unwrap_or(("", ""));
                                let media_type = format!("image/{}", media_type_suffix);
                                serde_json::json!({
                                    "type": "image",
                                    "source": { "type": "base64", "media_type": media_type, "data": data }
                                })
                            } else {
                                serde_json::json!({ "type": "image", "source": { "type": "url", "url": url } })
                            }
                        } else {
                            part.clone()
                        }
                    }).collect();
                    serde_json::Value::Array(converted)
                }
                Some(serde_json::Value::String(s)) => {
                    serde_json::json!(s)
                }
                Some(other) => other.clone(),
                None => serde_json::json!(""),
            };
            serde_json::json!({
                "role": m.role,
                "content": content_val,
            })
        })
        .collect();

    let system_msg = req
        .messages
        .iter()
        .find(|m| m.role == "system")
        .and_then(|m| m.content.as_ref())
        .and_then(|c| c.as_str())
        .unwrap_or("")
        .to_string();

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

    // Anthropic Tool Use 累积器
    let mut current_tool_id = String::new();
    let mut current_tool_name = String::new();
    let mut current_tool_args = String::new();

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
                        "content_block_start" => {
                            let block = &json["content_block"];
                            if block["type"].as_str() == Some("tool_use") {
                                current_tool_id = block["id"].as_str().unwrap_or("").to_string();
                                current_tool_name = block["name"].as_str().unwrap_or("").to_string();
                                current_tool_args.clear();
                            }
                        }
                        "content_block_delta" => {
                            let delta_type = json["delta"]["type"].as_str().unwrap_or("");
                            if delta_type == "text_delta" {
                                if let Some(text) = json["delta"]["text"].as_str() {
                                    let _ = window.emit("chat-stream", StreamChunk {
                                        content: text.to_string(),
                                        done: false,
                                        tool_calls: None,
                                    });
                                }
                            } else if delta_type == "input_json_delta" {
                                if let Some(partial) = json["delta"]["partial_json"].as_str() {
                                    current_tool_args.push_str(partial);
                                }
                            }
                        }
                        "content_block_stop" => {
                            if !current_tool_id.is_empty() && !current_tool_name.is_empty() {
                                let _ = window.emit("chat-stream", StreamChunk {
                                    content: String::new(),
                                    done: false,
                                    tool_calls: Some(vec![ToolCallChunk {
                                        id: current_tool_id.clone(),
                                        function_name: current_tool_name.clone(),
                                        arguments: current_tool_args.clone(),
                                    }]),
                                });
                                current_tool_id.clear();
                                current_tool_name.clear();
                                current_tool_args.clear();
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

    // Gemini 不支持 role: "system"，需提取到 systemInstruction
    let system_text = req
        .messages
        .iter()
        .find(|m| m.role == "system")
        .and_then(|m| m.content.as_ref())
        .and_then(|c| c.as_str())
        .unwrap_or("")
        .to_string();

    let contents: Vec<serde_json::Value> = req
        .messages
        .iter()
        .filter(|m| m.role != "system")
        .map(|m| {
            let role = match m.role.as_str() {
                "assistant" => "model",
                _ => "user",
            };
            // Google 多模态: 将 OpenAI 格式转为 Gemini parts 格式
            let parts = match &m.content {
                Some(serde_json::Value::Array(content_parts)) => {
                    content_parts.iter().map(|part| {
                        if part["type"] == "image_url" {
                            let url = part["image_url"]["url"].as_str().unwrap_or("");
                            if let Some(base64_data) = url.strip_prefix("data:image/") {
                                let (mime_suffix, data) = base64_data.split_once(";base64,").unwrap_or(("", ""));
                                serde_json::json!({
                                    "inline_data": {
                                        "mime_type": format!("image/{}", mime_suffix),
                                        "data": data
                                    }
                                })
                            } else {
                                serde_json::json!({ "text": url })
                            }
                        } else {
                            serde_json::json!({ "text": part["text"].as_str().unwrap_or("") })
                        }
                    }).collect::<Vec<_>>()
                }
                Some(serde_json::Value::String(s)) => vec![serde_json::json!({ "text": s })],
                _ => vec![serde_json::json!({ "text": "" })],
            };
            serde_json::json!({
                "role": role,
                "parts": parts
            })
        })
        .collect();

    let mut body = serde_json::json!({
        "contents": contents,
        "generationConfig": {
            "temperature": req.temperature,
            "maxOutputTokens": req.max_tokens,
        }
    });

    if !system_text.is_empty() {
        body["systemInstruction"] = serde_json::json!({
            "parts": [{ "text": system_text }]
        });
    }

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

#[tauri::command]
async fn ollama_list_models() -> Result<Vec<serde_json::Value>, String> {
    let client = reqwest::Client::new();
    let response = client
        .get("http://127.0.0.1:11434/api/tags")
        .send()
        .await
        .map_err(|e| format!("无法连接到 Ollama: {}", e))?;

    if !response.status().is_success() {
        return Err("Ollama 服务未运行或返回错误".to_string());
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    let models = data["models"]
        .as_array()
        .cloned()
        .unwrap_or_default();

    Ok(models)
}

#[tauri::command]
async fn ollama_pull_model(model_name: String, window: tauri::WebviewWindow) -> Result<String, String> {
    let client = reqwest::Client::new();
    let response = client
        .post("http://127.0.0.1:11434/api/pull")
        .json(&serde_json::json!({ "name": model_name, "stream": true }))
        .send()
        .await
        .map_err(|e| format!("拉取模型失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Ollama 拉取失败: HTTP {}", response.status()));
    }

    use futures::StreamExt;
    let mut stream = response.bytes_stream();
    let mut last_status = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("流读取错误: {}", e))?;
        let text = String::from_utf8_lossy(&chunk);
        for line in text.lines() {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
                let status = json["status"].as_str().unwrap_or("").to_string();
                if !status.is_empty() {
                    last_status = status.clone();
                    let _ = window.emit("ollama-pull-progress", serde_json::json!({
                        "status": status,
                        "completed": json["completed"],
                        "total": json["total"],
                    }));
                }
            }
        }
    }

    let _ = last_status;
    Ok(format!("模型 {} 拉取完成", model_name))
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
        },
        Migration {
            version: 3,
            description: "conversation_organize",
            sql: include_str!("../migrations/03_conversation_organize.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "inbox_messages_and_sessions",
            sql: include_str!("../migrations/04_inbox.sql"),
            kind: MigrationKind::Up,
        }
    ];

    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            #[cfg(target_os = "macos")]
            apply_vibrancy(&window, NSVisualEffectMaterial::Menu, None, None)
                .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");

            #[cfg(target_os = "windows")]
            {
                use window_vibrancy::apply_mica;
                let _ = apply_mica(&window, Some(true));
            }

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
            ollama_list_models,
            ollama_pull_model,
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
            cloud::cloud_save_credentials,
            cloud::cloud_get_credentials,
            tools::tool_file_exists,
            tools::set_workspace,
            tools::get_workspace,
            tools::pick_folder,
            tools_extended::tool_search_web,
            tools_extended::tool_fetch_url,
            tools_extended::tool_screenshot,
            tools_extended::tool_browser_screenshot,
            tools_extended::tool_browser_run_js,
            mcp::mcp_connect,
            mcp::mcp_call_tool,
            mcp::mcp_get_active_tools,
            gateway::openclaw_start_gateway,
            gateway::openclaw_stop_gateway,
            gateway::openclaw_gateway_status,
            gateway::openclaw_restart_gateway,
            gateway::openclaw_run_cli,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
