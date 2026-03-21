import fs from 'fs/promises';
import { existsSync, statSync } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { glob } from 'glob';
import chalk from 'chalk';
import { createInterface } from 'readline';
import {
  enforcePathSandbox,
  isCommandBlocked,
  isSensitiveFile,
  hasSensitiveContent,
  redactSensitiveContent,
  logAudit,
  snapshotFile,
  generateDiff,
} from '../security.js';
import { executeSubagent } from './subagent.js';
import { executeTodo } from './todo.js';
import { executeLoadSkill } from '../skill-loader.js';

const DANGEROUS_TOOLS = ['run_command', 'write_file', 'edit_file', 'delete_file', 'move_file'];
let autoApprove = false;

// Runtime provider/conversation references for subagent
let _provider = null;
let _conversation = null;

export function setProvider(provider) {
  _provider = provider;
}

export function setConversation(conversation) {
  _conversation = conversation;
}

export function setAutoApprove(value) {
  autoApprove = value;
}

export function getAutoApprove() {
  return autoApprove;
}

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function confirmAction(toolName, args) {
  if (!DANGEROUS_TOOLS.includes(toolName)) return true;
  if (autoApprove) {
    console.log(chalk.dim(`  ⚡ Auto-approved: ${toolName}`));
    return true;
  }

  let desc = '';
  if (toolName === 'run_command') {
    desc = `Run command: ${chalk.yellow(args.command)}`;
  } else if (toolName === 'write_file') {
    desc = `Write file: ${chalk.yellow(args.path)}`;
  } else if (toolName === 'edit_file') {
    desc = `Edit file: ${chalk.yellow(args.path)}`;
  } else if (toolName === 'delete_file') {
    desc = `Delete: ${chalk.yellow(args.path)}`;
  } else if (toolName === 'move_file') {
    desc = `Move: ${chalk.yellow(args.source)} → ${chalk.yellow(args.destination)}`;
  }

  console.log('');
  console.log(chalk.hex('#f59e0b')('  ⚠ Tool requires approval:'));
  console.log(chalk.white(`    ${desc}`));
  const answer = await prompt(chalk.hex('#f59e0b')('  Allow? [Y/n]: '));
  return answer !== 'n' && answer !== 'no';
}

async function executeReadFile({ path: filePath, start_line, end_line }) {
  const resolved = enforcePathSandbox(filePath);
  if (!existsSync(resolved)) {
    return { error: `File not found: ${resolved}` };
  }

  // Sensitive file check
  if (isSensitiveFile(resolved)) {
    const content = await fs.readFile(resolved, 'utf-8');
    const redacted = redactSensitiveContent(content);
    const lines = redacted.split('\n');
    const start = (start_line || 1) - 1;
    const end = end_line || lines.length;
    const sliced = lines.slice(start, end);
    const numbered = sliced.map((line, i) => `${String(start + i + 1).padStart(4)} │ ${line}`).join('\n');
    await logAudit('read_file', { path: resolved, redacted: true });
    return { content: numbered, totalLines: lines.length, showing: `${start + 1}-${end}`, note: '⚠ Sensitive content redacted' };
  }

  const content = await fs.readFile(resolved, 'utf-8');
  const lines = content.split('\n');
  const start = (start_line || 1) - 1;
  const end = end_line || lines.length;
  const sliced = lines.slice(start, end);
  const numbered = sliced.map((line, i) => `${String(start + i + 1).padStart(4)} │ ${line}`).join('\n');

  await logAudit('read_file', { path: resolved });
  return { content: numbered, totalLines: lines.length, showing: `${start + 1}-${end}` };
}

async function executeWriteFile({ path: filePath, content }) {
  const resolved = enforcePathSandbox(filePath);
  
  // Snapshot for undo
  await snapshotFile(resolved);

  // Diff preview if file exists
  if (existsSync(resolved)) {
    const original = await fs.readFile(resolved, 'utf-8');
    const { diff, changes } = generateDiff(original, content, resolved);
    if (changes > 0) {
      console.log(chalk.dim(`\n  📋 Diff preview (${changes} changes):`));
      console.log(diff.split('\n').map(l => `    ${l}`).join('\n'));
    }
  }

  const dir = path.dirname(resolved);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(resolved, content, 'utf-8');

  await logAudit('write_file', { path: resolved, bytes: Buffer.byteLength(content) });
  return { success: true, path: resolved, bytes: Buffer.byteLength(content) };
}

