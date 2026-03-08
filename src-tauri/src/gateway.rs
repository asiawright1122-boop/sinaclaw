use std::sync::Arc;
use std::path::PathBuf;
use tokio::sync::Mutex;
use once_cell::sync::Lazy;
use tauri::Manager;
use tauri::Emitter;
use tokio::io::AsyncBufReadExt;

struct GatewayProcess {
    child: Option<tokio::process::Child>,
    pid: Option<u32>,
    started_at: Option<std::time::SystemTime>,
}

#[derive(serde::Serialize, Clone)]
struct GatewayLogEvent {
    stream: String,  // "stdout" | "stderr"
    line: String,
    timestamp: u64,
}

static GATEWAY: Lazy<Arc<Mutex<GatewayProcess>>> = Lazy::new(|| {
    Arc::new(Mutex::new(GatewayProcess {
        child: None,
        pid: None,
        started_at: None,
    }))
});

fn resolve_openclaw_entry(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let resource_dir = app.path().resource_dir()
        .map_err(|e| format!("无法获取资源目录: {}", e))?;

    let candidates = [
        resource_dir.join("openclaw/openclaw.mjs"),
        resource_dir.join("../Resources/openclaw/openclaw.mjs"),
        resource_dir.join("node_modules/openclaw/openclaw.mjs"),
        resource_dir.join("../Resources/node_modules/openclaw/openclaw.mjs"),
    ];

    for p in &candidates {
        if p.exists() {
            return Ok(p.clone());
        }
    }

    if let Ok(cwd) = std::env::current_dir() {
        let dev_path = cwd.join("node_modules/openclaw/openclaw.mjs");
        if dev_path.exists() {
            return Ok(dev_path);
        }
    }

    let which_cmd = if cfg!(target_os = "windows") { "where" } else { "which" };
    let global_check = std::process::Command::new(which_cmd)
        .arg("openclaw")
        .output();
    if let Ok(out) = global_check {
        if out.status.success() {
            let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
            return Ok(PathBuf::from(path));
        }
    }

    Err("未找到 OpenClaw。请确保已安装: npm install -g openclaw@latest".to_string())
}

/// 解析内嵌的 Node.js sidecar 二进制路径
fn resolve_node_binary(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let resource_dir = app.path().resource_dir()
        .map_err(|e| format!("无法获取资源目录: {}", e))?;

    // Tauri externalBin 打包后的路径
    let suffix = if cfg!(target_os = "windows") { ".exe" } else { "" };
    let candidates = [
        resource_dir.join(format!("bin/node{}", suffix)),
        resource_dir.join(format!("../MacOS/node{}", suffix)),
    ];

    for p in &candidates {
        if p.exists() {
            return Ok(p.clone());
        }
    }

    // 开发模式: src-tauri/bin/ 下
    let dev_bin = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(format!("bin/node{}", suffix));
    if dev_bin.exists() {
        return Ok(dev_bin);
    }

    // 回退: 系统 node
    let which_cmd = if cfg!(target_os = "windows") { "where" } else { "which" };
    if let Ok(out) = std::process::Command::new(which_cmd).arg("node").output() {
        if out.status.success() {
            let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !path.is_empty() {
                return Ok(PathBuf::from(path));
            }
        }
    }

    Err("未找到 Node.js 运行时。请重新安装 Sinaclaw 或安装 Node.js v22+".to_string())
}

/// 解析 openclaw 运行时依赖的 node_modules 目录
fn resolve_node_modules_dir(app: &tauri::AppHandle, entry: &std::path::Path) -> PathBuf {
    // 优先查找资源目录下的 node_modules（生产打包）
    if let Ok(resource_dir) = app.path().resource_dir() {
        let candidates = [
            resource_dir.join("node_modules"),
            resource_dir.join("../Resources/node_modules"),
        ];
        for p in &candidates {
            if p.exists() {
                return p.clone();
            }
        }
    }

    // 开发模式：entry 的祖父目录（node_modules/openclaw/openclaw.mjs → node_modules/）
    let openclaw_dir = entry.parent().unwrap_or(std::path::Path::new("."));
    let nm_dir = openclaw_dir.parent().unwrap_or(openclaw_dir);
    nm_dir.to_path_buf()
}

/// 获取用户 HOME 目录（跨平台）
fn dirs_home() -> String {
    if cfg!(target_os = "windows") {
        std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\Default".to_string())
    } else {
        std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string())
    }
}

async fn health_check() -> bool {
    reqwest::Client::new()
        .get("http://127.0.0.1:18789/health")
        .timeout(std::time::Duration::from_secs(2))
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}

