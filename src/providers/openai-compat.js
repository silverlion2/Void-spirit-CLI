import OpenAI from 'openai';

export class OpenAICompatProvider {
  constructor({ apiKey, baseURL, model }) {
    this.client = new OpenAI({
      apiKey,
      baseURL,
    });
    this.model = model;
    this.name = 'openai-compat';
  }

  getToolFormat(tools) {
    return tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  buildMessages(messages, imageData) {
    const formatted = messages.map((msg) => {
      if (msg.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: msg.tool_call_id,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        };
      }
      // Pass through assistant messages with reasoning_content and tool_calls intact
      if (msg.role === 'assistant') {
        const out = { role: 'assistant', content: msg.content || null };
        if (msg.reasoning_content) {
          out.reasoning_content = msg.reasoning_content;
        }
        if (msg.tool_calls) {
          out.tool_calls = msg.tool_calls;
        }
        return out;
      }
      return msg;
    });

    // If there's image data, attach to the last user message
    if (imageData && formatted.length > 0) {
      const lastUserIdx = formatted.findLastIndex((m) => m.role === 'user');
      if (lastUserIdx !== -1) {
        const msg = formatted[lastUserIdx];
        formatted[lastUserIdx] = {
          role: 'user',
          content: [
            { type: 'text', text: typeof msg.content === 'string' ? msg.content : '' },
            {
              type: 'image_url',
              image_url: { url: `data:${imageData.mimeType};base64,${imageData.base64}` },
            },
          ],
        };
      }
    }

    return formatted;
  }

  async *stream(messages, tools = [], imageData = null) {
    const formatted = this.buildMessages(messages, imageData);
    const params = {
      model: this.model,
      messages: formatted,
      stream: true,
      stream_options: { include_usage: true },
    };

    if (tools.length > 0) {
      params.tools = this.getToolFormat(tools);
    }

    const stream = await this.client.chat.completions.create(params);

    let currentToolCalls = {};

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta;
      if (!delta) continue;

      // DeepSeek Reasoner thinking/reasoning content
      if (delta.reasoning_content) {
        yield { type: 'thinking', content: delta.reasoning_content };
      }

      // Text content
      if (delta.content) {
        yield { type: 'text', content: delta.content };
      }

      // Tool calls
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          if (!currentToolCalls[idx]) {
            currentToolCalls[idx] = { id: tc.id || '', name: '', arguments: '' };
          }
          if (tc.id) currentToolCalls[idx].id = tc.id;
          if (tc.function?.name) currentToolCalls[idx].name = tc.function.name;
          if (tc.function?.arguments) currentToolCalls[idx].arguments += tc.function.arguments;
        }
      }

      // Check for finish
      if (chunk.choices?.[0]?.finish_reason === 'tool_calls' || chunk.choices?.[0]?.finish_reason === 'stop') {
        const toolCallList = Object.values(currentToolCalls);
        if (toolCallList.length > 0) {
          for (const tc of toolCallList) {
            let args = {};
            try {
              args = JSON.parse(tc.arguments);
            } catch {
              args = { raw: tc.arguments };
            }
            yield { type: 'tool_call', id: tc.id, name: tc.name, arguments: args };
          }
          currentToolCalls = {};
        }

        // Extract usage from response if available
        if (chunk.usage) {
          yield { type: 'usage', usage: chunk.usage };
        }

        if (chunk.choices?.[0]?.finish_reason === 'stop') {
          yield { type: 'done' };
        }
      }
    }

    yield { type: 'done' };
  }

  buildAssistantMessage(text, toolCalls, reasoningContent) {
    const msg = { role: 'assistant', content: text || null };
    // DeepSeek Reasoner: include reasoning_content so it gets sent back during tool call loops
    if (reasoningContent) {
      msg.reasoning_content = reasoningContent;
    }
    if (toolCalls && toolCalls.length > 0) {
      msg.tool_calls = toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
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
