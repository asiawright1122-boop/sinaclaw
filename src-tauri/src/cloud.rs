/**
 * 云存储集成模块
 *
 * 支持 Google Drive / OneDrive / Dropbox
 * 统一接口：OAuth2 认证 + 文件浏览 / 下载 / 上传 / 删除
 */
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

// ── 数据结构 ──────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CloudFile {
    pub id: String,
    pub name: String,
    pub mime_type: String,
    pub size: u64,
    pub is_folder: bool,
    pub modified_at: String,
    pub path: String,         // 相对路径
    pub download_url: String, // 直接下载链接（如果有）
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CloudAccount {
    pub provider: String,       // "google_drive" | "onedrive" | "dropbox"
    pub email: String,
    pub display_name: String,
    pub total_space: u64,       // bytes
    pub used_space: u64,
    pub connected: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CloudTokens {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: u64, // unix timestamp
}

// Token 缓存（运行时内存 + JSON 文件持久化）
use std::sync::Mutex;
use once_cell::sync::Lazy;

static TOKEN_STORE: Lazy<Mutex<HashMap<String, CloudTokens>>> =
    Lazy::new(|| {
        // 启动时尝试从磁盘加载已保存的 token
        match load_tokens_from_disk() {
            Ok(tokens) => Mutex::new(tokens),
            Err(_) => Mutex::new(HashMap::new()),
        }
    });

/// 获取 token 持久化文件路径
fn get_tokens_file_path() -> Result<std::path::PathBuf, String> {
    let home = std::env::var("HOME").map_err(|_| "无法获取 HOME 目录".to_string())?;
    let dir = std::path::PathBuf::from(home).join(".sinaclaw");
    std::fs::create_dir_all(&dir).map_err(|e| format!("创建目录失败: {}", e))?;
    Ok(dir.join("cloud_tokens.json"))
}

/// 将当前内存中的 token 持久化到磁盘
fn persist_tokens() -> Result<(), String> {
    let store = TOKEN_STORE.lock().map_err(|e| format!("Lock 失败: {}", e))?;
    let path = get_tokens_file_path()?;
    let json = serde_json::to_string_pretty(&*store).map_err(|e| format!("序列化失败: {}", e))?;
    std::fs::write(&path, json).map_err(|e| format!("写入失败: {}", e))?;
    Ok(())
}

/// 从磁盘加载已保存的 token
fn load_tokens_from_disk() -> Result<HashMap<String, CloudTokens>, String> {
    let path = get_tokens_file_path()?;
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let data = std::fs::read_to_string(&path).map_err(|e| format!("读取失败: {}", e))?;
    let tokens: HashMap<String, CloudTokens> = serde_json::from_str(&data)
        .map_err(|e| format!("解析失败: {}", e))?;
    Ok(tokens)
}

// ── OAuth2 配置 ──────────────────────────────────────────

struct OAuthConfig {
    auth_url: &'static str,
    token_url: &'static str,
    scopes: &'static [&'static str],
    redirect_uri: &'static str,
}

fn get_oauth_config(provider: &str) -> Result<OAuthConfig, String> {
    match provider {
        "google_drive" => Ok(OAuthConfig {
            auth_url: "https://accounts.google.com/o/oauth2/v2/auth",
            token_url: "https://oauth2.googleapis.com/token",
            scopes: &["https://www.googleapis.com/auth/drive"],
            redirect_uri: "http://localhost:19726/oauth/callback",
        }),
        "onedrive" => Ok(OAuthConfig {
            auth_url: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
            token_url: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            scopes: &["Files.ReadWrite", "User.Read", "offline_access"],
            redirect_uri: "http://localhost:19726/oauth/callback",
        }),
        "dropbox" => Ok(OAuthConfig {
            auth_url: "https://www.dropbox.com/oauth2/authorize",
            token_url: "https://api.dropboxapi.com/oauth2/token",
            scopes: &[],
            redirect_uri: "http://localhost:19726/oauth/callback",
        }),
        _ => Err(format!("不支持的云存储提供商: {}", provider)),
    }
}

// ── 命令 1: 获取 OAuth URL ───────────────────────────────

