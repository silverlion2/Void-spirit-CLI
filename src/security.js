import path from 'path';
import chalk from 'chalk';
import fs from 'fs/promises';
import os from 'os';

// ── Path Sandboxing ──────────────────────────────────────────────
const projectRoot = process.cwd();

const ALLOWED_ROOTS = [
  projectRoot,
  os.tmpdir(),
  os.homedir(), // allow reading home dir files
];

export function isPathAllowed(targetPath) {
  const resolved = path.resolve(targetPath);
  return ALLOWED_ROOTS.some((root) => resolved.startsWith(root));
}

export function enforcePathSandbox(targetPath) {
  const resolved = path.resolve(targetPath);
  if (!isPathAllowed(resolved)) {
    throw new Error(`Path blocked by sandbox: ${resolved} is outside the allowed directories.`);
  }
  return resolved;
}

// ── Command Blocklist ────────────────────────────────────────────
const BLOCKED_COMMANDS = [
  // Destructive file operations
  /\brm\s+(-rf?|--recursive)\s+[\/\\]/i,
  /\brm\s+(-rf?|--recursive)\s+~/i,
  /\bdel\s+\/s\s+\/q/i,
  /\bformat\s+[a-z]:/i,
  /\brmdir\s+\/s\s+\/q/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  // System modification
  /\bchmod\s+(-R\s+)?777\s+\//i,
  /\bchown\s+(-R\s+)?.*\s+\//i,
  /\breg\s+(delete|add)/i,
  // Network exfiltration
  /\bcurl\b.*\|\s*(bash|sh|powershell)/i,
  /\bwget\b.*\|\s*(bash|sh)/i,
  /\bInvoke-WebRequest\b.*\|\s*iex/i,
  // Process/system kill
  /\bkill\s+-9\s+1\b/,
  /\bshutdown\b/i,
  /\btaskkill\s+\/f\s+\/im\s+(explorer|svchost|csrss)/i,
  // Crypto / ransomware patterns
  /\bcipher\s+\/w:/i,
  /\bopenssl\s+enc\b.*-in\s+\//i,
];

export function isCommandBlocked(command) {
  const normalized = command.trim();
  for (const pattern of BLOCKED_COMMANDS) {
    if (pattern.test(normalized)) {
      return { blocked: true, reason: `Matched blocklist pattern: ${pattern}` };
    }
  }
  return { blocked: false };
}

// ── Sensitive File Filter ────────────────────────────────────────
const SENSITIVE_PATTERNS = [
  /\.env$/i,
  /\.env\.\w+$/i,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /\.jks$/i,
  /id_rsa$/i,
  /id_ed25519$/i,
  /\.secret$/i,
  /credentials\.json$/i,
  /service[-_]?account.*\.json$/i,
  /token\.json$/i,
  /\.npmrc$/i,
  /\.pypirc$/i,
  /\.netrc$/i,
];

const SENSITIVE_CONTENT_MARKERS = [
  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/,  // AWS access key
  /sk-[a-zA-Z0-9]{20,}/,  // API keys
  /ghp_[a-zA-Z0-9]{36}/,  // GitHub PAT
  /glpat-[a-zA-Z0-9\-]{20,}/,  // GitLab PAT
];

export function isSensitiveFile(filePath) {
  const basename = path.basename(filePath);
  return SENSITIVE_PATTERNS.some((p) => p.test(basename));
}

export function hasSensitiveContent(content) {
  return SENSITIVE_CONTENT_MARKERS.some((p) => p.test(content));
}

export function redactSensitiveContent(content) {
  let redacted = content;
  for (const pattern of SENSITIVE_CONTENT_MARKERS) {
    redacted = redacted.replace(pattern, '[REDACTED]');
  }
  return redacted;
}

// ── Audit Log ────────────────────────────────────────────────────
const AUDIT_PATH = path.join(os.homedir(), '.void-spirit', 'audit.log');

export async function logAudit(action, details) {
  try {
    const dir = path.dirname(AUDIT_PATH);
    await fs.mkdir(dir, { recursive: true });
    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      action,
      ...details,
    }) + '\n';
    await fs.appendFile(AUDIT_PATH, entry, 'utf-8');
  } catch {
    // silently fail — audit should never break the tool
  }
}

// ── Undo / Rollback ──────────────────────────────────────────────
const undoStack = [];
const MAX_UNDO = 20;

export async function snapshotFile(filePath) {
  try {
    const resolved = path.resolve(filePath);
    const content = await fs.readFile(resolved, 'utf-8');
    undoStack.push({
      path: resolved,
      content,
      timestamp: new Date().toISOString(),
      type: 'modify',
    });
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    return true;
  } catch {
    // File doesn't exist yet (create), that's fine
    undoStack.push({
      path: path.resolve(filePath),
      content: null,
      timestamp: new Date().toISOString(),
      type: 'create',
    });
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    return true;
  }
}

export async function undoLast() {
  if (undoStack.length === 0) {
    return { error: 'Nothing to undo.' };
  }
  const snapshot = undoStack.pop();
  try {
    if (snapshot.type === 'create' && snapshot.content === null) {
      // File was created — delete it to undo
      await fs.unlink(snapshot.path);
      return { restored: snapshot.path, action: 'deleted (was newly created)' };
    } else {
      // File was modified — restore original content
      await fs.writeFile(snapshot.path, snapshot.content, 'utf-8');
      return { restored: snapshot.path, action: 'restored to previous version' };
    }
  } catch (err) {
    return { error: `Undo failed: ${err.message}` };
  }
}

export function getUndoStack() {
  return undoStack.map((s) => ({
    path: s.path,
    type: s.type,
    timestamp: s.timestamp,
  }));
}

// ── Diff Preview ─────────────────────────────────────────────────
export function generateDiff(original, modified, filePath) {
  const origLines = original.split('\n');
  const modLines = modified.split('\n');
  const diff = [];
  const maxLines = Math.max(origLines.length, modLines.length);

  let changes = 0;
  for (let i = 0; i < maxLines; i++) {
    const origLine = origLines[i];
    const modLine = modLines[i];

    if (origLine === undefined) {
      diff.push(chalk.green(`+ ${modLine}`));
      changes++;
    } else if (modLine === undefined) {
      diff.push(chalk.red(`- ${origLine}`));
      changes++;
    } else if (origLine !== modLine) {
      diff.push(chalk.red(`- ${origLine}`));
      diff.push(chalk.green(`+ ${modLine}`));
      changes++;
    }
  }

  return { diff: diff.join('\n'), changes };
}
