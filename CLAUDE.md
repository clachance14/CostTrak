# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Package Management
pnpm install            # Install dependencies

# Development
pnpm dev                # Start Next.js development server with Turbopack
pnpm build              # Build for production
pnpm start              # Start production server

# Code Quality
pnpm lint               # Run ESLint
pnpm type-check         # Run TypeScript compiler check

# Database Management
pnpm db:start           # Start local Supabase instance via Docker
pnpm db:stop            # Stop local Supabase
pnpm db:reset           # Reset database to initial state
pnpm db:migrate         # Run Supabase migrations
pnpm db:push            # Push database changes
pnpm db:seed            # Seed database with test data

# Type Generation
pnpm generate-types     # Generate TypeScript types from local database
pnpm generate-types:remote # Generate types from remote database
```

## Architecture Overview

CostTrak is an internal financial tracking system for industrial construction projects built with:
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Key Libraries**: lucide-react (icons), xlsx (Excel import/export), date-fns, recharts (visualizations)

### Database Schema

Core tables with Row Level Security (RLS):
- `profiles`: User profiles with role-based access (controller, executive, ops_manager, project_manager, accounting, viewer)
- `projects`: Central entity with job_number as unique identifier
- `purchase_orders` & `po_line_items`: Track committed costs
- `change_orders`: Contract modifications with approval workflow
- `financial_snapshots`: Pre-calculated metrics for performance
- `labor_actuals`: Weekly actual labor costs and hours by craft type
- `labor_headcount_forecasts`: Future headcount projections
- `craft_types`: Labor categories (direct, indirect, staff)

### Key Business Rules

1. **Email Domain**: Only @ics.ac emails allowed (enforced at database level)
2. **Job Numbers**: Unique project identifiers, must be preserved during imports
3. **Access Control**: Division-based for ops managers, project-based for PMs
4. **Financial Calculations**: Revised contract = original + approved change orders
5. **Soft Deletes**: Use status fields, never hard delete

### Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` 
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN=ics.ac`

### Database Connection

The project uses Supabase for the database. There are two connection options:

1. **Remote Database (Production)** - Contains actual project data
   - Project ID: `gzrxhwpmtbgnngadgnse`
   - Connection URL: `postgres://postgres.gzrxhwpmtbgnngadgnse:F1dOjRhYg9lFWSlY@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require`
   - API URL: `https://gzrxhwpmtbgnngadgnse.supabase.co`

2. **Local Database (Development)** - For local testing
   - Connection URL: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
   - API URL: `http://127.0.0.1:54321`
   - Start with: `pnpm db:start`
   - Seed data: `pnpm db:seed`

### MCP Configuration for Database Queries

To enable direct database queries in Claude Desktop, configure the MCP postgres server:

1. Open Claude Desktop Settings → Developer → MCP Servers
2. Edit the postgres server configuration:

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

3. Restart Claude Desktop completely for changes to take effect

### Database Query Scripts

Helpful scripts in the `/scripts` directory:

- `test-db-connection.ts` - Tests both local and remote database connections
- `show-mcp-config.ts` - Shows step-by-step MCP configuration instructions
- `show-mcp-config-ready.ts` - Displays ready-to-use MCP configuration
- `get-db-connection-string.ts` - Generates connection strings (use `--local` flag for local)
- `query-database.ts` - Uses Supabase client to query and display sample data
- `test-final-connection.ts` - Direct PostgreSQL connection test with pg client

Run scripts with: `npx tsx scripts/[script-name].ts`

### Database Connection Troubleshooting

If you encounter database connection issues:

1. **MCP Connection Fails**: The MCP postgres server might be pointing to a different database
   - Check current MCP configuration in Claude Desktop settings
   - Use the connection string from the Database Connection section above
   - Restart Claude Desktop completely after configuration changes

2. **Fallback Query Method**: If MCP isn't working, use the Supabase client approach:
   - Create a script using `createClient` from '@supabase/supabase-js'
   - Use the API URL and anon key from environment variables
   - See `scripts/query-database.ts` for an example

3. **Connection Testing**:
   - Run `npx tsx scripts/test-db-connection.ts` to verify connectivity
   - Run `npx tsx scripts/test-final-connection.ts` for direct PostgreSQL test
   - Check Docker containers with `docker ps | grep supabase` for local setup

4. **Common Issues**:
   - "relation does not exist" - You may be connected to local DB without migrations
   - "ENOTFOUND" - Check if the database host is correct in MCP config
   - "permission denied" - Ensure using correct credentials for the environment

### Development Patterns

1. **Type Safety**: Generate types from database schema when schema changes
2. **RLS Policies**: All database access must respect row-level security
3. **Audit Trail**: Use audit_log table for tracking sensitive changes
4. **Performance**: Use financial_snapshots for dashboard queries
5. **Excel Import**: Preserve legacy PO numbers and job numbers during import

### Code Style

- **Prettier Config**: No semicolons, single quotes, 2-space indentation, ES5 trailing commas
- **Components**: Use shadcn/ui components with Radix UI primitives
- **Forms**: react-hook-form with Zod validation
- **State**: React Query for server state, Context for UI state
- **Styling**: Tailwind CSS with cn() utility for conditional classes

### Current Features

1. **Authentication**: 
   - Email/password login with @ics.ac domain restriction
   - Role-based access control
   - Protected routes via middleware

2. **Projects CRUD**:
   - List view with search, status, and division filters
   - Create/Edit forms with validation
   - Detail view with financial summary
   - Soft delete capability (controllers only)

3. **Purchase Orders**:
   - CSV import from ICS PO system
   - PO tracking with line items
   - Forecast management
   - Advanced filtering and sorting

4. **Change Orders**:
   - Create and approve change orders
   - Approval workflow by role
   - Impact on contract values
   - Audit trail

5. **Labor Forecasts** (Headcount-based Model):
   - Weekly actual cost/hours entry
   - Running average rate calculations
   - Headcount-based future projections
   - Labor analytics dashboard
   - Categories: Direct, Indirect, Staff

6. **Financial Integration**:
   - Comprehensive project financial summary
   - Real-time budget tracking
   - Variance analysis and alerts
   - Profitability projections

### API Endpoints

**Projects**:
- `/api/projects` - List and create projects
- `/api/projects/[id]` - Get, update, delete single project
- `/api/projects/[id]/financial-summary` - Get comprehensive financial data

**Purchase Orders**:
- `/api/purchase-orders` - List and create POs
- `/api/purchase-orders/[id]` - Get, update single PO
- `/api/purchase-orders/import` - Import from CSV

**Change Orders**:
- `/api/change-orders` - List and create COs
- `/api/change-orders/[id]` - Get, update, approve COs

**Labor Forecasts**:
- `/api/labor-forecasts/weekly-actuals` - Enter/view weekly actual costs
- `/api/labor-forecasts/running-averages` - Get running average rates
- `/api/labor-forecasts/headcount` - Manage headcount projections
- `/api/labor-forecasts/calculate` - Calculate forecast from headcount

**Reference Data**:
- `/api/divisions` - List all divisions
- `/api/clients` - List all clients
- `/api/users` - List users with role filter
- `/api/craft-types` - List labor craft types
- `/api/auth/create-user` - Create new users (controllers only)