#[tauri::command]
pub async fn cloud_auth_url(
    provider: String,
    client_id: String,
) -> Result<String, String> {
    let config = get_oauth_config(&provider)?;

    let scopes = config.scopes.join(" ");
    let url = format!(
        "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=consent",
        config.auth_url,
        urlencoding::encode(&client_id),
        urlencoding::encode(config.redirect_uri),
        urlencoding::encode(&scopes),
    );

    Ok(url)
}

// ── 命令 2: 用 code 换 token ─────────────────────────────

#[tauri::command]
pub async fn cloud_auth_exchange(
    provider: String,
    client_id: String,
    client_secret: String,
    code: String,
) -> Result<CloudAccount, String> {
    let config = get_oauth_config(&provider)?;

    let client = reqwest::Client::new();

    // 通用 token 请求
    let mut params = HashMap::new();
    params.insert("grant_type", "authorization_code");
    params.insert("code", &code);
    params.insert("client_id", &client_id);
    params.insert("client_secret", &client_secret);
    params.insert("redirect_uri", config.redirect_uri);

    let resp = client
        .post(config.token_url)
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Token 请求失败: {}", e))?;

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Token 响应解析失败: {}", e))?;

    let access_token = body["access_token"]
        .as_str()
        .ok_or("未获取到 access_token")?
        .to_string();
    let refresh_token = body["refresh_token"].as_str().map(|s| s.to_string());
    let expires_in = body["expires_in"].as_u64().unwrap_or(3600);

    let tokens = CloudTokens {
        access_token: access_token.clone(),
        refresh_token,
        expires_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
            + expires_in,
    };

    // 存储 token（内存 + 磁盘）
    TOKEN_STORE
        .lock()
        .map_err(|e| format!("Token 存储失败: {}", e))?
        .insert(provider.clone(), tokens);
    let _ = persist_tokens();

    // 获取用户信息
    let account = get_account_info(&provider, &access_token).await?;

    Ok(account)
}

// ── 命令 3: 列出文件 ─────────────────────────────────────

#[tauri::command]
pub async fn cloud_list_files(
    provider: String,
    folder_id: Option<String>,
) -> Result<Vec<CloudFile>, String> {
    let token = get_valid_token(&provider)?;

    match provider.as_str() {
        "google_drive" => list_google_drive(&token, folder_id).await,
        "onedrive" => list_onedrive(&token, folder_id).await,
        "dropbox" => list_dropbox(&token, folder_id).await,
        _ => Err(format!("不支持: {}", provider)),
    }
}

// ── 命令 4: 下载文件 ─────────────────────────────────────

#[tauri::command]
pub async fn cloud_download(
    provider: String,
    file_id: String,
    local_path: String,
) -> Result<String, String> {
    let token = get_valid_token(&provider)?;

    let bytes = match provider.as_str() {
        "google_drive" => download_google_drive(&token, &file_id).await?,
        "onedrive" => download_onedrive(&token, &file_id).await?,
        "dropbox" => download_dropbox(&token, &file_id).await?,
        _ => return Err(format!("不支持: {}", provider)),
    };

    // 确保父目录存在
    let path = Path::new(&local_path);
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("创建目录失败: {}", e))?;
    }

    tokio::fs::write(path, &bytes)
        .await
        .map_err(|e| format!("写入文件失败: {}", e))?;

    Ok(format!(
        "✅ 已下载到 {} ({} bytes)",
        local_path,
        bytes.len()
    ))
}

// ── 命令 5: 上传文件 ─────────────────────────────────────

#[tauri::command]
pub async fn cloud_upload(
    provider: String,
    local_path: String,
    remote_folder_id: Option<String>,
    file_name: Option<String>,
) -> Result<CloudFile, String> {
    let token = get_valid_token(&provider)?;

    let path = Path::new(&local_path);
    if !path.exists() {
        return Err(format!("本地文件不存在: {}", local_path));
    }

    let bytes = tokio::fs::read(path)
        .await
        .map_err(|e| format!("读取文件失败: {}", e))?;

    let name = file_name.unwrap_or_else(|| {
        path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "unnamed".to_string())
    });

    match provider.as_str() {
        "google_drive" => upload_google_drive(&token, &bytes, &name, remote_folder_id).await,
        "onedrive" => upload_onedrive(&token, &bytes, &name, remote_folder_id).await,
        "dropbox" => upload_dropbox(&token, &bytes, &name, remote_folder_id).await,
        _ => Err(format!("不支持: {}", provider)),
    }
}

