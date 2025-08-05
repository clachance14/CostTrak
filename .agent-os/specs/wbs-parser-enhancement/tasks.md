# WBS Parser Enhancement - Task Breakdown

**Last Updated**: 2025-01-30  
**Sprint Duration**: 9 days  
**Team Size**: 1-2 developers

## Overview

This document provides a detailed breakdown of all tasks required to enhance the CostTrak WBS parser from 3-level to 5-level hierarchy with comprehensive sheet parsing capabilities.

## Task Organization

Tasks are organized by epic, with dependencies clearly marked. Each task includes estimated hours and acceptance criteria.

## Epic 1: Data Model & Infrastructure [16 hours]

### ✅ Task 1.1: Extend WBS Data Model
**Priority**: High  
**Estimate**: 4 hours  
**Assignee**: TBD  
**Dependencies**: None

**Description**: Update TypeScript interfaces and types to support 5-level WBS hierarchy

**Acceptance Criteria**:
- [ ] WBSNode interface supports 5 levels
- [ ] Phase allocation types created
- [ ] Labor category constants defined
- [ ] Type safety maintained throughout

**Implementation Notes**:
```typescript
// Update in excel-budget-analyzer.ts
interface WBSNode {
  code: string
  parent_code?: string
  level: 1 | 2 | 3 | 4 | 5
  description: string
  discipline?: string
  phase?: PhaseType
  cost_type?: CostType
  children: WBSNode[]
  budget_total: number
  manhours_total?: number
}
```

### ✅ Task 1.2: Create Database Migrations
**Priority**: High  
**Estimate**: 3 hours  
**Assignee**: TBD  
**Dependencies**: Task 1.1

**Description**: Create Supabase migrations for 5-level WBS support

**Acceptance Criteria**:
- [ ] wbs_structure table supports level 5
- [ ] Phase allocation tables created
- [ ] Master discipline registry table added
- [ ] Proper indexes for performance

### ✅ Task 1.3: Update Discipline Mapper
**Priority**: High  
**Estimate**: 3 hours  
**Assignee**: TBD  
**Dependencies**: Task 1.1

**Description**: Enhance discipline mapper for dynamic discipline discovery

**Acceptance Criteria**:
- [ ] Auto-detect new disciplines from files
- [ ] Map to standard WBS groups
- [ ] Persist to master registry
- [ ] Handle variations (e.g., "CIVIL - GROUNDING")

### ✅ Task 1.4: Create Master Discipline Registry
**Priority**: Medium  
**Estimate**: 2 hours  
**Assignee**: TBD  
**Dependencies**: Task 1.2

**Description**: Implement persistent discipline registry with CRUD operations

**Acceptance Criteria**:
- [ ] Registry stored in database
- [ ] API for add/update/remove disciplines
- [ ] Default disciplines seeded
- [ ] Version control for changes

### ✅ Task 1.5: Set Up Test Infrastructure
**Priority**: High  
**Estimate**: 4 hours  
**Assignee**: TBD  
**Dependencies**: None

**Description**: Create test framework for WBS parser testing

**Acceptance Criteria**:
- [ ] Test directory structure created
- [ ] Mock data generators implemented
- [ ] Test utilities for Excel parsing
- [ ] CI/CD integration configured

## Epic 2: Sheet Parser Implementation [24 hours]

### ✅ Task 2.1: Implement STAFF Parser
**Priority**: High  
**Estimate**: 6 hours  
**Assignee**: TBD  
**Dependencies**: Epic 1

**Description**: Create parser for STAFF sheet with 23 roles × 4 phases

**Acceptance Criteria**:
- [ ] Parse all 23 indirect roles
- [ ] Support 4 phases (Job Set Up, Pre-Work, Project, Close Out)
- [ ] Calculate FTE allocations
- [ ] Handle perdiem and add-ons

**Implementation Example**:
```typescript
// staff-parser.ts
export function parseStaffSheet(worksheet: XLSX.WorkSheet): StaffAllocation[] {
  // Parse 23 roles across 4 phases
  const phases = ['JOB_SET_UP', 'PRE_WORK', 'PROJECT', 'CLOSE_OUT']
  const roles = INDIRECT_LABOR_ROLES // 23 roles
  // Implementation...
}
```

### ✅ Task 2.2: Implement DIRECTS Parser
**Priority**: High  
**Estimate**: 5 hours  
**Assignee**: TBD  
**Dependencies**: Epic 1

**Description**: Create parser for DIRECTS sheet with 39 labor categories

**Acceptance Criteria**:
- [ ] Parse all 39 direct labor categories
- [ ] Map to appropriate disciplines
- [ ] Calculate manhours and costs
- [ ] Handle rate variations

### ✅ Task 2.3: Implement CONSTRUCTABILITY Parser
**Priority**: Medium  
**Estimate**: 4 hours  
**Assignee**: TBD  
**Dependencies**: Epic 1

**Description**: Parse CONSTRUCTABILITY sheet for add-ons and indirect costs

**Acceptance Criteria**:
- [ ] Parse 7 main categories
- [ ] Map add-ons to Indirect Labor
- [ ] Handle safety supplies categorization
- [ ] Support temporary facilities

### ✅ Task 2.4: Implement MATERIALS Parser
**Priority**: Medium  
**Estimate**: 3 hours  
**Assignee**: TBD  
**Dependencies**: Epic 1

**Description**: Parse MATERIALS sheet with vendor tracking

**Acceptance Criteria**:
- [ ] Separate taxed/non-taxed materials
- [ ] Track vendor information
- [ ] Calculate tax amounts
- [ ] Map to disciplines

