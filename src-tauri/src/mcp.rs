use serde::{Deserialize, Serialize};
use reqwest::Client;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use lazy_static::lazy_static;
use std::sync::atomic::{AtomicU64, Ordering};
use tokio::process::Command;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MCPTool {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

#[derive(Clone)]
pub enum MCPConnectionType {
    Sse(String), // url
    Stdio(
        tokio::sync::mpsc::Sender<serde_json::Value>, 
        Arc<Mutex<HashMap<u64, tokio::sync::oneshot::Sender<serde_json::Value>>>>
    ),
}

#[derive(Clone)]
#[allow(dead_code)]
pub struct MCPConnection {
    pub id: String,
    pub name: String,
    pub conn_type: MCPConnectionType,
    pub status: String,
    pub tools: Vec<MCPTool>,
}

lazy_static! {
    static ref CONNECTIONS: Arc<Mutex<HashMap<String, MCPConnection>>> = Arc::new(Mutex::new(HashMap::new()));
    static ref HTTP_CLIENT: Client = Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .expect("Failed to create HTTP client");
    static ref MSG_ID: AtomicU64 = AtomicU64::new(1);
}

#[tauri::command]
pub async fn mcp_connect(id: String, name: String, url: String) -> Result<Vec<MCPTool>, String> {
    let is_stdio = url.starts_with("stdio://");
    
    let (conn_type, tools) = if is_stdio {
        let cmd_str = url.strip_prefix("stdio://").unwrap_or(&url);
        connect_stdio(cmd_str).await?
    } else {
        let tools_url = if url.ends_with('/') {
            format!("{}tools", url)
        } else {
            format!("{}/tools", url)
        };
        
        let response = HTTP_CLIENT
            .get(&tools_url)
            .send()
            .await
            .map_err(|e| format!("Failed to connect to MCP server: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Server returned error: {}", response.status()));
        }

        let tools: Vec<MCPTool> = response.json().await.map_err(|e| format!("Failed to parse tools: {}", e))?;
        (MCPConnectionType::Sse(url.clone()), tools)
    };

    let mut connections = CONNECTIONS.lock().await;
    connections.insert(id.clone(), MCPConnection {
        id,
        name,
        conn_type,
        status: "active".to_string(),
        tools: tools.clone(),
    });

    Ok(tools)
}

async fn connect_stdio(cmd_str: &str) -> Result<(MCPConnectionType, Vec<MCPTool>), String> {
    let mut parts = shlex::split(cmd_str).ok_or("Invalid command string")?;
    if parts.is_empty() { return Err("Empty command".to_string()); }
    let cmd = parts.remove(0);

    let mut child = Command::new(&cmd)
        .args(&parts)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Failed to spawn process {}: {}", cmd, e))?;

    let stdin = child.stdin.take().ok_or("Failed to open stdin")?;
    let stdout = child.stdout.take().ok_or("Failed to open stdout")?;

    let pending_requests: Arc<Mutex<HashMap<u64, tokio::sync::oneshot::Sender<serde_json::Value>>>> = Arc::new(Mutex::new(HashMap::new()));
    let pending_clone = pending_requests.clone();

    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(&line) {
                if let Some(id_val) = value.get("id").and_then(|i| i.as_u64()) {
                    let mut pending = pending_clone.lock().await;
                    if let Some(sender) = pending.remove(&id_val) {
                        let _ = sender.send(value);
                    }
                }
            }
        }
    });

    let (tx, mut rx) = tokio::sync::mpsc::channel::<serde_json::Value>(32);
    let mut stdin_writer = stdin;
    
    tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            let mut line = msg.to_string();
            line.push('\n');
            if stdin_writer.write_all(line.as_bytes()).await.is_err() {
                break;
            }
            let _ = stdin_writer.flush().await;
        }
    });

    let conn_type = MCPConnectionType::Stdio(tx.clone(), pending_requests.clone());

    // 1. Send initialize
    let init_id = MSG_ID.fetch_add(1, Ordering::SeqCst);
    let (init_tx, init_rx) = tokio::sync::oneshot::channel();
    pending_requests.lock().await.insert(init_id, init_tx);

    let init_msg = serde_json::json!({
        "jsonrpc": "2.0",
        "id": init_id,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "clientInfo": { "name": "sinaclaw", "version": "0.1.0" },
            "capabilities": {}
        }
    });
    tx.send(init_msg).await.map_err(|e| e.to_string())?;

    // Wait for init response
    match tokio::time::timeout(std::time::Duration::from_secs(10), init_rx).await {
        Ok(Ok(_)) => {},
        _ => return Err("Initialize timeout or channel closed".to_string()),
    };

    // 2. Send initialized notification
    let initialized_msg = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "notifications/initialized"
    });
    tx.send(initialized_msg).await.map_err(|e| e.to_string())?;

    // 3. Send tools/list
    let list_id = MSG_ID.fetch_add(1, Ordering::SeqCst);
    let (list_tx, list_rx) = tokio::sync::oneshot::channel();
    pending_requests.lock().await.insert(list_id, list_tx);

    let list_msg = serde_json::json!({
        "jsonrpc": "2.0",
        "id": list_id,
        "method": "tools/list"
    });
    tx.send(list_msg).await.map_err(|e| e.to_string())?;

    let list_res = match tokio::time::timeout(std::time::Duration::from_secs(10), list_rx).await {
        Ok(Ok(res)) => res,
        _ => return Err("tools/list timeout".to_string()),
    };
    
    let mut tools = Vec::new();

    if let Some(t_array) = list_res.get("result").and_then(|r| r.get("tools")).and_then(|a| a.as_array()) {
        for t in t_array {
            if let Ok(tool) = serde_json::from_value::<MCPTool>(t.clone()) {
                tools.push(tool);
            }
        }
    }

    Ok((conn_type, tools))
}

