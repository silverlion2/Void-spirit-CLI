# Void Spirit — Marketing Playbook

## Dual-Audience Positioning

Void Spirit serves **two audiences** with one codebase:

### 🧑‍💻 Personal (Indie Devs, Students, Hobbyists)

**Tagline**: *"Your AI pair programmer — any LLM, zero lock-in, zero cost."*

Pain points addressed:
- Can't afford $20/mo Claude subscriptions
- Behind API restrictions (China, corporate firewalls)
- Want to learn coding with AI assistance
- Privacy-conscious — code should stay local
- Want productivity beyond just coding (planning, notes, learning)

Key messaging:
- Free forever, open source
- Works from China with DeepSeek — no VPN needed
- Run locally with Ollama — your code never leaves your machine
- Built-in skills for daily planning, note-taking, and learning paths
- No account, no login, no subscription

### 🏢 Business (Teams, Consultants, Enterprise)

**Tagline**: *"The AI coding agent your team controls — local models, audit logs, token budgets."*

Pain points addressed:
- Data sovereignty — can't send code to external APIs
- Cost control — need to cap AI spending per developer
- Compliance — need audit trails of what the AI did
- Standardization — team should use same provider/model config
- Security — restrict destructive commands for junior devs

Key messaging:
- Run with Ollama or LM Studio — air-gapped, zero data exfiltration
- Per-session token budgets prevent cost overruns
- Full audit log of every AI action for compliance
- Team config (`.void-spirit/team.json`) enforces org standards
- Plugin security with three-tier trust model and SHA-256 integrity
- Choose your LLM vendor to match procurement requirements

---

## Pricing Strategy

| Tier | Target | Price | Features |
|------|--------|-------|----------|
| **Core** | Everyone | Free / OSS | All 15 tools, multi-provider, plugins, skills, sessions |
| **Team** | Small teams | Free (self-managed) | Team config, token budgets, audit log |
| **Enterprise** | Large orgs | Future (SaaS/support) | SSO, centralized key vault, usage dashboards |

> The free tier is the full product. Business features are additive, not gated.

---

## Tactical Playbook

### 1. Viral Blog Post

**Title**: "I Built a Claude Code Clone That Works With Any LLM — Here's What I Learned"

**Publish to**:
- [DEV.to](https://dev.to) (English dev community)
- [Medium](https://medium.com) (broader reach)
- [Hacker News](https://news.ycombinator.com/submit) (Show HN)
- [掘金 Juejin](https://juejin.cn) (Chinese dev community)
- [V2EX](https://v2ex.com) (Chinese tech forum)

**Content angles**:
- Compare architectures: Claude Code vs Void Spirit
- Show it working with DeepSeek Reasoner (thinking mode!)
- "Lessons learned reverse-engineering an AI coding agent"
- **NEW**: "Why your team should self-host their AI coding agent"

### 2. Target the DeepSeek Community

DeepSeek has a huge Chinese user base with no good CLI agent:
- Showcase reasoning/thinking mode integration
- Post demos on **Bilibili** (Chinese YouTube)
- Share in **WeChat dev communities**
- Post on 掘金 and V2EX with Chinese copy
- **Business angle**: "DeepSeek for enterprise — keep code in-house"

### 3. GitHub SEO

**Topics to add on GitHub repo settings**:
```
claude-code-alternative, ai-coding-assistant, terminal-ai, deepseek, 
ollama, ai-agent, coding-agent, cli-tool, developer-tools, llm,
enterprise-ai, team-coding-agent, token-budget, audit-log
```

**Other GitHub optimizations**:
- Pin an animated GIF/SVG demo in the README (record with `asciinema` or `vhs`)
- Add star history badge: `https://star-history.com/#silverlion2/void-spirit-cli`
- Use GitHub Releases for each version

### 4. Build in Public

Tweet/post each feature as you ship it:
- "Day 1: Agent loop ✅"
- "Day 2: Multi-provider support ✅"
- "Day 3: DeepSeek thinking mode ✅"
- "Day 4: Token budgets for teams ✅"
- "Day 5: Team config enforcement ✅"
- "Day 6: Audit log export ✅"

### 5. Cross-Traffic Strategy

Reference learn-claude-code in README:
> "Inspired by the agent engineering principles from learn-claude-code"

This drives cross-traffic from their 34.9K star audience who search for alternatives.

### 6. Community Submissions

- [ ] Submit to [awesome-nodejs](https://github.com/sindresorhus/awesome-nodejs)
- [ ] Submit to [awesome-cli-apps](https://github.com/agarrharr/awesome-cli-apps)
- [ ] Submit to [awesome-ai-tools](https://github.com/mahseema/awesome-ai-tools)
- [ ] Post on r/programming, r/artificial, r/LocalLLaMA
- [ ] Product Hunt launch
- [ ] **NEW**: Post on r/devops, r/selfhosted (business angle)

### 7. LinkedIn & Enterprise Outreach

- Post case study: "How a 5-person team saved $X/mo by switching from Claude Code to Void Spirit"
- Target CTO/VP Eng audience on LinkedIn
- Highlight data sovereignty for regulated industries (healthcare, finance, defense)

---

## Audience-Specific Landing Pages (Future)

| Page | URL | Focus |
|------|-----|-------|
| **Developers** | `/for/developers` | Speed, freedom, any LLM |
| **Teams** | `/for/teams` | Control, compliance, cost |
| **China** | `/zh` | DeepSeek, no VPN, 掘金/V2EX social proof |

---

## Key Metrics to Track

- GitHub stars (vs learn-claude-code, Kode CLI timelines)
- npm weekly downloads
- GitHub issues/PRs (community engagement)
- Blog post views and referral traffic
- **NEW**: Team config adoption (track via opt-in telemetry or GitHub issues)
