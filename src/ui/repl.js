import { createInterface } from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { getToolDefinitions } from '../tools/definitions.js';
import { executeTool, setAutoApprove, getAutoApprove } from '../tools/executor.js';
import { renderMarkdown, renderToolCall, renderToolResult, renderStreamChunk, renderThinkingChunk, renderThinkingEnd, renderError, renderInfo, renderSuccess, renderParallelStart, renderParallelEnd, StreamBuffer } from './renderer.js';
import { getConfig, setConfig, getPresets, PROVIDER_PRESETS } from '../config.js';
import { createProvider } from '../providers/index.js';
import { installPlugin } from '../plugins/loader.js';
import { undoLast, getUndoStack } from '../security.js';

const READ_ONLY_TOOLS = new Set(['read_file', 'list_directory', 'search_files', 'grep', 'web_fetch', 'git_command']);

const SLASH_COMMANDS = {
  '/help': 'Show this help message',
  '/model <name>': 'Switch model',
  '/provider <name>': 'Switch provider preset',
  '/config': 'Show current configuration',
  '/clear': 'Clear conversation history',
  '/compact': 'Summarize conversation to save context',
  '/image <path>': 'Attach image to next message',
  '/memory': 'Show saved memories',
  '/memory add <text>': 'Save a memory',
  '/memory clear': 'Clear all memories',
  '/undo': 'Undo last file change',
  '/auto': 'Toggle auto-approve mode',
  '/stats': 'Show token usage & cost',
  '/context': 'Show context window usage',
  '/save [name]': 'Save current session',
  '/load [name]': 'List or load sessions',
  '/fork [label]': 'Create a conversation checkpoint',
  '/branches': 'List conversation checkpoints',
  '/switch <label>': 'Restore a checkpoint',
  '/diff': 'Show file changes vs git HEAD',
  '/export': 'Export conversation to markdown',
  '/install <url>': 'Install a plugin from GitHub/URL',
  '/plugins': 'List installed plugins',
  '/trust <name>': 'Trust a plugin (grant declared permissions)',
  '/untrust <name>': 'Revoke trust (restrict to read-only)',
  '/mcp': 'List connected MCP servers and their tools',
  '/exit': 'Quit Void Spirit',
};

export async function startREPL(provider, conversation, memory, tokenTracker, sessionManager, config, fastProvider, mcpManager) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.hex('#7c3aed')('\n  ❯ '),
    historySize: 100,
  });

  const tools = getToolDefinitions();

  // Auto-save on exit
  const autoSave = async () => {
    if (sessionManager && conversation.getMessages().length > 1) {
      try {
        await sessionManager.save(conversation, config || getConfig(), sessionManager.currentId || undefined);
      } catch {
        // silent fail on exit
      }
    }
  };

  process.on('SIGINT', async () => {
    await autoSave();
    console.log(chalk.hex('#a78bfa')('\n  👋 Goodbye!\n'));
    process.exit(0);
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    // Handle slash commands
    if (input.startsWith('/')) {
      const handled = await handleSlashCommand(input, conversation, memory, provider, rl, tokenTracker, sessionManager, config, mcpManager);
      if (handled) {
        rl.prompt();
        return;
      }
    }

    // Regular message — send to LLM
    conversation.addUserMessage(input);

    try {
      await agentLoop(provider, conversation, tools, tokenTracker);
    } catch (err) {
      renderError(`API Error: ${err.message}`);
    }

    // Show token stats after each exchange
    if (tokenTracker) {
      console.log(tokenTracker.getStatusLine());
      // Auto-compact warning
      if (tokenTracker.shouldAutoCompact()) {
        console.log(chalk.hex('#f59e0b')('  ⚠ Context window is getting full. Consider running /compact to free space.'));
      }
    }

    rl.prompt();
  });

  rl.on('close', async () => {
    await autoSave();
    console.log(chalk.hex('#a78bfa')('\n  👋 Goodbye!\n'));
    process.exit(0);
  });
}

