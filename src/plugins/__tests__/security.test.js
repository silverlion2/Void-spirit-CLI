import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

// ── Permission Tests ────────────────────────────────────────────

describe('Plugin Permissions', () => {
  let mod;
  beforeEach(async () => {
    mod = await import('../plugin-permissions.js');
  });

  describe('resolveAllowedTools', () => {
    it('should resolve fs:read to read-only tools', () => {
      const { allowedTools } = mod.resolveAllowedTools(['fs:read']);
      expect(allowedTools.has('read_file')).toBe(true);
      expect(allowedTools.has('list_directory')).toBe(true);
      expect(allowedTools.has('search_files')).toBe(true);
      expect(allowedTools.has('grep')).toBe(true);
      // Should NOT include write tools
      expect(allowedTools.has('write_file')).toBe(false);
      expect(allowedTools.has('run_command')).toBe(false);
    });

    it('should resolve multiple capabilities', () => {
      const { allowedTools } = mod.resolveAllowedTools(['fs:read', 'fs:write']);
      expect(allowedTools.has('read_file')).toBe(true);
      expect(allowedTools.has('write_file')).toBe(true);
      expect(allowedTools.has('edit_file')).toBe(true);
      expect(allowedTools.has('delete_file')).toBe(false);
    });

    it('should resolve git:read with gitFilter=read', () => {
      const { allowedTools, gitFilter } = mod.resolveAllowedTools(['git:read']);
      expect(allowedTools.has('git_command')).toBe(true);
      expect(gitFilter).toBe('read');
    });

    it('should escalate gitFilter to write when git:write declared', () => {
      const { gitFilter } = mod.resolveAllowedTools(['git:read', 'git:write']);
      expect(gitFilter).toBe('write');
    });

    it('should return empty set for empty permissions', () => {
      const { allowedTools } = mod.resolveAllowedTools([]);
      expect(allowedTools.size).toBe(0);
    });

    it('should ignore unknown capabilities', () => {
      const { allowedTools } = mod.resolveAllowedTools(['fs:read', 'bogus:capability']);
      expect(allowedTools.size).toBe(4); // only fs:read tools
    });
  });

  describe('validatePermissions', () => {
    it('should accept valid permissions', () => {
      const result = mod.validatePermissions(['fs:read', 'fs:write', 'web:fetch']);
      expect(result.valid).toBe(true);
    });

    it('should reject unknown capabilities', () => {
      const result = mod.validatePermissions(['fs:read', 'nuclear:launch']);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('nuclear:launch');
    });

    it('should reject non-array permissions', () => {
      const result = mod.validatePermissions('fs:read');
      expect(result.valid).toBe(false);
    });

    it('should default to fs:read when permissions field is missing', () => {
      const result = mod.validatePermissions(undefined);
      expect(result.valid).toBe(true);
      expect(result.resolved).toEqual(['fs:read']);
    });
  });

  describe('getMaxRisk', () => {
    it('should return critical for command:run', () => {
      expect(mod.getMaxRisk(['fs:read', 'command:run'])).toBe('critical');
    });

    it('should return low for read-only', () => {
      expect(mod.getMaxRisk(['fs:read'])).toBe('low');
    });

    it('should return none for empty', () => {
      expect(mod.getMaxRisk([])).toBe('none');
    });
  });
});

// ── Sandbox Tests ───────────────────────────────────────────────

