use scraper::{Html, Selector};
use xcap::Monitor;
use anyhow::{Result, Context};
use std::path::PathBuf;
use std::env;

/// 跨平台查找 Chrome/Chromium 浏览器
async fn find_chrome() -> Option<String> {
    let candidates: Vec<&str> = if cfg!(target_os = "windows") {
        vec![
            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
            "C:\\Program Files\\Chromium\\Application\\chrome.exe",
        ]
    } else {
        vec![
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
            "google-chrome",
            "chromium",
            "chromium-browser",
        ]
    };

    for path in &candidates {
        if std::path::Path::new(path).exists() {
            return Some(path.to_string());
        }
        let which_cmd = if cfg!(target_os = "windows") { "where" } else { "which" };
        if let Ok(out) = tokio::process::Command::new(which_cmd).arg(path).output().await {
            if out.status.success() {
                return Some(path.to_string());
            }
        }
    }
    None
}

/// 网页抓取工具
#[tauri::command]
pub async fn tool_fetch_url(url: String) -> Result<String, String> {
    fetch_url_internal(&url).await.map_err(|e: anyhow::Error| e.to_string())
}

async fn fetch_url_internal(url: &str) -> Result<String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()?;
        
    let response = client.get(url).send().await?;
    if !response.status().is_success() {
        return Err(anyhow::anyhow!("网页抓取失败: HTTP {}", response.status()));
    }
    
    let html_content = response.text().await?;
    let document = Html::parse_document(&html_content);
    let body_selector = Selector::parse("body").unwrap();

    // 收集 script/style/noscript 节点 ID，提取文本时跳过
    let skip_selectors = ["script", "style", "noscript"];
    let mut skip_ids = std::collections::HashSet::new();
    for sel_str in &skip_selectors {
        if let Ok(sel) = Selector::parse(sel_str) {
            for el in document.select(&sel) {
                skip_ids.insert(el.id());
            }
        }
    }

    let mut text = String::new();
    if let Some(body) = document.select(&body_selector).next() {
        for node in body.descendants() {
            if let Some(txt) = node.value().as_text() {
                // 检查该文本节点的所有祖先是否在跳过列表中
                let in_skip = node.ancestors().any(|a| skip_ids.contains(&a.id()));
                if !in_skip {
                    let trimmed = txt.trim();
                    if !trimmed.is_empty() {
                        text.push_str(trimmed);
                        text.push(' ');
                    }
                }
            }
        }
    } else {
        return Err(anyhow::anyhow!("未找到网页的主体内容"));
    }
    
    // 截断过长的文本
    if text.len() > 10000 {
        text.truncate(10000);
        text.push_str("\n\n... (网页内容过长，已被截断)");
    }
    
    Ok(text)
}

/// 互联网搜索工具 (DuckDuckGo Lite Web Scraper)

#[tauri::command]
pub async fn tool_search_web(query: String) -> Result<String, String> {
    search_web_internal(&query).await.map_err(|e: anyhow::Error| e.to_string())
}

async fn search_web_internal(query: &str) -> Result<String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()?;

    // 请求 DuckDuckGo Lite 版 (无 JS, 纯 HTML)
    let url = format!("https://lite.duckduckgo.com/lite/");
    let params = [("q", query), ("kl", ""), ("df", "")];
    
    let response = client.post(&url)
        .form(&params)
        .send()
        .await?;
        
    if !response.status().is_success() {
        return Err(anyhow::anyhow!("搜索请求失败: HTTP {}", response.status()));
    }
    
    let html_content = response.text().await?;
    let document = Html::parse_document(&html_content);
    
    // 解析表格结果
    let tr_selector = Selector::parse("tr").unwrap();
    let td_result_snippet_selector = Selector::parse("td.result-snippet").unwrap();
    let a_selector = Selector::parse("a.result-url").unwrap();
    let a_title_selector = Selector::parse("a.result-title").unwrap();
    
    let mut results_str = format!("🔍 Web Search Results for '{}':\n\n", query);
    let mut count = 0;
    
    for tr in document.select(&tr_selector) {
        if count >= 5 {
            break; // 限制返回前 5 条结果避免上下文过长
        }
        
        let title_elem = tr.select(&a_title_selector).next();
        let snippet_elem = tr.select(&td_result_snippet_selector).next();
        let url_elem = tr.select(&a_selector).next();
        
        if let (Some(title), Some(snippet), Some(url)) = (title_elem, snippet_elem, url_elem) {
            let title_text = title.text().collect::<Vec<_>>().join("").trim().to_string();
            let snippet_text = snippet.text().collect::<Vec<_>>().join("").trim().to_string();
            let href = url.value().attr("href").unwrap_or("").to_string();
            
            if !title_text.is_empty() {
                results_str.push_str(&format!("{}. {}\n", count + 1, title_text));
                results_str.push_str(&format!("   🔗 {}\n", href));
                results_str.push_str(&format!("   📄 {}\n\n", snippet_text));
                count += 1;
            }
        }
    }
    
    if count == 0 {
        return Ok(format!("没有找到与 '{}' 相关的搜索结果。", query));
    }
    
    Ok(results_str)
}

