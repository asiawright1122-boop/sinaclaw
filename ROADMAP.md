# Sinaclaw 开发规划

> **定位：OpenClaw for Everyone — 一键启动你的 AI 多通道助手**
>
> 无需终端、无需 npm、无需 Node.js — 下载，打开，配置密钥，即刻连接 22+ 通道。

---

## 现有功能盘点 (v0.1.0)

| 模块 | 文件 | 完成度 | 说明 |
|------|------|--------|------|
| **聊天核心** | `ChatPage.tsx`, `agent.ts` | ★★★★☆ | Agent Loop、流式响应、Deep Research 模式 |
| **Gateway 桥接** | `openclawBridge.ts`, `gateway.rs` | ★★★☆☆ | 启动/停止/状态/CLI 调用，缺少通道管理 UI |
| **设置面板** | `SettingsPage.tsx`, `settingsStore.ts` | ★★★★☆ | API Key、模型、语言、主题 |
| **知识库** | `KnowledgePage.tsx`, `embeddings.ts`, `db.ts` | ★★★☆☆ | 文档导入、向量嵌入、RAG 检索 |
| **技能商店** | `SkillStorePage.tsx`, `skills.ts`, `skillRegistry.ts` | ★★★☆☆ | 本地技能扫描、启用/禁用、在线市场 |
| **技能创造器** | `SkillMakerPage.tsx` | ★★★☆☆ | AI 辅助创建 Shell 技能 |
| **工具系统** | `tools.ts` | ★★★☆☆ | 浏览器、文件、系统工具 |
| **多 Agent** | `agentStore.ts`, `swarmRouter.ts` | ★★☆☆☆ | Agent 配置、Swarm 路由雏形 |
| **MCP** | `mcpStore.ts`, `mcpGenerator.ts` | ★★☆☆☆ | MCP 配置存储、生成器 |
| **云同步** | `cloudStore.ts`, `cloud.ts` | ★☆☆☆☆ | 基础框架 |
| **打包分发** | `bundle-openclaw.js`, `download-sidecars.js` | ★★★★☆ | Tauri DMG 打包、Node sidecar、依赖 bundle |
| **国际化** | `i18n.ts` | ★★★★☆ | 中文/英文 |

### 缺失的关键模块（竞品已有）

| 模块 | CoWork OS | TypingMind | Jan | 当前状态 |
|------|-----------|------------|-----|----------|
| 通道配置向导 | ✅ | — | — | ✅ `ChannelsPage.tsx` |
| 多通道统一收件箱 | ✅ | — | — | ✅ `InboxPage.tsx` |
| Gateway 状态面板 | ✅ | — | — | ✅ `GatewayPage.tsx` |
| 设备/节点管理 | ✅ | — | — | ✅ `DevicesPage.tsx` |
| Knowledge Graph | ✅ | — | — | ✅ `KnowledgePage.tsx` |
| 任务/日程面板 | ✅ | — | — | ✅ `AutomationPage.tsx` |
| Artifacts/Canvas | ✅ | ✅ | — | ✅ `CanvasPage.tsx` |
| 用量/成本追踪 | — | ✅ | — | ✅ `UsagePage.tsx` |
| 对话文件夹/标签 | — | ✅ | ✅ | ✅ `Sidebar.tsx` |
| 本地模型支持 | — | — | ✅ | ✅ `LocalModelsPage.tsx` |
| 云同步/备份 | — | ✅ | — | ✅ `SyncPage.tsx` |
| 安全/GDPR | — | — | — | ✅ `SecurityPage.tsx` |
| Gateway 集群 | — | — | — | ✅ `GatewayClusterPage.tsx` |
| Voice & TTS | — | — | — | ✅ `voiceManager.ts` |

---

## 开发阶段规划

### Phase 1：基础稳固 (v0.2.0) — 约 3-4 周

> **目标：让 Sinaclaw 可靠运行，Gateway 可视化管控**

#### P1.1 Gateway 控制面板 ⭐ 关键
- [x] **Gateway 状态页面** (`/gateway`)
  - 运行状态指示灯（启动中/运行中/已停止/错误）
  - 启动/停止/重启按钮
  - 实时日志流（WebSocket 订阅 Gateway 日志）
  - 运行时长、版本号、端口信息
