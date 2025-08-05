# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-07-23-excel-budget-test-page/spec.md

> Created: 2025-07-23
> Version: 1.0.0

## Technical Requirements

### Core Architecture

- **Public Route**: `/test/excel-budget-import` - No authentication required, completely isolated from production
- **API Namespace**: `/api/test/excel-budget-analysis/*` - Test-specific endpoints that perform read-only operations
- **Extended Analyzer**: Create `ExcelBudgetTestAnalyzer` class extending the existing `ExcelBudgetAnalyzer`
- **State Management**: Use React Context for wizard state and React Query for caching analysis results
- **Data Persistence**: LocalStorage for mapping configurations and user preferences

### UI/UX Specifications

- **Multi-step Wizard**: 7-step process with progress indicator and back/forward navigation
- **Drag-and-Drop Upload**: Support for .xlsx and .xls files up to 50MB
- **Responsive Tables**: Virtualized data tables for handling thousands of rows efficiently
- **Interactive Tree View**: Collapsible WBS hierarchy with search and filter capabilities
- **Real-time Validation**: Instant feedback on mapping changes without re-uploading file

### Performance Requirements

- **File Processing**: Parse 10,000 row Excel files in under 5 seconds
- **UI Responsiveness**: Tables must render within 100ms of data availability
- **Memory Management**: Limit browser memory usage to 500MB for large files
- **Caching**: Cache analysis results for 1 hour to enable quick re-analysis

### Integration Requirements

- **Excel Analyzer Service**: Extend without modifying the production `ExcelBudgetAnalyzer`
- **Existing UI Components**: Reuse shadcn/ui components from the main application
- **Type Safety**: Full TypeScript coverage with generated types for all data structures

## Approach Options

### Option A: Client-Side Processing
- Pros: No server load, instant feedback, works offline
- Cons: Limited by browser memory, slower for large files, security concerns

### Option B: Server-Side Processing with Streaming (Selected)
- Pros: Handles large files, secure processing, can leverage server resources
- Cons: Requires network requests, slightly higher latency

### Option C: Hybrid Processing
- Pros: Best of both worlds, progressive enhancement
- Cons: Complex implementation, duplicate logic

**Rationale:** Server-side processing ensures consistency with production import logic while maintaining security. The test endpoints can use the same analyzer service with additional debugging output.

## Technical Architecture Details

### Component Structure
```
components/test/excel-budget-import/
├── wizard/
│   ├── wizard-container.tsx       # Main wizard orchestrator
│   ├── wizard-progress.tsx        # Step progress indicator
│   └── wizard-navigation.tsx      # Back/Next controls
├── steps/
│   ├── upload-step.tsx           # File upload with drag-drop
│   ├── raw-data-step.tsx         # Display all Excel sheets
│   ├── mapping-step.tsx          # Configure column mappings
│   ├── wbs-preview-step.tsx      # WBS hierarchy visualization
│   ├── validation-step.tsx       # Show warnings/errors
│   ├── import-preview-step.tsx   # Final data preview
│   └── export-config-step.tsx    # Save configuration
├── visualizations/
│   ├── wbs-tree-viewer.tsx       # Interactive WBS tree
│   ├── data-flow-diagram.tsx     # Sankey diagram
│   └── mapping-preview.tsx       # Before/after comparison
└── shared/
    ├── excel-data-table.tsx      # Virtualized data table
    ├── column-mapper.tsx         # Drag-drop mapping UI
    └── validation-messages.tsx   # Error/warning display
```

### State Management Pattern
```typescript
interface TestWizardState {
  currentStep: number
  uploadedFile: File | null
  analysisResult: ExcelAnalysisResult | null
  customMappings: Record<string, ColumnMapping>
  validationResults: ValidationResult[]
  userPreferences: UserPreferences
}

// React Context for wizard state
const TestWizardContext = createContext<TestWizardState>()

// React Query for analysis caching
const useExcelAnalysis = (file: File, mappings: CustomMappings) => {
  return useQuery({
    queryKey: ['excel-analysis', file.name, mappings],
    queryFn: () => analyzeExcelFile(file, mappings),
    staleTime: 60 * 60 * 1000, // 1 hour
  })
}
```

### Extended Analyzer Service
```typescript
export class ExcelBudgetTestAnalyzer extends ExcelBudgetAnalyzer {
  // Additional methods for testing
  getDetectedHeaders(): HeaderDetectionResult
  getRawSheetData(): RawDataBySheet
  getColumnMappings(): DetectedMappings
  getTransformationLog(): TransformationStep[]
  applyCustomMappings(mappings: CustomMappings): AnalysisResult
  validateWithoutSaving(): ValidationResult
}
```

## External Dependencies

- **react-arborist** - Interactive tree component for WBS hierarchy visualization
  - **Justification:** Provides performant tree rendering with built-in search, drag-drop, and virtualization for large hierarchies

- **@tanstack/react-virtual** - Virtualization for large data tables
  - **Justification:** Already used in the project, ensures consistent performance with thousands of rows

- **react-flow** - For data flow visualization (optional enhancement)
  - **Justification:** Industry-standard library for creating interactive node-based diagrams to show data transformation flow