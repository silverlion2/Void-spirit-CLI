import chalk from 'chalk';

// Model-specific cost per 1M tokens (USD)
const MODEL_COSTS = {
  // OpenAI
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'o1': { input: 15.00, output: 60.00 },
  'o1-mini': { input: 3.00, output: 12.00 },
  // Anthropic
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  // DeepSeek
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },
  // Gemini
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
  // Groq (most are free / very cheap)
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
  // Local (free)
  'llama3': { input: 0, output: 0 },
};

// Context window limits (total tokens)
const MODEL_LIMITS = {
  // OpenAI
  'gpt-4o': 128_000,
  'gpt-4o-mini': 128_000,
  'gpt-4-turbo': 128_000,
  'o1': 200_000,
  'o1-mini': 128_000,
  // Anthropic
  'claude-sonnet-4-20250514': 200_000,
  'claude-3-5-sonnet-20241022': 200_000,
  'claude-3-haiku-20240307': 200_000,
  // DeepSeek
  'deepseek-chat': 64_000,
  'deepseek-reasoner': 64_000,
  // Gemini
  'gemini-2.0-flash': 1_048_576,
  'gemini-1.5-pro': 2_097_152,
  // Groq
  'llama-3.3-70b-versatile': 128_000,
  // Local
  'llama3': 8_192,
};

export class TokenTracker {
  constructor(model) {
    this.model = model;
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.messageCount = 0;
    // Real usage from API (if available)
    this.realInputTokens = null;
    this.realOutputTokens = null;
  }

  track(inputText, outputText) {
    // Rough estimate: 1 token ≈ 4 chars
    const inputTokens = Math.ceil((inputText || '').length / 4);
    const outputTokens = Math.ceil((outputText || '').length / 4);
    this.totalInputTokens += inputTokens;
    this.totalOutputTokens += outputTokens;
    this.messageCount++;
    return { inputTokens, outputTokens };
  }

  updateFromResponse(usage) {
    if (!usage) return;
    if (usage.prompt_tokens !== undefined) {
      this.realInputTokens = usage.prompt_tokens;
    }
    if (usage.completion_tokens !== undefined) {
      this.realOutputTokens = (this.realOutputTokens || 0) + usage.completion_tokens;
    }
    // Anthropic format
    if (usage.input_tokens !== undefined) {
      this.realInputTokens = usage.input_tokens;
    }
    if (usage.output_tokens !== undefined) {
      this.realOutputTokens = (this.realOutputTokens || 0) + usage.output_tokens;
    }
  }

  getUsedTokens() {
    // Prefer real token counts from API, fall back to estimates
    if (this.realInputTokens !== null) {
      return this.realInputTokens + (this.realOutputTokens || 0);
    }
    return this.totalInputTokens + this.totalOutputTokens;
  }

  getCost() {
    const costs = MODEL_COSTS[this.model];
    if (!costs) return null;
    const inputTokens = this.realInputTokens !== null ? this.realInputTokens : this.totalInputTokens;
    const outputTokens = this.realOutputTokens !== null ? this.realOutputTokens : this.totalOutputTokens;
    const inputCost = (inputTokens / 1_000_000) * costs.input;
    const outputCost = (outputTokens / 1_000_000) * costs.output;
    return {
      input: inputCost,
      output: outputCost,
      total: inputCost + outputCost,
    };
  }

  getContextUsage() {
    const limit = MODEL_LIMITS[this.model];
    if (!limit) return null;
    const used = this.getUsedTokens();
    return {
      used,
      limit,
      percentage: Math.min(100, Math.round((used / limit) * 100)),
    };
  }

  shouldAutoCompact() {
    const usage = this.getContextUsage();
    if (!usage) return false;
    return usage.percentage > 80;
  }

  getSummary() {
    const inputTokens = this.realInputTokens !== null ? this.realInputTokens : this.totalInputTokens;
    const outputTokens = this.realOutputTokens !== null ? this.realOutputTokens : this.totalOutputTokens;
    const cost = this.getCost();
    let summary = `${formatTokens(inputTokens)} in / ${formatTokens(outputTokens)} out`;
    if (cost && cost.total > 0) {
      summary += ` (~$${cost.total.toFixed(4)})`;
    }
    return summary;
  }

  getStatusLine() {
    const totalTokens = this.getUsedTokens();
    const cost = this.getCost();
    let line = chalk.dim(`  📊 ${formatTokens(totalTokens)} tokens`);
    if (cost && cost.total > 0) {
      line += chalk.dim(` · $${cost.total.toFixed(4)}`);
    }
    // Show context percentage if known
    const usage = this.getContextUsage();
    if (usage) {
      const pctColor = usage.percentage > 80 ? '#ef4444' : usage.percentage > 60 ? '#f59e0b' : '#64748b';
      line += chalk.hex(pctColor)(` · ${usage.percentage}% context`);
    }
    return line;
  }
}

function formatTokens(n) {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(1) + 'K';
  return (n / 1_000_000).toFixed(2) + 'M';
}
