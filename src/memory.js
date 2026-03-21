import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const MEMORY_PATH = path.join(os.homedir(), '.void-spirit', 'memory.json');

export class Memory {
  constructor() {
    this.entries = [];
  }

  async load() {
    try {
      const data = await fs.readFile(MEMORY_PATH, 'utf-8');
      this.entries = JSON.parse(data);
    } catch {
      this.entries = [];
    }
  }

  async save() {
    const dir = path.dirname(MEMORY_PATH);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(MEMORY_PATH, JSON.stringify(this.entries, null, 2), 'utf-8');
  }

  async add(content) {
    this.entries.push({
      content,
      timestamp: new Date().toISOString(),
    });
    await this.save();
  }

  async remove(index) {
    if (index >= 0 && index < this.entries.length) {
      this.entries.splice(index, 1);
      await this.save();
    }
  }

  async clear() {
    this.entries = [];
    await this.save();
  }

  getAll() {
    return this.entries;
  }

  toSystemPrompt() {
    if (this.entries.length === 0) return '';
    const items = this.entries.map((e) => `- ${e.content}`).join('\n');
    return `\n## Saved Memories\nThese are things the user has asked you to remember:\n${items}\n`;
  }
}
