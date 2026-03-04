use scraper::{Html, Selector};
use xcap::Monitor;
use anyhow::{Result, Context};
use std::path::PathBuf;
use std::env;

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
