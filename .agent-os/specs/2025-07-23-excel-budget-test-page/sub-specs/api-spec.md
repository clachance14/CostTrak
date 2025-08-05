# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-07-23-excel-budget-test-page/spec.md

> Created: 2025-07-23
> Version: 1.0.0

## Endpoints

### POST /api/test/excel-budget-analysis

**Purpose:** Analyze Excel file and return comprehensive parsing results without any database operations

**Parameters:**
- **Body:** multipart/form-data
  - `file` (required): Excel file (.xlsx or .xls)
  - `mappings` (optional): JSON string of custom column mappings
  - `options` (optional): JSON string of analysis options

**Request Example:**
```typescript
const formData = new FormData()
formData.append('file', excelFile)
formData.append('mappings', JSON.stringify({
  'DIRECTS': {
    wbs: 2,
    description: 3,
    manhours: 5,
    total: 8
  }
}))
formData.append('options', JSON.stringify({
  includeRawData: true,
  includeTransformationLog: true,
  validateOnly: false
}))
```

**Response:** 
```typescript
{
  success: boolean
  data: {
    // File metadata
    fileName: string
    fileSize: number
    sheetNames: string[]
    
    // Detected structure
    detectedHeaders: {
      [sheetName: string]: {
        headerRow: number
        columns: {
          [field: string]: {
            index: number
            headerText: string
            confidence: number
          }
        }
      }
    }
    
    // Raw data (if requested)
    rawData: {
      [sheetName: string]: {
        headers: string[]
        rows: any[][]
        totalRows: number
      }
    }
    
    // Parsed budget data
    budgetData: {
      summary: Record<string, any>
      details: Record<string, BudgetLineItem[]>
      wbsStructure: WBSNode[]
      totals: {
        labor: number
        material: number
        equipment: number
        subcontract: number
        other: number
        grand_total: number
      }
    }
    
    // Validation results
    validation: {
      errors: ValidationError[]
      warnings: ValidationWarning[]
      info: ValidationInfo[]
    }
    
    // Transformation log (if requested)
    transformationLog: {
      steps: TransformationStep[]
      duration: number
    }
    
    // Applied mappings
    appliedMappings: {
      [sheetName: string]: SheetMapping
    }
  }
  error?: string
}
```

**Errors:**
- `400 Bad Request` - Invalid file format or corrupted file
- `413 Payload Too Large` - File exceeds 50MB limit
- `422 Unprocessable Entity` - Invalid mapping configuration
- `500 Internal Server Error` - Unexpected processing error

### GET /api/test/excel-budget-analysis/export-config

**Purpose:** Export current mapping configuration as a downloadable JSON file

**Parameters:**
- **Query Parameters:**
  - `mappings` (required): Base64 encoded JSON string of mappings
  - `fileName` (optional): Name for the exported file

**Response:** JSON file download with Content-Disposition header

**Errors:**
- `400 Bad Request` - Invalid or missing mappings parameter

### POST /api/test/excel-budget-analysis/validate-mapping

**Purpose:** Validate a mapping configuration against a specific Excel structure

**Parameters:**
- **Body:** application/json
  ```json
  {
    "sheetStructure": {
      "sheetName": "string",
      "headers": ["string"],
      "sampleRow": ["any"]
    },
    "mapping": {
      "wbs": "number",
      "description": "number",
      // ... other fields
    }
  }
  ```

**Response:**
```json
{
  "valid": true,
  "issues": [],
  "suggestions": {
    "unmappedHeaders": ["string"],
    "requiredFieldsMissing": ["string"]
  }
}
```

**Errors:**
- `400 Bad Request` - Invalid request structure

## Controllers

### ExcelBudgetAnalysisController

**Actions:**
- `analyzeFile()` - Main analysis endpoint handler
- `exportConfig()` - Configuration export handler
- `validateMapping()` - Mapping validation handler

**Business Logic:**
1. File upload validation (size, format)
2. Extend ExcelBudgetAnalyzer for test mode
3. Apply custom mappings if provided
4. Generate comprehensive analysis results
5. Include debugging information
6. Return without any database operations

**Error Handling:**
- Graceful handling of malformed Excel files
- Clear error messages for mapping issues
- Detailed validation feedback
- Performance timeout protection (30 second limit)

## Integration Notes

### CORS Configuration
Since this is a test endpoint, ensure CORS is configured to allow requests from development environments:
```typescript
// In route.ts
export const runtime = 'nodejs'
export const maxDuration = 30

// CORS headers for test endpoints
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
```

### Rate Limiting
Implement basic rate limiting to prevent abuse:
- 100 requests per hour per IP
- 10 concurrent requests maximum
- File size limit: 50MB

### Security Considerations
- No authentication required (test environment)
- Sanitize all file inputs
- Prevent directory traversal in file names
- No file system writes
- No database connections
- Clear memory after processing