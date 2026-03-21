import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';

const SESSIONS_DIR = path.join(os.homedir(), '.void-spirit', 'sessions');

export class SessionManager {
  constructor() {
    this.currentId = null;
  }

  async ensureDir() {
    await fs.mkdir(SESSIONS_DIR, { recursive: true });
  }

  generateId(name) {
    if (name) return name.replace(/[^a-zA-Z0-9_-]/g, '-');
    return `session-${Date.now()}`;
  }

  async save(conversation, config, name) {
    await this.ensureDir();
    const id = this.generateId(name);
    const data = {
      id,
      timestamp: new Date().toISOString(),
      provider: config.provider,
      model: config.model,
      cwd: process.cwd(),
      messages: conversation.getMessages(),
    };
    const filePath = path.join(SESSIONS_DIR, `${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    this.currentId = id;
    return { id, path: filePath };
  }

  async load(id) {
    const filePath = path.join(SESSIONS_DIR, `${id}.json`);
    if (!existsSync(filePath)) {
      throw new Error(`Session not found: ${id}`);
    }
    const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
    this.currentId = id;
    return data;
  }

  async list() {
    await this.ensureDir();
    const files = await fs.readdir(SESSIONS_DIR);
    const sessions = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const data = JSON.parse(await fs.readFile(path.join(SESSIONS_DIR, file), 'utf-8'));
        sessions.push({
          id: data.id,
          timestamp: data.timestamp,
          provider: data.provider,
          model: data.model,
          messageCount: data.messages?.length || 0,
        });
      } catch {
        // skip corrupted files
      }
    }
    return sessions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  async delete(id) {
    const filePath = path.join(SESSIONS_DIR, `${id}.json`);
    if (!existsSync(filePath)) {
      throw new Error(`Session not found: ${id}`);
    }
    await fs.unlink(filePath);
    if (this.currentId === id) this.currentId = null;
  }

  async loadLatest() {
    const sessions = await this.list();
    if (sessions.length === 0) return null;
    return this.load(sessions[0].id);
  }
}
