# Sinaclaw 项目改进计划

> 基于对 147 个源文件（20,459 行）的深度审查，按优先级制定以下改进计划。

---

## 已完成的优化 ✅

| 项目 | 状态 |
|------|------|
| `as any` / `: any` / `e: any` | 全部清零（147 文件） |
| `@ts-ignore` / `@ts-expect-error` | 零使用 |
| 未使用导入/变量 | `--noUnusedLocals --noUnusedParameters` 零警告 |
| 逻辑层大文件拆分 | 7 个文件完成（tools/agent/channelStore/db/scanner/chatStore/openclawBridge） |
| 硬编码常量统一 | `GATEWAY_PORT` 和 `OLLAMA_BASE` 统一为单一来源 |
| SettingsPage 拆分 | 已拆分为 NavSidebar/Content/ApiTab/ExtensionsTab/MemoryManager/AddExtensionModal |
| 路由懒加载 | App.tsx(4) + SettingsContent(7) + ConnectionsPage(4) + AgentWorkbench(1) = 16 个页面 |
| Build chunk 分割 | vendor-react/motion/icons/tauri/zustand 已独立 |

---

## R1 — Bundle 体积优化 🔴 Critical

**现状**：主 bundle `index.js` 达 **1,798 KB**（gzip 539KB），远超 600KB 警告阈值。

### R1.1 — i18n 按需加载
- **文件**：`src/lib/i18n.ts`（1,499 行，68KB）
- **问题**：中英文翻译全量打入主 bundle，被 64 个文件引用
- **方案**：将翻译数据拆分为 `zh.json` / `en.json`，运行时按当前语言动态 `import()`
- **预估收益**：主 bundle 减少 ~30KB (gzip)

### R1.2 — 重型库动态导入
- **文件**：`src/lib/parsers.ts`
- **问题**：`pdfjs-dist`、`mammoth`、`xlsx` 三个重型库在顶层静态导入，但只在知识库上传时使用（仅 2 个文件引用）
- **方案**：改为 `const pdfjsLib = await import("pdfjs-dist")` 动态导入
- **预估收益**：主 bundle 减少 ~800KB+（这三个库是主要膨胀来源）

### R1.3 — highlight.js 按需加载语言
- **文件**：`src/components/chat/ChatMessage.tsx`
- **问题**：`rehype-highlight` 默认加载所有语言高亮
- **方案**：使用 `lowlight` + 注册常用语言（js/ts/python/bash/json/html/css）
- **预估收益**：减少 ~200KB

### R1.4 — react-markdown 代码分割
- **问题**：`react-markdown` + `remark-gfm` + `rehype-highlight` 仅在 ChatMessage 中使用，但被打入主 bundle
- **方案**：将 ChatMessage 的 Markdown 渲染部分拆为懒加载组件
- **预估收益**：减少 ~100KB

**R1 总预估收益**：主 bundle 从 1,798KB 降至 ~600KB（减少 ~65%）

---

## R2 — 测试覆盖率 🟡 Important

**现状**：仅 4 个单元测试文件，覆盖率 <3%。ROADMAP 声称 >80% 但实际远未达到。

### R2.1 — 核心逻辑单元测试（优先级最高）
| 文件 | 行数 | 重要性 | 测试要点 |
|------|------|--------|----------|
| `db.ts` + `dbDocuments.ts` + `dbMemories.ts` | 360 | ⭐⭐⭐ | CRUD 操作、迁移逻辑 |
| `agent.ts` + `agentLLM.ts` | 350 | ⭐⭐⭐ | LLM 调用、重试逻辑、工具调用循环 |
| `toolExecutors.ts` | 252 | ⭐⭐⭐ | 各工具执行逻辑、错误处理 |
| `chatStore.ts` | 264 | ⭐⭐ | 状态管理、对话 CRUD |
| `openclawBridge.ts` | 259 | ⭐⭐ | WS 连接/断连、Gateway 状态管理 |
| `skillRegistry.ts` | 297 | ⭐⭐ | 技能扫描、安装、卸载 |
| `swarmRouter.ts` | 183 | ⭐ | 任务分解、并行调度 |
| `accessControl.ts` | 175 | ⭐ | 用户权限管理 |

### R2.2 — Store 层测试
- `settingsStore.ts`（276行）— 持久化、hydration 逻辑
- `inboxStore.ts`（290行）— 消息处理、会话管理
- `channelStore.ts`（167行）— 通道状态管理

### R2.3 — Hook 层测试
- `useChatSend.ts`（300行）— 消息发送流程、流式响应处理
- `useChatFileProcessor.ts` — 文件处理逻辑

### R2.4 — E2E 测试补充
- 现有 4 个 E2E 测试（chat/core-flow/settings/sidebar）
- 补充：知识库上传流程、通道配置流程、Agent 创建流程

---

## R3 — 错误边界与容错 🟡 Important

### R3.1 — React ErrorBoundary
- **现状**：项目中没有任何 ErrorBoundary 组件
- **风险**：任何未捕获的渲染错误都会导致整个应用白屏
- **方案**：
  - 创建通用 `ErrorBoundary` 组件（带重试按钮和错误报告）
  - 在 `App.tsx` 顶层包裹全局 ErrorBoundary
  - 在 `SettingsContent.tsx` 的每个 Tab 包裹页面级 ErrorBoundary
  - 在 `ChatMessage.tsx` 的 Markdown 渲染包裹组件级 ErrorBoundary

