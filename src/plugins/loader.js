import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import chalk from 'chalk';
import {
  validatePermissions,
  resolveAllowedTools,
  DEFAULT_PERMISSIONS,
  formatPermissions,
  getMaxRisk,
} from './plugin-permissions.js';
import { createSandboxedExecutor } from './plugin-sandbox.js';
import { TrustManager, TRUST_TIERS } from './trust-manager.js';

const PLUGINS_DIR = path.join(os.homedir(), '.void-spirit', 'plugins');

export class PluginLoader {
  constructor() {
    this.plugins = [];
    this.tools = [];
    this.trustManager = new TrustManager();
  }

  async loadAll(realExecutor) {
    await this.trustManager.load();

    try {
      await fs.mkdir(PLUGINS_DIR, { recursive: true });
      const dirs = await fs.readdir(PLUGINS_DIR, { withFileTypes: true });

      for (const dir of dirs) {
        if (!dir.isDirectory()) continue;
        const pluginPath = path.join(PLUGINS_DIR, dir.name);
        try {
          await this.loadPlugin(pluginPath, realExecutor);
        } catch (err) {
          console.warn(`  ⚠ Failed to load plugin ${dir.name}: ${err.message}`);
        }
      }
    } catch {
      // plugins dir doesn't exist yet, that's fine
    }

    return { plugins: this.plugins, tools: this.tools, trustManager: this.trustManager };
  }

  async loadPlugin(pluginPath, realExecutor) {
    const manifestPath = path.join(pluginPath, 'manifest.json');
    const manifestData = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestData);

    // ── Validate permissions ──
    const permResult = validatePermissions(manifest.permissions);
    if (!permResult.valid) {
      console.warn(chalk.yellow(`  ⚠ Plugin "${manifest.name}" has invalid permissions:`));
      permResult.errors.forEach((e) => console.warn(chalk.dim(`    • ${e}`)));
      console.warn(chalk.dim('    Defaulting to read-only.'));
    }
    const declaredPermissions = permResult.valid ? (permResult.resolved || manifest.permissions) : DEFAULT_PERMISSIONS;

    // ── Resolve trust tier ──
    const trustTier = this.trustManager.getTier(manifest.name);
    const tierInfo = TRUST_TIERS[trustTier];

    // ── Integrity check for verified plugins ──
    if (trustTier === 'verified') {
      const integrity = await this.trustManager.verifyIntegrity(manifest.name, pluginPath);
      if (!integrity.verified && integrity.reason === 'hash_mismatch') {
        console.warn(chalk.hex('#f59e0b')(`  ⚠ Plugin "${manifest.name}" files changed since last trust verification!`));
        console.warn(chalk.dim('    Demoting to untrusted. Run /trust to re-verify.'));
        await this.trustManager.untrustPlugin(manifest.name);
      }
    }

    // ── Effective permissions based on trust ──
    const effectiveTier = this.trustManager.getTier(manifest.name);
    let effectivePermissions;
    if (effectiveTier === 'builtin') {
      // Builtin plugins get all capabilities
      effectivePermissions = declaredPermissions;
    } else if (effectiveTier === 'verified') {
      // Verified plugins get their declared permissions
      effectivePermissions = declaredPermissions;
    } else {
      // Untrusted plugins get read-only only
      effectivePermissions = DEFAULT_PERMISSIONS;
    }

    const { allowedTools, gitFilter } = resolveAllowedTools(effectivePermissions);

    // ── Create sandboxed executor for this plugin ──
    const sandboxedExecutor = realExecutor
      ? createSandboxedExecutor(manifest.name, allowedTools, gitFilter, pluginPath, realExecutor)
      : null;

    const plugin = {
      name: manifest.name,
      description: manifest.description || '',
      version: manifest.version || '1.0.0',
      path: pluginPath,
      // Security metadata
      declaredPermissions,
      effectivePermissions,
      trustTier: effectiveTier,
      trustLabel: TRUST_TIERS[effectiveTier]?.label || '❓',
      maxRisk: getMaxRisk(effectivePermissions),
      sandboxedExecutor,
    };

    // Load custom tools if defined
    if (manifest.tools && Array.isArray(manifest.tools)) {
      for (const toolDef of manifest.tools) {
        if (toolDef.handler) {
          const handlerPath = path.join(pluginPath, toolDef.handler);
          const handlerModule = await import(`file://${handlerPath}`);
          const rawExecute = handlerModule.default || handlerModule.execute;

          // Wrap handler to inject sandboxed executor
          this.tools.push({
            ...toolDef,
            pluginName: manifest.name,
            execute: sandboxedExecutor
              ? (...args) => rawExecute(...args, { executeTool: sandboxedExecutor })
              : rawExecute,
          });
        } else {
          this.tools.push({ ...toolDef, pluginName: manifest.name });
        }
      }
    }

    this.plugins.push(plugin);
  }
}

export async function installPlugin(source) {
  await fs.mkdir(PLUGINS_DIR, { recursive: true });

  if (source.startsWith('http') && (source.includes('github.com') || source.includes('gitlab.com'))) {
    // Git clone
    const repoName = source.split('/').pop().replace('.git', '');
    const destPath = path.join(PLUGINS_DIR, repoName);

    return new Promise((resolve, reject) => {
      exec(`git clone ${source} "${destPath}"`, { timeout: 30000 }, (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`Clone failed: ${stderr || err.message}`));
        } else {
          resolve({ name: repoName, path: destPath, message: `Plugin installed to ${destPath}` });
        }
      });
    });
  } else if (source.startsWith('http')) {
    // Download single file
    const fileName = source.split('/').pop() || 'plugin';
    const destDir = path.join(PLUGINS_DIR, fileName.replace(/\.[^.]+$/, ''));
    await fs.mkdir(destDir, { recursive: true });

    const res = await fetch(source);
    const content = await res.text();
    await fs.writeFile(path.join(destDir, 'index.js'), content, 'utf-8');

    // Create a basic manifest with default (read-only) permissions
    await fs.writeFile(path.join(destDir, 'manifest.json'), JSON.stringify({
      name: fileName,
      description: 'Downloaded plugin',
      version: '1.0.0',
      permissions: ['fs:read'],
    }, null, 2), 'utf-8');

    return { name: fileName, path: destDir, message: `Plugin downloaded to ${destDir}` };
  } else {
    throw new Error('Unsupported plugin source. Use a GitHub URL or direct download URL.');
  }
}

export { PLUGINS_DIR };