async function executeEditFile({ path: filePath, target, replacement }) {
  const resolved = enforcePathSandbox(filePath);
  if (!existsSync(resolved)) {
    return { error: `File not found: ${resolved}` };
  }

  const content = await fs.readFile(resolved, 'utf-8');
  if (!content.includes(target)) {
    return { error: `Target text not found in file. Make sure it matches exactly.` };
  }

  // Snapshot for undo
  await snapshotFile(resolved);

  const updated = content.replace(target, replacement);

  // Diff preview
  const { diff, changes } = generateDiff(content, updated, resolved);
  if (changes > 0) {
    console.log(chalk.dim(`\n  📋 Diff preview (${changes} changes):`));
    console.log(diff.split('\n').map(l => `    ${l}`).join('\n'));
  }

  await fs.writeFile(resolved, updated, 'utf-8');

  await logAudit('edit_file', { path: resolved });
  return { success: true, path: resolved };
}

async function executeListDirectory({ path: dirPath, recursive, max_depth }) {
  const resolved = enforcePathSandbox(dirPath || '.');
  if (!existsSync(resolved)) {
    return { error: `Directory not found: ${resolved}` };
  }

  const entries = [];
  async function walk(dir, depth) {
    if (depth > (max_depth || 3)) return;
    const items = await fs.readdir(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.name.startsWith('.') || item.name === 'node_modules') continue;
      const fullPath = path.join(dir, item.name);
      const rel = path.relative(resolved, fullPath);
      if (item.isDirectory()) {
        entries.push({ name: rel, type: 'dir' });
        if (recursive) await walk(fullPath, depth + 1);
      } else {
        try {
          const stat = statSync(fullPath);
          entries.push({ name: rel, type: 'file', size: stat.size });
        } catch {
          entries.push({ name: rel, type: 'file' });
        }
      }
    }
  }

  await walk(resolved, 0);
  const output = entries
    .map((e) => {
      if (e.type === 'dir') return `📁 ${e.name}/`;
      const size = e.size ? ` (${formatSize(e.size)})` : '';
      const sensitive = isSensitiveFile(e.name) ? ' 🔒' : '';
      return `📄 ${e.name}${size}${sensitive}`;
    })
    .join('\n');

  return { path: resolved, entries: entries.length, listing: output || '(empty directory)' };
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
}

async function executeSearchFiles({ pattern, path: searchPath }) {
  const cwd = enforcePathSandbox(searchPath || '.');
  const matches = await glob(pattern, {
    cwd,
    ignore: ['node_modules/**', '.git/**'],
    nodir: true,
  });
  return {
    pattern,
    cwd,
    matches: matches.slice(0, 50),
    total: matches.length,
    truncated: matches.length > 50,
  };
}

async function executeGrep({ pattern, path: searchPath, include, ignore_case }) {
  const cwd = enforcePathSandbox(searchPath || '.');
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    let cmd;

    if (isWindows) {
      const flags = ignore_case ? '/I /S /N' : '/S /N';
      const fileFilter = include ? `*.${include.replace('*.', '')}` : '*.*';
      cmd = `findstr ${flags} "${pattern}" ${fileFilter}`;
    } else {
      const flags = ignore_case ? '-rni' : '-rn';
      const includeArg = include ? `--include="${include}"` : '';
      cmd = `grep ${flags} ${includeArg} "${pattern}" .`;
    }

    exec(cmd, { cwd, maxBuffer: 1024 * 1024, timeout: 10000 }, (err, stdout) => {
      const lines = (stdout || '').split('\n').filter(Boolean).slice(0, 50);
      resolve({
        pattern,
        cwd,
        matches: lines,
        total: lines.length,
      });
    });
  });
}

async function executeRunCommand({ command, cwd }) {
  // Command blocklist check
  const blockCheck = isCommandBlocked(command);
  if (blockCheck.blocked) {
    await logAudit('command_blocked', { command, reason: blockCheck.reason });
    return { error: `🛡️ Command blocked for safety: ${blockCheck.reason}` };
  }

  const resolved = cwd ? enforcePathSandbox(cwd) : process.cwd();

  await logAudit('run_command', { command, cwd: resolved });

  return new Promise((resolve) => {
    exec(command, { cwd: resolved, maxBuffer: 5 * 1024 * 1024, timeout: 60000 }, (err, stdout, stderr) => {
      resolve({
        command,
        exitCode: err ? err.code || 1 : 0,
        stdout: stdout ? stdout.slice(0, 10000) : '',
        stderr: stderr ? stderr.slice(0, 5000) : '',
      });
    });
  });
}