// ── 命令 6: 删除文件 ─────────────────────────────────────

#[tauri::command]
pub async fn cloud_delete(
    provider: String,
    file_id: String,
) -> Result<String, String> {
    let token = get_valid_token(&provider)?;
    let client = reqwest::Client::new();

    match provider.as_str() {
        "google_drive" => {
            client
                .delete(&format!(
                    "https://www.googleapis.com/drive/v3/files/{}",
                    file_id
                ))
                .bearer_auth(&token)
                .send()
                .await
                .map_err(|e| format!("删除失败: {}", e))?;
        }
        "onedrive" => {
            client
                .delete(&format!(
                    "https://graph.microsoft.com/v1.0/me/drive/items/{}",
                    file_id
                ))
                .bearer_auth(&token)
                .send()
                .await
                .map_err(|e| format!("删除失败: {}", e))?;
        }
        "dropbox" => {
            let mut body = HashMap::new();
            body.insert("path", file_id.clone());
            client
                .post("https://api.dropboxapi.com/2/files/delete_v2")
                .bearer_auth(&token)
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("删除失败: {}", e))?;
        }
        _ => return Err(format!("不支持: {}", provider)),
    }

    Ok(format!("✅ 已删除: {}", file_id))
}

// ── 命令 7: 获取连接状态 ─────────────────────────────────

#[tauri::command]
pub async fn cloud_get_status(
    provider: String,
) -> Result<CloudAccount, String> {
    let token = get_valid_token(&provider)?;
    get_account_info(&provider, &token).await
}

// ── 命令 8: 断开连接 ─────────────────────────────────────

#[tauri::command]
pub async fn cloud_disconnect(
    provider: String,
) -> Result<String, String> {
    TOKEN_STORE
        .lock()
        .map_err(|e| format!("操作失败: {}", e))?
        .remove(&provider);
    let _ = persist_tokens();
    Ok(format!("✅ 已断开 {} 连接", provider))
}

// ══════════════════════════════════════════════════════════
// 以下为各平台具体实现
// ══════════════════════════════════════════════════════════

// ── Token 管理 ───────────────────────────────────────────

fn get_valid_token(provider: &str) -> Result<String, String> {
    let store = TOKEN_STORE
        .lock()
        .map_err(|e| format!("Token 读取失败: {}", e))?;
    let tokens = store
        .get(provider)
        .ok_or_else(|| format!("未连接 {}，请先授权登录", provider))?;
    Ok(tokens.access_token.clone())
}

// ── 用户信息 ─────────────────────────────────────────────

