# Findings & Discoveries

## Existing Tools (Rust)
- `tools.rs` currently implements `read_file`, `write_file`, `list_dir` in pure Rust. These are **independent** of external dependencies.
- `tool_detect_env` relies on system `node`, `git`, `python3`.
- `tool_install_dependency` relies on system `npm`, `yarn`, `cargo`, `pip3`.
- `tool_run_command` executes through `sh -c` on Mac/Linux or `cmd /C` on Windows, inheriting the user's environment.

## Tauri Sidecar Concept
To ensure true zero-dependency execution:
1. We need to bundle a Node.js execution binary for interpreting any JS-based scripts or agent tools.
2. In `tauri.conf.json`, we configure `"bundle": { "externalBin": ["bin/node"] }`.
3. Tauri expects binaries named with target triples (e.g. `node-aarch64-apple-darwin`, `node-x86_64-pc-windows-msvc`).
4. Instead of relying on `scanner.ts` to `brew install node`, we just call the Sidecar `node` provided by Tauri API `Command::sidecar("node")` from Rust, or via `@tauri-apps/plugin-shell` from frontend.

## Setup Wizard Overhaul
- Since we embed `node`, we can remove `Node`, `npm`, `Git`, `Python`, `Rust` from the mandatory `scanner.ts` checks.
- If an agent wants to execute code, it should use the Sidecar `node` (JS). If the user wants to compile Rust, then they need standard Rust, but that's for developers, not regular users.
- Regular users should just be able to parse files and run JS tools right away.

## Plan Formulation
1. Create a `download-node-sidecars.js` script to fetch portable Node binaries for `aarch64` and `x86_64` mac/windows and place them in `src-tauri/bin/`.
2. Update `tauri.conf.json` to include `"externalBin": ["bin/node"]`.
3. Update `src-tauri/src/tools.rs` to expose a `tool_run_script` command that specifically invokes the `node` sidecar rather than system node.
4. Rewrite `src/lib/scanner.ts` to simply check `Command.sidecar("node").execute()` instead of checking system PATH.
5. Simplify the `SetupWizard.tsx` UI.