async function executeWebFetch({ url }) {
  await logAudit('web_fetch', { url });
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'VoidSpirit/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();

    let content = text;
    if (contentType.includes('html')) {
      content = text
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 15000);
    } else {
      content = text.slice(0, 15000);
    }

    return { url, status: res.status, content };
  } catch (err) {
    return { url, error: err.message };
  }
}

async function executeGitCommand({ args, cwd }) {
  const resolved = cwd ? enforcePathSandbox(cwd) : process.cwd();

  await logAudit('git_command', { args, cwd: resolved });

  return new Promise((resolve) => {
    exec(`git ${args}`, { cwd: resolved, maxBuffer: 5 * 1024 * 1024, timeout: 30000 }, (err, stdout, stderr) => {
      resolve({
        command: `git ${args}`,
        exitCode: err ? err.code || 1 : 0,
        output: (stdout || '').slice(0, 10000),
        error: stderr ? stderr.slice(0, 5000) : '',
      });
    });
  });
}

async function executeCreateDirectory({ path: dirPath }) {
  const resolved = enforcePathSandbox(dirPath);
  await fs.mkdir(resolved, { recursive: true });
  await logAudit('create_directory', { path: resolved });
  return { success: true, path: resolved };
}

async function executeDeleteFile({ path: filePath }) {
  const resolved = enforcePathSandbox(filePath);
  if (!existsSync(resolved)) {
    return { error: `Not found: ${resolved}` };
  }
  
  // Snapshot for undo
  await snapshotFile(resolved);

  const stat = statSync(resolved);
  if (stat.isDirectory()) {
    await fs.rmdir(resolved);
  } else {
    await fs.unlink(resolved);
  }
  await logAudit('delete_file', { path: resolved });
  return { success: true, deleted: resolved };
}

async function executeMoveFile({ source, destination }) {
  const src = enforcePathSandbox(source);
  const dest = enforcePathSandbox(destination);
  if (!existsSync(src)) {
    return { error: `Source not found: ${src}` };
  }

  // Snapshot for undo
  await snapshotFile(src);

  const destDir = path.dirname(dest);
  await fs.mkdir(destDir, { recursive: true });
  await fs.rename(src, dest);

  await logAudit('move_file', { from: src, to: dest });
  return { success: true, from: src, to: dest };
}

const EXECUTORS = {
  read_file: executeReadFile,
  write_file: executeWriteFile,
  edit_file: executeEditFile,
  list_directory: executeListDirectory,
  search_files: executeSearchFiles,
  grep: executeGrep,
  run_command: executeRunCommand,
  web_fetch: executeWebFetch,
  git_command: executeGitCommand,
  create_directory: executeCreateDirectory,
  delete_file: executeDeleteFile,
  move_file: executeMoveFile,
  // Claude Code-inspired tools
  todo_write: (args) => executeTodo(args),
  load_skill: (args) => executeLoadSkill(args),
};

export async function executeTool(name, args) {
  // Special handling for subagent — needs provider + conversation
  if (name === 'spawn_subagent') {
    if (!_provider) {
      return { error: 'Subagent requires an active provider. Make sure provider is set.' };
    }
    try {
      return await executeSubagent(args, _provider, _conversation);
    } catch (err) {
      await logAudit('tool_error', { name, error: err.message });
      return { error: `Subagent failed: ${err.message}` };
    }
  }

  const executor = EXECUTORS[name];
  if (!executor) {
    return { error: `Unknown tool: ${name}` };
  }

  // Check for user approval on dangerous tools
  const approved = await confirmAction(name, args);
  if (!approved) {
    await logAudit('tool_denied', { name, args });
    return { error: 'Action denied by user.' };
  }

  try {
    return await executor(args);
  } catch (err) {
    await logAudit('tool_error', { name, error: err.message });
    return { error: `Tool execution failed: ${err.message}` };
  }
}