### ✅ Task 2.5: Implement SUBS Parser
**Priority**: Medium  
**Estimate**: 3 hours  
**Assignee**: TBD  
**Dependencies**: Epic 1

**Description**: Parse SUBS sheet for subcontractor information

**Acceptance Criteria**:
- [ ] Extract contractor names
- [ ] Map to appropriate WBS codes
- [ ] Handle lump sum vs unit pricing
- [ ] Track contractor categories

### ✅ Task 2.6: Handle Truncations
**Priority**: High  
**Estimate**: 3 hours  
**Assignee**: TBD  
**Dependencies**: Tasks 2.1-2.5

**Description**: Implement robust truncation handling

**Acceptance Criteria**:
- [ ] Detect truncation patterns
- [ ] Default zeros for missing values
- [ ] Log truncations as warnings
- [ ] Maintain data integrity

## Epic 3: Validation & Integration [16 hours]

### ✅ Task 3.1: Implement 100% Rule Validation
**Priority**: High  
**Estimate**: 4 hours  
**Assignee**: TBD  
**Dependencies**: Epic 2

**Description**: Create validation logic for WBS hierarchy

**Acceptance Criteria**:
- [ ] Sum of children equals parent
- [ ] Level 3 totals = Project Total
- [ ] Validation report generated
- [ ] Error recovery strategies

### ✅ Task 3.2: Cross-Sheet Reconciliation
**Priority**: High  
**Estimate**: 4 hours  
**Assignee**: TBD  
**Dependencies**: Epic 2

**Description**: Implement reconciliation between sheets

**Acceptance Criteria**:
- [ ] COVERSHEET vs BUDGETS validation
- [ ] Delta checking (row 55)
- [ ] Discrepancy reporting
- [ ] Reconciliation suggestions

### ✅ Task 3.3: Update API Endpoints
**Priority**: High  
**Estimate**: 4 hours  
**Assignee**: TBD  
**Dependencies**: Epic 2

**Description**: Enhance API endpoints for 5-level WBS

**Acceptance Criteria**:
- [ ] /budget-import supports 5 levels
- [ ] New /wbs-hierarchy endpoint
- [ ] Phase-based queries added
- [ ] Cost type filtering implemented

### ✅ Task 3.4: UI Integration
**Priority**: Medium  
**Estimate**: 4 hours  
**Assignee**: TBD  
**Dependencies**: Task 3.3

**Description**: Update budget import UI for enhanced features

**Acceptance Criteria**:
- [ ] Preview shows 5-level hierarchy
- [ ] Validation warnings displayed
- [ ] Progress indicators added
- [ ] Error recovery UI

## Epic 4: Testing & Documentation [16 hours]

### ✅ Task 4.1: Unit Test Suite
**Priority**: High  
**Estimate**: 6 hours  
**Assignee**: TBD  
**Dependencies**: Epics 1-3

**Description**: Create comprehensive unit tests

**Acceptance Criteria**:
- [ ] Parser tests for each sheet type
- [ ] Validation logic tests
- [ ] Edge case coverage
- [ ] 95% code coverage

### ✅ Task 4.2: Integration Tests
**Priority**: High  
**Estimate**: 4 hours  
**Assignee**: TBD  
**Dependencies**: Task 4.1

**Description**: Test full import workflow

**Acceptance Criteria**:
- [ ] End-to-end import tests
- [ ] Database integration tests
- [ ] API endpoint tests
- [ ] Performance benchmarks

### ✅ Task 4.3: Performance Optimization
**Priority**: Medium  
**Estimate**: 3 hours  
**Assignee**: TBD  
**Dependencies**: Task 4.2

**Description**: Optimize parser performance

**Acceptance Criteria**:
- [ ] 10MB file parsed in <5 seconds
- [ ] Memory usage optimized
- [ ] Database queries <100ms
- [ ] Streaming for large files

### ✅ Task 4.4: Documentation
**Priority**: Medium  
**Estimate**: 3 hours  
**Assignee**: TBD  
**Dependencies**: All tasks

**Description**: Create user and developer documentation

**Acceptance Criteria**:
- [ ] API documentation updated
- [ ] User guide for import process
- [ ] Developer guide for extensions
- [ ] Migration guide from 3-level

## Risk Items & Blockers

### ⚠️ Risk 1: Excel Format Variations
**Impact**: High  
**Probability**: Medium  
**Mitigation**: Implement flexible parsing with fallbacks

### ⚠️ Risk 2: Performance with Large Files
**Impact**: Medium  
**Probability**: Low  
**Mitigation**: Implement streaming and chunking

### ⚠️ Risk 3: Backwards Compatibility
**Impact**: High  
**Probability**: Low  
**Mitigation**: Maintain dual support for 3 and 5 levels

## Sprint Schedule

### Week 1 (Days 1-5)
- Epic 1: Complete infrastructure
- Epic 2: Start parser implementation
- Daily standups at 9 AM

### Week 2 (Days 6-9)
- Epic 2: Complete parsers
- Epic 3: Validation & integration
- Epic 4: Testing & documentation
- Sprint review on Day 9

## Definition of Done

- [ ] Code reviewed by peer
- [ ] Unit tests passing (95% coverage)
- [ ] Integration tests passing
- [ ] Documentation updated
- [ ] Performance benchmarks met
- [ ] No critical bugs
- [ ] Deployed to staging environment

## Notes

- All tasks should follow TDD approach
- Use conventional commit messages
- Update this document as tasks progress
- Flag blockers immediately