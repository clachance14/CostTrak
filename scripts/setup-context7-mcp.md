# Setting up Context7 MCP Server for Claude Desktop

## What is Context7?

Context7 is an MCP (Model Context Protocol) server that dynamically injects up-to-date, version-specific documentation into your prompts. It fetches current official documentation and code examples from libraries like React, Vue, FastAPI, etc., and integrates them directly into Claude's context window.

## Why Context7 isn't working

The Context7 MCP server is referenced in your SuperClaude configuration (`.claude/shared/superclaude-mcp.yml`) but it's not actually installed or configured in Claude Desktop. The `--c7` flag won't work without proper installation.

## Installation Steps

### Option 1: Using Smithery CLI (Recommended)

If you have smithery installed:
```bash
claude mcp add context7 -- npx -y @upstash/context7-mcp@latest
```

### Option 2: Manual Configuration in Claude Desktop

1. Open Claude Desktop
2. Go to Settings → Developer → MCP Servers
3. Click "Edit" or "Add new MCP server"
4. Add the following configuration:

```json
{
  "context7": {
    "command": "npx",
    "args": ["-y", "@upstash/context7-mcp@latest"]
  }
}
```

### Option 3: Alternative with Deno (if you prefer Deno over Node.js)

```json
{
  "context7": {
    "command": "deno",
    "args": ["run", "--allow-net", "npm:@upstash/context7-mcp"]
  }
}
```

## Important Notes

1. **Restart Required**: After adding the configuration, you MUST completely restart Claude Desktop for the changes to take effect.

2. **Node.js Requirement**: The npx command requires Node.js to be installed on your system. If you don't have it, install from https://nodejs.org/

3. **Network Access**: Context7 needs internet access to fetch documentation, so ensure your firewall/proxy allows it.

## How to Use Context7

Once installed and configured:

1. In Claude Desktop, you can use Context7 by adding "use context7" to your prompts
2. With SuperClaude configuration, you can use the `--c7` flag in commands like:
   - `/analyze --c7`
   - `/build --react --c7`
   - `/explain --c7`

## Testing Context7

After installation and restart:

1. Try a simple test: "use context7 to show me the latest React hooks documentation"
2. Check if MCP tools are available with the ListMcpResourcesTool
3. If working correctly, Context7 will fetch and inject current React documentation

## Troubleshooting

If Context7 still doesn't work:

1. Check Claude Desktop logs for any error messages
2. Ensure Node.js is installed: `node --version`
3. Try the manual npx command in terminal to test: `npx -y @upstash/context7-mcp@latest`
4. Make sure you've completely restarted Claude Desktop (not just closed the window)
5. Check that the MCP server configuration was saved correctly in Claude Desktop settings

## Benefits of Context7

- Always get up-to-date documentation
- Avoid outdated API usage
- Get version-specific code examples
- Reduce hallucinations about library APIs
- Better code suggestions with current best practices