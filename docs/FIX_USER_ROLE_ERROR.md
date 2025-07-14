# Fix for "user_role type does not exist" Error

## Problem
When trying to create a new user, you're getting the error:
```
type "user_role" does not exist (SQLSTATE 42704)
```

This happens because the `user_role` enum type hasn't been created in your Supabase database.

## Solution

### Method 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard at https://supabase.com/dashboard
2. Navigate to the **SQL Editor** section
3. Copy the entire contents of the migration file:
   ```
   supabase/migrations/00012_fix_user_role_type.sql
   ```
4. Paste it into the SQL Editor
5. Click **Run** to execute the migration

### Method 2: Using the Migration Script

1. Run the migration helper script:
   ```bash
   node scripts/apply-migration.js 00012_fix_user_role_type.sql
   ```

2. This will display the SQL you need to run and save it to a temporary file

3. Copy the SQL and run it in your Supabase SQL Editor

### Method 3: Manual Application

If the above methods don't work, you can manually run this SQL in your Supabase SQL Editor:

```sql
-- Create the user_role type
CREATE TYPE user_role AS ENUM (
    'controller', 
    'executive', 
    'ops_manager', 
    'project_manager', 
    'accounting', 
    'viewer'
);

-- Grant permissions
GRANT USAGE ON TYPE user_role TO authenticated;
GRANT USAGE ON TYPE user_role TO service_role;
```

## Verification

After applying the migration, verify it worked by:

1. Going to the SQL Editor in Supabase
2. Running this query:
   ```sql
   SELECT typname FROM pg_type 
   WHERE typname = 'user_role' 
   AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
   ```
3. You should see `user_role` in the results

## Prevention

To prevent this in the future:

1. Always run all migrations in order when setting up a new database
2. Use the Supabase CLI for migration management:
   ```bash
   supabase db push
   ```
3. Keep track of which migrations have been applied using a schema_migrations table

## Related Files

- Migration file: `/supabase/migrations/00012_fix_user_role_type.sql`
- Original type definition: `/supabase/migrations/00002_users_and_auth.sql`
- API endpoint using the type: `/app/api/auth/create-user/route.ts`