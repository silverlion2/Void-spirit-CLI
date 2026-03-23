import { describe, it, expect, beforeEach } from 'vitest';

// We import the class directly so we can test in isolation
let TokenTracker;

beforeEach(async () => {
  const mod = await import('../token-tracker.js');
  TokenTracker = mod.TokenTracker;
});

describe('Token Budget', () => {
  it('should not exceed when no budget is set', () => {
    const tracker = new TokenTracker('gpt-4o');
    tracker.track('hello world', 'response text');
    const result = tracker.isBudgetExceeded();
    expect(result.exceeded).toBe(false);
  });

  it('should enforce token budget', () => {
    const tracker = new TokenTracker('gpt-4o');
    tracker.setBudget(10); // very low budget

    // Each char is ~0.25 tokens, so 100 chars ≈ 25 tokens
    tracker.track('a'.repeat(100), 'b'.repeat(100));

    const result = tracker.isBudgetExceeded();
    expect(result.exceeded).toBe(true);
    expect(result.reason).toContain('Token budget exceeded');
  });

  it('should not exceed when under token budget', () => {
    const tracker = new TokenTracker('gpt-4o');
    tracker.setBudget(1_000_000);

    tracker.track('hello', 'world');

    const result = tracker.isBudgetExceeded();
    expect(result.exceeded).toBe(false);
  });

  it('should enforce USD budget', () => {
    const tracker = new TokenTracker('gpt-4o');
    tracker.setBudgetUSD(0.0001); // extremely low

    // Simulate large usage via real token counts
    tracker.realInputTokens = 100_000;
    tracker.realOutputTokens = 100_000;

    const result = tracker.isBudgetExceeded();
    expect(result.exceeded).toBe(true);
    expect(result.reason).toContain('USD budget exceeded');
  });

  it('should not exceed USD budget when under limit', () => {
    const tracker = new TokenTracker('gpt-4o');
    tracker.setBudgetUSD(100.00); // generous budget

    tracker.track('hello', 'world');

    const result = tracker.isBudgetExceeded();
    expect(result.exceeded).toBe(false);
  });

  it('setBudgetUSD should also set a token budget from cost table', () => {
    const tracker = new TokenTracker('gpt-4o');
    tracker.setBudgetUSD(1.00);

    expect(tracker.budgetUSD).toBe(1.00);
    expect(tracker.budgetTokens).toBeGreaterThan(0);
  });

  it('setBudgetUSD with unknown model should still set USD limit', () => {
    const tracker = new TokenTracker('totally-unknown-model');
    tracker.setBudgetUSD(5.00);

    expect(tracker.budgetUSD).toBe(5.00);
    // No cost table entry → budgetTokens stays null
    expect(tracker.budgetTokens).toBeNull();
  });

  it('getBudgetStatus returns null when no budget set', () => {
    const tracker = new TokenTracker('gpt-4o');
    expect(tracker.getBudgetStatus()).toBeNull();
  });

  it('getBudgetStatus returns correct info when budget is set', () => {
    const tracker = new TokenTracker('gpt-4o');
    tracker.setBudget(50000);
    tracker.track('hello', 'world');

    const status = tracker.getBudgetStatus();
    expect(status).not.toBeNull();
    expect(status.tokenLimit).toBe(50000);
    expect(status.tokensUsed).toBeGreaterThan(0);
    expect(status.tokenPercentage).toBeGreaterThanOrEqual(0);
  });

  it('budget works correctly across multiple track calls', () => {
    const tracker = new TokenTracker('gpt-4o');
    tracker.setBudget(100);

    // First call — small
    tracker.track('hi', 'ok');
    expect(tracker.isBudgetExceeded().exceeded).toBe(false);

    // Second call — push over
    tracker.track('a'.repeat(500), 'b'.repeat(500));
    expect(tracker.isBudgetExceeded().exceeded).toBe(true);
  });
});