async fn get_account_info(provider: &str, token: &str) -> Result<CloudAccount, String> {
    let client = reqwest::Client::new();

    match provider {
        "google_drive" => {
            let about: serde_json::Value = client
                .get("https://www.googleapis.com/drive/v3/about?fields=user,storageQuota")
                .bearer_auth(token)
                .send()
                .await
                .map_err(|e| format!("请求失败: {}", e))?
                .json()
                .await
                .map_err(|e| format!("解析失败: {}", e))?;

            Ok(CloudAccount {
                provider: "google_drive".into(),
                email: about["user"]["emailAddress"]
                    .as_str()
                    .unwrap_or("")
                    .to_string(),
                display_name: about["user"]["displayName"]
                    .as_str()
                    .unwrap_or("")
                    .to_string(),
                total_space: about["storageQuota"]["limit"]
                    .as_str()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0),
                used_space: about["storageQuota"]["usage"]
                    .as_str()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0),
                connected: true,
            })
        }
        "onedrive" => {
            let me: serde_json::Value = client
                .get("https://graph.microsoft.com/v1.0/me")
                .bearer_auth(token)
                .send()
                .await
                .map_err(|e| format!("请求失败: {}", e))?
                .json()
                .await
                .map_err(|e| format!("解析失败: {}", e))?;

            let drive: serde_json::Value = client
                .get("https://graph.microsoft.com/v1.0/me/drive")
                .bearer_auth(token)
                .send()
                .await
                .map_err(|e| format!("请求失败: {}", e))?
                .json()
                .await
                .map_err(|e| format!("解析失败: {}", e))?;

            Ok(CloudAccount {
                provider: "onedrive".into(),
                email: me["mail"]
                    .as_str()
                    .or(me["userPrincipalName"].as_str())
                    .unwrap_or("")
                    .to_string(),
                display_name: me["displayName"].as_str().unwrap_or("").to_string(),
                total_space: drive["quota"]["total"].as_u64().unwrap_or(0),
                used_space: drive["quota"]["used"].as_u64().unwrap_or(0),
                connected: true,
            })
        }
        "dropbox" => {
            let user: serde_json::Value = client
                .post("https://api.dropboxapi.com/2/users/get_current_account")
                .bearer_auth(token)
                .header("Content-Type", "application/json")
                .body("null")
                .send()
                .await
                .map_err(|e| format!("请求失败: {}", e))?
                .json()
                .await
                .map_err(|e| format!("解析失败: {}", e))?;

            let space: serde_json::Value = client
                .post("https://api.dropboxapi.com/2/users/get_space_usage")
                .bearer_auth(token)
                .header("Content-Type", "application/json")
                .body("null")
                .send()
                .await
                .map_err(|e| format!("请求失败: {}", e))?
                .json()
                .await
                .map_err(|e| format!("解析失败: {}", e))?;

            Ok(CloudAccount {
                provider: "dropbox".into(),
                email: user["email"].as_str().unwrap_or("").to_string(),
                display_name: user["name"]["display_name"]
                    .as_str()
                    .unwrap_or("")
                    .to_string(),
                total_space: space["allocation"]["allocated"].as_u64().unwrap_or(0),
                used_space: space["used"].as_u64().unwrap_or(0),
                connected: true,
            })
        }
        _ => Err(format!("不支持: {}", provider)),
    }
}

// ══════════════════════════════════════════════════════════
// Google Drive 实现
// ══════════════════════════════════════════════════════════

async fn list_google_drive(
    token: &str,
    folder_id: Option<String>,
) -> Result<Vec<CloudFile>, String> {
    let client = reqwest::Client::new();
    let parent = folder_id.unwrap_or_else(|| "root".to_string());

    let query = format!("'{}' in parents and trashed = false", parent);
    let url = format!(
        "https://www.googleapis.com/drive/v3/files?q={}&fields=files(id,name,mimeType,size,modifiedTime)&orderBy=folder,name&pageSize=100",
        urlencoding::encode(&query)
    );

    let resp: serde_json::Value = client
        .get(&url)
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?
        .json()
        .await
        .map_err(|e| format!("解析失败: {}", e))?;

    let files = resp["files"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .map(|f| {
            let is_folder = f["mimeType"].as_str() == Some("application/vnd.google-apps.folder");
            CloudFile {
                id: f["id"].as_str().unwrap_or("").to_string(),
                name: f["name"].as_str().unwrap_or("").to_string(),
                mime_type: f["mimeType"].as_str().unwrap_or("").to_string(),
                size: f["size"]
                    .as_str()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0),
                is_folder,
                modified_at: f["modifiedTime"].as_str().unwrap_or("").to_string(),
                path: String::new(),
                download_url: String::new(),
            }
        })
        .collect();

    Ok(files)
}

async fn download_google_drive(token: &str, file_id: &str) -> Result<Vec<u8>, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "https://www.googleapis.com/drive/v3/files/{}?alt=media",
        file_id
    );

    let bytes = client
        .get(&url)
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("下载失败: {}", e))?
        .bytes()
        .await
        .map_err(|e| format!("读取失败: {}", e))?;

    Ok(bytes.to_vec())
}

