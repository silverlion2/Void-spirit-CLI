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

## Who Is Void Spirit For?

### 🧑‍💻 Personal — Indie Devs, Students, Hobbyists

- Free AI pair programming with **any model** you choose
- Learn to code with AI — no subscription paywall
- Built-in productivity skills: daily planner, notes, learning paths
- Privacy-first: run Ollama locally, your code stays on your machine

### 🏢 Teams & Business — Consultants, Startups, Enterprise

- **Token budgets** — Cap spending per session (`--budget 50000` or `--budget-usd 0.50`)
- **Team config** — Share standardized settings via `.void-spirit/team.json` in your repo
- **Audit log** — Full trail of every AI action for compliance (`/audit`, `--export-audit`)
- **Data sovereignty** — Run with Ollama or LM Studio, air-gapped, zero data exfiltration
- **Plugin security** — Three-tier trust model with SHA-256 integrity verification

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
| **Multi-provider** | Claude only | ✅ 17+ providers | ✅ 20+ |
| **Login required** | ✅ Anthropic account | ❌ None | ❌ None |
| **Token budgets** | ❌ | ✅ Per-session caps | ❌ |
| **Team config** | ❌ | ✅ Shared `.void-spirit/team.json` | ❌ |
| **Audit log** | ❌ | ✅ Full action trail + export | ❌ |
| **Session persist** | ✅ | ✅ | ✅ |
| **Conversation branching** | ❌ | ✅ Fork & switch | ❌ |
| **Plugin system** | ❌ | ✅ GitHub plugins | ✅ |
| **Security sandbox** | ✅ | ✅ Path + command sandbox | ⚠️ Partial |
| **Subagents** | ✅ | ✅ Isolated context | ✅ |
| **Task tracking** | ✅ | ✅ Persistent todos | ❌ |
| **On-demand skills** | ❌ | ✅ Load on need | ❌ |

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
| OpenRouter | Cloud | MiMo, Mistral, Llama, etc. |
| Mistral | Cloud | Large, Nemo, Pixtral |
| Perplexity | Cloud | Sonar reasoning |
| Fireworks | Cloud | Serverless Llama endpoints |
| Cerebras | Cloud | Ultra-fast hardware |
| Moonshot / Kimi | Cloud | Native endpoint |
| Alibaba Qwen | Cloud | DashScope compatible |
| SambaNova | Cloud | Specialized inference |
| LM Studio | Local | Like Ollama, no key needed |
| Custom | Any | Any OpenAI-compatible endpoint |

---

## Features

- 🛠️ **15 built-in tools** — File ops, shell commands, git, web fetch, grep, search, subagents, todos, skills
- 🤖 **Subagents** — Spawn isolated sub-agents for focused tasks, keeping main context clean
- 📋 **Task tracking** — AI-managed todo list that persists across sessions
- 📚 **On-demand skills** — Load expert knowledge modules only when needed (saves context)
- 💾 **Session persistence** — Auto-save on exit, resume with `--resume`
- 🌿 **Conversation branching** — Fork checkpoints, switch between them
- ⚡ **Parallel tool execution** — Read-only tools run concurrently for speed
- 📝 **Streaming markdown** — Rich formatted output in terminal
- 🧠 **Persistent memory** — Cross-session memory with `/memory add`
- 📊 **Token tracking** — Real-time usage and cost estimation
- 💵 **Token budgets** — Per-session spending caps (`--budget`, `--budget-usd`)
- 👥 **Team config** — Shared settings via `.void-spirit/team.json`
- 🎯 **Project detection** — Auto-detects project type and adapts context
- 🔒 **Security sandbox** — Path sandboxing, command blocklist, audit log
- 📋 **Audit export** — Export AI action log for compliance (`--export-audit`)
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
| `/trust <name>` | Trust a plugin (grant declared permissions) |
| `/untrust <name>` | Revoke trust (restrict to read-only) |
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
| `spawn_subagent` | Run isolated sub-agent for focused tasks |
| `todo_write` | AI-managed persistent task tracking |
| `load_skill` | Load expert knowledge modules on-demand |

---

## Plugins

Install plugins from GitHub:

```bash
# Inside Void Spirit
/install https://github.com/user/void-spirit-plugin
```

Plugins are stored in `~/.void-spirit/plugins/`.

### Plugin Security

Void Spirit enforces a **three-layer plugin security model**:

**Permission Scoping** — Plugins declare capabilities in `manifest.json`:

```json
{ "permissions": ["fs:read", "fs:write", "web:fetch"] }
```

| Capability | Risk | Allowed Tools |
|---|---|---|
| `fs:read` | 🟢 Low | read_file, list_directory, search_files, grep |
| `fs:write` | 🟡 Medium | write_file, edit_file, create_directory |
| `fs:delete` | 🟠 High | delete_file, move_file |
| `command:run` | 🔴 Critical | run_command |
| `git:read` | 🟢 Low | git (status, log, diff) |
| `git:write` | 🟡 Medium | git (commit, push, checkout) |
| `web:fetch` | 🟡 Medium | web_fetch |

**Trust Tiers** — 🟢 Built-in (full) · 🔵 Verified (declared perms) · 🟡 Untrusted (read-only). Use `/trust` and `/untrust` to manage. Verified plugins include SHA-256 integrity checking.

**Sandboxed Execution** — Plugin tool calls go through a proxy executor that blocks unauthorized tools, restricts file paths, and logs all blocked attempts.

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
├── skill-loader.js     # On-demand skill loading
├── providers/          # LLM provider adapters
│   ├── index.js        # Provider factory
│   ├── openai-compat.js# OpenAI-compatible (most providers)
│   └── anthropic.js    # Native Anthropic SDK
├── tools/              # Agent tool definitions
│   ├── definitions.js  # Tool schemas (15 tools)
│   ├── executor.js     # Tool execution logic
│   ├── subagent.js     # Isolated sub-agent execution
│   └── todo.js         # Persistent task tracking
├── skills/             # Built-in skill prompts
├── plugins/            # Plugin system
│   ├── loader.js       # Plugin loader + security integration
│   ├── plugin-permissions.js  # Capability → tool mapping
│   ├── plugin-sandbox.js      # Sandboxed tool executor
│   └── trust-manager.js       # Three-tier trust model
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
