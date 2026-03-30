import Conf from 'conf';
import { createInterface } from 'readline';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';

const PROVIDER_PRESETS = {
  openai: {
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    envKey: 'OPENAI_API_KEY',
    type: 'openai-compat',
  },
  gemini: {
    name: 'Google Gemini',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    defaultModel: 'gemini-2.0-flash',
    envKey: 'GEMINI_API_KEY',
    type: 'openai-compat',
  },
  anthropic: {
    name: 'Anthropic Claude',
    baseURL: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-20250514',
    envKey: 'ANTHROPIC_API_KEY',
    type: 'anthropic',
  },
  deepseek: {
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-reasoner',
    envKey: 'DEEPSEEK_API_KEY',
    type: 'openai-compat',
  },
  'deepseek-chat': {
    name: 'DeepSeek Chat',
    baseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    envKey: 'DEEPSEEK_API_KEY',
    type: 'openai-compat',
  },
  groq: {
    name: 'Groq',
    baseURL: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    envKey: 'GROQ_API_KEY',
    type: 'openai-compat',
  },
  ollama: {
    name: 'Ollama (Local)',
    baseURL: 'http://localhost:11434/v1',
    defaultModel: 'llama3',
    envKey: null,
    type: 'openai-compat',
    noKey: true,
  },
  together: {
    name: 'Together AI',
    baseURL: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    envKey: 'TOGETHER_API_KEY',
    type: 'openai-compat',
  },
  openrouter: {
    name: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    defaultModel: 'xiaomi/mimo-v2-flash:free',
    envKey: 'OPENROUTER_API_KEY',
    type: 'openai-compat',
  },
  mistral: {
    name: 'Mistral AI',
    baseURL: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-large-latest',
    envKey: 'MISTRAL_API_KEY',
    type: 'openai-compat',
  },
  perplexity: {
    name: 'Perplexity',
    baseURL: 'https://api.perplexity.ai',
    defaultModel: 'sonar-pro',
    envKey: 'PERPLEXITY_API_KEY',
    type: 'openai-compat',
  },
  fireworks: {
    name: 'Fireworks AI',
    baseURL: 'https://api.fireworks.ai/inference/v1',
    defaultModel: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    envKey: 'FIREWORKS_API_KEY',
    type: 'openai-compat',
  },
  cerebras: {
    name: 'Cerebras',
    baseURL: 'https://api.cerebras.ai/v1',
    defaultModel: 'llama-3.3-70b',
    envKey: 'CEREBRAS_API_KEY',
    type: 'openai-compat',
  },
  moonshot: {
    name: 'Moonshot AI (Kimi)',
    baseURL: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-auto',
    envKey: 'MOONSHOT_API_KEY',
    type: 'openai-compat',
  },
  qwen: {
    name: 'Alibaba Qwen',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    envKey: 'DASHSCOPE_API_KEY',
    type: 'openai-compat',
  },
  sambanova: {
    name: 'SambaNova',
    baseURL: 'https://api.sambanova.ai/v1',
    defaultModel: 'Meta-Llama-3.3-70B-Instruct',
    envKey: 'SAMBANOVA_API_KEY',
    type: 'openai-compat',
  },
  lmstudio: {
    name: 'LM Studio (Local)',
    baseURL: 'http://localhost:1234/v1',
    defaultModel: 'loaded-model',
    envKey: null,
    type: 'openai-compat',
    noKey: true,
  },
  custom: {
    name: 'Custom OpenAI-Compatible',
    baseURL: '',
    defaultModel: '',
    envKey: null,
    type: 'openai-compat',
  },
};

const config = new Conf({
  projectName: 'void-spirit',
  defaults: {
    provider: null,
    model: null,
    apiKey: null,
    baseURL: null,
    providerType: null,
    memory: [],
    theme: 'default',
    budget: null,
    budgetUSD: null,
  },
});

function getConfig() {
  return {
    provider: config.get('provider'),
    model: config.get('model'),
    apiKey: config.get('apiKey'),
    baseURL: config.get('baseURL'),
    providerType: config.get('providerType'),
    memory: config.get('memory') || [],
  };
}

function setConfig(key, value) {
  config.set(key, value);
}

function getPresets() {
  return PROVIDER_PRESETS;
}

function resolveApiKey(preset) {
  if (preset.noKey) return 'ollama';
  // Check env var first
  if (preset.envKey && process.env[preset.envKey]) {
    return process.env[preset.envKey];
  }
  // Check stored config
  const stored = config.get('apiKey');
  if (stored) return stored;
  return null;
}