async fn upload_google_drive(
    token: &str,
    bytes: &[u8],
    name: &str,
    folder_id: Option<String>,
) -> Result<CloudFile, String> {
    let client = reqwest::Client::new();

    // 使用 multipart upload
    let mut metadata = serde_json::json!({ "name": name });
    if let Some(fid) = &folder_id {
        metadata["parents"] = serde_json::json!([fid]);
    }

    let boundary = "sinaclaw_boundary_123";
    let body = format!(
        "--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{}\r\n--{boundary}\r\nContent-Type: application/octet-stream\r\n\r\n",
        metadata.to_string()
    );

    let mut full_body = body.into_bytes();
    full_body.extend_from_slice(bytes);
    full_body.extend_from_slice(format!("\r\n--{boundary}--").as_bytes());

    let resp: serde_json::Value = client
        .post("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime")
        .bearer_auth(token)
        .header(
            "Content-Type",
            format!("multipart/related; boundary={}", boundary),
        )
        .body(full_body)
        .send()
        .await
        .map_err(|e| format!("上传失败: {}", e))?
        .json()
        .await
        .map_err(|e| format!("解析失败: {}", e))?;

    Ok(CloudFile {
        id: resp["id"].as_str().unwrap_or("").to_string(),
        name: resp["name"].as_str().unwrap_or("").to_string(),
        mime_type: resp["mimeType"].as_str().unwrap_or("").to_string(),
        size: resp["size"]
            .as_str()
            .and_then(|s| s.parse().ok())
            .unwrap_or(0),
        is_folder: false,
        modified_at: resp["modifiedTime"].as_str().unwrap_or("").to_string(),
        path: String::new(),
        download_url: String::new(),
    })
}

// ══════════════════════════════════════════════════════════
// OneDrive 实现
// ══════════════════════════════════════════════════════════

async fn list_onedrive(
    token: &str,
    folder_id: Option<String>,
) -> Result<Vec<CloudFile>, String> {
    let client = reqwest::Client::new();
    let url = match &folder_id {
        Some(id) => format!(
            "https://graph.microsoft.com/v1.0/me/drive/items/{}/children?$select=id,name,size,lastModifiedDateTime,file,folder&$top=100",
            id
        ),
        None => "https://graph.microsoft.com/v1.0/me/drive/root/children?$select=id,name,size,lastModifiedDateTime,file,folder&$top=100".to_string(),
    };

    let resp: serde_json::Value = client
        .get(&url)
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?
        .json()
        .await
        .map_err(|e| format!("解析失败: {}", e))?;

    let files = resp["value"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .map(|f| CloudFile {
            id: f["id"].as_str().unwrap_or("").to_string(),
            name: f["name"].as_str().unwrap_or("").to_string(),
            mime_type: f["file"]["mimeType"]
                .as_str()
                .unwrap_or("folder")
                .to_string(),
            size: f["size"].as_u64().unwrap_or(0),
            is_folder: f["folder"].is_object(),
            modified_at: f["lastModifiedDateTime"]
                .as_str()
                .unwrap_or("")
                .to_string(),
            path: String::new(),
            download_url: String::new(),
        })
        .collect();

    Ok(files)
}

async fn download_onedrive(token: &str, file_id: &str) -> Result<Vec<u8>, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "https://graph.microsoft.com/v1.0/me/drive/items/{}/content",
        file_id
    );

    let bytes = client
        .get(&url)
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("下载失败: {}", e))?
        .bytes()
        .await
        .map_err(|e| format!("读取失败: {}", e))?;

    Ok(bytes.to_vec())
}

