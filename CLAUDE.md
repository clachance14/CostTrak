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

CostTrak is a lean financial tracking system for construction projects built with:
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth)
- **Key Libraries**: xlsx (Excel import/export), date-fns, recharts (visualizations)

### Simplified Database Schema

Core tables:
- `profiles`: User authentication (all users are "project_manager" role)
- `projects`: Basic project information
- `employees`: Employee list with Direct/Indirect classification
- `craft_types`: Labor categories
- `purchase_orders` & `po_line_items`: Weekly PO tracking
- `change_orders`: Contract modifications
- `labor_employee_actuals`: Weekly labor imports
- `labor_headcount_forecasts`: Simple headcount projections
- `budget_line_items`: One-time budget import
- `data_imports`: Import history and audit trail

### Key Business Rules

1. **Email Domain**: Only @ics.ac emails allowed
2. **Import Workflow**: Budget (once) → Labor/PO (weekly)
3. **Labor Classification**: Automatic Direct/Indirect based on employee data
4. **Access Control**: All authenticated users see all projects (no complex permissions)
5. **Financial Calculations**: Revised contract = original + approved change orders

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

### Development Patterns

1. **Type Safety**: Generate types from database schema when schema changes
2. **RLS Policies**: Simplified - all authenticated users can view all data
3. **Audit Trail**: Use audit_log table for tracking sensitive changes
4. **Excel Import**: Preserve job numbers and validate data before import

### Code Style

- **Prettier Config**: No semicolons, single quotes, 2-space indentation
- **Components**: Use shadcn/ui components with Radix UI primitives
- **Forms**: react-hook-form with Zod validation
- **State**: React Query for server state, Context for UI state
- **Styling**: Tailwind CSS with cn() utility for conditional classes

### Current Features (MVP)

1. **Authentication**: 
   - Email/password login with @ics.ac domain restriction
   - All users have "project_manager" role
   - All users see all projects

2. **Projects**:
   - Basic CRUD operations
   - Simple list view with search
   - Project detail with financial summary

3. **Budget Import** (One-time):
   - Excel template upload at project start
   - Preview and validation
   - Sets baseline for tracking

4. **Labor Import** (Weekly):
   - Upload weekly timecard data
   - Automatic Direct/Indirect classification
   - Links to employee master data

5. **Purchase Order Import** (Weekly):
   - CSV/Excel import with line items
   - Vendor and PO tracking
   - Weekly commitment updates

6. **Change Orders**:
   - Create and track contract changes
   - Simple approval workflow
   - Impact on revised contract

7. **Dashboard**:
   - Budget vs Actual view
   - Cost burn rate
   - Remaining budget
   - Simple headcount forecasting

### API Endpoints (Simplified)

**Projects**:
- `/api/projects` - List and create projects
- `/api/projects/[id]` - Get, update single project

**Import Endpoints**:
- `/api/purchase-orders/import` - Weekly PO import
- `/api/labor-import` - Weekly labor import
- `/api/project-budgets/import-coversheet` - One-time budget import

**Data Access**:
- `/api/purchase-orders` - List POs
- `/api/change-orders` - List and create change orders
- `/api/projects/[id]/budget-vs-actual` - Budget vs actual comparison

**Reference Data**:
- `/api/employees` - Employee list with Direct/Indirect flag
- `/api/craft-types` - Labor categories

## Claude Code Best Practices

### Context Management

When working with Claude Code on CostTrak, use these strategies to manage context effectively:

1. **Monitor Context Usage**: Watch the bottom-right indicator for context warnings
2. **Use `/clear` when**: Starting a completely new feature or switching between unrelated tasks
3. **Use `/compact` when**: Continuing work but approaching context limits - Claude will summarize progress
4. **Break Large Tasks**: Split complex features into smaller sessions to avoid context overflow

### Permission Management

For efficient Claude Code workflows, configure these permissions:

**Auto-approve these commands** (add to Claude Code settings):
- `pnpm lint` - Safe read-only linting
- `pnpm type-check` - TypeScript checking
- `pnpm test:run` - Running tests
- `git status` - Checking repository state
- `git diff` - Viewing changes
- `ls` and `find` commands - File system exploration

