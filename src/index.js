#!/usr/bin/env node

import { Command } from 'commander';
import { getConfig, isConfigured, setupWizard, setConfig, loadTeamConfig } from './config.js';
import { createProvider } from './providers/index.js';
import { Conversation } from './conversation.js';
import { Memory } from './memory.js';
import { SessionManager } from './session.js';
import { loadBuiltinSkills, skillsToSystemPrompt } from './skill-loader.js';
import { detectProject, projectToSystemPrompt } from './project-detector.js';
import { TokenTracker } from './token-tracker.js';
import { todosToSystemPrompt } from './tools/todo.js';
import { setProvider, setConversation, setMCPManager } from './tools/executor.js';
import { registerDynamicTools } from './tools/definitions.js';
import { MCPManager } from './mcp-client.js';
import { loadOpenCodeConfig } from './opencode-compat.js';
import { showBanner } from './ui/banner.js';
import { startREPL } from './ui/repl.js';
import { exportAuditLog } from './security.js';
import chalk from 'chalk';

const program = new Command();

program
  .name('void-spirit')
  .description('Terminal AI coding assistant — no login, any LLM API')
  .version('1.2.0')
  .option('-p, --provider <name>', 'Provider preset (openai, gemini, anthropic, deepseek, groq, ollama, together, custom)')
  .option('-m, --model <name>', 'Model name')
  .option('-k, --api-key <key>', 'API key')
  .option('-u, --base-url <url>', 'Custom API base URL')
  .option('-r, --resume', 'Resume the last session')
  .option('--fast-model <name>', 'Fast/cheap model for auxiliary ops (summaries, topic detection)')
  .option('--budget <tokens>', 'Per-session token budget limit', parseInt)
  .option('--budget-usd <amount>', 'Per-session USD spending limit', parseFloat)
  .option('--export-audit [path]', 'Export audit log as JSON and exit')
  .action(async (opts) => {
    // Handle --export-audit (standalone, exits immediately)
    if (opts.exportAudit !== undefined) {
      const outPath = typeof opts.exportAudit === 'string' ? opts.exportAudit : null;
      const result = await exportAuditLog(outPath);
      if (result.exported) {
        console.log(chalk.green(`  ✓ Exported ${result.count} audit entries to ${result.path}`));
      } else {
        console.log(JSON.stringify(result.entries, null, 2));
      }
      process.exit(0);
    }

    // Override config with CLI flags
    if (opts.provider) setConfig('provider', opts.provider);
    if (opts.model) setConfig('model', opts.model);
    if (opts.apiKey) setConfig('apiKey', opts.apiKey);
    if (opts.baseUrl) setConfig('baseURL', opts.baseUrl);
    if (opts.fastModel) setConfig('fastModel', opts.fastModel);

    // First-run setup if not configured
    if (!isConfigured()) {
      await setupWizard();
    }

    // Load team config (project-level overrides)
    const teamResult = await loadTeamConfig(process.cwd());
    let mcpServers = {};

    if (teamResult.loaded) {
      console.log(chalk.dim(`  ✓ Team config loaded from ${teamResult.path}`));
      if (teamResult.applied.budget) console.log(chalk.dim(`    Token budget: ${teamResult.applied.budget}`));
      if (teamResult.applied.budgetUSD) console.log(chalk.dim(`    USD budget: $${teamResult.applied.budgetUSD}`));
      if (teamResult.applied.mcpServers) {
        mcpServers = { ...mcpServers, ...teamResult.applied.mcpServers };
      }
    } else if (teamResult.error) {
      console.log(chalk.yellow(`  ⚠ ${teamResult.error}`));
    }

    // ── OpenCode config import (fallback) ────────────────────────
    const openCodeResult = await loadOpenCodeConfig(process.cwd());
    if (openCodeResult.loaded) {
      console.log(chalk.dim(`  ✓ OpenCode config detected: ${openCodeResult.path}`));

      // Import provider if Void Spirit provider is not explicitly set via CLI
      if (!opts.provider && openCodeResult.provider) {
        setConfig('provider', openCodeResult.provider);
        if (openCodeResult.model) setConfig('model', openCodeResult.model);
        if (openCodeResult.apiKey) setConfig('apiKey', openCodeResult.apiKey);
        if (openCodeResult.baseURL) setConfig('baseURL', openCodeResult.baseURL);
        console.log(chalk.dim(`    Imported provider: ${openCodeResult.provider} / ${openCodeResult.model || 'default'}`));
      }

      // Import MCP servers (team.json takes priority)
      if (openCodeResult.mcpServers) {
        mcpServers = { ...openCodeResult.mcpServers, ...mcpServers };
      }
    } else if (openCodeResult.error) {
      console.log(chalk.yellow(`  ⚠ ${openCodeResult.error}`));
    }

    const config = getConfig();

    // Validate config
    if (!config.provider || !config.model) {
      console.error('Missing provider or model. Run setup again or use --provider and --model flags.');
      process.exit(1);
    }

    // Create primary provider
    const provider = createProvider(config);

    // Create fast provider for cheap auxiliary ops (if configured)
    let fastProvider = null;
    if (config.fastModel && config.fastModel !== config.model) {
      try {
        fastProvider = createProvider({ ...config, model: config.fastModel });
      } catch {
        // fall back to primary provider
      }
    }

    // ── MCP Server initialization ────────────────────────────────
    const mcpManager = new MCPManager();
    if (Object.keys(mcpServers).length > 0) {
      console.log(chalk.dim(`  ⚡ Connecting to ${Object.keys(mcpServers).length} MCP server(s)...`));
      await mcpManager.connectAll(mcpServers);
      const tools = mcpManager.getTools();
      if (tools.length > 0) {
        registerDynamicTools(tools);
        console.log(chalk.dim(`  ✓ ${tools.length} MCP tools registered from ${mcpManager.servers.size} server(s)`));
      }
    }

    // Wire MCP manager into executor
    setMCPManager(mcpManager);

    // Load memory
    const memory = new Memory();
    await memory.load();

    // Session manager
    const sessionManager = new SessionManager();

    // Detect project (now includes AGENTS.md, CLAUDE.md, .cursorrules, etc.)
    const project = await detectProject(process.cwd());
    if (project.instructionFiles && project.instructionFiles.length > 0) {
      console.log(chalk.dim(`  ✓ Project instructions: ${project.instructionFiles.join(', ')}`));
    }

    // Token tracker with budget enforcement
    const tokenTracker = new TokenTracker(config.model);
    const budgetTokens = opts.budget || config.budget;
    const budgetUSD = opts.budgetUsd || config.budgetUSD;
    if (budgetTokens) tokenTracker.setBudget(budgetTokens);
    if (budgetUSD) tokenTracker.setBudgetUSD(budgetUSD);

    // Create conversation
    const conversation = new Conversation();

    // Wire provider/conversation into executor for subagent support
    setProvider(provider);
    setConversation(conversation);

    // Resume session if requested
    if (opts.resume) {
      try {
        const session = await sessionManager.loadLatest();
        if (session) {
          conversation.setMessages(session.messages);
          console.log(`  ✓ Resumed session: ${session.id} (${session.messages.length} messages)`);
        }
      } catch {
        // no sessions to resume, start fresh
      }
    }

    // Inject memory
    const memoryPrompt = memory.toSystemPrompt();
    if (memoryPrompt) {
      conversation.addSystemContext(memoryPrompt);
    }

    // Inject skills catalog (lightweight — just names, loaded on-demand)
    const skills = await loadBuiltinSkills();
    const skillsPrompt = skillsToSystemPrompt(skills);
    if (skillsPrompt) {
      conversation.addSystemContext(skillsPrompt);
    }

    // Inject project context
    const projectPrompt = projectToSystemPrompt(project);
    if (projectPrompt) {
      conversation.addSystemContext(projectPrompt);
    }

    // Inject active todos
    const todosPrompt = await todosToSystemPrompt();
    if (todosPrompt) {
      conversation.addSystemContext(todosPrompt);
    }

    // Graceful shutdown for MCP servers
    const cleanupMCP = async () => {
      if (mcpManager.servers.size > 0) {
        await mcpManager.shutdown();
      }
    };
    process.on('exit', () => { cleanupMCP().catch(() => {}); });

    // Show banner and start REPL
    showBanner(config, skills.length, project, mcpManager);
    await startREPL(provider, conversation, memory, tokenTracker, sessionManager, config, fastProvider, mcpManager);
  });

program.parse();
