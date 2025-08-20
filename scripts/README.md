# CostTrak Scripts Documentation

This directory contains various utility scripts for database operations, testing, and maintenance. Scripts are organized by category and purpose.

## 🟢 ACTIVE SCRIPTS (Use These)

### Database Connection & Queries
- **`query-database.ts`** - ⭐ MAIN script for safe SQL operations (RECOMMENDED)
- **`test-final-connection.ts`** - Test database connectivity
- **`test-db-connection.ts`** - Alternative connection test

### Type Generation & Schema
- **`generate-types-from-api.ts`** - Generate TypeScript types from API endpoints
- **`check-database-tables.ts`** - Verify database schema and table structure
- **`inspect-database-schema.js`** - Detailed schema inspection

### Migration Management
- **`verify-and-apply-migrations.ts`** - Apply and verify database migrations
- **`run-sql-migration.ts`** - Execute SQL migration files
- **`check-migration-results.ts`** - Verify migration success

### Project Management
- **`test-project-api.ts`** - Test project CRUD operations
- **`test-projects-list-api.ts`** - Test project listing functionality
- **`hard-delete-project-comprehensive.ts`** - ⚠️ DANGEROUS: Complete project deletion
- **`validate-deployment.ts`** - Validate deployment readiness

### Data Import & Processing
- **`test-labor-apis.ts`** - Test labor import functionality
- **`test-po-import-fix.ts`** - Test purchase order import
- **`test-budget-import-new-schema.ts`** - Test budget import with new schema

### API Testing
- **`test-api-endpoint.ts`** - General API endpoint testing
- **`test-headcount-api.ts`** - Test headcount calculation APIs
- **`test-weekly-actuals-api.ts`** - Test weekly actuals APIs

## 🟡 SPECIALIZED SCRIPTS (Use When Needed)

### Labor & Forecasting
- **`debug-labor-calculation.ts`** - Debug labor calculation issues
- **`test-labor-forecast-apis.ts`** - Test forecast calculation APIs
- **`check-labor-data-exists.ts`** - Verify labor data presence
- **`test-composite-rate-rpc.ts`** - Test composite rate calculations

### Per Diem Management
- **`test-per-diem-api.ts`** - Test per diem calculations
- **`verify-per-diem-working.ts`** - Verify per diem functionality
- **`backfill-perdiem-costs.ts`** - Backfill per diem historical data

### Purchase Orders
- **`debug-po-committed.ts`** - Debug PO commitment calculations
- **`test-po-committed-amount-preservation.ts`** - Test PO amount handling
- **`create-po-line-items-table.ts`** - Create PO line items table

### Financial Analysis
- **`test-margin-calculation.ts`** - Test project margin calculations
- **`verify-contract-values.ts`** - Verify contract value calculations
- **`compare-dashboard-overview.ts`** - Compare dashboard calculations

### User Management
- **`test-user-management.ts`** - Test user creation and management
- **`check-user-jgeer.ts`** - Check specific user configuration

## 🟠 MAINTENANCE SCRIPTS (Admin Use)

### Database Maintenance
- **`check-all-rls-policies.ts`** - Audit RLS policy configurations
- **`check-budget-tables.ts`** - Verify budget table integrity
- **`fix-employee-categories.ts`** - Fix employee categorization issues

### Build & Deployment
- **`build-diagnostics.ts`** - Diagnose build issues
- **`build-info.js`** - Generate build information
- **`vercel-build.js`** - Custom Vercel build script

### Testing Infrastructure
- **`verify-playwright.ts`** - Verify Playwright test setup
- **`audit-ui-values.ts`** - Audit UI value calculations

## 🔴 ARCHIVE CANDIDATES (Old/Debug Scripts)

### Debug Scripts (Consider Archiving)
- **`debug-5772-dashboard.ts`** - Debug specific project dashboard
- **`debug-5800.ts`** - Debug specific project issues
- **`debug-dashboard-full.ts`** - Debug dashboard calculations
- **`analyze-561781.ts`** - Analyze specific project data

