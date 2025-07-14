#!/bin/bash

# Script to apply the user_role type fix to your Supabase database
# This fixes the "type user_role does not exist" error

echo "======================================="
echo "Supabase User Role Type Fix"
echo "======================================="

# Check if required environment variables are set
if [ -z "$SUPABASE_DB_URL" ] && [ -z "$DATABASE_URL" ]; then
    echo "Error: No database URL found!"
    echo ""
    echo "Please set one of the following environment variables:"
    echo "  - SUPABASE_DB_URL (preferred)"
    echo "  - DATABASE_URL"
    echo ""
    echo "You can find your database URL in your Supabase dashboard:"
    echo "1. Go to Settings > Database"
    echo "2. Copy the 'Connection string' (URI format)"
    echo ""
    echo "Example:"
    echo "export SUPABASE_DB_URL='postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres'"
    exit 1
fi

# Use SUPABASE_DB_URL if set, otherwise use DATABASE_URL
DB_URL=${SUPABASE_DB_URL:-$DATABASE_URL}

# Path to the migration file
MIGRATION_FILE="$(dirname "$0")/../supabase/migrations/00012_fix_user_role_type.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "Error: Migration file not found at $MIGRATION_FILE"
    exit 1
fi

echo "Using database URL: ${DB_URL:0:50}..."
echo "Applying migration: $MIGRATION_FILE"
echo ""

# Apply the migration
echo "Running migration..."
psql "$DB_URL" -f "$MIGRATION_FILE" -v ON_ERROR_STOP=1

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration applied successfully!"
    echo ""
    echo "The user_role type has been created/fixed in your database."
    echo "You should now be able to create users without errors."
else
    echo ""
    echo "❌ Migration failed!"
    echo ""
    echo "Please check the error messages above and ensure:"
    echo "1. Your database URL is correct"
    echo "2. You have the necessary permissions"
    echo "3. The psql command is installed"
    exit 1
fi