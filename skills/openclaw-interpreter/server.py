"""
OpenClaw Interpreter — MCP Server
=================================
一个轻量级的 Python 代码执行沙盒，以标准 MCP (Model Context Protocol) 方式
暴露工具给 Sinaclaw Agent 调用。

提供三个工具：
  1. execute_python  — 在隔离环境中执行任意 Python 代码片段
  2. analyze_csv     — 读取 CSV/Excel 文件并返回统计摘要
  3. render_chart    — 生成图表并返回 base64 编码的 PNG 图片
"""

import base64
import io
import sys
import traceback
from contextlib import redirect_stdout, redirect_stderr

from mcp.server.fastmcp import FastMCP

# ── 初始化 MCP Server ──────────────────────────────────────

mcp = FastMCP(
    "openclaw-interpreter",
    version="0.1.0",
)

# ── 沙盒全局命名空间（跨调用保持状态） ────────────────────

_sandbox_globals: dict = {
    "__builtins__": __builtins__,
}

# 预加载常用数据科学库到沙盒
try:
    import pandas as pd
    import numpy as np
    _sandbox_globals["pd"] = pd
    _sandbox_globals["np"] = np
except ImportError:
    pass

try:
    import matplotlib
    matplotlib.use("Agg")  # 非交互式后端
    import matplotlib.pyplot as plt
    import seaborn as sns
    _sandbox_globals["plt"] = plt
    _sandbox_globals["sns"] = sns
    _sandbox_globals["matplotlib"] = matplotlib
except ImportError:
    pass


# ── 工具 1: 执行 Python 代码 ──────────────────────────────

@mcp.tool()
def execute_python(code: str) -> str:
    """在安全沙盒中执行 Python 代码。支持多行脚本、变量持久化、pandas/numpy/matplotlib。
    返回标准输出和最后一个表达式的 repr。如果出错，返回完整的 traceback。

    Args:
        code: 要执行的 Python 代码字符串
    """
    stdout_capture = io.StringIO()
    stderr_capture = io.StringIO()

    try:
        with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
            # 尝试 eval（单表达式），失败则 exec（多行脚本）
            try:
                result = eval(code, _sandbox_globals)
                if result is not None:
                    print(repr(result))
            except SyntaxError:
                exec(code, _sandbox_globals)

        output = stdout_capture.getvalue()
        errors = stderr_capture.getvalue()

        parts = []
        if output.strip():
            parts.append(output.strip())
        if errors.strip():
            parts.append(f"[stderr]\n{errors.strip()}")

        return "\n".join(parts) if parts else "(无输出)"

    except Exception:
        tb = traceback.format_exc()
        return f"❌ 执行出错:\n{tb}"


# ── 工具 2: CSV/Excel 数据分析 ─────────────────────────────

@mcp.tool()
def analyze_csv(file_path: str, head_rows: int = 5) -> str:
    """读取 CSV 或 Excel 文件，返回数据概览（前 N 行、列信息、统计摘要）。

    Args:
        file_path: 文件的绝对路径（支持 .csv, .xlsx, .xls, .tsv）
        head_rows: 预览的行数，默认 5
    """
    try:
        import pandas as pd

        ext = file_path.rsplit(".", 1)[-1].lower()
        if ext in ("xlsx", "xls"):
            df = pd.read_excel(file_path)
        elif ext == "tsv":
            df = pd.read_csv(file_path, sep="\t")
        else:
            df = pd.read_csv(file_path)

        # 保存到沙盒全局变量以便后续 execute_python 引用
        _sandbox_globals["df"] = df

        parts = [
            f"📊 数据集: {file_path}",
            f"形状: {df.shape[0]} 行 × {df.shape[1]} 列",
            "",
            "── 列信息 ──",
            str(df.dtypes.to_string()),
            "",
            f"── 前 {head_rows} 行 ──",
            df.head(head_rows).to_markdown(index=False),
            "",
            "── 数值统计 ──",
            df.describe().to_markdown(),
        ]
        return "\n".join(parts)

    except Exception:
        return f"❌ 读取失败:\n{traceback.format_exc()}"


# ── 工具 3: 图表渲染 ──────────────────────────────────────

@mcp.tool()
def render_chart(code: str, width: int = 10, height: int = 6) -> str:
    """执行 matplotlib/seaborn 绑图代码，返回 base64 编码的 PNG 图片。
    代码中可以直接使用 plt, sns, df 等已在沙盒中加载的变量。

    Args:
        code: 使用 matplotlib 或 seaborn 的绑图 Python 代码
        width: 图片宽度（英寸），默认 10
        height: 图片高度（英寸），默认 6
    """
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        plt.close("all")
        fig = plt.figure(figsize=(width, height), dpi=120)
        _sandbox_globals["fig"] = fig

        exec(code, _sandbox_globals)

        buf = io.BytesIO()
        plt.savefig(buf, format="png", bbox_inches="tight", facecolor="white")
        plt.close("all")
        buf.seek(0)

        b64 = base64.b64encode(buf.read()).decode("utf-8")
        return f"data:image/png;base64,{b64}"

    except Exception:
        return f"❌ 图表渲染出错:\n{traceback.format_exc()}"


# ── 启动入口 ──────────────────────────────────────────────

if __name__ == "__main__":
    mcp.run()
