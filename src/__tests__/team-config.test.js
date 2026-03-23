import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Team Config', () => {
  let loadTeamConfig;
  let tmpDir;

  beforeEach(async () => {
    const mod = await import('../config.js');
    loadTeamConfig = mod.loadTeamConfig;
    tmpDir = path.join(os.tmpdir(), `vs-team-test-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it('should return loaded: false when no team config exists', async () => {
    const result = await loadTeamConfig(tmpDir);
    expect(result.loaded).toBe(false);
    expect(result.error).toBeUndefined();
  });

  it('should load valid team config', async () => {
    const vsDir = path.join(tmpDir, '.void-spirit');
    await fs.mkdir(vsDir, { recursive: true });
    await fs.writeFile(
      path.join(vsDir, 'team.json'),
      JSON.stringify({
        model: 'deepseek-chat',
        budget: 100000,
        budgetUSD: 2.50,
      }),
      'utf-8'
    );

    const result = await loadTeamConfig(tmpDir);
    expect(result.loaded).toBe(true);
    expect(result.applied.model).toBe('deepseek-chat');
    expect(result.applied.budget).toBe(100000);
    expect(result.applied.budgetUSD).toBe(2.50);
  });

  it('should handle invalid JSON gracefully', async () => {
    const vsDir = path.join(tmpDir, '.void-spirit');
    await fs.mkdir(vsDir, { recursive: true });
    await fs.writeFile(
      path.join(vsDir, 'team.json'),
      '{ invalid json !!!',
      'utf-8'
    );

    const result = await loadTeamConfig(tmpDir);
    expect(result.loaded).toBe(false);
    expect(result.error).toContain('Team config error');
  });

  it('should only apply allowed keys', async () => {
    const vsDir = path.join(tmpDir, '.void-spirit');
    await fs.mkdir(vsDir, { recursive: true });
    await fs.writeFile(
      path.join(vsDir, 'team.json'),
      JSON.stringify({
        model: 'gpt-4o',
        apiKey: 'should-not-be-applied-from-team',
        hackerField: 'should-not-appear',
      }),
      'utf-8'
    );

    const result = await loadTeamConfig(tmpDir);
    expect(result.loaded).toBe(true);
    expect(result.applied.model).toBe('gpt-4o');
    // apiKey is not in ALLOWED_KEYS, should not be in applied
    expect(result.applied.apiKey).toBeUndefined();
    expect(result.applied.hackerField).toBeUndefined();
  });

  it('should merge blockedCommands and allowedPaths if present', async () => {
    const vsDir = path.join(tmpDir, '.void-spirit');
    await fs.mkdir(vsDir, { recursive: true });
    await fs.writeFile(
      path.join(vsDir, 'team.json'),
      JSON.stringify({
        blockedCommands: ['npm publish', 'rm -rf'],
        allowedPaths: ['/src', '/tests'],
      }),
      'utf-8'
    );

    const result = await loadTeamConfig(tmpDir);
    expect(result.loaded).toBe(true);
    expect(result.applied.blockedCommands).toEqual(['npm publish', 'rm -rf']);
    expect(result.applied.allowedPaths).toEqual(['/src', '/tests']);
  });
});