#[tauri::command]
pub async fn openclaw_start_gateway(app: tauri::AppHandle) -> Result<String, String> {
    let mut gw = GATEWAY.lock().await;

    if gw.child.is_some() {
        return Ok("Gateway 已在运行中".to_string());
    }

    if health_check().await {
        return Ok("Gateway 已在外部运行中".to_string());
    }

    let entry = resolve_openclaw_entry(&app)?;
    let node_bin = resolve_node_binary(&app)?;
    let nm_dir = resolve_node_modules_dir(&app, &entry);

    let mut child = tokio::process::Command::new(node_bin.to_string_lossy().as_ref())
        .arg(entry.to_string_lossy().as_ref())
        .arg("gateway")
        .env("NODE_ENV", "production")
        .env("NODE_PATH", nm_dir.to_string_lossy().as_ref())
        .env("HOME", dirs_home())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("启动 Gateway 失败: {}", e))?;

    let pid = child.id();

    // 捕获 stdout 并转发为 Tauri 事件
    if let Some(stdout) = child.stdout.take() {
        let app_handle = app.clone();
        tokio::spawn(async move {
            let reader = tokio::io::BufReader::new(stdout);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let ts = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64;
                let _ = app_handle.emit("gateway-log", GatewayLogEvent {
                    stream: "stdout".to_string(),
                    line,
                    timestamp: ts,
                });
            }
        });
    }

    // 捕获 stderr 并转发为 Tauri 事件
    if let Some(stderr) = child.stderr.take() {
        let app_handle = app.clone();
        tokio::spawn(async move {
            let reader = tokio::io::BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let ts = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64;
                let _ = app_handle.emit("gateway-log", GatewayLogEvent {
                    stream: "stderr".to_string(),
                    line,
                    timestamp: ts,
                });
            }
        });
    }

    gw.child = Some(child);
    gw.pid = pid;
    gw.started_at = Some(std::time::SystemTime::now());
    drop(gw);

    for _ in 0..30 {
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        if health_check().await {
            return Ok("Gateway 已启动".to_string());
        }
    }

    Ok("Gateway 进程已启动（等待就绪中）".to_string())
}

#[tauri::command]
pub async fn openclaw_stop_gateway() -> Result<String, String> {
    let mut gw = GATEWAY.lock().await;

    if let Some(mut child) = gw.child.take() {
        let _ = child.kill().await;
        gw.pid = None;
        gw.started_at = None;
        return Ok("Gateway 已停止".to_string());
    }

    Ok("Gateway 未在运行".to_string())
}

#[tauri::command]
pub async fn openclaw_gateway_status() -> Result<serde_json::Value, String> {
    let gw = GATEWAY.lock().await;
    let has_process = gw.child.is_some();
    let pid = gw.pid;
    let started_at = gw.started_at;
    drop(gw);

    let mut running = false;
    let mut version = String::new();
    let mut health_data = serde_json::Value::Null;

    if let Ok(resp) = reqwest::Client::new()
        .get("http://127.0.0.1:18789/health")
        .timeout(std::time::Duration::from_secs(2))
        .send()
        .await
    {
        if resp.status().is_success() {
            running = true;
            if let Ok(data) = resp.json::<serde_json::Value>().await {
                version = data["version"].as_str().unwrap_or("").to_string();
                health_data = data;
            }
        }
    }

    let uptime_secs = started_at
        .and_then(|t| t.elapsed().ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let started_at_ms = started_at
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    Ok(serde_json::json!({
        "running": running,
        "hasProcess": has_process,
        "pid": pid,
        "port": 18789,
        "version": version,
        "uptimeSeconds": uptime_secs,
        "startedAt": started_at_ms,
        "health": health_data,
    }))
}

#[tauri::command]
pub async fn openclaw_restart_gateway(app: tauri::AppHandle) -> Result<String, String> {
    openclaw_stop_gateway().await?;
    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
    openclaw_start_gateway(app).await
}

#[tauri::command]
pub async fn openclaw_run_cli(app: tauri::AppHandle, command: String) -> Result<String, String> {
    let entry = resolve_openclaw_entry(&app)?;
    let node_bin = resolve_node_binary(&app)?;
    let nm_dir = resolve_node_modules_dir(&app, &entry);

    let mut args: Vec<String> = vec![entry.to_string_lossy().to_string()];
    for arg in shlex::split(&command).unwrap_or_else(|| command.split_whitespace().map(String::from).collect()) {
        args.push(arg);
    }

    let output = tokio::process::Command::new(node_bin.to_string_lossy().as_ref())
        .args(&args)
        .env("NODE_PATH", nm_dir.to_string_lossy().as_ref())
        .env("HOME", dirs_home())
        .output()
        .await
        .map_err(|e| format!("CLI 执行失败: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        Ok(stdout)
    } else {
        Err(format!("{}\n{}", stdout, stderr))
    }
}
