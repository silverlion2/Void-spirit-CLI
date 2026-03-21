import os from 'os';
import path from 'path';

const SYSTEM_PROMPT = `You are Void Spirit, a powerful AI coding assistant running in the user's terminal. You help with programming tasks by reading, writing, and editing code, running commands, searching codebases, and browsing the web.

## Guidelines
- Be concise and direct. Avoid unnecessary filler.
- When editing code, read the file first to understand context.
- Use tools proactively — don't just describe what you'd do, actually do it.
- Ask for clarification only when truly needed.
- When running commands, explain what the command does before running it.
- Show your work: explain your reasoning briefly, then act.
- Format code and technical content using markdown.

## Environment
- OS: ${process.platform} (${os.arch()})
- Shell: ${process.platform === 'win32' ? 'PowerShell' : 'bash'}
- Working Directory: ${process.cwd()}
- Home: ${os.homedir()}
`;

export class Conversation {
  constructor() {
    this.messages = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];
    this.pendingImage = null;
    this.forks = new Map();
  }

  addSystemContext(text) {
    this.messages[0].content += '\n' + text;
  }

  addUserMessage(content) {
    // DeepSeek Reasoner: clear reasoning_content from prior assistant messages
    // when a new user question starts (per API docs)
    for (const msg of this.messages) {
      if (msg.role === 'assistant' && msg.reasoning_content) {
        delete msg.reasoning_content;
      }
    }
    this.messages.push({ role: 'user', content });
  }

  addAssistantMessage(provider, text, toolCalls, reasoningContent) {
    const msg = provider.buildAssistantMessage(text, toolCalls, reasoningContent);
    this.messages.push(msg);
  }

  addToolResult(provider, toolCallId, result) {
    const msg = provider.buildToolResultMessage(toolCallId, result);
    this.messages.push(msg);
  }

  getMessages() {
    return this.messages;
  }

  setImage(imageData) {
    this.pendingImage = imageData;
  }

  consumeImage() {
    const img = this.pendingImage;
    this.pendingImage = null;
    return img;
  }

  clear() {
    this.messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    this.pendingImage = null;
    this.forks = new Map();
  }

  setMessages(messages) {
    this.messages = messages;
  }

  fork(label) {
    const name = label || `fork-${this.forks.size + 1}`;
    this.forks.set(name, {
      messages: JSON.parse(JSON.stringify(this.messages)),
      timestamp: new Date().toISOString(),
    });
    return name;
  }

  listForks() {
    const list = [];
    for (const [name, data] of this.forks) {
      list.push({
        name,
        messageCount: data.messages.length,
        timestamp: data.timestamp,
      });
    }
    return list;
  }

  switchFork(label) {
    const data = this.forks.get(label);
    if (!data) throw new Error(`Fork not found: ${label}`);
    this.messages = JSON.parse(JSON.stringify(data.messages));
    this.pendingImage = null;
    return { name: label, messageCount: data.messages.length };
  }

  getTokenEstimate() {
    // Rough estimate: 1 token ≈ 4 chars
    const totalChars = this.messages.reduce((sum, m) => {
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      return sum + content.length;
    }, 0);
    return Math.ceil(totalChars / 4);
  }

  compact(summaryText) {
    const systemMsg = this.messages[0];
    this.messages = [
      systemMsg,
      {
        role: 'user',
        content: '[Previous conversation was summarized to save context]\n\nSummary of what we discussed:\n' + summaryText,
      },
      {
        role: 'assistant',
        content: 'Understood. I have the context from our previous conversation. How can I continue helping you?',
      },
    ];
  }
}