#[tauri::command]
pub async fn mcp_call_tool(server_id: String, tool_name: String, arguments: serde_json::Value) -> Result<serde_json::Value, String> {
    let conn = {
        let connections = CONNECTIONS.lock().await;
        connections.get(&server_id).cloned().ok_or_else(|| "Connection not found".to_string())?
    };
    
    match conn.conn_type {
        MCPConnectionType::Sse(url) => {
            let call_url = if url.ends_with('/') {
                format!("{}call", url)
            } else {
                format!("{}/call", url)
            };

            let response = HTTP_CLIENT
                .post(&call_url)
                .json(&serde_json::json!({
                    "tool": tool_name,
                    "arguments": arguments
                }))
                .send()
                .await
                .map_err(|e| format!("Tool call failed: {}", e))?;

            let result: serde_json::Value = response.json().await.map_err(|e| format!("Failed to parse tool result: {}", e))?;
            Ok(result)
        },
        MCPConnectionType::Stdio(tx, pending) => {
            let call_id = MSG_ID.fetch_add(1, Ordering::SeqCst);
            let (call_tx, call_rx) = tokio::sync::oneshot::channel();
            pending.lock().await.insert(call_id, call_tx);

            let call_msg = serde_json::json!({
                "jsonrpc": "2.0",
                "id": call_id,
                "method": "tools/call",
                "params": {
                    "name": tool_name,
                    "arguments": arguments
                }
            });

            tx.send(call_msg).await.map_err(|e| e.to_string())?;

            let call_res = tokio::time::timeout(std::time::Duration::from_secs(60), call_rx)
                .await
                .map_err(|_| "tools/call timeout".to_string())?
                .map_err(|_| "tools/call channel closed".to_string())?;

            // Try extracting 'result' field from JSON-RPC response format
            if let Some(error) = call_res.get("error") {
                return Err(error.to_string());
            }
            
            if let Some(result) = call_res.get("result") {
                Ok(result.clone())
            } else {
                // Process did not return standard JSON-RPC but parsing succeeded
                Ok(call_res)
            }
        }
    }
}

#[tauri::command]
pub async fn mcp_get_active_tools() -> Result<Vec<serde_json::Value>, String> {
    let connections = CONNECTIONS.lock().await;
    let mut all_tools = Vec::new();
    
    for (id, conn) in connections.iter() {
        if conn.status == "active" {
            for tool in &conn.tools {
                all_tools.push(serde_json::json!({
                    "server_id": id,
                    "server_name": conn.name,
                    "name": tool.name,
                    "description": tool.description,
                    "input_schema": tool.input_schema
                }));
            }
        }
    }
    
    Ok(all_tools)
}
