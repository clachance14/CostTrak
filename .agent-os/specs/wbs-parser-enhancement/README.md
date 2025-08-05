# WBS Parser Enhancement Specification

**Version**: 1.0.0  
**Date**: 2025-01-30  
**Status**: Active Development

## Executive Summary

This specification outlines the enhancement of CostTrak's Work Breakdown Structure (WBS) parser from a 3-level to a comprehensive 5-level hierarchy. The enhancement will support parsing of all Excel budget sheets, implement 39 direct labor categories, 23 indirect labor roles across 4 phases, and provide dynamic discipline mapping capabilities.

## Objectives

1. **Extend WBS Hierarchy**: Upgrade from 3-level to 5-level structure with 01-99 major categories
2. **Comprehensive Sheet Parsing**: Parse all budget sheets including STAFF, DIRECTS, CONSTRUCTABILITY, MATERIALS, SUBS, and equipment sheets
3. **Labor Management**: Implement complete labor categorization with 39 direct and 23 indirect roles
4. **Dynamic Discipline Mapping**: Auto-detect and map new disciplines from Excel files
5. **Data Validation**: Ensure 100% rule compliance and cross-sheet reconciliation

## Key Features

### 5-Level WBS Structure

```
1.0 Project Total
1.1 Construction Phase
  1.1.1 Major Group (e.g., General Staffing)
    1.1.1.1 Sub-Category (e.g., Job Set Up)
      1.1.1.1.1 Cost Type (DL/IL/MAT/EQ/SUB)
        1.1.1.1.1.01 Line Item (e.g., Area Superintendent)
```

### Direct Labor Categories (39 Total)

- Boiler Maker (Class A & B)
- Carpenter (Class A & B)
- Crane Operator (A & B)
- Electrician (Class A, B & C)
- Equipment Operator (Class A, B & C)
- Field Engineer (A & B)
- Fitter (Class A & B)
- General Foreman
- Helper
- Instrument Tech (Class A, B & C)
- Ironworker (Class A & B)
- Laborer (Class A & B)
- Millwright (A & B)
- Operating Engineer (A & B)
- Operator (A & B)
- Painter
- Piping Foreman
- Supervisor
- Surveyor (A & B)
- Warehouse
- Welder (Class A & B)

### Indirect Labor Roles (23 Total)

Applied across 4 phases: Job Set Up, Pre-Work, Project Execution, Job Close Out

1. Area Superintendent
2. Clerk
3. Cost Engineer
4. Field Engineer
5. Field Exchanger General Foreman
6. General Foreman
7. Lead Planner
8. Lead Scheduler
9. Planner A
10. Planner B
11. Procurement Coordinator
12. Project Controls Lead
13. Project Manager
14. QA/QC Inspector A
15. QA/QC Inspector B
16. QA/QC Supervisor
17. Safety Supervisor
18. Safety Technician A
19. Safety Technician B
20. Scheduler
21. Senior Project Manager
22. Superintendent
23. Timekeeper

## Technical Architecture

### Core Components

1. **ExcelBudgetAnalyzer Enhancement**
   - Location: `/lib/services/excel-budget-analyzer.ts`
   - Extend to support 5-level hierarchy
   - Add comprehensive sheet parsing methods

2. **Specialized Parsers**
   - `/lib/services/parsers/staff-parser.ts`
   - `/lib/services/parsers/directs-parser.ts`
   - `/lib/services/parsers/constructability-parser.ts`
   - `/lib/services/parsers/materials-parser.ts`
   - `/lib/services/parsers/subs-parser.ts`

3. **Database Schema**
   - Extend `wbs_structure` table for 5 levels
   - Add phase allocation tables
   - Create master discipline registry

4. **API Endpoints**
   - Enhanced `/api/projects/[id]/budget-import`
   - New `/api/projects/[id]/wbs-hierarchy`
   - Phase-based labor queries

## Implementation Approach

### Phase 1: Infrastructure (2 days)
- Extend data models and interfaces
- Create database migrations
- Set up test infrastructure

### Phase 2: Parser Development (3 days)
- Implement all sheet parsers
- Add truncation handling
- Create validation logic

### Phase 3: Integration (2 days)
- Update API endpoints
- Integrate with existing UI
- Add reconciliation features

### Phase 4: Testing & Documentation (2 days)
- Comprehensive test suite
- Performance optimization
- User documentation

## Success Criteria

1. **Functional Requirements**
   - All 39 direct labor categories correctly mapped
   - 23 indirect roles implemented across 4 phases
   - Dynamic discipline discovery working
   - 100% rule validation passing

2. **Performance Requirements**
   - Parse 10MB Excel file in <5 seconds
   - Support files up to 50MB
   - Efficient database queries (<100ms)

3. **Quality Requirements**
   - 95% test coverage
   - Zero data loss from truncations
   - Full backwards compatibility

## Dependencies

- TypeScript 5.x
- Next.js 15.3.5
- Supabase (PostgreSQL)
- xlsx library
- Zod for validation

## Risk Mitigation

1. **Data Truncation**: Implement robust handling with logging and default values
2. **Performance**: Use streaming for large files, implement caching
3. **Compatibility**: Maintain backwards compatibility with existing 3-level WBS

## References

- [Technical Architecture](./architecture.md)
- [Task Breakdown](./tasks.md)
- [API Design](./api-design.md)
- [Test Plan](./test-plan.md)