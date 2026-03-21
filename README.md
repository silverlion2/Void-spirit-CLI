# ⚡ Void Spirit

**Terminal AI coding assistant — any LLM, no login, no geo-restrictions.**

[![npm version](https://img.shields.io/npm/v/void-spirit?color=%2300d4aa&style=flat-square)](https://www.npmjs.com/package/void-spirit)
[![license](https://img.shields.io/npm/l/void-spirit?color=%23555&style=flat-square)](./LICENSE)
[![node](https://img.shields.io/node/v/void-spirit?color=%23339933&style=flat-square)](https://nodejs.org)

> Inspired by the agent engineering principles from [learn-claude-code](https://github.com/anthropics/courses/tree/master/claude-code-guide). Built for developers who want the same agentic power with **any LLM provider** — no Anthropic subscription required.

---

## Why Void Spirit?

Most AI coding agents lock you into a single provider. **Void Spirit doesn't.**

- 🌏 **Works from China** — Use DeepSeek, Gemini, or any accessible API. No VPN gymnastics.
- 🔓 **No login, no account** — Bring your own API key. That's it.
- 🏠 **Run locally** — Full offline mode with Ollama. Your code never leaves your machine.
- 💰 **Zero subscription** — Pay only for what you use via API. No $20/mo paywall.
- 🧠 **DeepSeek thinking mode** — First-class support for DeepSeek Reasoner's chain-of-thought.

---

## Install

```bash
# Run instantly (no install)
npx void-spirit

# Or install globally
npm install -g void-spirit
void-spirit   # or: vs
```

First run will launch the setup wizard to pick your provider and model.

---

## How It Compares

| Feature | Claude Code | Void Spirit | Kode CLI |
|---|---|---|---|
| **Cost** | $20/mo subscription | Your API key only | Free / API key |
| **China access** | ❌ Blocked | ✅ DeepSeek, Gemini, Ollama | ✅ |
| **Local models** | ❌ | ✅ Ollama | ✅ |
| **Multi-provider** | Claude only | ✅ 8+ providers | ✅ 20+ |
| **Login required** | ✅ Anthropic account | ❌ None | ❌ None |
| **Session persist** | ✅ | ✅ | ✅ |
| **Conversation branching** | ❌ | ✅ Fork & switch | ❌ |
| **Plugin system** | ❌ | ✅ GitHub plugins | ✅ |
| **Security sandbox** | ✅ | ✅ Path + command sandbox | ⚠️ Partial |
| **Subagents** | ✅ | 🔜 Coming soon | ✅ |

---

## Supported Providers

| Provider | Type | Notes |
|----------|------|-------|
| OpenAI | Cloud | GPT-4o, GPT-4, o1, etc. |
| Google Gemini | Cloud | Via OpenAI-compatible endpoint |
| Anthropic Claude | Cloud | Native SDK |
| DeepSeek | Cloud | Reasoner thinking mode ✅ |
| Groq | Cloud | Ultra-fast inference |
| Ollama | Local | No internet needed |
| Together AI | Cloud | Open-source models |
| Custom | Any | Any OpenAI-compatible endpoint |

---

## Features

- 🛠️ **12 built-in tools** — File ops, shell commands, git, web fetch, grep, search
- 💾 **Session persistence** — Auto-save on exit, resume with `--resume`
- 🌿 **Conversation branching** — Fork checkpoints, switch between them
- ⚡ **Parallel tool execution** — Read-only tools run concurrently for speed
- 📝 **Streaming markdown** — Rich formatted output in terminal
- 🧠 **Persistent memory** — Cross-session memory with `/memory add`
- 📊 **Token tracking** — Real-time usage and cost estimation
- 🎯 **Project detection** — Auto-detects project type and adapts context
- 🔒 **Security sandbox** — Path sandboxing, command blocklist, audit log
- ↩️ **Undo/rollback** — Revert file changes with `/undo`
- 🔌 **Plugin system** — Install from GitHub with `/install <url>`

---

## Quick Start

```bash
# Start with specific provider
void-spirit --provider deepseek --model deepseek-reasoner --api-key YOUR_KEY

# Use local Ollama
void-spirit --provider ollama --model codellama

# Resume last session
void-spirit --resume
```

---

## Commands

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/model <name>` | Switch model |
| `/provider <name>` | Switch provider |
| `/config` | Show configuration |
| `/clear` | Clear conversation |
| `/compact` | Summarize to save context |
| `/image <path>` | Attach image to next message |
| `/memory add <text>` | Save a memory |
| `/memory` | Show saved memories |
| `/save [name]` | Save current session |
| `/load [name]` | List or load sessions |
| `/fork [label]` | Create conversation checkpoint |
| `/branches` | List checkpoints |
| `/switch <label>` | Restore a checkpoint |
| `/diff` | Show file changes vs git HEAD |
| `/context` | Show context window usage |
| `/stats` | Show token usage & cost |
| `/undo` | Undo last file change |
| `/auto` | Toggle auto-approve mode |
| `/export` | Export conversation to markdown |
| `/install <url>` | Install a plugin |
| `/plugins` | List installed plugins |
| `/exit` | Quit |

---

## Tools

The AI can use these tools during conversation:

| Tool | Description |
|------|-------------|
| `read_file` | Read files with line numbers |
| `write_file` | Create/overwrite files |
| `edit_file` | Find-and-replace edits |
| `list_directory` | Browse file system |
| `search_files` | Glob-based file search |
| `grep` | Search code contents |
| `run_command` | Execute shell commands (with approval) |
| `web_fetch` | Fetch URLs as markdown |
| `git_command` | Git operations |
| `create_directory` | Create directories |
| `delete_file` | Delete files (with approval) |
| `move_file` | Move/rename files |

---

## Plugins

Install plugins from GitHub:

```bash
# Inside Void Spirit
/install https://github.com/user/void-spirit-plugin
```

Plugins are stored in `~/.void-spirit/plugins/`.

---

## Architecture

```
src/
├── index.js            # CLI entry point
├── config.js           # Provider/model configuration
├── conversation.js     # Message management
├── memory.js           # Persistent memory
├── session.js          # Session save/load
├── token-tracker.js    # Usage & cost tracking
├── security.js         # Path sandbox & command blocklist
├── project-detector.js # Auto-detect project type
├── skill-loader.js     # Built-in skill loading
├── providers/          # LLM provider adapters
│   ├── index.js        # Provider factory
│   ├── openai-compat.js# OpenAI-compatible (most providers)
│   └── anthropic.js    # Native Anthropic SDK
├── tools/              # Agent tool definitions
│   ├── definitions.js  # Tool schemas
│   └── executor.js     # Tool execution logic
├── skills/             # Built-in skill prompts
├── plugins/            # Plugin loader
└── ui/                 # Terminal UI
    ├── banner.js       # Startup banner
    ├── renderer.js     # Markdown renderer
    └── repl.js         # Interactive REPL
```

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup and guidelines.

---

## License

[MIT](./LICENSE) © silverlion2

---

<p align="center">
  <strong>⚡ Any LLM. No login. No restrictions. Just code.</strong>
</p>