describe('Plugin Sandbox', () => {
  let createSandboxedExecutor;
  beforeEach(async () => {
    const mod = await import('../plugin-sandbox.js');
    createSandboxedExecutor = mod.createSandboxedExecutor;
  });

  it('should allow permitted tools', async () => {
    const mockExecutor = vi.fn().mockResolvedValue({ success: true });
    const allowed = new Set(['read_file', 'list_directory']);
    const sandbox = createSandboxedExecutor('test-plugin', allowed, null, '/tmp/test-plugin', mockExecutor);

    const result = await sandbox('read_file', { path: process.cwd() + '/test.txt' });
    expect(mockExecutor).toHaveBeenCalledWith('read_file', { path: process.cwd() + '/test.txt' });
    expect(result).toEqual({ success: true });
  });

  it('should block non-permitted tools', async () => {
    const mockExecutor = vi.fn();
    const allowed = new Set(['read_file']);
    const sandbox = createSandboxedExecutor('test-plugin', allowed, null, '/tmp/test-plugin', mockExecutor);

    const result = await sandbox('run_command', { command: 'rm -rf /' });
    expect(mockExecutor).not.toHaveBeenCalled();
    expect(result.error).toContain('blocked');
  });

  it('should block mutating git commands when gitFilter is read', async () => {
    const mockExecutor = vi.fn().mockResolvedValue({ success: true });
    const allowed = new Set(['git_command']);
    const sandbox = createSandboxedExecutor('test-plugin', allowed, 'read', '/tmp/test-plugin', mockExecutor);

    // Read should pass
    const readResult = await sandbox('git_command', { args: 'status' });
    expect(mockExecutor).toHaveBeenCalled();

    mockExecutor.mockClear();

    // Write should block
    const writeResult = await sandbox('git_command', { args: 'push origin main' });
    expect(mockExecutor).not.toHaveBeenCalled();
    expect(writeResult.error).toContain('blocked');
  });

  it('should allow mutating git commands when gitFilter is write', async () => {
    const mockExecutor = vi.fn().mockResolvedValue({ success: true });
    const allowed = new Set(['git_command']);
    const sandbox = createSandboxedExecutor('test-plugin', allowed, 'write', '/tmp/test-plugin', mockExecutor);

    const result = await sandbox('git_command', { args: 'push origin main' });
    expect(mockExecutor).toHaveBeenCalled();
  });

  it('should block file access outside cwd and plugin dir', async () => {
    const mockExecutor = vi.fn();
    const allowed = new Set(['read_file']);
    const sandbox = createSandboxedExecutor('test-plugin', allowed, null, '/tmp/test-plugin', mockExecutor);

    const result = await sandbox('read_file', { path: '/etc/passwd' });
    expect(mockExecutor).not.toHaveBeenCalled();
    expect(result.error).toContain('blocked');
  });
});

// ── Trust Manager Tests ─────────────────────────────────────────

describe('Trust Manager', () => {
  let TrustManager;
  let tmpDir;

  beforeEach(async () => {
    const mod = await import('../trust-manager.js');
    TrustManager = mod.TrustManager;
    tmpDir = path.join(os.tmpdir(), `vs-trust-test-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it('should default to untrusted for unknown plugins', () => {
    const tm = new TrustManager();
    expect(tm.getTier('some-plugin')).toBe('untrusted');
  });

  it('should set builtin tier', () => {
    const tm = new TrustManager();
    tm.setBuiltin('core-plugin');
    expect(tm.getTier('core-plugin')).toBe('builtin');
    expect(tm.isVerifiedOrAbove('core-plugin')).toBe(true);
  });

  it('should trust and untrust plugins', async () => {
    const tm = new TrustManager();

    // Create a test plugin dir
    const pluginDir = path.join(tmpDir, 'test-plugin');
    await fs.mkdir(pluginDir, { recursive: true });
    await fs.writeFile(path.join(pluginDir, 'index.js'), 'export default function() {}', 'utf-8');

    await tm.trustPlugin('test-plugin', pluginDir);
    expect(tm.getTier('test-plugin')).toBe('verified');

    await tm.untrustPlugin('test-plugin');
    expect(tm.getTier('test-plugin')).toBe('untrusted');
  });

  it('should detect integrity changes', async () => {
    const tm = new TrustManager();

    // Create plugin dir
    const pluginDir = path.join(tmpDir, 'integrity-test');
    await fs.mkdir(pluginDir, { recursive: true });
    await fs.writeFile(path.join(pluginDir, 'index.js'), 'original content', 'utf-8');

    // Trust it (stores hash)
    await tm.trustPlugin('integrity-test', pluginDir);

    // Verify — should pass
    let check = await tm.verifyIntegrity('integrity-test', pluginDir);
    expect(check.verified).toBe(true);

    // Modify files
    await fs.writeFile(path.join(pluginDir, 'index.js'), 'MODIFIED content', 'utf-8');

    // Verify — should fail
    check = await tm.verifyIntegrity('integrity-test', pluginDir);
    expect(check.verified).toBe(false);
    expect(check.reason).toBe('hash_mismatch');
  });

  it('should produce deterministic hashes', async () => {
    const tm = new TrustManager();

    const pluginDir = path.join(tmpDir, 'hash-test');
    await fs.mkdir(pluginDir, { recursive: true });
    await fs.writeFile(path.join(pluginDir, 'a.js'), 'aaa', 'utf-8');
    await fs.writeFile(path.join(pluginDir, 'b.js'), 'bbb', 'utf-8');

    const hash1 = await tm.hashDirectory(pluginDir);
    const hash2 = await tm.hashDirectory(pluginDir);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });
});
