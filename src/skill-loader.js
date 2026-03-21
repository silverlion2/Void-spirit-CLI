import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, 'skills');

export async function loadBuiltinSkills() {
  const skills = [];
  try {
    const files = await fs.readdir(SKILLS_DIR);
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const content = await fs.readFile(path.join(SKILLS_DIR, file), 'utf-8');
      const name = file.replace('.md', '');
      skills.push({ name, content });
    }
  } catch {
    // skills dir missing, skip
  }
  return skills;
}

export function skillsToSystemPrompt(skills) {
  if (skills.length === 0) return '';
  const sections = skills.map((s) => s.content).join('\n\n---\n\n');
  return `\n## Built-in Skills & Knowledge\nYou have the following expert knowledge available. Apply it proactively when relevant:\n\n${sections}\n`;
}
