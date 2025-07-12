#!/bin/bash

# Run Supabase migrations against remote database
# This script uses the Supabase CLI to apply migrations

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "Error: .env.local file not found"
    exit 1
fi

# Source environment variables
export $(cat .env.local | grep -v '^#' | xargs)

# Extract project ID from Supabase URL
PROJECT_ID=$(echo $NEXT_PUBLIC_SUPABASE_URL | sed 's/https:\/\/\(.*\)\.supabase\.co/\1/')

echo "Running migrations for Supabase project: $PROJECT_ID"

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "Supabase CLI not found. Using direct SQL connection..."
    
    # Alternative: Use psql if available
    if command -v psql &> /dev/null; then
        DB_URL="postgresql://postgres:${SUPABASE_DB_PASSWORD}@${SUPABASE_DB_HOST}:5432/postgres"
        
        # Run each migration file
        for migration in supabase/migrations/*.sql; do
            echo "Running migration: $(basename $migration)"
            psql "$DB_URL" -f "$migration"
            if [ $? -ne 0 ]; then
                echo "Error running migration: $(basename $migration)"
                exit 1
            fi
        done
        
        echo "All migrations completed successfully!"
    else
        echo "Neither supabase CLI nor psql is available."
        echo "Please install one of them to run migrations."
        exit 1
    fi
else
    # Use Supabase CLI
    supabase db push --project-id "$PROJECT_ID"
fi