### R3.2 — 异步错误处理改进
- 11 个空 `catch {}` 块中，以下可加日志辅助调试：
  - `openclawBridge.ts:67` — 添加 `console.debug("Gateway stop ignored:", e)`
  - `automationStore.ts` (4处) — 添加 `console.debug`
- 关键异步操作添加用户可见的错误提示（toast）

---

## R4 — 组件拆分（第二轮） 🟢 Nice-to-Have

### R4.1 — 大组件拆分

| 组件 | 行数 | 拆分建议 |
|------|------|----------|
| `SetupWizard.tsx` | 324 | 拆分 3 个步骤组件（WelcomeStep/ProviderStep/ChannelStep） |
| `ChatMessage.tsx` | 278 | 拆分 MarkdownRenderer（含 CodeBlock/Table 自定义组件） |
| `ModelSelector.tsx` | 265 | 拆分 CloudModelSelect / LocalModelSelect |
| `ChatInput.tsx` | 254 | 拆分 FileUploadArea / VoiceButton |
| `CloudImportModal.tsx` | 229 | 拆分 FileList / ImportProgress |
| `Onboarding.tsx` | 227 | 拆分 OnboardingStep / AnimatedBackground |
| `ChannelConfigPanel.tsx` | 225 | 拆分 FieldRenderer / StatusIndicator |
| `Sidebar.tsx` | 211 | 拆分 ConversationList / FolderTree |

### R4.2 — 大页面组件拆分

| 页面 | 行数 | 拆分建议 |
|------|------|----------|
| `UsagePage.tsx` | 295 | 拆分 UsageChart / CostEstimator / ExportPanel |
| `SecurityPage.tsx` | 289 | 拆分 AuditLogTable / TokenManager / GDPRPanel |
| `SyncPage.tsx` | 279 | 拆分 SyncStatusCard / BackupControls |
| `SkillStorePage.tsx` | 274 | 拆分 SkillCard / MarketplaceBrowser |
| `KnowledgePage.tsx` | 252 | 拆分 DocTable / GraphView / ImportPanel |

---

## R5 — 性能优化 🟢 Nice-to-Have

### R5.1 — React 渲染优化
- `React.memo` 使用量为 **0**，建议对以下纯展示组件添加：
  - `ToolCallBlock.tsx`（165行）— 工具调用展示
  - `DeviceDetailPanel.tsx`（150行）— 设备详情
  - `SkillDeployStep.tsx`（143行）— 技能部署步骤
- `useMemo`/`useCallback` 仅 24 处，检查高频渲染组件是否需要补充

### R5.2 — 图片/资源优化
- 检查 `public/` 和 `src/assets/` 中的资源是否经过压缩
- 考虑使用 WebP 格式替代 PNG

### R5.3 — Zustand Store 选择器优化
- 检查是否有不必要的全 store 订阅（应使用选择器避免重渲染）
- 示例：`useSettingsStore()` → `useSettingsStore(s => s.provider)`

---

## R6 — 代码规范与工具链 🟢 Nice-to-Have

### R6.1 — ESLint 配置
- 项目中没有 ESLint 配置文件
- 建议添加 `eslint.config.js`（flat config），启用：
  - `@typescript-eslint/recommended`
  - `react-hooks/rules-of-hooks`
  - `react-hooks/exhaustive-deps`
  - `no-console`（warn 级别）

### R6.2 — Prettier 统一格式
- 项目中没有 Prettier 配置
- 建议添加 `.prettierrc` 统一代码格式

### R6.3 — 提交规范
- 建议添加 `commitlint` + `husky` 强制 commit message 规范
- 配合 `lint-staged` 在提交前自动格式化

---

## R7 — 安全审查 🟢 Nice-to-Have

### R7.1 — .env 安全
- `.env` 已在 `.gitignore` 中 ✅
- 确认 `.env.example` 不包含真实密钥 ✅

### R7.2 — 依赖安全
- 运行 `npm audit` 检查已知漏洞
- 建议配置 Dependabot 或 Renovate 自动更新依赖

---

## 执行优先级排序

```
          紧急 ←→ 不紧急
重   ┌──────────┬──────────┐
要   │ R1 Bundle│ R3 错误  │
     │  体积优化 │  边界    │
     ├──────────┼──────────┤
不   │ R2 测试  │ R4 组件  │
重   │  覆盖率  │ R5 性能  │
要   │          │ R6 工具链│
     └──────────┴──────────┘
```

**建议执行顺序**：R1.2 → R1.1 → R3.1 → R1.3 → R2.1 → R4.1 → R5 → R6

---

## 里程碑

| 里程碑 | 目标 | 预估工时 |
|--------|------|----------|
| **M1: Bundle 瘦身** | 主 bundle < 600KB | 2-3h |
| **M2: 错误容错** | ErrorBoundary + 关键路径错误处理 | 1-2h |
| **M3: 测试基础** | 核心模块单元测试覆盖 | 4-6h |
| **M4: 组件拆分** | 300+ 行组件全部拆分 | 2-3h |
| **M5: 工具链** | ESLint + Prettier + 提交规范 | 1h |
