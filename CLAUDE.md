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