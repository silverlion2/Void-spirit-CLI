import Anthropic from '@anthropic-ai/sdk';

export class AnthropicProvider {
  constructor({ apiKey, model }) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
    this.name = 'anthropic';
  }

  getToolFormat(tools) {
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
  }

  buildMessages(messages) {
    // Anthropic expects system separate, and messages alternating user/assistant
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
    const nonSystem = messages.filter((m) => m.role !== 'system');

    const formatted = [];
    for (const msg of nonSystem) {
      if (msg.role === 'tool') {
        // Anthropic tool results go as user messages with tool_result content blocks
        formatted.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: msg.tool_call_id,
              content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
            },
          ],
        });
      } else if (msg.role === 'assistant' && msg.tool_calls) {
        // Reconstruct assistant message with tool_use blocks
        const content = [];
        if (msg.content) {
          content.push({ type: 'text', text: msg.content });
        }
        for (const tc of msg.tool_calls) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function?.name || tc.name,
            input: typeof tc.function?.arguments === 'string'
              ? JSON.parse(tc.function.arguments)
              : tc.arguments || tc.function?.arguments || {},
          });
        }
        formatted.push({ role: 'assistant', content });
      } else {
        formatted.push({
          role: msg.role,
          content: msg.content || '',
        });
      }
    }

    // Merge consecutive same-role messages
    const merged = [];
    for (const msg of formatted) {
      if (merged.length > 0 && merged[merged.length - 1].role === msg.role) {
        const prev = merged[merged.length - 1];
        if (typeof prev.content === 'string' && typeof msg.content === 'string') {
          prev.content += '\n' + msg.content;
        } else {
          const prevContent = Array.isArray(prev.content) ? prev.content : [{ type: 'text', text: prev.content }];
          const msgContent = Array.isArray(msg.content) ? msg.content : [{ type: 'text', text: msg.content }];
          prev.content = [...prevContent, ...msgContent];
        }
      } else {
        merged.push({ ...msg });
      }
    }

    return { system, messages: merged };
  }

  async *stream(messages, tools = [], imageData = null) {
    const { system, messages: formatted } = this.buildMessages(messages);

    // Handle image input
    if (imageData && formatted.length > 0) {
      const lastUserIdx = formatted.findLastIndex((m) => m.role === 'user');
      if (lastUserIdx !== -1) {
        const msg = formatted[lastUserIdx];
        const textContent = typeof msg.content === 'string' ? msg.content : '';
        formatted[lastUserIdx] = {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: imageData.mimeType,
                data: imageData.base64,
              },
            },
            { type: 'text', text: textContent },
          ],
        };
      }
    }

    const params = {
      model: this.model,
      max_tokens: 8192,
      messages: formatted,
      stream: true,
    };

    if (system) params.system = system;
    if (tools.length > 0) params.tools = this.getToolFormat(tools);

    const stream = await this.client.messages.stream(params);

    let currentToolId = null;
    let currentToolName = null;
    let currentToolInput = '';

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        if (event.content_block?.type === 'tool_use') {
          currentToolId = event.content_block.id;
          currentToolName = event.content_block.name;
          currentToolInput = '';
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta?.type === 'text_delta') {
          yield { type: 'text', content: event.delta.text };
        } else if (event.delta?.type === 'input_json_delta') {
          currentToolInput += event.delta.partial_json;
        }
      } else if (event.type === 'content_block_stop') {
        if (currentToolId) {
          let args = {};
          try {
            args = JSON.parse(currentToolInput);
          } catch {
            args = { raw: currentToolInput };
          }
          yield { type: 'tool_call', id: currentToolId, name: currentToolName, arguments: args };
          currentToolId = null;
          currentToolName = null;
          currentToolInput = '';
        }
      } else if (event.type === 'message_start') {
        // Extract usage from message start
        if (event.message?.usage) {
          yield { type: 'usage', usage: event.message.usage };
        }
      } else if (event.type === 'message_delta') {
        // Extract usage from message delta
        if (event.usage) {
          yield { type: 'usage', usage: event.usage };
        }
      } else if (event.type === 'message_stop') {
        yield { type: 'done' };
      }
    }

    yield { type: 'done' };
  }

  buildAssistantMessage(text, toolCalls, reasoningContent) {
    const msg = { role: 'assistant', content: text || '' };
    if (toolCalls && toolCalls.length > 0) {
      msg.tool_calls = toolCalls.map((tc) => ({
        id: tc.id,
        name: tc.name,
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.arguments),
        },
      }));
    }
    return msg;
  }

  buildToolResultMessage(toolCallId, result) {
    return {
      role: 'tool',
      tool_call_id: toolCallId,
      content: typeof result === 'string' ? result : JSON.stringify(result),
    };
  }
}