async function agentLoop(provider, conversation, tools, tokenTracker) {
  let iteration = 0;
  const MAX_ITERATIONS = 20;

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    const imageData = conversation.consumeImage();
    const streamBuffer = new StreamBuffer();
    let reasoningContent = '';
    let toolCalls = [];

    console.log('');
    const spinner = ora({ text: chalk.dim('Thinking...'), spinner: 'dots', indent: 2 }).start();
    let spinnerStopped = false;

    try {
      const stream = provider.stream(conversation.getMessages(), tools, imageData);

      for await (const event of stream) {
        if (event.type === 'thinking') {
          if (!spinnerStopped) {
            spinner.stop();
            spinnerStopped = true;
          }
          reasoningContent += event.content;
          renderThinkingChunk(event.content);
        } else if (event.type === 'text') {
          if (!spinnerStopped) {
            spinner.stop();
            spinnerStopped = true;
          }
          renderThinkingEnd();
          streamBuffer.push(event.content);
        } else if (event.type === 'tool_call') {
          if (!spinnerStopped) {
            spinner.stop();
            spinnerStopped = true;
          }
          renderThinkingEnd();
          toolCalls.push(event);
        } else if (event.type === 'usage' && tokenTracker) {
          tokenTracker.updateFromResponse(event.usage);
        } else if (event.type === 'done') {
          if (!spinnerStopped) {
            spinner.stop();
            spinnerStopped = true;
          }
          break;
        }
      }
    } catch (err) {
      if (!spinnerStopped) spinner.stop();
      throw err;
    }

    // Finalize stream — re-render as markdown
    const fullText = streamBuffer.finalize();

    // Track tokens
    if (tokenTracker) {
      const inputText = conversation.getMessages().map(m => typeof m.content === 'string' ? m.content : '').join('');
      tokenTracker.track(inputText, fullText + reasoningContent);
    }

    // Save assistant message
    conversation.addAssistantMessage(provider, fullText, toolCalls, reasoningContent || null);

    if (toolCalls.length === 0) {
      break;
    }

    // Parallel tool execution for read-only tools
    const readOnlyCalls = toolCalls.filter(tc => READ_ONLY_TOOLS.has(tc.name));
    const writeCalls = toolCalls.filter(tc => !READ_ONLY_TOOLS.has(tc.name));

    if (readOnlyCalls.length > 1) {
      // Execute read-only tools in parallel
      renderParallelStart(readOnlyCalls.length);
      const parallelResults = await Promise.all(
        readOnlyCalls.map(async (tc) => {
          renderToolCall(tc.name, tc.arguments);
          const result = await executeTool(tc.name, tc.arguments);
          renderToolResult(tc.name, result);
          return { tc, result };
        })
      );
      renderParallelEnd();

      for (const { tc, result } of parallelResults) {
        conversation.addToolResult(provider, tc.id, result);
      }
    } else {
      // Execute read-only tools serially (only 0 or 1)
      for (const tc of readOnlyCalls) {
        renderToolCall(tc.name, tc.arguments);
        const result = await executeTool(tc.name, tc.arguments);
        renderToolResult(tc.name, result);
        conversation.addToolResult(provider, tc.id, result);
      }
    }

    // Execute write tools serially (preserves undo ordering)
    for (const tc of writeCalls) {
      renderToolCall(tc.name, tc.arguments);
      const result = await executeTool(tc.name, tc.arguments);
      renderToolResult(tc.name, result);
      conversation.addToolResult(provider, tc.id, result);
    }
  }

  if (iteration >= MAX_ITERATIONS) {
    renderError('Agent exceeded maximum iterations. Stopping.');
  }
}

