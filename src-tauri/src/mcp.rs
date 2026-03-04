use serde::{Deserialize, Serialize};
use reqwest::Client;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use lazy_static::lazy_static;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MCPTool {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MCPConnection {
    pub id: String,
    pub name: String,
    pub url: String,
    pub status: String,
    pub tools: Vec<MCPTool>,
}

lazy_static! {
    static ref CONNECTIONS: Arc<Mutex<HashMap<String, MCPConnection>>> = Arc::new(Mutex::new(HashMap::new()));
    static ref HTTP_CLIENT: Client = Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .expect("Failed to create HTTP client");
}

#[tauri::command]
pub async fn mcp_connect(id: String, name: String, url: String) -> Result<Vec<MCPTool>, String> {
    // Ensure URL has no trailing slash issues or protocol if needed
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

    let mut connections = CONNECTIONS.lock().await;
    connections.insert(id.clone(), MCPConnection {
        id,
        name,
        url,
        status: "active".to_string(),
        tools: tools.clone(),
    });

    Ok(tools)
}

#[tauri::command]
pub async fn mcp_call_tool(server_id: String, tool_name: String, arguments: serde_json::Value) -> Result<serde_json::Value, String> {
    let connections = CONNECTIONS.lock().await;
    let conn = connections.get(&server_id).ok_or_else(|| "Connection not found".to_string())?;
    
    let call_url = if conn.url.ends_with('/') {
        format!("{}call", conn.url)
    } else {
        format!("{}/call", conn.url)
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
