# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DeskFlow is a desktop workflow automation tool built with **Tauri 2** (Rust backend) + **React 19** (TypeScript frontend). Users create automations via a node-based visual editor (FlowGram.ai), with 60+ node types covering shell commands, file operations, AI/LLM, HTTP, scheduling, and more.

**App identifier**: `com.qiuxchao.desk-pipe` (binary name: DeskPipe)

## Common Commands

```bash
# Frontend dev server (port 1429)
bun run dev

# Full Tauri app (frontend + Rust backend)
bun run tauri dev

# Build production app
bun run tauri build

# Build frontend only
bun run build

# Rust checks (from src-tauri/)
cd src-tauri && cargo check
cd src-tauri && cargo clippy
cd src-tauri && cargo build
```

Package manager is **Bun** (not npm/yarn).

## Architecture

### Frontend (`src/`)
- **Entry**: `main.tsx` → `App.tsx` (hash router: Home / Editor / Settings)
- **Pages**: `HomePage.tsx` (workflow list), `EditorPage.tsx` (FlowGram canvas + toolbars), `SettingsPage.tsx` (AI config, env vars, theme)
- **Node system**: `nodes/registries.tsx` defines all 60+ node types with UI schemas and port configs. `nodes/port-types.ts` handles type compatibility. `nodes/form-components.tsx` renders dynamic property forms.
- **Contexts**: `ExecutionContext` (run state), `SelectedNodeContext` (inspector), `UpstreamContext` (node data flow)
- **Multi-window**: Separate HTML entry points for `screenshot.html`, `preview.html`, `dialog.html`, `status.html` — each is a child window managed via Tauri.
- **UI**: shadcn/ui (New York style, Zinc base color) + Tailwind CSS 4. Path alias `@/` → `./src`.

### Backend (`src-tauri/src/`)
- **`lib.rs`**: Tauri app setup, plugin init, command handler registration
- **`commands.rs`**: 25+ Tauri IPC commands (workflow CRUD, execution, settings, windows)
- **`workflow/executor.rs`**: Core async execution engine (~68KB) — event-driven, supports breakpoints, parallel execution, context variable passing between nodes
- **`workflow/nodes/`**: 54+ individual node implementations (one file per node type)
- **`workflow/storage.rs`**: File-based JSON persistence for workflows
- **`workflow/history.rs`**: Execution history storage
- **`setup/`**: Global shortcuts (`shortcuts.rs`), system tray (`tray.rs`), cron scheduler (`cron.rs`)

### Custom Crate (`crates/tauri-nspanel/`)
macOS-specific NSPanel plugin for floating window behavior.

### Execution Model
- Async Tokio-based engine streams `WorkflowEvent`s (node_started, node_completed, node_failed, debug_pause, etc.)
- Nodes receive upstream context variables and output results for downstream nodes
- Debug mode supports per-node breakpoints with pause/resume
- Parallel node type enables concurrent branch execution

### IPC Pattern
Frontend calls Rust via `invoke("command_name", { args })`. Commands are registered in `lib.rs` and implemented in `commands.rs`. Events flow back via Tauri event system for real-time execution updates.

## Design Guidelines (from .impeccable.md)
- **UI language**: Chinese-first
- **Aesthetic**: Minimalist, friendly, modern — inspired by Linear (restraint, smooth animations) and Notion (warmth, whitespace)
- **Brand color**: Blue-purple / 蓝紫色 (oklch hue 280)
- **Theme**: Light-first, dark mode follows system
- **Principles**: Content-first, progressive disclosure, immediate feedback, consistent spacing rhythm, Chinese-optimized typography
