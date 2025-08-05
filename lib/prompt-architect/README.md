# CostTrak Prompt Architect

A sophisticated prompt engineering system tailored specifically for CostTrak development tasks. This tool analyzes your intent, asks targeted questions, and generates optimized prompts for Claude or other LLMs.

## Quick Start

```typescript
import { promptArchitect } from '@/lib/prompt-architect'

// Basic usage
const template = await promptArchitect('create a labor import validation function')
```

## How It Works

1. **Context Analysis**: Analyzes your input to determine the type of task (code generation, data analysis, debugging, etc.)
2. **Adaptive Questions**: Asks 3-5 targeted questions based on the detected context
3. **Domain Knowledge**: Incorporates CostTrak-specific knowledge (tables, business rules, tech stack)
4. **Template Generation**: Creates an optimized prompt with all necessary context and constraints

## Context Types

The system recognizes these primary contexts:

- **code-generation**: Building new features, components, or APIs
- **data-analysis**: Analyzing financial data, creating reports
- **documentation**: Writing technical docs, guides, or specifications  
- **process-automation**: Creating import/export workflows, batch processes
- **testing**: Writing unit, integration, or E2E tests
- **debugging**: Investigating and fixing issues
- **architecture**: Designing system improvements
- **migration**: Planning data or system migrations
- **integration**: Connecting with external systems

## Example Usage

### 1. Code Generation
```typescript
// Input: "create a new API endpoint for budget variance analysis"
// Detected context: code-generation
// Questions asked:
// - What type of component? → "API Route"
// - Integration points? → "Projects, Budget Line Items"  
// - Error handling? → "Invalid project ID, missing budget data"
// - Include tests? → "Unit tests only"
```

### 2. Data Analysis
```typescript
// Input: "analyze labor cost trends across all projects"
// Detected context: data-analysis
// Questions asked:
// - Data sources? → "labor_employee_actuals, projects, employees"
// - Time period? → "Year to date"
// - Grouping? → "By month and craft type"
// - Output format? → "Chart/Visualization"
```

### 3. Process Automation
```typescript
// Input: "automate the weekly purchase order import"
// Detected context: process-automation
// Questions asked:
// - Trigger? → "File upload"
// - Data flow? → "Excel → validation → database → notifications"
// - Validation rules? → "Valid project, unique PO numbers"
// - Error recovery? → "Transaction rollback with detailed report"
```

## Programmatic Usage

For automated workflows or testing:

```typescript
import { PromptArchitect } from '@/lib/prompt-architect'

const architect = new PromptArchitect({
  maxQuestions: 5,
  includeExamples: true,
  adaptiveFlow: true
})

// Generate prompt with predefined responses
const template = architect.generatePromptWithResponses(
  'build a dashboard widget for cost tracking',
  {
    'component-type': 'React Component',
    'integration-points': 'Projects, Budget Line Items, Purchase Orders',
    'error-handling': 'Loading states, API failures, empty data',
    'scope': 'Real-time cost tracking with drill-down capability',
    'success': 'Updates every 30 seconds, handles large datasets'
  }
)

console.log(template.promptText)
```

## Domain Knowledge

The system includes built-in knowledge of:

### Tables & Relationships
- projects, budget_line_items, purchase_orders, labor_employee_actuals
- employees, craft_types, change_orders, data_imports

### Business Rules
- Email domain restrictions (@ics.ac)
- Budget import once per project
- Weekly labor/PO import cadence
- Direct/Indirect labor classification
- Revised contract calculations

### Tech Stack
- Next.js 15 (App Router)
- TypeScript (strict mode)
- Supabase (PostgreSQL + Auth)
- Tailwind CSS + shadcn/ui
- React Query + react-hook-form

### Code Patterns
- API route structure
- Component organization
- Error handling patterns
- Data fetching strategies

## Advanced Features

### Context Detection
```typescript
import { getDetailedAnalysis } from '@/lib/prompt-architect/context-analyzer'

const analysis = getDetailedAnalysis('debug slow project list loading')
console.log(analysis.explanation)
// Output: 
// Detected context type: debugging (confidence: 75.0%)
// Keywords found: debug, slow, loading
// Related features: Performance Optimization
```

### Custom Configuration
```typescript
const architect = new PromptArchitect({
  maxQuestions: 8,           // Ask more detailed questions
  includeExamples: false,    // Skip examples in output
  adaptiveFlow: true,        // Enable follow-up questions
  outputFormat: 'markdown'   // Force markdown output
})
```

## Testing

Run the test suite to see example scenarios:

```typescript
import { runAllTests } from '@/lib/prompt-architect/test-examples'

await runAllTests()
```

Test scenarios include:
- Labor import validation
- Budget vs actual dashboard
- PO import automation
- API documentation
- Performance debugging

## Best Practices

1. **Be Specific**: The more specific your initial input, the better the context detection
2. **Answer Thoroughly**: Provide detailed responses to questions for optimal prompts
3. **Review Output**: Always review the generated prompt before using it
4. **Iterate**: You can refine the prompt by running the architect again with adjusted input

## Integration with Claude Code

This system is designed to work seamlessly with Claude Code:

1. Create a command alias in your shell:
```bash
alias pa='node -e "require(\"./lib/prompt-architect\").promptArchitect(process.argv[1])"'
```

2. Use it directly:
```bash
pa "create a new labor forecast feature"
```

3. Answer the questions interactively
4. Copy the generated prompt to use with Claude

## Future Enhancements

- [ ] Interactive CLI mode with better question flow
- [ ] Prompt history and favorites
- [ ] Team-shared prompt templates
- [ ] Integration with VSCode extension
- [ ] Multi-language support