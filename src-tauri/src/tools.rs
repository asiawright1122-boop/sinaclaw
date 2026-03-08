use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use once_cell::sync::Lazy;

// ── 全局工作目录状态 ──────────────────────────────────────
static WORKSPACE_PATH: Lazy<Mutex<Option<PathBuf>>> = Lazy::new(|| Mutex::new(None));

/// 检查路径是否在已授权的工作目录内
/// 如果用户未设置工作目录，默认以 $HOME 作为安全边界
fn is_path_allowed(target: &Path) -> Result<(), String> {
    let ws = WORKSPACE_PATH.lock().map_err(|e| format!("锁异常: {}", e))?;
    let boundary = match ws.as_ref() {
        Some(workspace) => workspace.clone(),
        None => {
            // 未设置工作目录时，默认以用户 Home 目录为边界
            let home = std::env::var("HOME")
                .or_else(|_| std::env::var("USERPROFILE"))
                .map(PathBuf::from)
                .unwrap_or_else(|_| PathBuf::from("/"));
            home
        }
    };

    let canonical_target = target.canonicalize()
        .or_else(|_| {
            // 文件可能尚不存在（写入场景），检查父目录
            target.parent()
                .and_then(|p| p.canonicalize().ok())
                .map(|p| p.join(target.file_name().unwrap_or_default()))
                .ok_or_else(|| format!("无法解析路径: {}", target.display()))
        })?;
    let canonical_ws = boundary.canonicalize()
        .map_err(|e| format!("无法解析工作目录: {}", e))?;
    if canonical_target.starts_with(&canonical_ws) {
        Ok(())
    } else {
        Err(format!("⛔ 安全限制：路径 {} 不在已授权的工作范围 {} 内",
            target.display(), boundary.display()))
    }
}

#[tauri::command]
pub fn set_workspace(path: String) -> Result<String, String> {
    let p = PathBuf::from(&path);
    if !p.is_dir() {
        return Err(format!("路径不是有效目录: {}", path));
    }
    let mut ws = WORKSPACE_PATH.lock().map_err(|e| format!("锁异常: {}", e))?;
    *ws = Some(p);
    Ok(format!("✅ 工作目录已设置为: {}", path))
}

#[tauri::command]
pub fn get_workspace() -> Result<Option<String>, String> {
    let ws = WORKSPACE_PATH.lock().map_err(|e| format!("锁异常: {}", e))?;
    Ok(ws.as_ref().map(|p| p.to_string_lossy().to_string()))
}

/// 使用原生文件对话框选择工作目录
/// 通过 spawn_blocking 在独立线程运行，避免阻塞 Tauri 主线程/tokio 运行时
#[tauri::command]
pub async fn pick_folder() -> Result<Option<String>, String> {
    let result = tokio::task::spawn_blocking(|| {
        rfd::FileDialog::new()
            .set_title("选择工作目录")
            .pick_folder()
    })
    .await
    .map_err(|e| format!("线程异常: {}", e))?;

    match result {
        Some(path) => {
            let path_str = path.to_string_lossy().to_string();
            let mut ws = WORKSPACE_PATH.lock().map_err(|e| format!("锁异常: {}", e))?;
            *ws = Some(path);
            Ok(Some(path_str))
        }
        None => Ok(None),
    }
}

// ── 数据结构 ──────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommandResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub success: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EnvInfo {
    pub os: String,
    pub arch: String,
    pub tools: HashMap<String, ToolStatus>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolStatus {
    pub installed: bool,
    pub version: String,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DirEntry {
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
}

// ── 构建完整 PATH ───────────────────────────────────────
// macOS GUI 应用不继承终端的 PATH，必须手动补充

fn get_full_path() -> String {
    let sys_path = std::env::var("PATH").unwrap_or_default();
    let separator = if cfg!(target_os = "windows") { ";" } else { ":" };

    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| if cfg!(target_os = "windows") { "C:\\Users".to_string() } else { "/Users".to_string() });

    let extra_paths: Vec<String> = if cfg!(target_os = "windows") {
        vec![
            format!("{}\\AppData\\Roaming\\npm", home),
            format!("{}\\.cargo\\bin", home),
            format!("{}\\AppData\\Local\\Programs\\Python", home),
            format!("{}\\scoop\\shims", home),
            format!("{}\\.volta\\bin", home),
            "C:\\Program Files\\nodejs".to_string(),
            "C:\\Program Files\\Git\\cmd".to_string(),
            "C:\\Program Files\\Git\\bin".to_string(),
        ]
    } else {
        // macOS 常见工具路径
        vec![
            format!("{home}/.cargo/bin"),
            format!("{home}/.local/bin"),
            format!("{home}/.nvm/versions/node/*/bin"),
            "/opt/homebrew/bin".to_string(),
            "/opt/homebrew/sbin".to_string(),
            "/usr/local/bin".to_string(),
            "/usr/local/sbin".to_string(),
            "/usr/bin".to_string(),
            "/usr/sbin".to_string(),
            "/bin".to_string(),
            "/sbin".to_string(),
            format!("{home}/.volta/bin"),
            format!("{home}/.fnm/aliases/default/bin"),
            format!("{home}/.pyenv/shims"),
            format!("{home}/.rbenv/shims"),
        ]
    };

    let mut all_paths: Vec<String> = extra_paths;
    for p in sys_path.split(separator) {
        if !p.is_empty() && !all_paths.contains(&p.to_string()) {
            all_paths.push(p.to_string());
        }
    }
    all_paths.join(separator)
}

