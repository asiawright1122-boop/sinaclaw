# Phase 1.0: Sidecar Integration & Tool Decoupling

## Objective
Make Sinaclaw truly "one-click install, zero setup" by eliminating the need for `brew`, system `node`, system `git`, etc. This involves embedding a portable runtime (Node.js/Bun) via Tauri Sidecar, rewriting core OS tools in pure Rust, and simplifying the Setup Wizard to just verify built-in components.

## Core Phases

### Phase 1: Rust Core Tools Migration ✅
- [x] Migrate `read_file` to use pure Rust (verified in `tools.rs`)
- [x] Migrate `write_file` to use pure Rust (verified in `tools.rs`)
- [x] Migrate `list_dir` to use pure Rust (verified in `tools.rs`)
- [x] Migrate `run_command` to handle node commands via Sidecar (`tool_run_command` in `tools.rs`)
- [ ] Implement `fetch_web` / `search_web` in Rust (`reqwest`) instead of relying on Node scripts

### Phase 2: Tauri Sidecar Setup (Node.js) ✅
- [x] Download portable Node.js binaries for target platforms (`download-sidecars.js`)
- [x] Place binaries in `src-tauri/bin/` (node-aarch64-apple-darwin, node-x86_64-apple-darwin, node-x86_64-pc-windows-msvc.exe)
- [x] Update `tauri.conf.json` to include the `node` sidecar in the bundle
- [x] Test invoking the Sidecar from Rust / Frontend

### Phase 3: Setup Wizard Simplification ✅
- [x] Update `src/lib/scanner.ts` to remove Homebrew, Git, system Node checks
- [x] Replace checks with a simple validation that the Sidecar Node is executable
- [x] Update `SetupWizard.tsx` UI to reflect the "Zero Setup" zero-config check

### Phase 4: Integration Testing (pending)
- [ ] Execute an agent tool call that runs a Node.js script ensuring it uses the Sidecar `node`
- [ ] Verify `npm` is either bundled or not needed
- [ ] Run `npm run tauri build` to verify universal darwin packaging

## Completed Milestones
- ✅ i18n 国际化: 完整 zh/en 双语字典覆盖所有 UI 组件（sidebar, welcome, chat, settings, knowledge, skills, extensions）
- ✅ MCP 工具集成循环
- ✅ 前端 Vite 构建通过（dist 生成成功）

## Current Status
Phase 1 mechanically complete. Phase 2 execution started.

---

# Phase 2.0: Core Capabilities & Stability

## Phase 2.1: Agent Toolchain Completion ✅
- [x] Add `fetch_url` tool in `tools_extended.rs` using `reqwest` and `scraper` to grab text content.
- [x] Register `tool_fetch_url` in `lib.rs` Tauri commands list.
- [x] Update `src/lib/tools.ts` to include `search_web` and `fetch_url` in `OPENCLAW_TOOLS` schema.
- [x] Implement invoke handler for `search_web` and `fetch_url` in frontend `executeTool()`.

## Phase 2.2: Context Window Management ✅
- [x] Update `agent.ts` to implement a sliding window for chat history.
- [x] Preserve the `system` prompt and the most recent N messages (40 limit) to avoid `context_length_exceeded` errors.

## Phase 2.3: AppLayout Modularization ✅
- [x] Split `AppLayout.tsx` (currently ~30KB) into `Sidebar`, `TitleBar`, and `MainContent` components.

## Phase 2.4: MCP STDIO Support ✅
- [x] Add `stdio` connection capability to `mcp.rs` for local MCP server processes.
- [x] Parse `stdio://<cmd>` URIs from the frontend and spawn child processes via `tokio::process::Command`.

---

# Phase 3.0: Agent Store & Memory System ✅

## Phase 3.1: Agent Store Implementation ✅
- [x] 创建 `agentStore.ts` (Zustand) 管理自定义 Agent 配置（系统提示、头像、启用的工具）。
- [x] 在 `Sidebar.tsx` 中添加 Agent 选择下拉菜单。
- [x] 将选定的 Agent 上下文集成到 `agent.ts` 的 LLM 执行循环中。
- [x] 更新 `chatStore.ts` 和 `db.ts` 关联 `agent_id` 到会话。

## Phase 3.2: SQLite Persistent Memory ✅
- [x] 在 `db.ts` 中添加 `memories` 表和 `appendCoreMemory` / `getAllCoreMemories` 函数。
- [x] 在 `tools.ts` 中注入 `core_memory_append` 和 `core_memory_search` 工具。
- [x] 更新 `OPENCLAW_SYSTEM_PROMPT` 指导 LLM 主动使用长期记忆。

---

# Phase 4.0: 产品化与打包 (进行中)

## Phase 4.1: Tauri 构建验证
- [ ] 运行 `npm run tauri build` 测试 macOS universal binary 编译。
- [ ] 验证 Node sidecar 在 `.app` 包中存在且可正常工作。
- [ ] 测试代码签名与公证。

## Phase 4.2: Bundle 优化
- [ ] Code-splitting：为 Settings / Knowledge / Skills 页面实现动态导入。
- [ ] 移除 tree-shaking 遗漏的未使用依赖。
- [ ] 目标: JS Bundle < 500KB (目前约 1.75MB)。

## Phase 4.3: 自动化测试
- [ ] 前端: Vitest 单元测试核心模块 (agent loop, embeddings, text splitter)。
- [x] E2E: 基础 Playwright 测试覆盖核心 UI 流程。

