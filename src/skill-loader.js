/**
 * Skill Loader — On-Demand Knowledge Loading
 *
 * Skills are .md files in src/skills/ that provide expert knowledge.
 * Instead of loading all skills into the system prompt upfront (wasting
 * context), we register a catalog and let the AI load them on-demand
 * via the load_skill tool.
 *
 * Inspired by Claude Code's on-demand skill loading via tool_result.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, 'skills');

// Cached skill catalog (name → { name, description, loaded })
let skillCatalog = null;

/**
 * Build a catalog of available skills (name + first line as description)
 */
export async function getSkillCatalog() {
  if (skillCatalog) return skillCatalog;

  skillCatalog = {};
  try {
    const files = await fs.readdir(SKILLS_DIR);
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const name = file.replace('.md', '');
      const content = await fs.readFile(path.join(SKILLS_DIR, file), 'utf-8');
      // Extract first non-empty line as description
      const firstLine = content.split('\n').find((l) => l.trim() && !l.startsWith('#')) || name;
      skillCatalog[name] = {
        name,
        description: firstLine.trim().slice(0, 100),
        filePath: path.join(SKILLS_DIR, file),
      };
    }
  } catch {
    // skills dir missing, empty catalog
  }

  return skillCatalog;
}

/**
 * Load a specific skill's content by name
 */
export async function loadSkill(name) {
  const catalog = await getSkillCatalog();
  const skill = catalog[name];
  if (!skill) {
    return { error: `Skill not found: "${name}". Use load_skill with action=list to see available skills.` };
  }

  const content = await fs.readFile(skill.filePath, 'utf-8');
  return {
    name: skill.name,
    content,
    note: `Skill "${skill.name}" loaded. Apply this knowledge to the current task.`,
  };
}

/**
 * Execute the load_skill tool
 */
export async function executeLoadSkill({ action, name }) {
  if (action === 'list') {
    const catalog = await getSkillCatalog();
    const skills = Object.values(catalog).map((s) => `- ${s.name}: ${s.description}`);
    return {
      available: skills.length,
      skills: skills.join('\n'),
      hint: 'Use load_skill with action=load and name=<skill-name> to load one.',
    };
  }

  if (action === 'load') {
    if (!name) return { error: 'name is required for load action' };
    return loadSkill(name);
  }

  return { error: `Unknown action: ${action}` };
}

/**
 * Generate a minimal system prompt section listing available skills
 * (catalog only, not full content — saves context)
 */
export async function skillsCatalogToSystemPrompt() {
  const catalog = await getSkillCatalog();
  const names = Object.keys(catalog);
  if (names.length === 0) return '';

  return `\n## Available Skills\nYou have ${names.length} built-in skill(s) available. Use the load_skill tool to load one when you need expert knowledge:\n${names.map((n) => `- ${n}`).join('\n')}\n`;
}

// Keep backward compatibility
export async function loadBuiltinSkills() {
  const catalog = await getSkillCatalog();
  return Object.values(catalog).map((s) => ({ name: s.name, content: s.description }));
}

export function skillsToSystemPrompt(skills) {
  if (skills.length === 0) return '';
  return `\n## Available Skills\nYou have ${skills.length} built-in skill(s). Use the load_skill tool to load one on-demand when needed:\n${skills.map((s) => `- ${s.name}: ${s.content}`).join('\n')}\n`;
}