- [x] **Gateway 健康检查**
  - 心跳监测，断线自动重连
  - Gateway 异常时 UI 提示和恢复建议
- [x] 文件涉及：`openclawBridge.ts`（增加日志订阅）、`gateway.rs`（增加日志转发）、新建 `GatewayPage.tsx`

#### P1.2 通道配置向导 ⭐ 关键
- [x] **图形化通道配置**（`/channels`）
  - 列出 OpenClaw 支持的 22+ 通道，带图标和状态
  - 每个通道的配置表单（Token/密钥输入、选项开关）
  - 通道连接测试按钮
  - 配置写入 OpenClaw 的 `config.json5`
- [x] **首次启动引导** (Onboarding Wizard)
  - 引导选择 LLM 提供商 → 输入 API Key → 选择首个通道 → 测试连接
  - 复用 OpenClaw 的 `wizard` CLI 命令，用 GUI 包装
- [x] 文件涉及：新建 `ChannelsPage.tsx`、`SetupWizard.tsx`、`channelStore.ts`

#### P1.3 对话组织增强
- [x] **对话文件夹** — 创建文件夹、拖拽分组
- [x] **对话搜索** — 全文搜索历史对话
- [x] **对话标签** — 给对话打标签、按标签过滤
- [x] **对话置顶/归档**
- [x] 文件涉及：`chatStore.ts`、`Sidebar.tsx`、`db.ts`

#### P1.4 打包与分发完善
- [x] Windows (MSI/NSIS) 打包测试
- [x] Linux (AppImage/deb) 打包测试
- [x] 自动更新机制 (`tauri-plugin-updater`)
- [x] CI/CD 流水线（GitHub Actions：build → test → publish）

---

### Phase 2：通道体验 (v0.3.0) — 约 4-5 周

> **目标：让用户真正通过 Sinaclaw 管理多通道消息**

#### P2.1 多通道统一收件箱 ⭐ 差异化核心
- [x] **统一收件箱页面** (`/inbox`)
  - 按通道分栏或混合时间线视图
  - 消息来源标识（WhatsApp/Telegram/Slack 图标 + 用户头像）
  - 消息回复（自动路由到原通道）
  - 未读计数、@提及高亮
- [x] **会话管理**
  - 活跃会话列表
  - 会话状态（等待回复/Agent 处理中/已关闭）
  - 手动接管/交回 Agent
- [x] 技术实现：订阅 Gateway 的 `chat` 事件流，本地 SQLite 存储消息
- [x] 文件涉及：新建 `InboxPage.tsx`、`inboxStore.ts`、`messageDb.ts`

#### P2.2 通道状态监控
- [x] **通道仪表板**
  - 每个通道的连接状态、最后活跃时间
  - 消息收发计数（日/周图表）
  - 错误日志和重连操作
- [x] 文件涉及：扩展 `ChannelsPage.tsx`

#### P2.3 Artifacts / Canvas
- [x] **Artifacts 面板**
  - Agent 生成的代码/HTML/图表可在侧面板实时预览
  - 支持编辑和重新渲染
- [x] **OpenClaw Canvas 集成**
  - 嵌入 OpenClaw 的 A2UI Canvas（`/__openclaw__/canvas/`）
  - 通过 WebView 加载 Gateway 的 Canvas 端点
- [x] 文件涉及：新建 `ArtifactPanel.tsx`、`CanvasPage.tsx`

#### P2.4 设备节点管理
- [x] **Nodes 管理页面** (`/devices`)
  - 已配对设备列表（macOS/iOS/Android/headless）
  - 设备能力展示（camera/screen/location/canvas）
  - 配对/取消配对操作
  - 向设备发送命令（截图、录屏、获取位置等）
- [x] 技术实现：通过 Gateway WS API 的 device 相关方法
- [x] 文件涉及：新建 `DevicesPage.tsx`、`deviceStore.ts`

---

### Phase 3：智能增强 (v0.4.0) — 约 4-5 周

> **目标：提升 Agent 智能和自动化能力**

#### P3.1 Agent 工作台
- [x] **多 Agent 管理面板**
  - 可视化 Agent 列表（角色、模型、系统提示词）
  - Agent 模板市场（预设角色：客服、翻译、摘要等）
  - Agent 性能统计（响应时间、Token 消耗、满意度）
