#!/usr/bin/env node

import { Command } from 'commander';
import { getConfig, isConfigured, setupWizard, setConfig } from './config.js';
import { createProvider } from './providers/index.js';
import { Conversation } from './conversation.js';
import { Memory } from './memory.js';
import { SessionManager } from './session.js';
import { loadBuiltinSkills, skillsToSystemPrompt } from './skill-loader.js';
import { detectProject, projectToSystemPrompt } from './project-detector.js';
import { TokenTracker } from './token-tracker.js';
import { todosToSystemPrompt } from './tools/todo.js';
import { setProvider, setConversation } from './tools/executor.js';
import { showBanner } from './ui/banner.js';
import { startREPL } from './ui/repl.js';

const program = new Command();

program
  .name('void-spirit')
  .description('Terminal AI coding assistant — no login, any LLM API')
  .version('1.0.0')
  .option('-p, --provider <name>', 'Provider preset (openai, gemini, anthropic, deepseek, groq, ollama, together, custom)')
  .option('-m, --model <name>', 'Model name')
  .option('-k, --api-key <key>', 'API key')
  .option('-u, --base-url <url>', 'Custom API base URL')
  .option('-r, --resume', 'Resume the last session')
  .option('--fast-model <name>', 'Fast/cheap model for auxiliary ops (summaries, topic detection)')
  .action(async (opts) => {
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

    // Load memory
    const memory = new Memory();
    await memory.load();

    // Session manager
    const sessionManager = new SessionManager();

    // Detect project
    const project = await detectProject(process.cwd());

    // Token tracker
    const tokenTracker = new TokenTracker(config.model);

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

    // Show banner and start REPL
    showBanner(config, skills.length, project);
    await startREPL(provider, conversation, memory, tokenTracker, sessionManager, config, fastProvider);
  });

program.parse();
