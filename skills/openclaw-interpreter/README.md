# 🧪 OpenClaw Interpreter

> Sinaclaw 代码执行沙盒 — 基于 MCP (Model Context Protocol) 标准

## 功能

| 工具名 | 描述 |
|--------|------|
| `execute_python` | 在安全沙盒中执行任意 Python 代码（支持 pandas/numpy/matplotlib） |
| `analyze_csv` | 读取 CSV/Excel/TSV 文件，返回数据概览与统计摘要 |
| `render_chart` | 执行 matplotlib/seaborn 绑图代码，返回 base64 PNG |

## 快速启动

```bash
# 1. 安装依赖
cd skills/openclaw-interpreter
python3 -m venv venv && source venv/bin/activate
pip install mcp pandas matplotlib seaborn numpy

# 2. 直接运行（stdio 模式）
python server.py
```

## 在 Sinaclaw 中使用

在设置页 → 扩展 → 添加服务器，选择 **OpenClaw Interpreter** 预设即可自动挂载。

或手动配置 stdio 类型服务器：
- 命令: `python3 /path/to/skills/openclaw-interpreter/server.py`
- 类型: stdio

## 安全说明

- 代码在当前进程的隔离命名空间中执行，**不做网络隔离**。
- 适合本地可信环境使用。生产级部署建议使用 Docker 容器隔离。
