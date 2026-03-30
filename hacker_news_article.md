# How I Built Void Spirit: A Universal, Local-First AI Coding Agent

Like many, I’ve been watching the AI agent ecosystem explode. But juggling 5+ providers has become a nightmare. Existing terminal coding agents are powerful but come with huge caveats: strict geo-restrictions, forced vendor logins, and $20/month paywalls. Plus, they lack true local-first control. 

I got tired of the friction, so I built **Void Spirit**.

## What Void Spirit Actually Is

Void Spirit is a terminal AI assistant inspired by Anthropic's `learn-claude-code`, but built for radical flexibility:

- **Bring Your Own Model:** Natively supports 17+ APIs (OpenAI, Gemini, Anthropic, DeepSeek, Groq). Just pass `--provider` to switch brains. No VPN gymnastics required.
- **Local-First & Privacy:** Full offline support via Ollama and LM Studio. Your code never has to leave your machine.
- **Zero Subscriptions:** No logins and no monthly paywalls. Pay only pure API costs. You can even set hard session spending limits (`--budget-usd 0.50`).
- **A REPL That Remembers:** Auto-saves on exit so you can `--resume` later. It also supports conversation branching (`/fork` and `/switch`) to safely explore alternative code paths without nuking your context.

## A Quick Architecture Deep-Dive

Building a CLI that maps shell commands and persistent state across 17 APIs was interesting. Instead of writing 17 bespoke clients, Void Spirit uses a robust `OpenAICompatProvider` wrapper. 

The trickiest part was standardizing how models stream tool calls and unique behaviors—like DeepSeek Reasoner’s "thinking" phase. I wrote a streaming iterator that automatically intercepts reasoning tokens and pipes them to the terminal *before* final text output begins. This lets you use an advanced chain-of-thought model exactly the same way you’d use `gpt-4o`.

### The Plugin Security Sandbox

Giving an LLM direct access to your shell is terrifying. To sleep at night, I implemented a strict three-layer security model:

1. **Permission Scoping**: Plugins must declare capabilities in a `manifest.json` (e.g., `"permissions": ["fs:read", "fs:write", "web:fetch"]`).
2. **Trust Tiers**: Commands fall into Built-in, Verified (with SHA-256 integrity), and Untrusted categories.
3. **Sandboxed Execution**: Every tool call routes through a proxy that blocks unauthorized commands, restricts paths to your workspace, and logs everything to an audit trail (`--export-audit`).

## Why I Open-Sourced It

AI is evolving too fast. When a new state-of-the-art model drops tomorrow—whether it's an ultra-fast Groq endpoint or a new local Llama—you shouldn't have to wait for a corporation to update their app. You should just change a config flag and get back to building. I also wanted to democratize access for developers in geo-restricted regions who are currently locked out of tools like Claude Code.

## Give it a try

If you're tired of vendor lock-in, I’d love for you to try Void Spirit. 

You don't even need to install it permanently, just run:
```bash
npx void-spirit
```

If it helps your workflow, **[drop a star on GitHub](https://github.com/silverlion2/Void-spirit-CLI)**. Feel free to roast my architecture in the comments, and let me know which provider you end up using!
