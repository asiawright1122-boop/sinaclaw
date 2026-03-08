"""
OpenClaw GraphRAG — 混合检索 + 知识图谱 MCP Server

工具：
  - hybrid_search: BM25 + 向量双路召回 + RRF 融合排序
  - build_graph:   从文档提取实体-关系对构建图谱
  - graph_query:   图谱关联检索
"""

from mcp.server.fastmcp import FastMCP
import json
import os
import re
from collections import defaultdict

mcp = FastMCP("openclaw-rag-engine", version="1.0.0")

# ── 存储 ──────────────────────────────────────────────────

# 简单的内存文档存储
documents: dict[str, str] = {}  # doc_id -> content
graph: dict[str, list[dict]] = defaultdict(list)  # entity -> [{"relation", "target", "source_doc"}]


# ── 工具 1: 混合检索 ──────────────────────────────────────

@mcp.tool()
def hybrid_search(query: str, top_k: int = 5) -> str:
    """
    在已加载的文档中执行混合检索 (BM25 关键词 + 简易语义匹配)。
    返回最相关的文档片段，按融合分数排序。

    Args:
        query: 搜索查询文本
        top_k: 返回的最大结果数量
    """
    if not documents:
        return "⚠️ 当前没有加载任何文档。请先调用 build_graph 或上传文档。"

    query_terms = set(query.lower().split())
    results = []

    for doc_id, content in documents.items():
        # 按段落切分
        paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]

        for i, para in enumerate(paragraphs):
            para_lower = para.lower()
            para_terms = set(para_lower.split())

            # BM25 近似：词频匹配
            bm25_score = len(query_terms & para_terms) / (len(query_terms) + 1)

            # 简易语义：连续子串匹配
            semantic_score = 0
            for term in query_terms:
                if term in para_lower:
                    semantic_score += 1
            semantic_score /= (len(query_terms) + 1)

            # RRF 融合
            rrf_score = 1 / (60 + (1 / (bm25_score + 0.001))) + 1 / (60 + (1 / (semantic_score + 0.001)))

            results.append({
                "doc_id": doc_id,
                "paragraph_index": i,
                "score": round(rrf_score, 4),
                "text": para[:500],
            })

    results.sort(key=lambda x: x["score"], reverse=True)
    top_results = results[:top_k]

    if not top_results:
        return f"未找到与 '{query}' 相关的内容。"

    output = f"## 检索结果 (Top {len(top_results)})\n\n"
    for i, r in enumerate(top_results, 1):
        output += f"### [{i}] 来源: {r['doc_id']} (段落 {r['paragraph_index']}, 分数: {r['score']})\n"
        output += f"{r['text']}\n\n"

    return output


# ── 工具 2: 构建知识图谱 ──────────────────────────────────

@mcp.tool()
def build_graph(document_path: str, document_id: str = "") -> str:
    """
    读取文档文件，提取实体和关系构建知识图谱。
    支持 .txt, .md, .csv 文件。

    Args:
        document_path: 文档文件的绝对路径
        document_id: 可选的文档 ID，默认使用文件名
    """
    if not os.path.exists(document_path):
        return f"❌ 文件不存在: {document_path}"

    try:
        with open(document_path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        return f"❌ 读取文件失败: {e}"

    doc_id = document_id or os.path.basename(document_path)
    documents[doc_id] = content

    # 简单的实体-关系提取（基于模式匹配）
    entity_count = 0
    relation_count = 0

    # 提取引号中的概念/术语作为实体
    entities = set(re.findall(r'[""「」《》]([^""「」《》]{2,20})[""「」《》]', content))

    # 提取标题作为核心实体
    headings = re.findall(r'^#{1,3}\s+(.+)$', content, re.MULTILINE)
    entities.update(headings)

    entity_count = len(entities)

    # 构建共现关系（同一段落中出现的实体视为关联）
    paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]
    for para in paragraphs:
        para_entities = [e for e in entities if e in para]
        for i, e1 in enumerate(para_entities):
            for e2 in para_entities[i + 1:]:
                graph[e1].append({
                    "relation": "co-occurs",
                    "target": e2,
                    "source_doc": doc_id,
                })
                graph[e2].append({
                    "relation": "co-occurs",
                    "target": e1,
                    "source_doc": doc_id,
                })
                relation_count += 1

    return (
        f"✅ 图谱构建完成\n"
        f"- 文档: {doc_id}\n"
        f"- 内容长度: {len(content)} 字符\n"
        f"- 提取实体: {entity_count} 个\n"
        f"- 关系边: {relation_count} 条\n\n"
        f"实体列表: {', '.join(list(entities)[:20])}{'...' if len(entities) > 20 else ''}"
    )


# ── 工具 3: 图谱查询 ──────────────────────────────────────

@mcp.tool()
def graph_query(entity: str, depth: int = 2) -> str:
    """
    从知识图谱中查询与指定实体关联的所有节点。
    支持多跳查询（depth 控制深度）。

    Args:
        entity: 要查询的实体名称
        depth: 查询深度（1=直接关联, 2=二跳关联）
    """
    if not graph:
        return "⚠️ 图谱为空。请先调用 build_graph 加载文档。"

    # 精确匹配或模糊匹配
    matched_entity = None
    for key in graph:
        if entity.lower() in key.lower() or key.lower() in entity.lower():
            matched_entity = key
            break

    if not matched_entity:
        available = list(graph.keys())[:20]
        return f"未找到实体 '{entity}'。\n\n可用实体: {', '.join(available)}"

    # BFS 多跳遍历
    visited = set()
    queue = [(matched_entity, 0)]
    results = []

    while queue:
        current, d = queue.pop(0)
        if current in visited or d > depth:
            continue
        visited.add(current)

        relations = graph.get(current, [])
        for rel in relations:
            results.append({
                "from": current,
                "relation": rel["relation"],
                "to": rel["target"],
                "depth": d,
                "source": rel["source_doc"],
            })
            if d + 1 <= depth and rel["target"] not in visited:
                queue.append((rel["target"], d + 1))

    if not results:
        return f"实体 '{matched_entity}' 存在于图谱中，但没有关联关系。"

    output = f"## 图谱查询: {matched_entity}\n\n"
    output += f"| 深度 | 起点 | 关系 | 终点 | 来源 |\n"
    output += f"|------|------|------|------|------|\n"

    seen = set()
    for r in results:
        key = f"{r['from']}-{r['to']}"
        if key not in seen:
            seen.add(key)
            output += f"| {r['depth']} | {r['from']} | {r['relation']} | {r['to']} | {r['source']} |\n"

    output += f"\n共 {len(seen)} 条关系 (深度 ≤ {depth})"
    return output


if __name__ == "__main__":
    mcp.run()
