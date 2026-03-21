/**
 * Subagent Tool — Isolated Context Execution
 *
 * Inspired by Claude Code's Task/Sub Agent system.
 * Spawns a fresh conversation with a focused task, runs an isolated
 * agent loop, and returns only the final result — keeping "dirty context"
 * from exploratory steps out of the parent conversation.
 */

import { Conversation } from '../conversation.js';
import { getToolDefinitions } from './definitions.js';
import { executeTool } from './executor.js';

/**
 * Tool definition for the LLM
 */
export const SUBAGENT_TOOL = {
  name: 'spawn_subagent',
  description: 'Spawn an isolated sub-agent to handle a focused task. The sub-agent gets a fresh context with only the task description, can use all tools, and returns only its final answer. Use this for exploratory tasks (searching codebases, reading multiple files to find something specific) to keep the main conversation clean.',
  parameters: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: 'Clear description of the task for the sub-agent to complete. Be specific about what information to return.',
      },
      context: {
        type: 'string',
        description: 'Optional additional context to provide (e.g. file paths, variable names, relevant background).',
      },
    },
    required: ['task'],
  },
};

/**
 * Execute a subagent task
 */
export async function executeSubagent({ task, context }, provider, parentConversation) {
  const tools = getToolDefinitions();

  // Build a focused system prompt for the sub-agent
  const systemPromptParts = [
    'You are a focused sub-agent. Your job is to complete ONE specific task and return a clear, concise result.',
    'Do NOT explain your process unless asked. Just find the answer and return it.',
    `Working directory: ${process.cwd()}`,
  ];

  // Build sub-conversation with fresh context
  const subConversation = new Conversation();

  // Override with a minimal system prompt
  subConversation.messages = [
    { role: 'system', content: systemPromptParts.join('\n') },
  ];

  // Build the user message
  let userMessage = `Task: ${task}`;
  if (context) {
    userMessage += `\n\nContext:\n${context}`;
  }
  subConversation.addUserMessage(userMessage);

  // Run isolated agent loop (max 10 iterations for sub-tasks)
  let iteration = 0;
  const MAX_ITERATIONS = 10;
  let finalText = '';

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    let text = '';
    let toolCalls = [];

    const stream = provider.stream(subConversation.getMessages(), tools);

    for await (const event of stream) {
      if (event.type === 'text') {
        text += event.content;
      } else if (event.type === 'tool_call') {
        toolCalls.push(event);
      } else if (event.type === 'done') {
        break;
      }
    }

    subConversation.addAssistantMessage(provider, text, toolCalls, null);

    if (toolCalls.length === 0) {
      finalText = text;
      break;
    }

    // Execute tools in the sub-context
    for (const tc of toolCalls) {
      const result = await executeTool(tc.name, tc.arguments);
      subConversation.addToolResult(provider, tc.id, result);
    }

    finalText = text;
  }

  const tokenEstimate = subConversation.getTokenEstimate();

  return {
    result: finalText || '(sub-agent completed without text output)',
    iterations: iteration,
    tokensUsed: tokenEstimate,
  };
}