// ── 工具 1: 执行命令 ─────────────────────────────────────

#[tauri::command]
pub async fn tool_run_command(app: tauri::AppHandle, command: String, cwd: Option<String>) -> Result<CommandResult, String> {
    let is_node_command = command.starts_with("node ") || command == "node";

    if is_node_command {
        // 使用 Tauri Sidecar (内置的 node 二进制文件)
        // 从 "node script.js arg1" 中抽取出 script.js 和 arg1
        use tauri_plugin_shell::ShellExt;
        
        let mut sidecar = app.shell().sidecar("bin/node")
            .map_err(|e| format!("无法初始化 sidecar (node 内置环境): {}", e))?;
            
        let args: Vec<String> = command
            .split_whitespace()
            .skip(1) // 跳过 "node" 本身
            .map(|s| s.to_string())
            .collect();
            
        if !args.is_empty() {
             sidecar = sidecar.args(&args);
        }

        if let Some(dir) = &cwd {
             sidecar = sidecar.current_dir(Path::new(dir));
        }
        
        // 执行 built-in node
        let output = sidecar
            .output()
            .await
            .map_err(|e| format!("Node 内置环境执行失败: {}", e))?;
            
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let exit_code = output.status.code().unwrap_or(-1);

        Ok(CommandResult {
            stdout: truncate_output(&stdout, 8000),
            stderr: truncate_output(&stderr, 4000),
            exit_code,
            success: output.status.success(),
        })
    } else {
        // 普通的 Shell 命令 (Git, pip 等系统级命令)，回落到常规流程
        let shell = if cfg!(target_os = "windows") { "cmd" } else { "sh" };
        let flag = if cfg!(target_os = "windows") { "/C" } else { "-c" };

        let sandbox_enabled = std::env::var("SINACLAW_SANDBOX").unwrap_or_default() == "1";

        // 危险命令过滤（跨平台）
        if sandbox_enabled {
            let blocked = if cfg!(target_os = "windows") {
                vec!["format c:", "del /s /q c:\\", "rd /s /q c:\\", "shutdown", "reg delete"]
            } else {
                vec!["rm -rf /", "shutdown", "reboot", "mkfs", "dd if=/dev/zero"]
            };
            for b in &blocked {
                if command.contains(b) {
                    return Err(format!("⛔ 沙箱阻止了危险命令: {}", command));
                }
            }
        }

        let wrapped_command = if cfg!(target_os = "windows") {
            if sandbox_enabled {
                // Windows 无 timeout 命令，用 cmd 直接执行
                format!("set \"PATH={}\" && {}", get_full_path(), command)
            } else {
                format!("set \"PATH={}\" && {}", get_full_path(), command)
            }
        } else if sandbox_enabled {
            format!(
                "export PATH=\"{}\"; timeout 30 {}",
                get_full_path(),
                command
            )
        } else {
            format!(
                "export PATH=\"{}\"; {}",
                get_full_path(),
                command
            )
        };

        let mut cmd = tokio::process::Command::new(shell);
        cmd.arg(flag).arg(&wrapped_command);

        if let Some(dir) = &cwd {
            let path = Path::new(dir);
            if path.exists() {
                cmd.current_dir(path);
            }
        }

        cmd.env("PATH", get_full_path());

        let output = cmd
            .output()
            .await
            .map_err(|e| format!("命令执行失败: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let exit_code = output.status.code().unwrap_or(-1);

        Ok(CommandResult {
            stdout: truncate_output(&stdout, 8000),
            stderr: truncate_output(&stderr, 4000),
            exit_code,
            success: output.status.success(),
        })
    }
}

// ── 工具 2: 读取文件 ─────────────────────────────────────

#[tauri::command]
pub async fn tool_read_file(path: String) -> Result<String, String> {
    let file_path = Path::new(&path);

    is_path_allowed(file_path)?;

    if !file_path.exists() {
        return Err(format!("文件不存在: {}", path));
    }

    let metadata = std::fs::metadata(file_path)
        .map_err(|e| format!("无法读取文件信息: {}", e))?;

    // 限制读取大小为 500KB
    if metadata.len() > 500_000 {
        return Err(format!("文件过大 ({} bytes)，超过 500KB 限制", metadata.len()));
    }

    let content = tokio::fs::read_to_string(file_path)
        .await
        .map_err(|e| format!("读取文件失败: {}", e))?;

    Ok(content)
}

// ── 工具 3: 写入文件 ─────────────────────────────────────

#[tauri::command]
pub async fn tool_write_file(path: String, content: String) -> Result<String, String> {
    let file_path = Path::new(&path);

    is_path_allowed(file_path)?;

    // 确保父目录存在
    if let Some(parent) = file_path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("无法创建目录: {}", e))?;
    }

    tokio::fs::write(file_path, &content)
        .await
        .map_err(|e| format!("写入文件失败: {}", e))?;

    Ok(format!("✅ 已写入 {} ({} bytes)", path, content.len()))
}

