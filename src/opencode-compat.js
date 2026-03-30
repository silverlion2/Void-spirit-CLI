// ── OpenCode Config Compatibility ────────────────────────────────
// Reads opencode.json / opencode.jsonc and maps to Void Spirit config.

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Map OpenCode provider prefixes to Void Spirit provider presets
const PROVIDER_MAP = {
  'anthropic': 'anthropic',
  'openai': 'openai',
  'google': 'gemini',
  'deepseek': 'deepseek',
  'groq': 'groq',
  'ollama': 'ollama',
  'together': 'together',
  'openrouter': 'openrouter',
  'mistral': 'mistral',
  'perplexity': 'perplexity',
  'fireworks': 'fireworks',
  'cerebras': 'cerebras',
  'aws': 'custom',      // Bedrock → custom endpoint
  'azure': 'custom',    // Azure OpenAI → custom endpoint
};

/**
 * Attempt to load and parse an OpenCode config file.
 * @param {string} projectDir — project root
 * @returns {{ loaded, config?, provider?, model?, mcpServers?, instructions?, error? }}
 */
export async function loadOpenCodeConfig(projectDir) {
  const candidates = [
    path.join(projectDir, 'opencode.jsonc'),
    path.join(projectDir, 'opencode.json'),
  ];

  let configPath = null;
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      configPath = candidate;
      break;
    }
  }

  if (!configPath) {
    return { loaded: false };
  }

  try {
    const raw = await fs.readFile(configPath, 'utf-8');
    const cleaned = stripJSONCComments(raw);
    const config = JSON.parse(cleaned);

    const result = {
      loaded: true,
      path: configPath,
      raw: config,
    };

    // Extract provider + model
    const providerInfo = extractProvider(config);
    if (providerInfo) {
      result.provider = providerInfo.provider;
      result.model = providerInfo.model;
      result.apiKey = providerInfo.apiKey;
      result.baseURL = providerInfo.baseURL;
    }

    // Extract MCP servers
    if (config.mcpServers) {
      result.mcpServers = normalizeMCPServers(config.mcpServers);
    }

    // Extract instruction files
    if (config.instructions) {
      result.instructions = config.instructions;
    }

    return result;
  } catch (err) {
    return { loaded: false, error: `OpenCode config error: ${err.message}` };
  }
}

/**
 * Extract provider and model from OpenCode config.
 * OpenCode format: "anthropic/claude-sonnet-4-20250514" or nested provider config.
 */
function extractProvider(config) {
  // Check for models.primary or models.default
  let modelString = null;
  if (config.models?.primary) {
    modelString = config.models.primary;
  } else if (config.model) {
    modelString = config.model;
  }

  if (modelString && typeof modelString === 'string') {
    // Format: "provider/model-name"
    const slashIndex = modelString.indexOf('/');
    if (slashIndex > 0) {
      const providerKey = modelString.slice(0, slashIndex).toLowerCase();
      const modelName = modelString.slice(slashIndex + 1);
      const vsProvider = PROVIDER_MAP[providerKey] || 'custom';

      const result = { provider: vsProvider, model: modelName };

      // Try to extract API key from provider config
      if (config.provider?.[providerKey]?.apiKey) {
        result.apiKey = config.provider[providerKey].apiKey;
      }
      if (config.provider?.[providerKey]?.baseURL) {
        result.baseURL = config.provider[providerKey].baseURL;
      }

      return result;
    }
  }

  // Check for individual provider blocks
  if (config.provider) {
    for (const [key, providerConfig] of Object.entries(config.provider)) {
      const vsProvider = PROVIDER_MAP[key.toLowerCase()];
      if (vsProvider && providerConfig.apiKey) {
        return {
          provider: vsProvider,
          model: providerConfig.model || null,
          apiKey: providerConfig.apiKey,
          baseURL: providerConfig.baseURL || null,
        };
      }
    }
  }

  return null;
}

/**
 * Normalize MCP server definitions from OpenCode format to Void Spirit format.
 * OpenCode uses: { "name": { "command": "...", "args": [...], "env": {...} } }
 * Same as our format, so mostly passthrough.
 */
function normalizeMCPServers(mcpServers) {
  const normalized = {};

  for (const [name, serverDef] of Object.entries(mcpServers)) {
    if (typeof serverDef === 'object' && serverDef.command) {
      normalized[name] = {
        command: serverDef.command,
        args: serverDef.args || [],
        env: serverDef.env || {},
      };
    }
  }

  return normalized;
}

/**
 * Strip JSONC comments (single-line and multi-line) from a string.
 */
function stripJSONCComments(str) {
  // Remove single-line comments
  let result = str.replace(/\/\/[^\n]*/g, '');
  // Remove multi-line comments
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  return result;
}

export { extractProvider, normalizeMCPServers, stripJSONCComments };
