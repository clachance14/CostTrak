# Spec Requirements Document

> Spec: Excel Budget Import Testing Page
> Created: 2025-07-23
> Status: Planning

## Overview

Create a dedicated testing and debugging page for Excel budget import functionality that allows users to preview, analyze, and configure Excel data mappings before importing into CostTrak. This tool will provide complete visibility into the import process and enable custom mapping configurations without affecting production data.

## User Stories

### Controller Testing Excel Imports

As a Controller, I want to upload Excel budget files and see exactly how the data will be interpreted, so that I can verify the import will work correctly before committing to the database.

When I upload an Excel coversheet file, I need to see all the raw data extracted from each sheet, understand how WBS codes are detected and hierarchically organized, preview which data goes into which budget categories, and validate that all financial totals match my expectations. This visibility helps me trust the automated import process and catch any issues before they affect project budgets.

### Developer Debugging Import Issues

As a Developer, I want to debug Excel import problems by seeing detailed parsing information, so that I can quickly identify and fix mapping issues without repeatedly testing against the production database.

When users report import problems, I need to reproduce the issue in an isolated environment, see exactly which columns were detected as headers, understand how data transformations are applied, and test different mapping configurations. This debugging capability reduces troubleshooting time from hours to minutes.

### Power User Custom Mapping Configuration

As a Power User, I want to configure custom column mappings for non-standard Excel formats, so that I can import budget data from various sources without requiring developer intervention.

Some of our Excel files have unique structures or column arrangements. I need to specify which columns contain WBS codes, descriptions, and costs, enable or disable specific sheets for import, and save these configurations for reuse with similar files. This flexibility allows us to handle edge cases without code changes.

## Spec Scope

1. **Standalone Testing Route** - Create public route at `/test/excel-budget-import` with no authentication requirements for isolated testing
2. **Enhanced Data Extraction** - Display raw Excel data from all sheets with detected structures, column mappings, and validation results
3. **Interactive WBS Visualization** - Show hierarchical WBS tree with collapsible nodes, budget rollups, and parent-child relationships
4. **Custom Mapping Interface** - Enable drag-and-drop column mapping configuration with real-time preview of results
5. **Comprehensive Validation** - Provide detailed validation messages, data type checking, and comparison between Excel totals and parsed totals

## Out of Scope

- Database write operations (this is read-only analysis)
- Authentication or user management
- Production data access or modification
- Historical import tracking
- Automated mapping suggestions using ML/AI

## Expected Deliverable

1. Users can upload any Excel file and immediately see all extracted data in organized tables
2. The testing page shows exactly how data flows from Excel sheets → WBS codes → Budget categories with visual representations
3. Custom mapping configurations can be created, tested, and exported as JSON for reuse

## Spec Documentation

- Tasks: @.agent-os/specs/2025-07-23-excel-budget-test-page/tasks.md
- Technical Specification: @.agent-os/specs/2025-07-23-excel-budget-test-page/sub-specs/technical-spec.md
- API Specification: @.agent-os/specs/2025-07-23-excel-budget-test-page/sub-specs/api-spec.md
- Tests Specification: @.agent-os/specs/2025-07-23-excel-budget-test-page/sub-specs/tests.md