async function handleSlashCommand(input, conversation, memory, provider, rl, tokenTracker, sessionManager, config, mcpManager) {
  const parts = input.split(/\s+/);
  const cmd = parts[0].toLowerCase();

  switch (cmd) {
    case '/help':
      console.log('');
      console.log(chalk.hex('#a78bfa').bold('  Commands:'));
      for (const [key, desc] of Object.entries(SLASH_COMMANDS)) {
        console.log(chalk.hex('#7c3aed')(`    ${key.padEnd(22)}`) + chalk.dim(desc));
      }
      console.log('');
      return true;

    case '/model':
      if (parts[1]) {
        setConfig('model', parts[1]);
        provider.model = parts[1];
        if (tokenTracker) tokenTracker.model = parts[1];
        renderSuccess(`Model switched to ${parts[1]}`);
      } else {
        renderInfo(`Current model: ${provider.model}`);
        renderInfo('Usage: /model <name>');
      }
      return true;

    case '/provider':
      if (parts[1]) {
        const presets = getPresets();
        if (presets[parts[1]]) {
          const preset = presets[parts[1]];
          setConfig('provider', parts[1]);
          setConfig('baseURL', preset.baseURL);
          setConfig('providerType', preset.type);
          setConfig('model', preset.defaultModel);
          renderSuccess(`Provider switched to ${preset.name} (${preset.defaultModel})`);
          renderInfo('Restart to apply provider change, or use /model to change model');
        } else {
          renderError(`Unknown provider: ${parts[1]}`);
          renderInfo(`Available: ${Object.keys(presets).join(', ')}`);
        }
      } else {
        const cfg = getConfig();
        renderInfo(`Current provider: ${cfg.provider}`);
        renderInfo(`Available: ${Object.keys(getPresets()).join(', ')}`);
      }
      return true;

    case '/config': {
      const cfg = getConfig();
      console.log('');
      console.log(chalk.hex('#a78bfa').bold('  Configuration:'));
      console.log(chalk.dim(`    Provider:  `) + chalk.white(cfg.provider || 'not set'));
      console.log(chalk.dim(`    Model:     `) + chalk.white(cfg.model || 'not set'));
      console.log(chalk.dim(`    Base URL:  `) + chalk.white(cfg.baseURL || 'default'));
      console.log(chalk.dim(`    API Key:   `) + chalk.white(cfg.apiKey ? '●●●●●●●●' : 'not set'));
      console.log(chalk.dim(`    Tokens:    `) + chalk.white(`~${conversation.getTokenEstimate()}`));
      console.log(chalk.dim(`    Messages:  `) + chalk.white(conversation.getMessages().length));
      console.log(chalk.dim(`    Auto-approve: `) + chalk.white(getAutoApprove() ? 'ON' : 'OFF'));
      console.log('');
      return true;
    }

    case '/clear':
      conversation.clear();
      console.clear();
      renderSuccess('Conversation cleared');
      return true;

    case '/compact':
      renderInfo('Compacting conversation (structured 3-layer)...');
      const compactMessages = [...conversation.getMessages()];
      compactMessages.push({
        role: 'user',
        content: `Provide a structured summary of our conversation in exactly this format:

## System State
List all files modified, tools used, current project state.

## Decision Log
Key decisions made and their reasoning.

## Pending Tasks
What remains to be done, any open questions.

Be concise but complete.`,
      });

      try {
        let summary = '';
        // Use fast model for compaction if available (cheaper)
        const compactProvider = fastProvider || provider;
        const stream = compactProvider.stream(compactMessages, []);
        for await (const event of stream) {
          if (event.type === 'text') summary += event.content;
          if (event.type === 'done') break;
        }
        conversation.compact(summary);
        renderSuccess(`Conversation compacted. ~${conversation.getTokenEstimate()} tokens`);
        if (fastProvider) renderInfo('(used fast model for compaction)');
      } catch (err) {
        renderError(`Compact failed: ${err.message}`);
      }
      return true;

    case '/image':
      if (parts[1]) {
        try {
          const imgPath = path.resolve(parts.slice(1).join(' '));
          const data = await fs.readFile(imgPath);
          const ext = path.extname(imgPath).toLowerCase();
          const mimeTypes = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };
          const mimeType = mimeTypes[ext] || 'image/png';
          conversation.setImage({ base64: data.toString('base64'), mimeType });
          renderSuccess(`Image attached: ${imgPath}`);
          renderInfo('Your next message will include this image.');
        } catch (err) {
          renderError(`Failed to read image: ${err.message}`);
        }
      } else {
        renderInfo('Usage: /image <path-to-image>');
      }
      return true;

    case '/memory':
      if (parts[1] === 'add' && parts.length > 2) {
        const text = parts.slice(2).join(' ');
        await memory.add(text);
        renderSuccess(`Memory saved: ${text}`);
      } else if (parts[1] === 'clear') {
        await memory.clear();
        renderSuccess('All memories cleared');
      } else {
        const entries = memory.getAll();
        if (entries.length === 0) {
          renderInfo('No saved memories. Use /memory add <text> to save one.');
        } else {
          console.log('');
          console.log(chalk.hex('#a78bfa').bold('  Saved Memories:'));
          entries.forEach((e, i) => {
            console.log(chalk.dim(`    ${i + 1}.`) + chalk.white(` ${e.content}`) + chalk.dim(` (${new Date(e.timestamp).toLocaleDateString()})`));
          });
          console.log('');
        }
      }
      return true;

    case '/undo': {
      const result = await undoLast();
      if (result.error) {
        renderError(result.error);
      } else {
        renderSuccess(`${result.restored}: ${result.action}`);
      }
      return true;
    }

    case '/auto':
      const newState = !getAutoApprove();
      setAutoApprove(newState);
      if (newState) {
        renderSuccess('Auto-approve: ON ⚡ (dangerous ops will be auto-approved)');
      } else {
        renderSuccess('Auto-approve: OFF 🔒 (dangerous ops require confirmation)');
      }
      return true;

    case '/stats': {
      if (tokenTracker) {
        console.log('');
        console.log(chalk.hex('#a78bfa').bold('  Token Usage:'));
        console.log(chalk.dim('    ') + chalk.white(tokenTracker.getSummary()));
        console.log(chalk.dim(`    Messages: ${tokenTracker.messageCount}`));
        console.log('');
      } else {
        renderInfo('Token tracking not available');
      }
      return true;
    }

    // ── Feature: Context Window ──────────────────────────────────
    case '/context': {
      if (tokenTracker) {
        const usage = tokenTracker.getContextUsage();
        if (usage) {
          console.log('');
          console.log(chalk.hex('#a78bfa').bold('  Context Window:'));
          const barWidth = 30;
          const filled = Math.round((usage.percentage / 100) * barWidth);
          const empty = barWidth - filled;
          const barColor = usage.percentage > 80 ? '#ef4444' : usage.percentage > 60 ? '#f59e0b' : '#22c55e';
          const bar = chalk.hex(barColor)('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
          console.log(`    ${bar} ${chalk.white(usage.percentage + '%')}`);
          console.log(chalk.dim(`    ${formatTokens(usage.used)} / ${formatTokens(usage.limit)} tokens`));
          console.log('');
        } else {
          renderInfo('Context limit unknown for this model. Estimated tokens: ~' + conversation.getTokenEstimate());
        }
      } else {
        renderInfo('Token tracking not available');
      }
      return true;
    }

    // ── Feature: Session Persistence ─────────────────────────────
    case '/save': {
      if (!sessionManager) { renderError('Session manager not available'); return true; }
      const name = parts.slice(1).join(' ') || undefined;
      try {
        const result = await sessionManager.save(conversation, config || getConfig(), name);
        renderSuccess(`Session saved: ${result.id}`);
      } catch (err) {
        renderError(`Save failed: ${err.message}`);
      }
      return true;
    }

    case '/load': {
      if (!sessionManager) { renderError('Session manager not available'); return true; }
      if (parts[1]) {
        try {
          const session = await sessionManager.load(parts[1]);
          conversation.setMessages(session.messages);
          renderSuccess(`Loaded session: ${session.id} (${session.messages.length} messages)`);
        } catch (err) {
          renderError(`Load failed: ${err.message}`);
        }
      } else {
        try {
          const sessions = await sessionManager.list();
          if (sessions.length === 0) {
            renderInfo('No saved sessions. Use /save [name] to create one.');
          } else {
            console.log('');
            console.log(chalk.hex('#a78bfa').bold('  Saved Sessions:'));
            for (const s of sessions.slice(0, 15)) {
              const date = new Date(s.timestamp).toLocaleString();
              console.log(chalk.hex('#7c3aed')(`    ${s.id.padEnd(30)}`) + chalk.dim(`${s.messageCount} msgs · ${s.model} · ${date}`));
            }
            console.log(chalk.dim(`\n    Use /load <name> to restore a session.`));
            console.log('');
          }
        } catch (err) {
          renderError(`List failed: ${err.message}`);
        }
      }
      return true;
    }

    // ── Feature: Conversation Branching ───────────────────────────
    case '/fork': {
      const label = parts.slice(1).join(' ') || undefined;
      const name = conversation.fork(label);
      renderSuccess(`Checkpoint created: ${name} (${conversation.getMessages().length} messages)`);
      return true;
    }

    case '/branches': {
      const forks = conversation.listForks();
      if (forks.length === 0) {
        renderInfo('No checkpoints. Use /fork [label] to create one.');
      } else {
        console.log('');
        console.log(chalk.hex('#a78bfa').bold('  Conversation Checkpoints:'));
        for (const f of forks) {
          const date = new Date(f.timestamp).toLocaleString();
          console.log(chalk.hex('#7c3aed')(`    ${f.name.padEnd(25)}`) + chalk.dim(`${f.messageCount} msgs · ${date}`));
        }
        console.log(chalk.dim(`\n    Use /switch <label> to restore.`));
        console.log('');
      }
      return true;
    }

    case '/switch': {
      if (!parts[1]) {
        renderInfo('Usage: /switch <label>');
        return true;
      }
      try {
        const result = conversation.switchFork(parts.slice(1).join(' '));
        renderSuccess(`Switched to: ${result.name} (${result.messageCount} messages)`);
      } catch (err) {
        renderError(err.message);
      }
      return true;
    }

    // ── Feature: /diff ───────────────────────────────────────────
    case '/diff': {
      try {
        const diffOutput = await runGitDiff();
        if (diffOutput) {
          console.log('');
          console.log(chalk.hex('#a78bfa').bold('  Changes vs HEAD:'));
          console.log('');
          // Colorize diff output
          const lines = diffOutput.split('\n');
          for (const line of lines) {
            if (line.startsWith('+') && !line.startsWith('+++')) {
              console.log(chalk.green(`    ${line}`));
            } else if (line.startsWith('-') && !line.startsWith('---')) {
              console.log(chalk.red(`    ${line}`));
            } else if (line.startsWith('@@')) {
              console.log(chalk.cyan(`    ${line}`));
            } else if (line.startsWith('diff ')) {
              console.log(chalk.hex('#a78bfa').bold(`    ${line}`));
            } else {
              console.log(chalk.dim(`    ${line}`));
            }
          }
          console.log('');
        } else {
          renderInfo('No changes detected vs HEAD.');
        }
      } catch {
        // Fallback: show undo stack
        const stack = getUndoStack();
        if (stack.length === 0) {
          renderInfo('No file changes in this session and not in a git repo.');
        } else {
          console.log('');
          console.log(chalk.hex('#a78bfa').bold('  File Changes (undo stack):'));
          for (const s of stack) {
            const date = new Date(s.timestamp).toLocaleString();
            console.log(chalk.dim(`    ${s.type.padEnd(8)}`) + chalk.white(s.path) + chalk.dim(` · ${date}`));
          }
          console.log('');
        }
      }
      return true;
    }

    case '/export': {
      const messages = conversation.getMessages();
      const md = messages
        .filter(m => m.role !== 'system')
        .map(m => {
          const role = m.role === 'user' ? '## 👤 User' : m.role === 'assistant' ? '## 🤖 Assistant' : `## 🔧 Tool (${m.tool_call_id || ''})`;
          const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content, null, 2);
          return `${role}\n\n${content}`;
        })
        .join('\n\n---\n\n');

      const exportPath = path.resolve(`void-spirit-export-${Date.now()}.md`);
      await fs.writeFile(exportPath, `# Void Spirit Conversation Export\n\n${md}`, 'utf-8');
      renderSuccess(`Exported to: ${exportPath}`);
      return true;
    }

    case '/install':
      if (parts[1]) {
        renderInfo(`Installing plugin from ${parts[1]}...`);
        try {
          const result = await installPlugin(parts[1]);
          renderSuccess(result.message);
          renderInfo('Restart Void Spirit to load the new plugin.');
        } catch (err) {
          renderError(`Install failed: ${err.message}`);
        }
      } else {
        renderInfo('Usage: /install <github-url-or-download-url>');
      }
      return true;

    case '/plugins': {
      const { PluginLoader } = await import('../plugins/loader.js');
      const loader = new PluginLoader();
      await loader.loadAll();
      if (loader.plugins.length === 0) {
        renderInfo('No plugins installed. Use /install <url> to add one.');
      } else {
        console.log('');
        console.log(chalk.hex('#a78bfa').bold('  Installed Plugins:'));
        loader.plugins.forEach((p, i) => {
          const trustBadge = p.trustLabel || '❓';
          const riskBadge = p.maxRisk === 'critical' ? chalk.red('CRITICAL')
            : p.maxRisk === 'high' ? chalk.hex('#f59e0b')('HIGH')
            : p.maxRisk === 'medium' ? chalk.yellow('MEDIUM')
            : chalk.green('LOW');
          console.log(chalk.dim(`    ${i + 1}.`) + chalk.white(` ${p.name}`) + chalk.dim(` v${p.version}`) + `  ${trustBadge}  ${riskBadge}`);
          if (p.effectivePermissions && p.effectivePermissions.length > 0) {
            console.log(chalk.dim(`       Permissions: ${p.effectivePermissions.join(', ')}`));
          }
          if (p.declaredPermissions && p.trustTier === 'untrusted' &&
              JSON.stringify(p.declaredPermissions) !== JSON.stringify(p.effectivePermissions)) {
            console.log(chalk.dim(`       Requested:   ${p.declaredPermissions.join(', ')}`) + chalk.hex('#f59e0b')(' (restricted — run /trust to grant)'));
          }
        });
        console.log('');
      }
      return true;
    }

    case '/trust': {
      if (!parts[1]) {
        renderInfo('Usage: /trust <plugin-name>');
        return true;
      }
      const pluginName = parts.slice(1).join(' ');
      const { PluginLoader: TLoader, PLUGINS_DIR: pDir } = await import('../plugins/loader.js');
      const tLoader = new TLoader();
      await tLoader.loadAll();
      const targetPlugin = tLoader.plugins.find(p => p.name === pluginName);
      if (!targetPlugin) {
        renderError(`Plugin "${pluginName}" not found. Use /plugins to see installed plugins.`);
        return true;
      }
      const result = await tLoader.trustManager.trustPlugin(pluginName, targetPlugin.path);
      renderSuccess(`Plugin "${pluginName}" is now ${result.label}. Restart to apply full permissions.`);
      return true;
    }

    case '/untrust': {
      if (!parts[1]) {
        renderInfo('Usage: /untrust <plugin-name>');
        return true;
      }
      const pluginName = parts.slice(1).join(' ');
      const { PluginLoader: ULoader } = await import('../plugins/loader.js');
      const uLoader = new ULoader();
      await uLoader.loadAll();
      const targetPlugin = uLoader.plugins.find(p => p.name === pluginName);
      if (!targetPlugin) {
        renderError(`Plugin "${pluginName}" not found.`);
        return true;
      }
      const result = await uLoader.trustManager.untrustPlugin(pluginName);
      renderSuccess(`Plugin "${pluginName}" is now ${result.label}. Restricted to read-only.`);
      return true;
    }

    case '/exit':
    case '/quit':
      if (sessionManager && conversation.getMessages().length > 1) {
        try {
          await sessionManager.save(conversation, config || getConfig(), sessionManager.currentId || undefined);
          renderInfo('Session auto-saved.');
        } catch { /* silent */ }
      }
      console.log(chalk.hex('#a78bfa')('\n  👋 Goodbye!\n'));
      process.exit(0);

    case '/mcp': {
      if (!mcpManager || mcpManager.servers.size === 0) {
        renderInfo('No MCP servers connected. Configure them in .void-spirit/team.json or opencode.json.');
        renderInfo('Example: { "mcpServers": { "github": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"] } } }');
      } else {
        console.log('');
        console.log(chalk.hex('#a78bfa').bold('  MCP Servers:'));
        const status = mcpManager.getStatus();
        for (const server of status) {
          console.log(chalk.hex('#00d4aa')(`    ${server.name}`) + chalk.dim(` — ${server.toolCount} tools`));
          for (const tool of server.tools.slice(0, 10)) {
            console.log(chalk.dim(`      • ${tool}`));
          }
          if (server.tools.length > 10) {
            console.log(chalk.dim(`      ... and ${server.tools.length - 10} more`));
          }
        }
        console.log('');
      }
      return true;
    }

    default:
      renderError(`Unknown command: ${cmd}. Type /help for available commands.`);
      return true;
  }
}

// ── Helpers ──────────────────────────────────────────────────────

function runGitDiff() {
  return new Promise((resolve, reject) => {
    exec('git diff HEAD', { cwd: process.cwd(), maxBuffer: 5 * 1024 * 1024, timeout: 10000 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout.trim());
    });
  });
}

function formatTokens(n) {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(1) + 'K';
  return (n / 1_000_000).toFixed(2) + 'M';
}
