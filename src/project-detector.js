import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const FRAMEWORK_SIGNATURES = {
  // JavaScript frameworks
  'next.js': { files: ['next.config.js', 'next.config.mjs', 'next.config.ts'], pkg: 'next' },
  'react': { files: [], pkg: 'react' },
  'vue': { files: ['vue.config.js'], pkg: 'vue' },
  'angular': { files: ['angular.json'], pkg: '@angular/core' },
  'svelte': { files: ['svelte.config.js'], pkg: 'svelte' },
  'vite': { files: ['vite.config.js', 'vite.config.ts'], pkg: 'vite' },
  'express': { files: [], pkg: 'express' },
  'fastify': { files: [], pkg: 'fastify' },
  'nest.js': { files: ['nest-cli.json'], pkg: '@nestjs/core' },
  'electron': { files: [], pkg: 'electron' },

  // Python
  'django': { files: ['manage.py'], pkg: null },
  'flask': { files: [], pkg: null, imports: ['flask'] },
  'fastapi': { files: [], pkg: null, imports: ['fastapi'] },

  // Other
  'rust': { files: ['Cargo.toml'], pkg: null },
  'go': { files: ['go.mod'], pkg: null },
  'docker': { files: ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml'], pkg: null },
};

const LANGUAGE_EXTENSIONS = {
  '.js': 'JavaScript',
  '.jsx': 'JavaScript (React)',
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript (React)',
  '.py': 'Python',
  '.go': 'Go',
  '.rs': 'Rust',
  '.java': 'Java',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.cs': 'C#',
  '.cpp': 'C++',
  '.c': 'C',
  '.swift': 'Swift',
  '.kt': 'Kotlin',
};

export async function detectProject(cwd) {
  const result = {
    frameworks: [],
    languages: new Set(),
    hasGit: false,
    hasTypeScript: false,
    packageManager: null,
    customPrompt: null,
    instructionFiles: [], // NEW: loaded instruction files
  };

  // Check for git
  result.hasGit = existsSync(path.join(cwd, '.git'));

  // ── Load instruction files (OpenCode / Claude Code / Cursor compat) ──
  // Priority order: lower index = lower priority (later entries override on conflict)
  const INSTRUCTION_FILES = [
    { name: '.cursorrules', path: path.join(cwd, '.cursorrules') },
    { name: 'AGENTS.md', path: path.join(cwd, 'AGENTS.md') },
    { name: 'CLAUDE.md', path: path.join(cwd, 'CLAUDE.md') },
    { name: '.github/copilot-instructions.md', path: path.join(cwd, '.github', 'copilot-instructions.md') },
    { name: '.void-spirit.md', path: path.join(cwd, '.void-spirit.md') }, // highest priority (native)
  ];

  const instructionParts = [];

  for (const file of INSTRUCTION_FILES) {
    if (existsSync(file.path)) {
      try {
        const content = await fs.readFile(file.path, 'utf-8');
        if (content.trim()) {
          instructionParts.push({ name: file.name, content: content.trim() });
          result.instructionFiles.push(file.name);
        }
      } catch {}
    }
  }

  // Check for .cursor/rules/*.md directory
  const cursorRulesDir = path.join(cwd, '.cursor', 'rules');
  if (existsSync(cursorRulesDir)) {
    try {
      const ruleFiles = await fs.readdir(cursorRulesDir);
      for (const ruleFile of ruleFiles.filter(f => f.endsWith('.md'))) {
        const rulePath = path.join(cursorRulesDir, ruleFile);
        const content = await fs.readFile(rulePath, 'utf-8');
        if (content.trim()) {
          instructionParts.push({ name: `.cursor/rules/${ruleFile}`, content: content.trim() });
          result.instructionFiles.push(`.cursor/rules/${ruleFile}`);
        }
      }
    } catch {}
  }

  // Merge all instruction files into customPrompt
  if (instructionParts.length > 0) {
    result.customPrompt = instructionParts
      .map(p => `<!-- From: ${p.name} -->\n${p.content}`)
      .join('\n\n');
  }

  // Check for package manager
  if (existsSync(path.join(cwd, 'pnpm-lock.yaml'))) result.packageManager = 'pnpm';
  else if (existsSync(path.join(cwd, 'yarn.lock'))) result.packageManager = 'yarn';
  else if (existsSync(path.join(cwd, 'bun.lockb'))) result.packageManager = 'bun';
  else if (existsSync(path.join(cwd, 'package-lock.json'))) result.packageManager = 'npm';

  // Check for TypeScript
  result.hasTypeScript = existsSync(path.join(cwd, 'tsconfig.json'));

  // Check framework signatures
  for (const [framework, sig] of Object.entries(FRAMEWORK_SIGNATURES)) {
    // Check files
    for (const file of sig.files || []) {
      if (existsSync(path.join(cwd, file))) {
        result.frameworks.push(framework);
        break;
      }
    }

    // Check package.json dependencies
    if (sig.pkg && existsSync(path.join(cwd, 'package.json'))) {
      try {
        const pkgData = await fs.readFile(path.join(cwd, 'package.json'), 'utf-8');
        const pkg = JSON.parse(pkgData);
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (allDeps[sig.pkg]) {
          if (!result.frameworks.includes(framework)) {
            result.frameworks.push(framework);
          }
        }
      } catch {}
    }
  }

  // Detect primary languages by scanning top-level src files
  try {
    const srcDir = existsSync(path.join(cwd, 'src')) ? path.join(cwd, 'src') : cwd;
    const files = await fs.readdir(srcDir);
    for (const file of files.slice(0, 50)) {
      const ext = path.extname(file).toLowerCase();
      if (LANGUAGE_EXTENSIONS[ext]) {
        result.languages.add(LANGUAGE_EXTENSIONS[ext]);
      }
    }
  } catch {}

  return {
    ...result,
    languages: [...result.languages],
  };
}

export function projectToSystemPrompt(project) {
  const parts = [];

  if (project.frameworks.length > 0) {
    parts.push(`Frameworks: ${project.frameworks.join(', ')}`);
  }
  if (project.languages.length > 0) {
    parts.push(`Languages: ${project.languages.join(', ')}`);
  }
  if (project.hasTypeScript) {
    parts.push('TypeScript: enabled (use .ts/.tsx, follow strict types)');
  }
  if (project.packageManager) {
    parts.push(`Package manager: ${project.packageManager} (use this for install/run commands)`);
  }
  if (project.hasGit) {
    parts.push('Git: initialized (use conventional commits)');
  }
  if (project.instructionFiles && project.instructionFiles.length > 0) {
    parts.push(`Project instructions loaded from: ${project.instructionFiles.join(', ')}`);
  }

  if (parts.length === 0 && !project.customPrompt) return '';

  let prompt = '\n## Project Context\n' + parts.map(p => `- ${p}`).join('\n') + '\n';

  if (project.customPrompt) {
    prompt += '\n## Custom Project Instructions\n' + project.customPrompt + '\n';
  }

  return prompt;
}
