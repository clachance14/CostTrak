# CostTrak Database Migration Guide

Due to network connectivity issues preventing direct database connections, here are multiple approaches to run the database migrations.

## Migration Files

All migration files are located in `/supabase/migrations/` and must be run in this order:

1. `00001_initial_schema.sql` - Foundation tables (divisions, clients, craft_types)
2. `00002_users_and_auth.sql` - Users, auth, and base notifications
3. `00003_core_business_tables.sql` - Projects, change orders, audit log, financial snapshots
4. `00004_purchase_orders.sql` - Purchase orders with line items
5. `00005_labor_management.sql` - Labor actuals, forecasts, and running averages
6. `00006_documents.sql` - Document management system
7. `00007_notifications_enhanced.sql` - Enhanced notification system

## Option 1: Supabase Dashboard (Recommended)

This is the easiest method when direct database connections fail.

1. Go to your Supabase SQL Editor:
   ```
   https://supabase.com/dashboard/project/cqdtuybqoccncujqpiwl/sql
   ```

2. Copy the contents of `/supabase/migrations/all_migrations_combined.sql` (55KB)
   - This file contains all migrations in the correct order
   - It includes migration tracking to prevent duplicate runs

3. Paste the entire content into the SQL editor

4. Click "Run" to execute all migrations

5. Verify success by checking the schema in the Table Editor

## Option 2: Individual Migration Files

If the combined file is too large or you prefer to run migrations individually:

1. Go to the Supabase SQL Editor (link above)

2. For each migration file in order:
   - Copy the contents of the migration file
   - Paste into the SQL editor
   - Click "Run"
   - Wait for success confirmation before proceeding to the next

3. After each migration, you can verify by running:
   ```sql
   SELECT * FROM schema_migrations ORDER BY applied_at;
   ```

## Option 3: Supabase CLI

If you have the Supabase CLI installed:

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Link your project:
   ```bash
   supabase link --project-ref cqdtuybqoccncujqpiwl
   ```

3. Run migrations:
   ```bash
   supabase db push
   ```

## Option 4: PostgreSQL Client

Use any PostgreSQL client (pgAdmin, DBeaver, psql) with these connection details:

- **Host**: `db.cqdtuybqoccncujqpiwl.supabase.co`
- **Port**: `5432`
- **Database**: `postgres`
- **Username**: `postgres`
- **Password**: (from your .env.local SUPABASE_DB_PASSWORD)
- **SSL**: Required

## Option 5: Using Scripts (When Network Allows)

We've created several scripts in `/scripts/`:

1. **push-migrations-fixed.js** - Enhanced script with retry logic
   ```bash
   node scripts/push-migrations-fixed.js
   ```

2. **verify-migrations.js** - Check migration status
   ```bash
   node scripts/verify-migrations.js
   ```

## Post-Migration Steps

After successfully running migrations:

1. **Regenerate TypeScript Types**:
   ```bash
   pnpm generate-types
   ```

2. **Verify Tables Created**:
   - Check Supabase Table Editor
   - All tables should be visible
   - RLS policies should be enabled

3. **Test Authentication**:
   - Try logging in with a test @ics.ac email
   - Verify role-based access works

4. **Check Sample Data**:
   - Divisions should be populated
   - Craft types should include Direct, Indirect, Staff

## Troubleshooting

### Network Issues (ENETUNREACH, ECONNREFUSED)

If you see these errors:
- Your network may be blocking PostgreSQL connections
- Use Option 1 (Supabase Dashboard) instead
- Check if you're behind a corporate firewall or VPN

### Migration Already Applied

If you see "relation already exists" errors:
- Check `schema_migrations` table for applied versions
- Skip migrations that are already applied
- Or use the combined migration file which handles this automatically

### Permission Errors

If you see permission denied errors:
- Ensure you're using the service role key (not anon key)
- Check that your database password is correct
- Verify your Supabase project is active

### SSL/TLS Errors

If you see SSL connection errors:
- The scripts force `rejectUnauthorized: false`
- Some networks may still block SSL connections
- Use the Supabase Dashboard method instead

## Migration Verification

To verify all migrations were applied successfully:

1. Check the migrations table:
   ```sql
   SELECT * FROM schema_migrations ORDER BY version;
   ```

2. Verify all tables exist:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_type = 'BASE TABLE'
   ORDER BY table_name;
   ```

3. Expected tables:
   - audit_log
   - change_orders
   - clients
   - craft_types
   - divisions
   - documents
   - financial_snapshots
   - labor_actuals
   - labor_headcount_forecasts
   - labor_running_averages
   - notifications
   - po_line_items
   - projects
   - purchase_orders
   - schema_migrations
   - users

## Next Steps

Once migrations are complete:

1. Generate TypeScript types
2. Test authentication flow
3. Create initial admin user
4. Import sample data if needed
5. Test all CRUD operations

For support, check the error logs in:
- Supabase Dashboard > Logs > Database
- Browser console for frontend errors
- Next.js terminal output for API errors