# Phase 1.0: Sidecar Integration & Tool Decoupling

## Objective
Make Sinaclaw truly "one-click install, zero setup" by eliminating the need for `brew`, system `node`, system `git`, etc. This involves embedding a portable runtime (Node.js/Bun) via Tauri Sidecar, rewriting core OS tools in pure Rust, and simplifying the Setup Wizard to just verify built-in components.

## Core Phases

### Phase 1: Rust Core Tools Migration (in_progress)
- [ ] Migrate `read_file` to use pure Rust (already done, verify `tools.rs`)
- [ ] Migrate `write_file` to use pure Rust (already done, verify `tools.rs`)
- [ ] Migrate `list_dir` to use pure Rust (already done, verify `tools.rs`)
- [ ] Migrate `run_command` to handle built-in paths (currently it wraps with shell and uses user's PATH).
- [ ] Implement `fetch_web` / `search_web` in Rust (`reqwest` blocking/async) instead of relying on Node scripts.

### Phase 2: Tauri Sidecar Setup (Node.js) (pending)
- [ ] Download portable Node.js binaries for target platforms (macOS aarch64, macOS x86_64, Windows x86_64).
- [ ] Place binaries in `src-tauri/bin/` with specific Tauri naming conventions (e.g., `node-aarch64-apple-darwin`).
- [ ] Update `tauri.conf.json` to include the `node` sidecar in the bundle.
- [ ] Test invoking the Sidecar from Rust / Frontend to ensure it executes without system Node.

### Phase 3: Setup Wizard Simplification (pending)
- [ ] Update `src/lib/scanner.ts` to remove Homebrew, Git, system Node checks.
- [ ] Replace checks with a simple validation that the Sidecar Node is executable and Rust tools are responding.
- [ ] Update `SetupWizard.tsx` UI to reflect the "Zero Setup" lightning-fast check (change from "Missing - installing" to just "Verifying built-in components").

### Phase 4: Integration Testing (pending)
- [ ] Execute an agent tool call that runs a Node.js script (e.g., a simple code execution tool) ensuring it uses the Sidecar `node` instead of the system `node`.
- [ ] Verify `npm` is either bundled or not needed (since we can use compiled scripts or just raw Node execution).

## Current Status
Currently in Phase 1. Planning is completed.

## Errors & Learnings
| Error | Attempt | Resolution |
|-------|---------|------------|
| N/A | N/A | N/A |