async fn upload_onedrive(
    token: &str,
    bytes: &[u8],
    name: &str,
    folder_id: Option<String>,
) -> Result<CloudFile, String> {
    let client = reqwest::Client::new();
    let url = match &folder_id {
        Some(id) => format!(
            "https://graph.microsoft.com/v1.0/me/drive/items/{}:/{}:/content",
            id, name
        ),
        None => format!(
            "https://graph.microsoft.com/v1.0/me/drive/root:/{}:/content",
            name
        ),
    };

    let resp: serde_json::Value = client
        .put(&url)
        .bearer_auth(token)
        .header("Content-Type", "application/octet-stream")
        .body(bytes.to_vec())
        .send()
        .await
        .map_err(|e| format!("上传失败: {}", e))?
        .json()
        .await
        .map_err(|e| format!("解析失败: {}", e))?;

    Ok(CloudFile {
        id: resp["id"].as_str().unwrap_or("").to_string(),
        name: resp["name"].as_str().unwrap_or("").to_string(),
        mime_type: resp["file"]["mimeType"]
            .as_str()
            .unwrap_or("")
            .to_string(),
        size: resp["size"].as_u64().unwrap_or(0),
        is_folder: false,
        modified_at: resp["lastModifiedDateTime"]
            .as_str()
            .unwrap_or("")
            .to_string(),
        path: String::new(),
        download_url: String::new(),
    })
}

// ══════════════════════════════════════════════════════════
// Dropbox 实现
// ══════════════════════════════════════════════════════════

async fn list_dropbox(
    token: &str,
    folder_path: Option<String>,
) -> Result<Vec<CloudFile>, String> {
    let client = reqwest::Client::new();
    let path = folder_path.unwrap_or_default();

    let body = serde_json::json!({
        "path": if path.is_empty() { "" } else { &path },
        "limit": 100,
        "include_media_info": false,
    });

    let resp: serde_json::Value = client
        .post("https://api.dropboxapi.com/2/files/list_folder")
        .bearer_auth(token)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?
        .json()
        .await
        .map_err(|e| format!("解析失败: {}", e))?;

    let files = resp["entries"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .map(|f| {
            let tag = f[".tag"].as_str().unwrap_or("");
            CloudFile {
                id: f["id"].as_str().unwrap_or("").to_string(),
                name: f["name"].as_str().unwrap_or("").to_string(),
                mime_type: if tag == "folder" {
                    "folder".to_string()
                } else {
                    "file".to_string()
                },
                size: f["size"].as_u64().unwrap_or(0),
                is_folder: tag == "folder",
                modified_at: f["server_modified"].as_str().unwrap_or("").to_string(),
                path: f["path_display"].as_str().unwrap_or("").to_string(),
                download_url: String::new(),
            }
        })
        .collect();

    Ok(files)
}

async fn download_dropbox(token: &str, file_path: &str) -> Result<Vec<u8>, String> {
    let client = reqwest::Client::new();
    let api_arg = serde_json::json!({ "path": file_path });

    let bytes = client
        .post("https://content.dropboxapi.com/2/files/download")
        .bearer_auth(token)
        .header("Dropbox-API-Arg", api_arg.to_string())
        .send()
        .await
        .map_err(|e| format!("下载失败: {}", e))?
        .bytes()
        .await
        .map_err(|e| format!("读取失败: {}", e))?;

    Ok(bytes.to_vec())
}

async fn upload_dropbox(
    token: &str,
    bytes: &[u8],
    name: &str,
    folder_path: Option<String>,
) -> Result<CloudFile, String> {
    let client = reqwest::Client::new();
    let remote_path = match &folder_path {
        Some(p) => format!("{}/{}", p.trim_end_matches('/'), name),
        None => format!("/{}", name),
    };

    let api_arg = serde_json::json!({
        "path": remote_path,
        "mode": "overwrite",
        "autorename": true,
    });

    let resp: serde_json::Value = client
        .post("https://content.dropboxapi.com/2/files/upload")
        .bearer_auth(token)
        .header("Dropbox-API-Arg", api_arg.to_string())
        .header("Content-Type", "application/octet-stream")
        .body(bytes.to_vec())
        .send()
        .await
        .map_err(|e| format!("上传失败: {}", e))?
        .json()
        .await
        .map_err(|e| format!("解析失败: {}", e))?;

    Ok(CloudFile {
        id: resp["id"].as_str().unwrap_or("").to_string(),
        name: resp["name"].as_str().unwrap_or("").to_string(),
        mime_type: "file".to_string(),
        size: resp["size"].as_u64().unwrap_or(0),
        is_folder: false,
        modified_at: resp["server_modified"].as_str().unwrap_or("").to_string(),
        path: resp["path_display"].as_str().unwrap_or("").to_string(),
        download_url: String::new(),
    })
}
