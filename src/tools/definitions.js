// Tool definitions — schemas only, no executor imports (avoids circular deps)

const TOOLS = [
  {
    name: 'read_file',
    description: 'Read the contents of a file. Returns the file content with line numbers.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute or relative path to the file to read' },
        start_line: { type: 'integer', description: 'Optional start line (1-indexed)' },
        end_line: { type: 'integer', description: 'Optional end line (1-indexed, inclusive)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Create a new file or overwrite an existing file with the given content.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file to write' },
        content: { type: 'string', description: 'The content to write to the file' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'edit_file',
    description: 'Edit a file by replacing exact text. The target text must match exactly (including whitespace).',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file to edit' },
        target: { type: 'string', description: 'The exact text to find and replace' },
        replacement: { type: 'string', description: 'The text to replace the target with' },
      },
      required: ['path', 'target', 'replacement'],
    },
  },
  {
    name: 'list_directory',
    description: 'List files and directories at the given path. Shows file sizes and types.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path to list (default: current directory)' },
        recursive: { type: 'boolean', description: 'Whether to list recursively (default: false)' },
        max_depth: { type: 'integer', description: 'Max depth for recursive listing (default: 3)' },
      },
      required: [],
    },
  },
  {
    name: 'search_files',
    description: 'Search for files by name pattern (glob). Returns matching file paths.',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Glob pattern to match (e.g. "**/*.js", "src/**/*.ts")' },
        path: { type: 'string', description: 'Directory to search in (default: current directory)' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'grep',
    description: 'Search file contents for a text pattern. Returns matching lines with file paths and line numbers.',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Text or regex pattern to search for' },
        path: { type: 'string', description: 'File or directory to search in (default: current directory)' },
        include: { type: 'string', description: 'Glob pattern to filter files (e.g. "*.js")' },
        ignore_case: { type: 'boolean', description: 'Case insensitive search (default: false)' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'run_command',
    description: 'Execute a shell command. The user will be asked to approve before execution. Use for running tests, builds, git, etc.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The shell command to execute' },
        cwd: { type: 'string', description: 'Working directory (default: current directory)' },
      },
      required: ['command'],
    },
  },
  {
    name: 'web_fetch',
    description: 'Fetch a URL and return its content as text/markdown. Useful for reading documentation, APIs, etc.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to fetch' },
      },
      required: ['url'],
    },
  },
  {
    name: 'git_command',
    description: 'Execute a git command. Common operations: status, diff, log, add, commit, branch, checkout, push, pull.',
    parameters: {
      type: 'object',
      properties: {
        args: { type: 'string', description: 'Git command arguments (e.g. "status", "diff --staged", "log -5")' },
        cwd: { type: 'string', description: 'Working directory (default: current directory)' },
      },
      required: ['args'],
    },
  },
  {
    name: 'create_directory',
    description: 'Create a new directory (and parent directories if needed).',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path to create' },
      },
      required: ['path'],
    },
  },
  {
    name: 'delete_file',
    description: 'Delete a file or empty directory. Use with caution.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to delete' },
      },
      required: ['path'],
    },
  },
  {
    name: 'move_file',
    description: 'Move or rename a file or directory.',
    parameters: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Source path' },
        destination: { type: 'string', description: 'Destination path' },
      },
      required: ['source', 'destination'],
    },
  },
  // ── Claude Code-inspired tools ──
  {
    name: 'spawn_subagent',
    description: 'Spawn an isolated sub-agent to handle a focused task. The sub-agent gets a fresh context with only the task description, can use all tools, and returns only its final answer. Use this for exploratory tasks (searching codebases, reading multiple files to find something specific) to keep the main conversation clean.',
    parameters: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: 'Clear description of the task for the sub-agent to complete. Be specific about what information to return.',
        },
        context: {
          type: 'string',
          description: 'Optional additional context to provide (e.g. file paths, variable names, relevant background).',
        },
      },
      required: ['task'],
    },
  },
  {
    name: 'todo_write',
    description: 'Manage your task list. Use this to track progress on multi-step work. Create todos when starting complex tasks, update status as you complete steps, and mark done when finished. Your todo list persists and is shown to you at the start of each conversation.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['add', 'update', 'complete', 'remove', 'list'],
          description: 'Action to perform on the todo list',
        },
        id: {
          type: 'string',
          description: 'Todo ID (required for update/complete/remove)',
        },
        content: {
          type: 'string',
          description: 'Todo description (required for add, optional for update)',
        },
        priority: {
          type: 'string',
          enum: ['high', 'medium', 'low'],
          description: 'Priority level (default: medium)',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'load_skill',
    description: 'Load a built-in skill/knowledge module on-demand. Skills provide expert knowledge for specific domains (debugging, testing, git workflow, etc.). Call this when you need specialized guidance. Use list action first to see available skills.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'load'],
          description: 'list = show available skills, load = load a specific skill by name',
        },
        name: {
          type: 'string',
          description: 'Skill name to load (required for load action)',
        },
      },
      required: ['action'],
    },
  },
];

// ── Dynamic MCP tools (registered at runtime) ───────────────────
let mcpTools = [];

/**
 * Register MCP-discovered tools into the global tool registry.
 * @param {Array} tools — tools in Void Spirit format from MCPManager.getTools()
 */
export function registerDynamicTools(tools) {
  mcpTools = tools || [];
}

/**
 * Clear all dynamic tools (used on MCP restart/reconnect).
 */
export function clearDynamicTools() {
  mcpTools = [];
}

export function getToolDefinitions() {
  return [...TOOLS, ...mcpTools];
}

export function getToolByName(name) {
  return TOOLS.find((t) => t.name === name) || mcpTools.find((t) => t.name === name);
}

export function getMCPToolCount() {
  return mcpTools.length;
}