### Old Test Scripts
- **`test-drag-drop-components.ts`** - UI component testing
- **`test-delete-ui.ts`** - Delete UI functionality testing
- **`test-general-staffing.ts`** - General staffing calculations

### Legacy Migration Scripts
- **`apply-*-migration.ts`** - Various old migration scripts
- **`fix-*-migration.ts`** - Migration fix scripts
- **`backfill-*`** - Data backfill scripts

### Per Diem Legacy Scripts
- **`fix-per-diem-*.sql`** - Multiple per diem fix attempts
- **`fix-perdiem-*`** - Various per diem fixes (keep only latest)

## ⚠️ DANGEROUS SCRIPTS (Admin Only)

**These scripts can modify/delete data. Use with extreme caution:**

- **`hard-delete-project-*.ts`** - Delete entire projects
- **`delete-project-*.sql`** - SQL deletion scripts
- **`fix-*`** - Various data fix scripts
- **`apply-*-migration.ts`** - Schema modification scripts

## 📋 QUICK REFERENCE

### Daily Operations
```bash
# Connect to database safely
npx tsx scripts/query-database.ts

# Test connection
npx tsx scripts/test-final-connection.ts

# Generate types after schema changes
pnpm generate-types:remote
```

### Testing APIs
```bash
# Test labor APIs
npx tsx scripts/test-labor-apis.ts

# Test project APIs
npx tsx scripts/test-project-api.ts

# Test specific functionality
npx tsx scripts/test-[specific-feature].ts
```

### Migrations
```bash
# Apply migrations safely
npx tsx scripts/verify-and-apply-migrations.ts

# Check migration results
npx tsx scripts/check-migration-results.ts
```

### Emergency Commands
```bash
# If database connection issues
npx tsx scripts/test-db-connection.ts

# If type generation issues
npx tsx scripts/generate-types-from-api.ts

# If schema questions
npx tsx scripts/inspect-database-schema.js
```

## 🗂️ CLEANUP RECOMMENDATIONS

### Scripts to Archive (Move to `scripts/archive/`)

**Debug Scripts** (project-specific):
- `debug-5772-dashboard.ts`
- `debug-5800.ts`
- `analyze-561781.ts`
- `check-dashboard-5640.ts`

**Legacy Per Diem Scripts** (keep only latest):
- `fix-per-diem-*.sql` (all except latest)
- `fix-perdiem-*` (all except latest)
- `backfill-perdiem-*` (all except latest)

**Old Migration Scripts**:
- `apply-*-migration.ts` (project-specific migrations)
- `run-*-migration.ts` (old migration runners)
- `execute-*-migration.ts` (legacy execution scripts)

**Test Component Scripts** (UI-specific):
- `test-drag-drop-components.ts`
- `test-delete-ui.ts`
- `audit-navigation.js`

### Scripts to Keep Active
- All database connection scripts
- Current API test scripts
- Active migration management scripts
- Current data processing scripts

## 📝 NAMING CONVENTIONS

- **`test-*.ts`** - Testing functionality
- **`debug-*.ts`** - Debugging specific issues
- **`fix-*.ts`** - Fixing data or schema issues
- **`apply-*.ts`** - Applying migrations or changes
- **`check-*.ts`** - Checking/validating state
- **`create-*.ts`** - Creating new resources
- **`verify-*.ts`** - Verifying functionality

## 🛡️ SAFETY GUIDELINES

1. **Always backup before running DANGEROUS scripts**
2. **Test on local database first when possible**
3. **Read script contents before execution**
4. **Use transaction wrappers for data modifications**
5. **Document any custom scripts you create**

## 📞 SUPPORT

For questions about specific scripts:
1. Check the script file for inline documentation
2. Review `docs/SUPABASE_OPERATIONS_GUIDE.md`
3. Test in local environment first
4. Ask for clarification if script purpose is unclear