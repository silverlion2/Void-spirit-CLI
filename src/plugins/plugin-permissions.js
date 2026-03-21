/**
 * Plugin Permission System — Capability-Based Permission Scoping
 *
 * Maps granular permission capabilities to allowed tool sets.
 * Plugins declare required permissions in manifest.json; the loader
 * resolves them to concrete tool access at load time.
 */

// ── Capability → Tool Mapping ────────────────────────────────────

const PERMISSION_CAPABILITIES = {
  'fs:read': {
    tools: ['read_file', 'list_directory', 'search_files', 'grep'],
    risk: 'low',
    description: 'Read files and browse directories',
  },
  'fs:write': {
    tools: ['write_file', 'edit_file', 'create_directory'],
    risk: 'medium',
    description: 'Create and modify files',
  },
  'fs:delete': {
    tools: ['delete_file', 'move_file'],
    risk: 'high',
    description: 'Delete and move files',
  },
  'command:run': {
    tools: ['run_command'],
    risk: 'critical',
    description: 'Execute arbitrary shell commands',
  },
  'git:read': {
    tools: ['git_command'],
    risk: 'low',
    description: 'Read git status, log, and diff',
    gitFilter: 'read', // used by sandbox to restrict git subcommands
  },
  'git:write': {
    tools: ['git_command'],
    risk: 'medium',
    description: 'Mutating git operations (commit, push, checkout)',
    gitFilter: 'write',
  },
  'web:fetch': {
    tools: ['web_fetch'],
    risk: 'medium',
    description: 'Fetch URLs from the internet',
  },
};

// Read-only git subcommands (used to distinguish git:read vs git:write)
const GIT_READ_COMMANDS = new Set([
  'status', 'log', 'diff', 'show', 'branch', 'tag',
  'remote', 'stash list', 'ls-files', 'blame',
]);

// Default permissions for untrusted plugins
const DEFAULT_PERMISSIONS = ['fs:read'];

// All valid capability names
const VALID_CAPABILITIES = new Set(Object.keys(PERMISSION_CAPABILITIES));

// ── Public API ───────────────────────────────────────────────────

/**
 * Resolve declared permissions into a set of allowed tool names.
 * @param {string[]} permissions - Array of capability strings from manifest
 * @returns {{ allowedTools: Set<string>, gitFilter: string|null }}
 */
export function resolveAllowedTools(permissions) {
  const tools = new Set();
  let gitFilter = null;

  for (const perm of permissions) {
    const cap = PERMISSION_CAPABILITIES[perm];
    if (!cap) continue;
    for (const tool of cap.tools) {
      tools.add(tool);
    }
    // Track the highest git access level
    if (cap.gitFilter === 'write') {
      gitFilter = 'write';
    } else if (cap.gitFilter === 'read' && gitFilter !== 'write') {
      gitFilter = 'read';
    }
  }

  return { allowedTools: tools, gitFilter };
}

/**
 * Validate permission declarations from a manifest.
 * Returns { valid: true } or { valid: false, errors: string[] }
 */
export function validatePermissions(permissions) {
  if (!permissions) {
    return { valid: true, resolved: DEFAULT_PERMISSIONS };
  }

  if (!Array.isArray(permissions)) {
    return { valid: false, errors: ['permissions must be an array of capability strings'] };
  }

  const errors = [];
  for (const perm of permissions) {
    if (typeof perm !== 'string') {
      errors.push(`Invalid permission type: ${typeof perm} (expected string)`);
    } else if (!VALID_CAPABILITIES.has(perm)) {
      errors.push(`Unknown capability: "${perm}". Valid: ${[...VALID_CAPABILITIES].join(', ')}`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, resolved: permissions };
}

/**
 * Get the risk level for a set of permissions (returns the highest risk).
 */
export function getMaxRisk(permissions) {
  const riskOrder = ['low', 'medium', 'high', 'critical'];
  let maxIndex = -1;

  for (const perm of permissions) {
    const cap = PERMISSION_CAPABILITIES[perm];
    if (cap) {
      const idx = riskOrder.indexOf(cap.risk);
      if (idx > maxIndex) maxIndex = idx;
    }
  }

  return maxIndex >= 0 ? riskOrder[maxIndex] : 'none';
}

/**
 * Format permissions for display (e.g. in /plugins output).
 */
export function formatPermissions(permissions) {
  const riskColors = { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' };

  return permissions.map((perm) => {
    const cap = PERMISSION_CAPABILITIES[perm];
    if (!cap) return `  ❓ ${perm} (unknown)`;
    return `  ${riskColors[cap.risk] || '❓'} ${perm} — ${cap.description}`;
  });
}

export {
  PERMISSION_CAPABILITIES,
  DEFAULT_PERMISSIONS,
  VALID_CAPABILITIES,
  GIT_READ_COMMANDS,
};
