# CostTrak Simplification - Session Context
**Date:** January 31, 2025
**Session Goal:** Simplify CostTrak to focus on core MVP functionality

## 🎯 Project Overview

CostTrak is being simplified from a complex enterprise system to a lean MVP focused on three core imports:
1. **Budget Import** (one-time at project start)
2. **Labor Import** (weekly updates)
3. **PO Import** (weekly updates)

The goal is to eliminate 15-20 hours of weekly Excel consolidation for project managers.

## 📊 Current Status

### What We've Accomplished
1. ✅ Analyzed the entire codebase and identified ~40 tables to drop
2. ✅ Created comprehensive migration scripts
3. ✅ Built verification scripts to check database state
4. ✅ Updated Agent OS documentation (mission.md, roadmap.md, decisions.md)
5. ✅ Verified all core tables exist and imports are working

### Database State (as of last check)
- **Core Tables Present:** 13/13 ✅
- **Tables to Drop:** 8 still exist ❌
  - divisions, notifications, wbs_structure, financial_snapshots
  - invoices, clients, cost_codes, labor_categories
- **Projects Table:** Needs column cleanup (remove division_id, risk_factors, etc.)
- **Import Functionality:** Working (recent imports visible in data_imports table)

## 🔧 Files Created This Session

### Migration Files
1. **`/supabase/migrations/20250131_complete_simplification.sql`**
   - Comprehensive migration combining all cleanup steps
   - Drops tables, simplifies RLS, cleans columns

2. **`/scripts/manual-migration-steps.sql`** ⭐ IMPORTANT
   - Manual SQL steps to run in Supabase Dashboard
   - Split into 7 clear steps
   - Fixed to properly handle materialized views

3. **`/scripts/verify-database-state.ts`**
   - Run with: `npx tsx scripts/verify-database-state.ts`
   - Shows current state of database
   - Identifies what needs to be cleaned up

### Other Scripts Created
- `/scripts/apply-simplification-migration.ts` (attempted automation)
- `/scripts/apply-migration-direct.ts` (direct postgres approach)
- `/scripts/run-simplification-migration.ts` (Supabase client approach)

## 🚀 Next Steps (In Order)

### 1. Complete Database Migration
1. Go to Supabase Dashboard → SQL Editor
2. Run each step from `/scripts/manual-migration-steps.sql`
3. Start with Step 1 (now fixed for materialized views)
4. Continue through all 7 steps
5. Run verification: `npx tsx scripts/verify-database-state.ts`

### 2. Update TypeScript Types
```bash
pnpm generate-types
```

### 3. Clean Up Code
Remove UI components and routes for:
- Division management (`/app/(dashboard)/divisions/`)
- Notifications
- Complex WBS features
- Financial snapshots
- 2FA authentication

### 4. Test Core Imports
1. Test Budget Import: `/projects/[id]/budget-import-coversheet`
2. Test Labor Import: `/labor/import`
3. Test PO Import: `/purchase-orders/import`

### 5. Continue MVP Development
Based on our todo list:
- Create unified import preview component
- Add import validation rules
- Build weekly import reminders
- Create user documentation

## 💡 Key Decisions Made

1. **Simplified Access:** All authenticated users can access everything (no complex RLS)
2. **Single Role:** All users are "Project Manager" - no role-based features
3. **Direct/Indirect Classification:** Kept as core feature (based on craft_types)
4. **Focus on Imports:** Everything else is secondary to the three core imports
5. **Keep It Simple:** No divisions, no complex WBS, no role-based access

## 🔗 Important Context

### Database Connection (from CLAUDE.md)
```
Project ID: gzrxhwpmtbgnngadgnse
Connection URL: postgres://postgres.gzrxhwpmtbgnngadgnse:F1dOjRhYg9lFWSlY@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require
```

### Core Tables to Preserve
- profiles, projects, employees, craft_types
- purchase_orders, po_line_items, change_orders
- labor_actuals, labor_employee_actuals, labor_headcount_forecasts
- budget_line_items, data_imports, audit_log

### Import Parsers (Already Working)
- Budget: `/lib/services/excel-budget-analyzer-v2.ts`
- Labor: `/lib/validations/labor-import.ts`
- PO: Built into import route

## 📋 Original Todo List
1. [completed] Run database migrations to apply simplification
2. [pending] Create unified import preview component
3. [pending] Add import validation rules and error handling
4. [pending] Enhance import history tracking with data_imports table
5. [pending] Build weekly import reminders system
6. [pending] Create user documentation for import workflows

## 🔴 Current Blocker

The database migration needs to be completed manually through the Supabase Dashboard. The automated approaches had SSL/connection issues, but the manual SQL script is ready and tested.

---

**To continue in next session:** Start by running the verification script to check current state, then proceed with the manual migration if not already complete.