- [x] **Agent 流程编排**
  - 可视化 Swarm 路由配置
  - Agent 之间的任务委托规则
  - 条件触发（关键词 → 特定 Agent）
- [x] 文件涉及：扩展 `agentStore.ts`、`swarmRouter.ts`、新建 `AgentWorkbenchPage.tsx`

#### P3.2 自动化面板
- [x] **Cron 任务管理**
  - 可视化创建/编辑/删除定时任务
  - 任务执行历史和日志
  - 示例模板（每日摘要、定时提醒、报告生成）
- [x] **Webhook 管理**
  - Webhook URL 生成和管理
  - 请求日志查看
  - 与技能/Agent 的绑定
- [x] **Gmail Pub/Sub 配置**
  - 图形化配置 Gmail 触发器
- [x] 技术实现：调用 OpenClaw CLI 的 cron/webhook 命令
- [x] 文件涉及：新建 `AutomationPage.tsx`、`automationStore.ts`

#### P3.3 用量与成本追踪
- [x] **用量仪表板** (`/usage`)
  - Token 消耗趋势图（按天/周/月）
  - 按模型/通道的用量分布
  - 成本估算（根据各提供商定价）
  - 预算预警设置
- [x] 技术实现：从 Gateway 的 usage tracking 事件收集数据
- [x] 文件涉及：新建 `UsagePage.tsx`、`usageStore.ts`

#### P3.4 知识库增强
- [x] **结构化知识**
  - 实体提取和关系图谱可视化（参考 CoWork OS）
  - 知识条目的手动编辑/标注
- [x] **知识来源扩展**
  - 网页爬取和定期更新
  - 支持更多格式（Excel、PPT、Markdown）
- [x] 文件涉及：扩展 `KnowledgePage.tsx`、`embeddings.ts`、`db.ts`

---

### Phase 4：生态与协作 (v0.5.0) — 约 5-6 周

> **目标：构建生态，支持团队使用**

#### P4.1 技能/Agent 市场
- [x] **在线市场**
  - 技能/Agent 模板的浏览、搜索、安装
  - 用户评分和评论
  - 一键安装到本地
- [x] **技能发布**
  - 本地技能打包和上传
  - 版本管理
- [x] 文件涉及：扩展 `SkillStorePage.tsx`、`skillRegistry.ts`

#### P4.2 云同步与多设备
- [x] **配置同步**
  - Agent 配置、通道配置、技能配置的云端备份
  - 多设备间同步
- [x] **对话同步**
  - 可选的对话历史云端备份
  - 端到端加密
- [x] 文件涉及：扩展 `cloudStore.ts`、`cloud.ts`、新建 `SyncPage.tsx`

#### P4.3 本地模型集成
- [x] **Ollama 集成**
  - 检测本地 Ollama 服务
  - 模型列表、下载、管理
  - 作为 LLM Provider 可选
- [x] **llama.cpp 直接集成**（可选）
  - 内嵌推理引擎，无需外部依赖
- [x] 文件涉及：扩展 `settingsStore.ts`、新建 `localModelManager.ts`、`LocalModelsPage.tsx`

#### P4.4 Voice & TTS 集成
- [x] **语音输入**
  - 麦克风录音 → Whisper 转写
  - 支持本地 Whisper 和云端 API
- [x] **语音输出**
  - TTS 朗读 Agent 回复
  - 支持 ElevenLabs、OpenAI TTS、系统 TTS
- [x] **Voice Wake**（macOS）
  - 集成 OpenClaw 的 voicewake 能力
- [x] 文件涉及：新建 `voiceManager.ts`、扩展 `ChatPage.tsx`

---

### Phase 5：企业就绪 (v1.0.0) — 约 6-8 周

> **目标：达到生产级质量，支持企业部署**

#### P5.1 安全加固
- [x] API Key 加密存储（密码保护）
- [x] Gateway Token 管理
- [x] 审计日志
- [x] 数据导出/删除（GDPR 合规）

#### P5.2 多用户支持
- [x] 多用户 Gateway 共享（权限分级）
- [x] 通道访问控制（谁可以访问哪些通道）
- [x] Agent 使用权限

#### P5.3 远程 Gateway 管理
- [x] 连接远程 Gateway（SSH Tunnel / Tailscale）
- [x] 多 Gateway 切换
- [x] Gateway 集群监控

