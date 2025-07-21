# Claude Desktop & MCP in WSL - Setup Guide

## Current Environment Status
- ✅ WSL2 Version 2 (Ubuntu 22.04)
- ✅ WSLg GUI support enabled (DISPLAY=:0)
- ✅ Kernel 6.6.87.2 (supports GUI applications)

## Option 1: Install Claude Desktop in WSL (Not Recommended)

Claude Desktop for Linux is not officially available yet. The Windows version cannot run directly in WSL.

## Option 2: Run MCP Servers Directly in WSL (Recommended)

This is the best approach - run MCP servers as standalone services in WSL that any Claude instance can use.

### Setup PostgreSQL MCP Server in WSL

```bash
# 1. Install globally for easy access
npm install -g @modelcontextprotocol/server-postgres

# 2. Create MCP configuration directory
mkdir -p ~/.config/mcp

# 3. Create startup script
cat > ~/.config/mcp/start-postgres.sh << 'EOF'
#!/bin/bash
export MCP_POSTGRES_URL="postgresql://postgres.gzrxhwpmtbgnngadgnse:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6cnhod3BtdGJnbm5nYWRnbnNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjM0MTA0NiwiZXhwIjoyMDY3OTE3MDQ2fQ.T28daDatbOTmApZOa3c2RyVPPJaQdMnnHD09NlXKtww@aws-0-us-west-1.pooler.supabase.com:6543/postgres"
mcp-server-postgres
EOF

chmod +x ~/.config/mcp/start-postgres.sh

# 4. Run the server (in a separate terminal or tmux session)
~/.config/mcp/start-postgres.sh
```

### Setup Context7 MCP Server in WSL

```bash
# 1. Install globally
npm install -g @upstash/context7-mcp

# 2. Create startup script
cat > ~/.config/mcp/start-context7.sh << 'EOF'
#!/bin/bash
context7-mcp
EOF

chmod +x ~/.config/mcp/start-context7.sh

# 3. Run the server
~/.config/mcp/start-context7.sh
```

## Option 3: Use Direct API Access (Current Working Solution)

Continue using the Supabase client directly, which already works perfectly:

```typescript
// scripts/db-query.ts
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Use this for all database queries
```

## Option 4: Hybrid Development Approach

1. **Database Access**: Use Supabase client in WSL (working now)
2. **Documentation**: Use WebFetch/WebSearch tools instead of Context7
3. **Windows Integration**: Keep Claude Desktop on Windows for general use
4. **Development**: All coding happens in WSL with direct API access

## Recommendation

**Option 3 + 4 (Hybrid with Direct API)** is the most practical:
- No complex setup required
- Already working
- Maintains separation between Windows desktop and WSL development
- Full database access via Supabase client
- Documentation access via web tools

If you specifically need MCP servers in WSL, Option 2 provides that capability but requires running separate server processes.