**Always review**:
- Database migrations or schema changes
- Any `rm` or deletion commands
- Production deployments
- Environment variable modifications

### Git Workflow with Claude

#### Commit Messages
When asking Claude to commit, use this pattern:
```
"Please commit these changes with a descriptive message following our conventions"
```

Claude will generate commits in this format:
```
feat: Add budget import validation for Excel sheets

- Implement cell validation for numeric fields
- Add error reporting for invalid data
- Create preview interface for import review

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
```

#### Pull Request Templates
When creating PRs, ask Claude to include:
- Summary of changes (2-3 bullet points)
- Test plan checklist
- Breaking changes (if any)
- Related issue numbers

### Advanced Claude Code Techniques

#### Multi-Instance Workflows
For complex features spanning multiple areas:
1. **Instance 1**: Backend API development
2. **Instance 2**: Frontend UI implementation
3. **Instance 3**: Test writing and documentation

Keep instances focused on their domain to maximize efficiency.

#### Planning Mode
Before implementing features, use planning mode:
```
"Can you analyze the codebase and create a plan for implementing [feature]?"
```

This helps Claude understand the full scope before making changes.

#### Test-Driven Development with Claude
1. Ask Claude to write tests first: "Write tests for the budget import feature"
2. Then implement: "Now implement the code to make these tests pass"
3. Finally: "Run the tests and fix any failures"

### Claude-Specific Development Tips

1. **Use Screenshots**: Paste UI mockups or error screenshots for Claude to analyze
2. **Think Hard Mode**: For complex debugging, ask Claude to "think hard about this bug"
3. **Tool Preferences**: 
   - Use built-in CLI tools over MCP servers when available
   - Prefer `rg` (ripgrep) over `grep` for searching
   - Use absolute paths in commands

4. **Session Management**:
   - Save important findings to markdown files for cross-session reference
   - Use `SESSION_NOTES.md` for temporary session documentation
   - Reference previous work: "Check SESSION_NOTES.md for our previous analysis"

### Performance Optimization

To keep Claude Code running efficiently:
- Avoid having Claude read large binary files
- Use targeted searches instead of broad file system scans
- Batch related tool calls in single messages
- Clear context regularly when switching between features

## Testing Strategy

### Current Test Infrastructure

CostTrak uses multiple testing frameworks:
- **Unit Tests**: Vitest for component and utility testing
- **E2E Tests**: Playwright for user flow testing
- **Integration Tests**: Puppeteer for API and database testing

### Test Coverage Goals

We aim for:
- **Critical Business Logic**: 90% coverage (financial calculations, import validation)
- **API Routes**: 80% coverage (all CRUD operations)
- **UI Components**: 70% coverage (user interactions, error states)
- **Utilities**: 100% coverage (date formatting, calculations)

### Writing Tests with Claude

When asking Claude to write tests:
1. **Provide Context**: "Write tests for the budget import feature, focusing on validation edge cases"
2. **Specify Framework**: "Use Vitest for unit tests" or "Use Playwright for E2E tests"
3. **Include Test Data**: "Use the sample Excel files in /tests/fixtures"

### Test File Naming Convention
- Unit tests: `[feature].test.ts` (e.g., `budget-import.test.ts`)
- E2E tests: `[feature].spec.ts` (e.g., `budget-import.spec.ts`)
- Test data: `/tests/fixtures/[feature]/` directory

### Running Tests Before Commits

Always ask Claude to:
```
1. Run pnpm lint
2. Run pnpm type-check  
3. Run pnpm test:run
4. Fix any issues before committing
```

### Priority Areas for Test Coverage

1. **Budget Import Logic** - Complex Excel parsing and validation
2. **Financial Calculations** - Budget vs actual, change order impacts
3. **Labor Import** - Weekly data processing and classification
4. **Authentication** - Email domain validation, session management
5. **Data Validation** - Form inputs, file uploads, API payloads

## Database Operations for Claude

**CRITICAL**: Follow these rules when working with the Supabase database to prevent errors and confusion.

