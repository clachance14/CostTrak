# Archived Scripts

This directory contains scripts that have been archived to reduce confusion and clutter. These scripts are preserved for reference but are no longer actively maintained.

## Directory Structure

### `/debug/` - Project-specific debug scripts
- `debug-5772-dashboard.ts` - Debug dashboard for project 5772
- `debug-5800.ts` - Debug issues with project 5800  
- `analyze-561781.ts` - Analysis for project 561781
- `check-dashboard-5640.ts` - Dashboard check for project 5640
- `debug-dashboard-full.ts` - Comprehensive dashboard debugging

### `/migrations/` - Legacy migration scripts
- `apply-5-level-wbs-migration.ts` - WBS migration implementation
- `apply-budget-schema-migration.ts` - Budget schema changes
- `apply-burden-migration.ts` - Labor burden migration
- `apply-drop-division-functions.ts` - Division function removal
- `apply-labor-forecast-fix.ts` - Labor forecast fixes
- `apply-migration-direct.ts` - Direct migration application
- `apply-migration-parts.ts` - Partial migration application

### `/per-diem/` - Legacy per-diem fix scripts
- `fix-per-diem-complete.sql` - Complete per-diem fix
- `fix-per-diem-final.sql` - Final per-diem implementation
- `fix-per-diem-final-v2.sql` - Updated final version
- `fix-perdiem-winner-takes-all.sql` - Winner-takes-all approach
- `fix-perdiem-winner-takes-all-v2.sql` - Updated version
- `fix-perdiem-winner-takes-all-v3.sql` - Third iteration
- `fix-per-diem-migration.sql` - Migration script
- `backfill-perdiem-migration.sql` - Data backfill
- `backfill-perdiem-simple.sql` - Simplified backfill

### `/legacy/` - Old UI and component scripts
- `test-drag-drop-components.ts` - Drag-drop component testing
- `test-delete-ui.ts` - Delete UI functionality tests
- `audit-navigation.js` - Navigation audit script
- `test-middleware.js` - Middleware testing

## Why These Were Archived

1. **Project-specific scripts** - Limited to specific projects that may no longer be relevant
2. **Multiple versions** - Several iterations of the same fix, keeping only the latest
3. **Legacy UI tests** - Outdated component testing that has been superseded
4. **Old migration approaches** - Migration strategies that have been replaced

## Restoration

If you need to restore any of these scripts:

1. Copy the file back to the main `/scripts/` directory
2. Update any outdated dependencies or imports
3. Test thoroughly before use
4. Update the main `scripts/README.md` to reflect the restoration

## Cleanup Date

These files were archived on: $(date +'%Y-%m-%d')

Original file count before cleanup: 160+ scripts
Active scripts after cleanup: ~60 scripts

This cleanup improved maintainability and reduced confusion for developers and AI assistants working with the codebase.