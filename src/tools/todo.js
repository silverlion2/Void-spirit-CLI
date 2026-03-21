/**
 * TodoWrite Tool — AI-Managed Task Tracking
 *
 * Inspired by Claude Code's TodoWrite system.
 * The AI manages its own task list, persisted to ~/.void-spirit/todos/.
 * Todos are injected into the system prompt dynamically so the AI
 * maintains coherence across long sessions.
 */

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';

const TODOS_DIR = path.join(os.homedir(), '.void-spirit', 'todos');

/**
 * Tool definition for the LLM
 */
export const TODO_TOOL = {
  name: 'todo_write',
  description: 'Manage your task list. Use this to track progress on multi-step work. Create todos when starting complex tasks, update status as you complete steps, and mark done when finished. Your todo list persists and is shown to you at the start of each conversation.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['add', 'update', 'complete', 'remove', 'list'],
        description: 'Action to perform on the todo list',
      },
      id: {
        type: 'string',
        description: 'Todo ID (required for update/complete/remove)',
      },
      content: {
        type: 'string',
        description: 'Todo description (required for add, optional for update)',
      },
      priority: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'Priority level (default: medium)',
      },
    },
    required: ['action'],
  },
};

// Generate a short unique ID
function generateId() {
  return `t${Date.now().toString(36)}`;
}

// Get the todo file path for the current session/cwd
function getTodoPath() {
  const cwdHash = Buffer.from(process.cwd()).toString('base64url').slice(0, 12);
  return path.join(TODOS_DIR, `${cwdHash}.json`);
}

async function loadTodos() {
  const todoPath = getTodoPath();
  try {
    if (existsSync(todoPath)) {
      return JSON.parse(await fs.readFile(todoPath, 'utf-8'));
    }
  } catch {}
  return [];
}

async function saveTodos(todos) {
  await fs.mkdir(TODOS_DIR, { recursive: true });
  await fs.writeFile(getTodoPath(), JSON.stringify(todos, null, 2), 'utf-8');
}

/**
 * Execute a todo action
 */
export async function executeTodo({ action, id, content, priority }) {
  let todos = await loadTodos();

  switch (action) {
    case 'add': {
      if (!content) return { error: 'Content is required for adding a todo' };
      const newTodo = {
        id: generateId(),
        content,
        priority: priority || 'medium',
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      todos.push(newTodo);
      await saveTodos(todos);
      return { success: true, todo: newTodo, total: todos.length };
    }

    case 'update': {
      if (!id) return { error: 'ID is required for updating a todo' };
      const todo = todos.find((t) => t.id === id);
      if (!todo) return { error: `Todo not found: ${id}` };
      if (content) todo.content = content;
      if (priority) todo.priority = priority;
      todo.updatedAt = new Date().toISOString();
      await saveTodos(todos);
      return { success: true, todo };
    }

    case 'complete': {
      if (!id) return { error: 'ID is required for completing a todo' };
      const todo = todos.find((t) => t.id === id);
      if (!todo) return { error: `Todo not found: ${id}` };
      todo.status = 'done';
      todo.completedAt = new Date().toISOString();
      await saveTodos(todos);
      const remaining = todos.filter((t) => t.status === 'pending').length;
      return { success: true, todo, remaining };
    }

    case 'remove': {
      if (!id) return { error: 'ID is required for removing a todo' };
      const idx = todos.findIndex((t) => t.id === id);
      if (idx === -1) return { error: `Todo not found: ${id}` };
      todos.splice(idx, 1);
      await saveTodos(todos);
      return { success: true, removed: id, remaining: todos.length };
    }

    case 'list': {
      return {
        todos: todos.map((t) => ({
          id: t.id,
          content: t.content,
          priority: t.priority,
          status: t.status,
        })),
        pending: todos.filter((t) => t.status === 'pending').length,
        done: todos.filter((t) => t.status === 'done').length,
      };
    }

    default:
      return { error: `Unknown action: ${action}` };
  }
}

/**
 * Generate a system prompt section with current todos
 */
export async function todosToSystemPrompt() {
  const todos = await loadTodos();
  const pending = todos.filter((t) => t.status === 'pending');
  if (pending.length === 0) return '';

  const items = pending
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.priority] || 1) - (order[b.priority] || 1);
    })
    .map((t) => {
      const icon = t.priority === 'high' ? '🔴' : t.priority === 'low' ? '🟢' : '🟡';
      return `- ${icon} [${t.id}] ${t.content}`;
    })
    .join('\n');

  return `\n## Active Todos\nYou have ${pending.length} pending task(s). Use the todo_write tool to update/complete them as you work:\n${items}\n`;
}
