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
];

export function getToolDefinitions() {
  return TOOLS;
}

export function getToolByName(name) {
  return TOOLS.find((t) => t.name === name);
}