### Required Reading
Before any database operation, review:
- `docs/SUPABASE_OPERATIONS_GUIDE.md` - Complete operations guide
- `docs/SUPABASE_QUICK_REFERENCE.md` - Quick lookup reference

### Mandatory Database Rules

1. **ALWAYS use the query-database.ts script for SQL operations**:
   ```bash
   npx tsx scripts/query-database.ts
   ```
   - Never use raw psql commands without checking environment first
   - This script handles connection automatically and logs operations

2. **ALWAYS check table existence before operations**:
   ```sql
   SELECT EXISTS (
     SELECT FROM information_schema.tables 
     WHERE table_name = 'your_table_name'
   );
   ```

3. **ALWAYS use transactions for multi-step operations**:
   ```sql
   BEGIN;
   -- Your operations here
   -- Verify results before committing
   SELECT COUNT(*) FROM affected_table; -- verification
   COMMIT; -- or ROLLBACK if something looks wrong
   ```

4. **ALWAYS preview before destructive operations**:
   ```sql
   -- Preview what will be affected
   SELECT * FROM table_name WHERE condition LIMIT 5;
   
   -- Then perform operation
   UPDATE table_name SET column = value WHERE condition;
   ```

5. **NEVER modify schema without testing locally first**:
   ```bash
   # Start local instance
   pnpm db:start
   
   # Test migration locally
   pnpm db:migrate
   
   # Only then apply to remote
   pnpm db:push
   ```

### Common Error Prevention

- **"relation does not exist"**: Always check table spelling and existence first
- **"permission denied"**: Use MCP postgres tool or query-database.ts script
- **"connection timeout"**: Check internet connection, retry with fresh connection
- **"column does not exist"**: Verify column names with information_schema.columns

### Safe Operation Pattern

For any database modification, follow this pattern:

```bash
# 1. Connect safely
npx tsx scripts/query-database.ts

# 2. In the script, follow this sequence:
```
```sql
-- 2a. Start transaction
BEGIN;

-- 2b. Check current state
SELECT COUNT(*) FROM target_table WHERE condition;

-- 2c. Preview changes (if applicable)
SELECT * FROM target_table WHERE condition LIMIT 3;

-- 2d. Perform operation
UPDATE/INSERT/DELETE operations;

-- 2e. Verify results
SELECT COUNT(*) FROM target_table WHERE condition;

-- 2f. Commit or rollback
COMMIT; -- or ROLLBACK if unexpected results
```

### Database Connection Details

- **Remote Database** (Production): `gzrxhwpmtbgnngadgnse.supabase.co`
- **Connection via MCP**: Already configured in environment
- **Direct queries**: Use `scripts/query-database.ts`
- **Migrations**: Use `pnpm db:push` after local testing

### Troubleshooting Database Issues

If you encounter database errors:

1. **Check connection first**:
   ```bash
   npx tsx scripts/test-final-connection.ts
   ```

2. **Verify environment variables** are set in `.env.local`

3. **Check table structure**:
   ```sql
   \d table_name  -- In psql
   -- OR
   SELECT column_name, data_type FROM information_schema.columns 
   WHERE table_name = 'your_table';
   ```

4. **Review recent migrations**:
   ```sql
   SELECT * FROM supabase_migrations.schema_migrations 
   ORDER BY version DESC LIMIT 5;
   ```

### Quick Reference

**Most Common Tables**:
- `projects` - Project information
- `purchase_orders`, `po_line_items` - PO tracking
- `labor_employee_actuals` - Weekly labor data
- `budget_line_items` - Budget baselines
- `change_orders` - Contract modifications
- `employees` - Employee master data
- `profiles` - User authentication

**Most Common Scripts**:
- `scripts/query-database.ts` - Safe SQL execution
- `scripts/test-final-connection.ts` - Connection test
- `pnpm generate-types:remote` - Update TypeScript types
- `pnpm db:push` - Apply migrations to remote

**Emergency Commands**:
```bash
# If stuck in transaction
ROLLBACK;

# If connection issues
npx tsx scripts/test-final-connection.ts

# If type issues
pnpm generate-types:remote
```

Remember: **When in doubt, ask for clarification rather than guessing table names or column structures.**