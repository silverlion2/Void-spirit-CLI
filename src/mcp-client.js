// ── MCP Client Manager ───────────────────────────────────────────
// Connects to configured MCP servers, discovers tools, routes calls.
// Uses @modelcontextprotocol/sdk stdio transport.

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import chalk from 'chalk';

export class MCPManager {
  constructor() {
    /** @type {Map<string, { client: Client, transport: StdioClientTransport, tools: any[] }>} */
    this.servers = new Map();
    this.allTools = []; // Flattened tool definitions in Void Spirit format
  }

  /**
   * Connect to all configured MCP servers.
   * @param {Object} mcpConfig — { serverName: { command, args, env } }
   */
  async connectAll(mcpConfig) {
    if (!mcpConfig || Object.keys(mcpConfig).length === 0) return;

    for (const [name, serverDef] of Object.entries(mcpConfig)) {
      try {
        await this.connectServer(name, serverDef);
      } catch (err) {
        console.log(chalk.yellow(`  ⚠ MCP server "${name}" failed to start: ${err.message}`));
      }
    }

    // Discover tools from all connected servers
    await this.discoverAllTools();
  }

  /**
   * Connect to a single MCP server.
   */
  async connectServer(name, serverDef) {
    const { command, args = [], env = {} } = serverDef;

    const transport = new StdioClientTransport({
      command,
      args,
      env: { ...process.env, ...env },
    });

    const client = new Client(
      { name: 'void-spirit', version: '1.2.0' },
      { capabilities: {} }
    );

    await client.connect(transport);

    this.servers.set(name, { client, transport, tools: [] });
  }

  /**
   * Discover tools from all connected servers.
   */
  async discoverAllTools() {
    this.allTools = [];

    for (const [serverName, server] of this.servers) {
      try {
        const result = await server.client.listTools();
        const tools = result.tools || [];
        server.tools = tools;

        // Convert to Void Spirit tool format with namespaced name
        for (const tool of tools) {
          const vsTool = mcpToolToVSFormat(serverName, tool);
          this.allTools.push(vsTool);
        }
      } catch (err) {
        console.log(chalk.yellow(`  ⚠ Failed to discover tools from "${serverName}": ${err.message}`));
      }
    }
  }

  /**
   * Get all discovered MCP tools in Void Spirit format.
   */
  getTools() {
    return this.allTools;
  }

  /**
   * Call an MCP tool by its namespaced name.
   * @param {string} fullName — e.g. "mcp_github_search_code"
   * @param {object} args — tool arguments
   * @returns {object} — tool result
   */
  async callTool(fullName, args) {
    const { serverName, toolName } = parseMCPToolName(fullName);
    if (!serverName || !toolName) {
      return { error: `Invalid MCP tool name: ${fullName}` };
    }

    const server = this.servers.get(serverName);
    if (!server) {
      return { error: `MCP server "${serverName}" not connected` };
    }

    try {
      const result = await server.client.callTool({
        name: toolName,
        arguments: args,
      });

      // MCP returns { content: [{ type, text }], isError }
      if (result.isError) {
        const errorText = extractMCPContent(result);
        return { error: errorText || 'MCP tool returned an error' };
      }

      return { result: extractMCPContent(result) };
    } catch (err) {
      return { error: `MCP tool call failed: ${err.message}` };
    }
  }

  /**
   * Check if a tool name is an MCP tool.
   */
  isMCPTool(name) {
    return name.startsWith('mcp_');
  }

  /**
   * Get summary of connected servers + tool counts.
   */
  getStatus() {
    const entries = [];
    for (const [name, server] of this.servers) {
      entries.push({
        name,
        toolCount: server.tools.length,
        tools: server.tools.map(t => t.name),
      });
    }
    return entries;
  }

  /**
   * Gracefully disconnect all servers.
   */
  async shutdown() {
    for (const [name, server] of this.servers) {
      try {
        await server.client.close();
      } catch {
        // silent — process may already be dead
      }
    }
    this.servers.clear();
    this.allTools = [];
  }
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Convert an MCP tool schema to Void Spirit's tool format.
 * Namespace: mcp_<serverName>_<toolName>
 */
function mcpToolToVSFormat(serverName, mcpTool) {
  const nsName = `mcp_${serverName}_${mcpTool.name}`;

  return {
    name: nsName,
    description: mcpTool.description || `MCP tool from ${serverName}`,
    parameters: mcpTool.inputSchema || { type: 'object', properties: {}, required: [] },
    _mcp: true, // marker for MCP tools
    _mcpServer: serverName,
    _mcpOriginalName: mcpTool.name,
  };
}

/**
 * Parse a namespaced MCP tool name.
 * "mcp_github_search_code" → { serverName: "github", toolName: "search_code" }
 */
function parseMCPToolName(fullName) {
  if (!fullName.startsWith('mcp_')) return { serverName: null, toolName: null };

  const withoutPrefix = fullName.slice(4); // remove "mcp_"
  const firstUnderscore = withoutPrefix.indexOf('_');
  if (firstUnderscore === -1) return { serverName: withoutPrefix, toolName: '' };

  return {
    serverName: withoutPrefix.slice(0, firstUnderscore),
    toolName: withoutPrefix.slice(firstUnderscore + 1),
  };
}

/**
 * Extract text content from MCP tool result.
 */
function extractMCPContent(result) {
  if (!result.content || !Array.isArray(result.content)) {
    return JSON.stringify(result);
  }

  return result.content
    .map(c => {
      if (c.type === 'text') return c.text;
      if (c.type === 'image') return `[Image: ${c.mimeType}]`;
      if (c.type === 'resource') return `[Resource: ${c.resource?.uri || 'unknown'}]`;
      return JSON.stringify(c);
    })
    .join('\n');
}

export { parseMCPToolName };