// ── 工具 4: 列出目录 ─────────────────────────────────────

#[tauri::command]
pub async fn tool_list_dir(path: String) -> Result<Vec<DirEntry>, String> {
    let dir_path = Path::new(&path);

    is_path_allowed(dir_path)?;

    if !dir_path.exists() {
        return Err(format!("路径不存在: {}", path));
    }

    if !dir_path.is_dir() {
        return Err(format!("不是目录: {}", path));
    }

    let mut entries: Vec<DirEntry> = Vec::new();
    let mut read_dir = tokio::fs::read_dir(dir_path)
        .await
        .map_err(|e| format!("无法读取目录: {}", e))?;

    while let Some(entry) = read_dir.next_entry().await.map_err(|e| format!("读取条目失败: {}", e))? {
        let metadata = entry.metadata().await.unwrap_or_else(|_| {
            std::fs::metadata(entry.path()).unwrap()
        });

        let name = entry.file_name().to_string_lossy().to_string();

        // 跳过隐藏文件和 node_modules
        if name.starts_with('.') || name == "node_modules" || name == "target" {
            continue;
        }

        entries.push(DirEntry {
            name,
            is_dir: metadata.is_dir(),
            size: metadata.len(),
        });
    }

    entries.sort_by(|a, b| {
        b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name))
    });

    Ok(entries)
}

// ── 工具 5: 跨平台文件/目录存在性检测 ──────────────────────

#[tauri::command]
pub async fn tool_file_exists(path: String) -> Result<bool, String> {
    let p = Path::new(&path);
    Ok(p.exists())
}

// ── 工具 6: 检测环境 ─────────────────────────────────────

#[tauri::command]
pub async fn tool_detect_env() -> Result<EnvInfo, String> {
    let mut tools = HashMap::new();

    // 检测各个开发工具
    let checks = vec![
        ("node", "node --version"),
        ("npm", "npm --version"),
        ("yarn", "yarn --version"),
        ("pnpm", "pnpm --version"),
        ("git", "git --version"),
        ("rustc", "rustc --version"),
        ("cargo", "cargo --version"),
        ("python3", "python3 --version"),
        ("pip3", "pip3 --version"),
    ];

    for (name, cmd) in checks {
        let status = check_tool(cmd).await;
        tools.insert(name.to_string(), status);
    }

    let os = std::env::consts::OS.to_string();
    let arch = std::env::consts::ARCH.to_string();

    Ok(EnvInfo { os, arch, tools })
}

// ── 工具 6: 智能安装依赖 ─────────────────────────────────

#[tauri::command]
pub async fn tool_install_dependency(
    app: tauri::AppHandle,
    package_manager: String,
    packages: Vec<String>,
    cwd: Option<String>,
) -> Result<CommandResult, String> {
    let cmd = match package_manager.as_str() {
        "npm" => format!("npm install {}", packages.join(" ")),
        "yarn" => format!("yarn add {}", packages.join(" ")),
        "pnpm" => format!("pnpm add {}", packages.join(" ")),
        "cargo" => format!("cargo add {}", packages.join(" ")),
        "pip" | "pip3" => format!("pip3 install {}", packages.join(" ")),
        _ => return Err(format!("不支持的包管理器: {}", package_manager)),
    };

    tool_run_command(app, cmd, cwd).await
}

// ── 辅助函数 ─────────────────────────────────────────────

async fn check_tool(cmd: &str) -> ToolStatus {
    let shell = if cfg!(target_os = "windows") { "cmd" } else { "sh" };
    let flag = if cfg!(target_os = "windows") { "/C" } else { "-c" };

    let result = tokio::process::Command::new(shell)
        .arg(flag)
        .arg(cmd)
        .env("PATH", get_full_path())
        .output()
        .await;

    match result {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            // 尝试获取工具路径
            let which_cmd = if cfg!(target_os = "windows") {
                format!("where {}", cmd.split_whitespace().next().unwrap_or(""))
            } else {
                format!("which {}", cmd.split_whitespace().next().unwrap_or(""))
            };
            let path_result = tokio::process::Command::new(shell)
                .arg(flag)
                .arg(&which_cmd)
                .env("PATH", get_full_path())
                .output()
                .await;

            let path = path_result
                .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
                .unwrap_or_default();

            ToolStatus {
                installed: true,
                version,
                path,
            }
        }
        _ => ToolStatus {
            installed: false,
            version: String::new(),
            path: String::new(),
        },
    }
}

fn truncate_output(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        // 在 UTF-8 字符边界安全截断，避免多字节字符被切断导致 panic
        let mut end = max_len;
        while end > 0 && !s.is_char_boundary(end) {
            end -= 1;
        }
        let truncated = &s[..end];
        format!("{}...\n\n[输出已截断，共 {} 字符]", truncated, s.len())
    }
}
