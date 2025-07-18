# CostTrak Database Setup Guide

## Current Setup

Your CostTrak application is configured with:
- **Local Supabase**: Running in Docker containers (but no schema/data)
- **Remote Supabase**: Production database with your actual data
- **Application**: Currently configured to use the remote database

## Database Connections

### 1. Application Connection (Working ✅)
Your Next.js app connects to the remote Supabase using:
- URL: `https://gzrxhwpmtbgnngadgnse.supabase.co`
- Uses environment variables in `.env.local`

### 2. Claude MCP Database Access (Ready to Configure ✅)

To enable Claude to query your database directly, configure the MCP postgres server in Claude Desktop.

#### Quick Setup:

1. **Open Claude Desktop Settings**
   - Click the gear icon
   - Navigate to **Developer → MCP Servers**

2. **Update the postgres configuration with this EXACT JSON:**
   ```json
   {
     "postgres": {
       "command": "npx",
       "args": [
         "@modelcontextprotocol/server-postgres",
         "postgres://postgres.gzrxhwpmtbgnngadgnse:F1dOjRhYg9lFWSlY@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require"
       ]
     }
   }
   ```

3. **Save and Restart Claude Desktop**
   - Click Save in settings
   - Completely quit and restart Claude Desktop
   - Wait for it to reconnect

4. **Test the Connection**
   - Ask Claude: "Query the projects table"
   - Or: "Show me all tables in the database"

#### Connection Details:
- Uses Supabase pooler connection (port 6543)
- SSL enabled for security
- Connection has been tested and verified working

### 3. Local Development Options

If you want to use the local Supabase instance:

```bash
# 1. Run migrations on local database
pnpm db:migrate

# 2. Seed with test data
pnpm db:seed

# 3. Update .env.local to use local URLs:
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

# 4. Configure MCP for local database:
# Connection string: postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

## Testing Database Connections

Use the provided test scripts:

```bash
# Test connection and verify it works
npx tsx scripts/test-final-connection.ts

# Show ready-to-use MCP configuration
npx tsx scripts/show-mcp-config-ready.ts

# Test both local and remote connections
npx tsx scripts/test-db-connection.ts
```

## Quick Reference

### Your Database Details:
- **Project Reference**: `gzrxhwpmtbgnngadgnse`
- **Database Password**: `F1dOjRhYg9lFWSlY`
- **Pooler URL** (for MCP): `postgres://postgres.gzrxhwpmtbgnngadgnse:F1dOjRhYg9lFWSlY@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require`
- **Direct URL**: `postgres://postgres.gzrxhwpmtbgnngadgnse:F1dOjRhYg9lFWSlY@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require`

## Troubleshooting

### "Claude can't connect to database"
1. Check that MCP postgres server is configured in Claude Desktop
2. Verify the connection string has the correct database password (not JWT token)
3. Test the connection using the scripts above

### "Local database has no tables"
1. Run migrations: `pnpm db:migrate`
2. Seed data: `pnpm db:seed`

### "Remote connection fails"
1. Check your internet connection
2. Verify credentials in `.env.local`
3. Ensure your IP is allowed in Supabase dashboard (if using IP restrictions)