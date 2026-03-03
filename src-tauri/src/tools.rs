use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

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
    let home = std::env::var("HOME").unwrap_or_else(|_| "/Users".to_string());

    // 补充 macOS 常见工具路径
    let extra_paths = vec![
        format!("{home}/.cargo/bin"),
        format!("{home}/.local/bin"),
        format!("{home}/.nvm/versions/node/*/bin"), // nvm
        "/opt/homebrew/bin".to_string(),
        "/opt/homebrew/sbin".to_string(),
        "/usr/local/bin".to_string(),
        "/usr/local/sbin".to_string(),
        "/usr/bin".to_string(),
        "/usr/sbin".to_string(),
        "/bin".to_string(),
        "/sbin".to_string(),
        format!("{home}/.volta/bin"),       // volta
        format!("{home}/.fnm/aliases/default/bin"), // fnm
        format!("{home}/.pyenv/shims"),     // pyenv
        format!("{home}/.rbenv/shims"),     // rbenv
    ];

    let mut all_paths: Vec<String> = extra_paths;
    for p in sys_path.split(':') {
        if !all_paths.contains(&p.to_string()) {
            all_paths.push(p.to_string());
        }
    }
    all_paths.join(":")
}

// ── 工具 1: 执行命令 ─────────────────────────────────────

#[tauri::command]
pub async fn tool_run_command(command: String, cwd: Option<String>) -> Result<CommandResult, String> {
    let shell = if cfg!(target_os = "windows") { "cmd" } else { "sh" };
    let flag = if cfg!(target_os = "windows") { "/C" } else { "-c" };

    // 用 login shell 包装命令，确保加载 ~/.zshrc / ~/.bashrc 中的环境变量
    let wrapped_command = if cfg!(target_os = "windows") {
        command.clone()
    } else {
        // source profile 然后执行命令，这样 nvm/volta 等也能正常工作
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

    // 设置完整 PATH
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

// ── 工具 2: 读取文件 ─────────────────────────────────────

#[tauri::command]
pub async fn tool_read_file(path: String) -> Result<String, String> {
    let file_path = Path::new(&path);

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

// ── 工具 5: 检测环境 ─────────────────────────────────────

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

    tool_run_command(cmd, cwd).await
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
        let truncated = &s[..max_len];
        format!("{}...\n\n[输出已截断，共 {} 字符]", truncated, s.len())
    }
}