#### P5.4 性能优化
- [x] 大量对话的虚拟滚动
- [x] 消息数据库分页加载
- [x] 内存占用优化
- [x] 冷启动速度优化

#### P5.5 质量保障
- [x] 单元测试覆盖率 > 80%
- [x] E2E 测试（Playwright）核心流程覆盖
- [x] 性能基准测试
- [x] 安全审计

---

## 技术架构演进

### 当前架构 (v0.1)

```
┌──────────────────────────┐
│     Tauri WebView        │
│  ┌────────────────────┐  │
│  │  React + Zustand   │  │
│  │  (Chat/Settings/   │  │
│  │   Knowledge/Skills)│  │
│  └────────┬───────────┘  │
│           │ invoke()     │
│  ┌────────▼───────────┐  │
│  │  Rust Backend      │  │
│  │  (gateway.rs)      │  │
│  └────────┬───────────┘  │
│           │ spawn        │
│  ┌────────▼───────────┐  │
│  │  Node.js Sidecar   │  │
│  │  (OpenClaw Gateway)│  │
│  └────────────────────┘  │
└──────────────────────────┘
```

### 目标架构 (v1.0)

```
┌──────────────────────────────────────────────┐
│                Tauri WebView                  │
│  ┌─────────────────────────────────────────┐  │
│  │           React + Zustand               │  │
│  │  ┌──────┐ ┌──────┐ ┌───────┐ ┌──────┐  │  │
│  │  │ Chat │ │Inbox │ │Devices│ │Canvas│  │  │
│  │  └──┬───┘ └──┬───┘ └──┬────┘ └──┬───┘  │  │
│  │  ┌──┴───┐ ┌──┴──┐ ┌───┴───┐ ┌───┴──┐   │  │
│  │  │Agent │ │Chan │ │Autom  │ │Usage │   │  │
│  │  │ Mgr  │ │ Mgr │ │ation  │ │Track │   │  │
│  │  └──────┘ └─────┘ └───────┘ └──────┘   │  │
│  │         ┌──────────────┐                │  │
│  │         │ openclawBridge│ (WS + invoke) │  │
│  │         └──────┬───────┘                │  │
│  └────────────────┼────────────────────────┘  │
│                   │                           │
│  ┌────────────────▼────────────────────────┐  │
│  │          Rust Backend                   │  │
│  │  gateway.rs | config.rs | logger.rs     │  │
│  │  updater.rs | security.rs              │  │
│  └────────────────┬────────────────────────┘  │
│                   │                           │
│  ┌────────────────▼────────────────────────┐  │
│  │       Node.js Sidecar (OpenClaw)        │  │
│  │  Gateway ← WS → Channels (22+)         │  │
│  │  Pi Agent Runtime | Skills | Cron       │  │
│  │  Canvas Host | WebChat | Nodes          │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │         Local Storage Layer             │  │
│  │  SQLite (chats, knowledge, usage)       │  │
│  │  tauri-store (settings, keys)           │  │
│  │  OpenClaw DB (sessions, skills)         │  │
│  └─────────────────────────────────────────┘  │
└───────────────────────────────────────────────┘
         │                           │
    ┌────▼────┐                 ┌────▼────┐
    │  Cloud  │                 │  Local  │
    │  LLMs   │                 │  Ollama │
    └─────────┘                 └─────────┘
```

---

## 里程碑与优先级矩阵

```
影响力 ↑
      │
  高  │  ★ 通道配置向导    ★ 统一收件箱     ★ 企业安全
      │  ★ Gateway 面板    ★ 自动化面板     ★ 多用户
      │  ★ 首次引导
      │
  中  │  ◆ 对话组织增强    ◆ Artifacts      ◆ 本地模型
      │  ◆ 打包完善        ◆ 设备管理       ◆ 云同步
      │                    ◆ 用量追踪       ◆ Voice
      │
  低  │  ○ CI/CD          ○ 知识图谱        ○ 市场
      │                    ○ Agent 编排
      │
      └──────────────────────────────────────→ 实现难度
           低               中               高
```

---

## 路由规划 (最终)

