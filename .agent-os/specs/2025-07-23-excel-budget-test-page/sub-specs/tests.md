# Tests Specification

This is the tests coverage details for the spec detailed in @.agent-os/specs/2025-07-23-excel-budget-test-page/spec.md

> Created: 2025-07-23
> Version: 1.0.0

## Test Coverage

### Unit Tests

**ExcelBudgetTestAnalyzer**
- Should extend ExcelBudgetAnalyzer without breaking existing functionality
- Should expose internal parsing details via getDetectedHeaders()
- Should return raw sheet data with getRawSheetData()
- Should apply custom column mappings correctly
- Should generate transformation logs for debugging
- Should validate data without database operations

**Mapping Configuration Service**
- Should serialize/deserialize mapping configurations to JSON
- Should validate mapping structure against sheet headers
- Should detect missing required fields in mappings
- Should suggest unmapped columns that might be useful
- Should handle invalid column indices gracefully

**WBS Tree Builder**
- Should build hierarchical structure from flat data
- Should calculate budget rollups at each level
- Should handle missing parent codes
- Should support searching nodes by code or description
- Should expand/collapse state management

### Integration Tests

**Excel Analysis API Endpoint**
- Should accept multipart form data with Excel file
- Should enforce 50MB file size limit
- Should return 400 for non-Excel files
- Should apply custom mappings when provided
- Should include raw data when requested in options
- Should complete analysis within 30 seconds
- Should handle concurrent requests properly

**Mapping Validation Endpoint**
- Should validate mapping against sheet structure
- Should return specific validation errors
- Should suggest improvements for mappings
- Should handle malformed requests gracefully

**Export Configuration Endpoint**
- Should generate downloadable JSON file
- Should include proper Content-Disposition headers
- Should handle base64 encoding/decoding correctly

### Component Tests

**File Upload Component**
- Should accept drag-and-drop files
- Should validate file type before upload
- Should show upload progress
- Should handle upload errors gracefully
- Should prevent multiple simultaneous uploads

**Raw Data Viewer**
- Should render large datasets efficiently with virtualization
- Should allow sheet switching
- Should highlight detected header rows
- Should support column sorting
- Should export visible data to CSV

**WBS Tree Viewer**
- Should render hierarchical data correctly
- Should support expand/collapse interactions
- Should show budget totals at each node
- Should support keyboard navigation
- Should filter tree by search term

**Mapping Configurator**
- Should display current mappings visually
- Should support drag-and-drop to change mappings
- Should validate mappings in real-time
- Should save/load mapping configurations
- Should show mapping preview with sample data

### Feature Tests

**Complete Import Analysis Workflow**
- User uploads Excel file successfully
- System displays all detected sheets and data
- User configures custom column mappings
- System shows updated WBS hierarchy
- User reviews validation results
- User exports mapping configuration

**Debug Failed Import Scenario**
- User uploads problematic Excel file
- System shows detailed parsing errors
- User identifies incorrect column detection
- User adjusts mappings to fix issues
- System validates corrections
- User sees successful preview

**Mapping Configuration Reuse**
- User creates mapping for first file
- User exports configuration as JSON
- User uploads similar Excel file
- User imports saved configuration
- System applies mappings correctly
- Analysis completes with saved settings

### Mocking Requirements

- **File Upload Service:** Mock file reading for consistent test data
- **LocalStorage:** Mock storage for testing configuration persistence
- **API Responses:** Mock successful and error responses for all endpoints
- **Large Dataset Generation:** Create mock Excel data with 10,000+ rows for performance testing
- **Network Delays:** Simulate slow uploads and processing for loading state tests

## Performance Tests

**Large File Handling**
- Should parse 10,000 row Excel file in under 5 seconds
- Should maintain UI responsiveness during analysis
- Should not exceed 500MB browser memory usage
- Should virtualize table rendering for smooth scrolling

**Concurrent Usage**
- Should handle 10 simultaneous file uploads
- Should queue requests appropriately
- Should not degrade performance significantly
- Should maintain isolated analysis sessions

## Accessibility Tests

**Keyboard Navigation**
- All interactive elements accessible via keyboard
- Tab order follows logical flow
- Focus indicators clearly visible
- Escape key closes modals/dropdowns

**Screen Reader Support**
- Proper ARIA labels for all controls
- Status announcements for async operations
- Table data readable in logical order
- Form validation errors announced

## Security Tests

**File Upload Security**
- Should reject files with suspicious extensions
- Should sanitize file names
- Should prevent path traversal attempts
- Should scan for malicious Excel macros
- Should enforce content-type validation

**Data Isolation**
- Should not access production database
- Should not persist uploaded files
- Should clear memory after processing
- Should prevent cross-session data leakage