function prompt(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function setupWizard() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log('');
  console.log(chalk.bold.hex('#a78bfa')('  ⚡ Void Spirit — First-Time Setup'));
  console.log(chalk.dim('  ─────────────────────────────────────'));
  console.log('');
  console.log(chalk.white('  Choose your LLM provider:\n'));

  const presetKeys = Object.keys(PROVIDER_PRESETS);
  presetKeys.forEach((key, i) => {
    const p = PROVIDER_PRESETS[key];
    console.log(chalk.hex('#7c3aed')(`    ${i + 1}.`) + chalk.white(` ${p.name}`) + chalk.dim(` (${p.defaultModel || 'custom'})`));
  });

  console.log('');
  const choice = await prompt(rl, chalk.hex('#a78bfa')('  Select provider [1-' + presetKeys.length + ']: '));
  const index = parseInt(choice, 10) - 1;

  if (index < 0 || index >= presetKeys.length) {
    console.log(chalk.red('  Invalid choice. Exiting.'));
    rl.close();
    process.exit(1);
  }

  const selectedKey = presetKeys[index];
  const preset = PROVIDER_PRESETS[selectedKey];

  let baseURL = preset.baseURL;
  let model = preset.defaultModel;
  let apiKey = '';

  if (selectedKey === 'custom') {
    baseURL = await prompt(rl, chalk.hex('#a78bfa')('  Base URL (e.g. http://localhost:8080/v1): '));
    model = await prompt(rl, chalk.hex('#a78bfa')('  Model name: '));
  }

  if (!preset.noKey) {
    apiKey = resolveApiKey(preset);
    if (!apiKey) {
      apiKey = await prompt(rl, chalk.hex('#a78bfa')(`  API Key${preset.envKey ? ` (or set ${preset.envKey})` : ''}: `));
    } else {
      console.log(chalk.dim(`  ✓ API key loaded from ${preset.envKey ? 'env: ' + preset.envKey : 'config'}`));
    }
  } else {
    apiKey = 'ollama';
    console.log(chalk.dim('  ✓ No API key needed for local provider'));
  }

  if (selectedKey !== 'custom' && !model) {
    model = await prompt(rl, chalk.hex('#a78bfa')('  Model name: '));
  }

  config.set('provider', selectedKey);
  config.set('model', model);
  config.set('apiKey', apiKey);
  config.set('baseURL', baseURL);
  config.set('providerType', preset.type);

  console.log('');
  console.log(chalk.green('  ✓ Setup complete!'));
  console.log(chalk.dim(`    Provider: ${preset.name}`));
  console.log(chalk.dim(`    Model: ${model}`));
  console.log(chalk.dim(`    Endpoint: ${baseURL}`));
  console.log('');

  rl.close();
  return getConfig();
}

function isConfigured() {
  return config.get('provider') !== null && config.get('model') !== null;
}

// ── Team Config ──────────────────────────────────────────────────

async function loadTeamConfig(projectDir) {
  const teamPath = path.join(projectDir, '.void-spirit', 'team.json');
  try {
    const raw = await fs.readFile(teamPath, 'utf-8');
    const team = JSON.parse(raw);
    // Merge team config into active config (team overrides user)
    const ALLOWED_KEYS = ['provider', 'model', 'baseURL', 'providerType', 'budget', 'budgetUSD'];
    const applied = {};
    for (const key of ALLOWED_KEYS) {
      if (team[key] !== undefined) {
        config.set(key, team[key]);
        applied[key] = team[key];
      }
    }
    // Merge blocked commands if present
    if (Array.isArray(team.blockedCommands)) {
      applied.blockedCommands = team.blockedCommands;
    }
    // Merge allowed paths if present
    if (Array.isArray(team.allowedPaths)) {
      applied.allowedPaths = team.allowedPaths;
    }
    // Extract MCP servers config
    if (team.mcpServers && typeof team.mcpServers === 'object') {
      applied.mcpServers = team.mcpServers;
    }
    return { loaded: true, applied, path: teamPath };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { loaded: false };
    }
    // Invalid JSON or other error — warn but don't crash
    return { loaded: false, error: `Team config error: ${err.message}` };
  }
}

export {
  getConfig,
  setConfig,
  getPresets,
  resolveApiKey,
  setupWizard,
  isConfigured,
  loadTeamConfig,
  PROVIDER_PRESETS,
};