```
/                   → ChatPage (首页/聊天)
/gateway            → GatewayPage (Gateway 控制面板)
/channels           → ChannelsPage (通道配置与监控)
/inbox              → InboxPage (多通道统一收件箱)
/devices            → DevicesPage (节点/设备管理)
/agents             → AgentWorkbenchPage (Agent 工作台)
/automation         → AutomationPage (Cron/Webhook/Gmail)
/knowledge          → KnowledgePage (知识库)
/skills             → SkillStorePage (技能商店)
/skill-maker        → SkillMakerPage (技能创造器)
/canvas             → CanvasPage (Canvas/Artifacts)
/usage              → UsagePage (用量与成本追踪)
/models             → LocalModelsPage (本地模型/Ollama 管理)
/sync               → SyncPage (云同步与多设备备份)
/security           → SecurityPage (安全与隐私/Token/审计/GDPR)
/gateway-cluster    → GatewayClusterPage (远程 Gateway 集群管理)
/settings           → SettingsPage (设置)
```

---

## 竞争策略总结

| 策略 | 具体行动 |
|------|----------|
| **复用 OpenClaw 而非自建** | Gateway、Agent、通道、技能全部复用上游，专注 GUI 体验 |
| **"零配置"差异化** | 首次引导向导 + 内嵌 Node.js + Bundle 依赖 = 用户无需任何技术知识 |
| **通道数量碾压** | 22+ 通道 vs CoWork OS 15 通道，突出亚洲通道（飞书/LINE/Zalo） |
| **轻量 vs 臃肿** | Tauri 68MB vs Electron 200MB+，强调性能和资源占用 |
| **统一收件箱** | 核心差异化功能，其他 LLM 前端均无此能力 |
| **跟随 OpenClaw 社区** | 及时跟进上游更新，成为 OpenClaw 推荐的桌面 GUI |

---

## 版本发布节奏

| 版本 | 状态 | 核心交付 |
|------|------|----------|
| v0.2.0 | ✅ 已完成 | Gateway 面板 + 通道向导 + 对话增强 + 跨平台打包 |
| v0.3.0 | ✅ 已完成 | 统一收件箱 + Artifacts + 设备管理 + 通道监控 |
| v0.4.0 | ✅ 已完成 | Agent 工作台 + 自动化 + 用量追踪 + 知识增强 |
| v0.5.0 | ✅ 已完成 | 市场 + 云同步 + 本地模型 + Voice |
| v1.0.0 | ✅ 已完成 | 安全加固 + 多用户 + 远程 Gateway + 性能优化 |
| v1.1.0 | 📋 规划中 | MCP 深度集成 + 插件系统 + 多窗口 |

---

## Phase 6：扩展与创新 (v1.1.0+) — 规划中

> **目标：构建插件生态，深度 MCP 集成，多窗口体验**

### P6.1 MCP 深度集成
- [ ] **MCP Server 浏览器** — 发现、安装、管理 MCP Server
- [ ] **MCP Tool 可视化** — 将 MCP 工具直接暴露为聊天可用工具
- [ ] **MCP Resource 集成** — 将 MCP 资源作为知识源接入 RAG
- [ ] **自定义 MCP Server 创建** — 通过 GUI 生成 MCP Server 模板

### P6.2 插件系统
- [ ] **插件 API** — 定义插件接口规范（生命周期、Hook 点、UI 扩展）
- [ ] **插件沙箱** — WebWorker 隔离执行，权限控制
- [ ] **插件市场** — 在线发现、安装、评分
- [ ] **内置插件** — 日历集成、邮件摘要、代码审查、翻译

### P6.3 多窗口支持
- [ ] **独立对话窗口** — 将对话弹出为独立窗口 (Tauri multiwindow)
- [ ] **悬浮助手** — 全局快捷键呼出悬浮输入窗口
- [ ] **画中画模式** — 小窗 Agent 持续运行
- [ ] **多显示器优化** — 记忆窗口位置和大小

### P6.4 高级 Agent 能力
- [ ] **Agent 记忆** — 长期记忆存储与检索 (向量化)
- [ ] **Agent 协作** — 多 Agent 实时协作完成复杂任务
- [ ] **Agent 自主学习** — 从用户反馈中调整行为
- [ ] **Agent 沙箱** — 安全执行代码和系统命令

### P6.5 数据可视化与分析
- [ ] **交互式图表** — 基于对话数据自动生成图表
- [ ] **数据仪表板** — 自定义数据看板
- [ ] **报告生成** — 定期自动生成分析报告 (PDF/Markdown)
