# DeskPipe

桌面工作流自动化引擎。可视化节点编辑器，60+ 节点类型，拖拽连线构建自动化流程。

Visual workflow automation for desktop. 60+ node types, drag & connect.

## Features

- **可视化编排** — 基于节点编辑器，拖拽连线即可构建复杂工作流
- **60+ 节点类型** — Shell、文件读写、HTTP 请求、AI 对话、数据库、正则提取、截图、邮件、AppleScript……
- **AI 原生集成** — 内置 AI 对话、意图识别、参数提取、TTS/STT 节点，支持多供应商配置
- **快捷键 & 定时** — 全局快捷键一键触发，Cron 表达式定时自动执行
- **调试 & 断点** — 逐节点调试，支持断点暂停、变量查看
- **轻量原生** — Tauri 2 + Rust 后端，安装包小、内存占用低

## Tech Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui
- **Backend**: Tauri 2 + Rust + Tokio
- **Package Manager**: Bun

## Getting Started

```bash
# Install dependencies
bun install

# Run in development mode
bun run tauri dev

# Build for production
bun run tauri build
```

## Screenshots

> Coming soon

## License

MIT
