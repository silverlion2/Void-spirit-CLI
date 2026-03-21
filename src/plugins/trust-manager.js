/**
 * Trust Manager — Three-Tier Plugin Trust Model
 *
 * Tiers:
 *   🟢 builtin   — ships with Void Spirit, full permissions
 *   🔵 verified  — user has explicitly trusted, gets declared permissions
 *   🟡 untrusted — default for newly installed plugins, read-only
 *
 * Trust state is persisted to ~/.void-spirit/trust.json.
 * Integrity is tracked via SHA-256 hash of plugin directory contents.
 */

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import chalk from 'chalk';
import { createInterface } from 'readline';

const TRUST_FILE = path.join(os.homedir(), '.void-spirit', 'trust.json');

const TRUST_TIERS = {
  builtin: { label: '🟢 Built-in', level: 3 },
  verified: { label: '🔵 Verified', level: 2 },
  untrusted: { label: '🟡 Untrusted', level: 1 },
};

export class TrustManager {
  constructor() {
    this.trustStore = {}; // pluginName → { tier, hash, trustedAt }
  }

  // ── Persistence ──────────────────────────────────────────────

  async load() {
    try {
      if (existsSync(TRUST_FILE)) {
        const data = await fs.readFile(TRUST_FILE, 'utf-8');
        this.trustStore = JSON.parse(data);
      }
    } catch {
      this.trustStore = {};
    }
  }

  async save() {
    try {
      const dir = path.dirname(TRUST_FILE);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(TRUST_FILE, JSON.stringify(this.trustStore, null, 2), 'utf-8');
    } catch {
      // trust persistence should not break the tool
    }
  }

  // ── Trust Queries ────────────────────────────────────────────

  getTier(pluginName) {
    const entry = this.trustStore[pluginName];
    if (!entry) return 'untrusted';
    return entry.tier || 'untrusted';
  }

  getTierInfo(pluginName) {
    const tier = this.getTier(pluginName);
    return { tier, ...TRUST_TIERS[tier] };
  }

  isVerifiedOrAbove(pluginName) {
    const tier = this.getTier(pluginName);
    return tier === 'verified' || tier === 'builtin';
  }

  // ── Trust Mutations ──────────────────────────────────────────

  async trustPlugin(pluginName, pluginPath) {
    const hash = await this.hashDirectory(pluginPath);
    this.trustStore[pluginName] = {
      tier: 'verified',
      hash,
      trustedAt: new Date().toISOString(),
      path: pluginPath,
    };
    await this.save();
    return TRUST_TIERS.verified;
  }

  async untrustPlugin(pluginName) {
    if (this.trustStore[pluginName]) {
      this.trustStore[pluginName].tier = 'untrusted';
      delete this.trustStore[pluginName].hash;
      delete this.trustStore[pluginName].trustedAt;
      await this.save();
    }
    return TRUST_TIERS.untrusted;
  }

  setBuiltin(pluginName) {
    this.trustStore[pluginName] = {
      tier: 'builtin',
      trustedAt: 'builtin',
    };
  }

  // ── Integrity Verification ───────────────────────────────────

  async verifyIntegrity(pluginName, pluginPath) {
    const entry = this.trustStore[pluginName];
    if (!entry || !entry.hash) return { verified: true, reason: 'no_hash_stored' };

    const currentHash = await this.hashDirectory(pluginPath);
    if (currentHash !== entry.hash) {
      return {
        verified: false,
        reason: 'hash_mismatch',
        storedHash: entry.hash,
        currentHash,
      };
    }

    return { verified: true };
  }

  async hashDirectory(dirPath) {
    const hash = crypto.createHash('sha256');
    await this._hashWalk(dirPath, hash);
    return hash.digest('hex');
  }

  async _hashWalk(dirPath, hash) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      // Sort for deterministic hashing
      entries.sort((a, b) => a.name.localeCompare(b.name));

      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          hash.update(`dir:${entry.name}\n`);
          await this._hashWalk(fullPath, hash);
        } else {
          const content = await fs.readFile(fullPath);
          hash.update(`file:${entry.name}:${content.length}\n`);
          hash.update(content);
        }
      }
    } catch {
      // skip unreadable entries
    }
  }

  // ── First-Run Trust Prompt ───────────────────────────────────

  async promptTrust(pluginName, permissions) {
    const permList = permissions.length > 0 ? permissions.join(', ') : 'none declared';

    console.log('');
    console.log(chalk.hex('#f59e0b')(`  ⚠ New plugin "${pluginName}" requests permissions:`));
    console.log(chalk.white(`    ${permList}`));
    console.log(chalk.dim('    Untrusted plugins are limited to read-only access.'));

    const answer = await this._prompt(chalk.hex('#f59e0b')('  Trust this plugin? [Y/n]: '));
    return answer !== 'n' && answer !== 'no';
  }

  _prompt(question) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim().toLowerCase());
      });
    });
  }

  // ── List All Trusted ─────────────────────────────────────────

  listAll() {
    return Object.entries(this.trustStore).map(([name, entry]) => ({
      name,
      tier: entry.tier,
      label: TRUST_TIERS[entry.tier]?.label || '❓ Unknown',
      trustedAt: entry.trustedAt,
    }));
  }
}

export { TRUST_TIERS };