/// 屏幕截取工具
#[tauri::command]
pub async fn tool_screenshot() -> Result<String, String> {
    screenshot_internal().map_err(|e: anyhow::Error| e.to_string())
}

fn screenshot_internal() -> Result<String> {
    // 获取主显示器
    let monitors = Monitor::all().context("无法获取显示器列表")?;
    let main_monitor = monitors.first().context("未找到任何活动显示器")?;
    
    // 拍摄截图
    let image = main_monitor.capture_image().context("截图失败")?;
    
    // 生成系统临时路径
    let temp_dir = env::temp_dir();
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();
    let file_path: PathBuf = temp_dir.join(format!("sinaclaw_screenshot_{}.png", timestamp));
    
    // 保存至本地
    image.save(&file_path).context("保存截图文件失败")?;
    
    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn tool_browser_screenshot(
    url: String,
    output_path: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
) -> Result<String, String> {
    let w = width.unwrap_or(1280);
    let h = height.unwrap_or(800);

    let out = match output_path {
        Some(p) => p,
        None => {
            let ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            let tmp = std::env::temp_dir().join(format!("sinaclaw_screenshot_{}.png", ts));
            tmp.to_string_lossy().to_string()
        }
    };

    let chrome = find_chrome().await
        .ok_or("未找到 Chrome/Chromium 浏览器，请安装 Google Chrome")?;

    let output = tokio::process::Command::new(&chrome)
        .args(&[
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            &format!("--window-size={},{}", w, h),
            &format!("--screenshot={}", out),
            &url,
        ])
        .output()
        .await
        .map_err(|e| format!("Chrome 截图失败: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("截图命令失败: {}", stderr));
    }

    Ok(format!("截图已保存: {}", out))
}

#[tauri::command]
pub async fn tool_browser_run_js(
    url: String,
    script: String,
    wait_ms: Option<u64>,
) -> Result<String, String> {
    let wait = wait_ms.unwrap_or(2000);

    let chrome = find_chrome().await
        .ok_or("未找到 Chrome/Chromium 浏览器，请安装 Google Chrome")?;
    let timeout = wait + 5000;

    // 创建临时 HTML wrapper，通过 fetch 加载目标页面内容后执行用户脚本
    let html_file = std::env::temp_dir().join(format!("sinaclaw_eval_{}.html",
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis()
    ));

    let html_content = format!(
        r#"<!DOCTYPE html><html><body><script>
setTimeout(async()=>{{
  try{{
    const r = await (async()=>{{ {script} }})();
    document.title = '__RESULT__:' + JSON.stringify(r ?? 'done');
  }}catch(e){{
    document.title = '__RESULT__:ERROR:' + e.message;
  }}
}},{wait});
</script></body></html>"#,
        script = script, wait = wait
    );

    std::fs::write(&html_file, &html_content).map_err(|e| format!("写入临时文件失败: {}", e))?;
    let html_url = format!("file://{}", html_file.to_string_lossy());

    let output = tokio::process::Command::new(&chrome)
        .args(&[
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            "--dump-dom",
            &format!("--virtual-time-budget={}", timeout),
            &html_url,
        ])
        .output()
        .await
        .map_err(|e| format!("Chrome 执行失败: {}", e))?;

    let _ = std::fs::remove_file(&html_file);

    let stdout = String::from_utf8_lossy(&output.stdout);

    // 从 dump-dom 输出中提取 <title> 中的结果
    if let Some(start) = stdout.find("__RESULT__:") {
        let rest = &stdout[start + 11..];
        let end = rest.find('<').unwrap_or(rest.len());
        return Ok(rest[..end].trim().to_string());
    }

    Ok(format!("已在页面上执行脚本（注意：目标 URL {} 需在脚本内通过 fetch 访问）。DOM 输出: {}", url, stdout.chars().take(2000).collect::<String>()))
}
