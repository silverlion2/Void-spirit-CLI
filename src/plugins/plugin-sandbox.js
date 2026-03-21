/**
 * Plugin Sandbox — Proxy-Based Tool Access Control
 *
 * Wraps the real tool executor to enforce per-plugin permission
 * boundaries. Plugin handlers receive a sandboxed executor that
 * only allows access to tools matching their declared capabilities.
 */

import path from 'path';
import { logAudit } from '../security.js';
import { GIT_READ_COMMANDS } from './plugin-permissions.js';

// ── Git Subcommand Classification ────────────────────────────────

function isGitReadOnly(gitArgs) {
  if (!gitArgs || typeof gitArgs !== 'string') return false;
  const subcommand = gitArgs.trim().split(/\s+/)[0];
  return GIT_READ_COMMANDS.has(subcommand);
}

// ── Sandboxed Executor Factory ───────────────────────────────────

/**
 * Create a sandboxed tool executor for a specific plugin.
 *
 * @param {string} pluginName - Name of the plugin (for logging)
 * @param {Set<string>} allowedTools - Set of tool names this plugin can use
 * @param {string|null} gitFilter - 'read', 'write', or null
 * @param {string} pluginPath - Absolute path to the plugin directory
 * @param {Function} realExecutor - The real executeTool function
 * @returns {Function} Sandboxed executor with same signature as executeTool
 */
export function createSandboxedExecutor(pluginName, allowedTools, gitFilter, pluginPath, realExecutor) {
  return async function sandboxedExecute(toolName, args) {
    // ── 1. Tool allowlist check ──
    if (!allowedTools.has(toolName)) {
      const msg = `Plugin "${pluginName}" blocked from using tool "${toolName}" — not in declared permissions`;
      await logAudit('plugin_tool_blocked', {
        plugin: pluginName,
        tool: toolName,
        reason: 'not_in_permissions',
      });
      return { error: `🛡️ ${msg}` };
    }

    // ── 2. Git subcommand filter ──
    if (toolName === 'git_command' && gitFilter === 'read') {
      if (!isGitReadOnly(args.args)) {
        const msg = `Plugin "${pluginName}" blocked from mutating git operation — only has git:read permission`;
        await logAudit('plugin_tool_blocked', {
          plugin: pluginName,
          tool: toolName,
          gitArgs: args.args,
          reason: 'git_write_not_permitted',
        });
        return { error: `🛡️ ${msg}` };
      }
    }

    // ── 3. Path restriction for file operations ──
    const pathArg = args.path || args.source || args.destination;
    if (pathArg && isFileOperation(toolName)) {
      const resolvedPath = path.resolve(pathArg);
      const cwd = process.cwd();

      // Plugin file operations are restricted to:
      //   - Current working directory (project)
      //   - The plugin's own directory
      const allowed =
        resolvedPath.startsWith(cwd) ||
        resolvedPath.startsWith(pluginPath);

      if (!allowed) {
        const msg = `Plugin "${pluginName}" blocked from accessing "${resolvedPath}" — outside allowed directories`;
        await logAudit('plugin_path_blocked', {
          plugin: pluginName,
          tool: toolName,
          path: resolvedPath,
          reason: 'outside_allowed_dirs',
        });
        return { error: `🛡️ ${msg}` };
      }
    }

    // ── 4. Audit and pass through ──
    await logAudit('plugin_tool_execute', {
      plugin: pluginName,
      tool: toolName,
    });

    return realExecutor(toolName, args);
  };
}

// ── Helpers ──────────────────────────────────────────────────────

const FILE_TOOLS = new Set([
  'read_file', 'write_file', 'edit_file', 'list_directory',
  'search_files', 'grep', 'create_directory', 'delete_file', 'move_file',
]);

function isFileOperation(toolName) {
  return FILE_TOOLS.has(toolName);
}
