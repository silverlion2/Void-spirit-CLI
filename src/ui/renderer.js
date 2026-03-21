import chalk from 'chalk';
import { Marked } from 'marked';
import { markedTerminal } from 'marked-terminal';

const marked = new Marked(markedTerminal({
  reflowText: true,
  width: Math.min(process.stdout.columns || 100, 120),
  tab: 2,
}));

const COLORS = {
  user: '#06b6d4',      // cyan
  assistant: '#e2e8f0',  // light gray
  tool: '#f59e0b',       // amber
  toolName: '#a78bfa',   // purple
  error: '#ef4444',      // red
  success: '#22c55e',    // green
  dim: '#64748b',        // slate
  accent: '#7c3aed',     // violet
};

// ── StreamBuffer ─────────────────────────────────────────────────
// Accumulates streamed text, writes raw during streaming,
// then clears and re-renders as markdown on finalize.
export class StreamBuffer {
  constructor() {
    this.chunks = [];
    this.rawLength = 0;
    this.started = false;
  }

  push(text) {
    if (!this.started) {
      process.stdout.write('  ');
      this.started = true;
    }
    this.chunks.push(text);
    this.rawLength += text.length;
    // Write raw text as it streams for responsiveness
    process.stdout.write(text);
  }

  finalize() {
    const fullText = this.chunks.join('');
    if (!fullText) return '';

    // Move to new line after raw stream
    if (this.started) {
      process.stdout.write('\n');
    }

    // Clear the raw streamed text and re-render as markdown
    // Use ANSI escape to move cursor up and clear lines
    const rawLines = (fullText + '  ').split('\n').length;
    for (let i = 0; i < rawLines; i++) {
      process.stdout.write('\x1b[1A\x1b[2K');
    }

    // Render as formatted markdown
    try {
      const rendered = marked.parse(fullText);
      if (rendered) {
        // Indent each line for consistent formatting
        const indented = rendered
          .split('\n')
          .map(line => '  ' + line)
          .join('\n');
        process.stdout.write(indented);
        if (!indented.endsWith('\n')) process.stdout.write('\n');
      }
    } catch {
      // Fallback: just print the raw text
      process.stdout.write('  ' + fullText + '\n');
    }

    return fullText;
  }
}

export function renderMarkdown(text) {
  if (!text) return '';
  try {
    return marked.parse(text);
  } catch {
    return text;
  }
}

export function renderToolCall(name, args) {
  const icon = getToolIcon(name);
  const label = chalk.hex(COLORS.toolName).bold(`${icon} ${name}`);
  const summary = getToolSummary(name, args);
  console.log('');
  console.log(chalk.hex(COLORS.dim)('  ┌─') + ` ${label}` + chalk.hex(COLORS.dim)(` ${summary}`));
}

export function renderToolResult(name, result) {
  const isError = result.error;
  const icon = isError ? '✗' : '✓';
  const color = isError ? COLORS.error : COLORS.success;

  if (isError) {
    console.log(chalk.hex(COLORS.dim)('  └─') + chalk.hex(color)(` ${icon} ${result.error}`));
  } else {
    const summary = getResultSummary(name, result);
    console.log(chalk.hex(COLORS.dim)('  └─') + chalk.hex(color)(` ${icon}`) + chalk.hex(COLORS.dim)(` ${summary}`));
  }
}

// ── Parallel tool rendering ──────────────────────────────────────
export function renderParallelStart(count) {
  console.log('');
  console.log(chalk.hex(COLORS.accent)(`  ⚡ Running ${count} tools in parallel`));
}

export function renderParallelEnd() {
  console.log(chalk.hex(COLORS.accent)(`  ⚡ Parallel execution complete`));
}

export function renderStreamChunk(text) {
  process.stdout.write(text);
}

let thinkingStarted = false;
export function renderThinkingChunk(text) {
  if (!thinkingStarted) {
    console.log('');
    process.stdout.write(chalk.dim.italic('  💭 Thinking: '));
    thinkingStarted = true;
  }
  process.stdout.write(chalk.dim.italic(text));
}

export function renderThinkingEnd() {
  if (thinkingStarted) {
    console.log('');
    thinkingStarted = false;
  }
}

export function renderError(message) {
  console.log(chalk.hex(COLORS.error)(`\n  ✗ ${message}`));
}

export function renderInfo(message) {
  console.log(chalk.hex(COLORS.dim)(`  ${message}`));
}

export function renderSuccess(message) {
  console.log(chalk.hex(COLORS.success)(`  ✓ ${message}`));
}

function getToolIcon(name) {
  const icons = {
    read_file: '📖',
    write_file: '📝',
    edit_file: '✏️',
    list_directory: '📁',
    search_files: '🔍',
    grep: '🔎',
    run_command: '⚡',
    web_fetch: '🌐',
    git_command: '📦',
    create_directory: '📂',
    delete_file: '🗑️',
    move_file: '📋',
  };
  return icons[name] || '🔧';
}

function getToolSummary(name, args) {
  switch (name) {
    case 'read_file': return args.path || '';
    case 'write_file': return args.path || '';
    case 'edit_file': return args.path || '';
    case 'list_directory': return args.path || '.';
    case 'search_files': return args.pattern || '';
    case 'grep': return `"${args.pattern}" in ${args.path || '.'}`;
    case 'run_command': return args.command || '';
    case 'web_fetch': return args.url || '';
    case 'git_command': return `git ${args.args || ''}`;
    case 'create_directory': return args.path || '';
    case 'delete_file': return args.path || '';
    case 'move_file': return `${args.source} → ${args.destination}`;
    default: return JSON.stringify(args).slice(0, 60);
  }
}

function getResultSummary(name, result) {
  switch (name) {
    case 'read_file': return `${result.totalLines} lines (showing ${result.showing})`;
    case 'write_file': return `${result.bytes} bytes written`;
    case 'edit_file': return 'file updated';
    case 'list_directory': return `${result.entries} entries`;
    case 'search_files': return `${result.total} matches`;
    case 'grep': return `${result.total} matches`;
    case 'run_command': return `exit code ${result.exitCode}`;
    case 'web_fetch': return `HTTP ${result.status}`;
    case 'git_command': return `exit code ${result.exitCode}`;
    case 'create_directory': return 'created';
    case 'delete_file': return 'deleted';
    case 'move_file': return 'moved';
    default: return 'done';
  }
}
