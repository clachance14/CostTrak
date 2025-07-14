#!/bin/bash

# Script to run the migration and clear PO data for re-import

echo "Starting migration and data clearing process..."

# Step 1: Run the migration to add committed_amount field
echo "1. Running database migration..."
pnpm db:migrate

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully"
else
    echo "❌ Migration failed"
    exit 1
fi

# Step 2: Clear existing PO data
echo "2. Clearing existing Purchase Order data..."

# Note: You'll need to run the SQL script manually or via Supabase dashboard
echo "Please run the following SQL script in your Supabase dashboard:"
echo "File: scripts/clear-po-data.sql"
echo ""
cat scripts/clear-po-data.sql
echo ""
echo "3. After running the SQL script, you can re-import your CSV file through the web interface"
echo ""
echo "This will ensure:"
echo "- committed_amount field exists and is populated with Est. PO Value"
echo "- PO Value column shows correct values from CSV column L"
echo "- Line Item Value column shows correct sums from CSV column R"