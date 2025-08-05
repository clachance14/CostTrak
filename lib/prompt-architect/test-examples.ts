import { PromptArchitect } from './index'
import { getDetailedAnalysis } from './context-analyzer'

// Test scenarios for the prompt architect command
export const testScenarios = [
  {
    name: 'Labor Import Validation',
    input: 'create a labor import validation function',
    expectedContext: 'code-generation',
    testResponses: {
      'component-type': 'Utility Function',
      'integration-points': 'Labor/Employees',
      'error-handling': 'Invalid employee IDs, missing craft types, negative hours',
      'scope': 'Validate weekly labor import data before database insertion',
      'success': 'All records pass validation with clear error messages for failures'
    }
  },
  {
    name: 'Budget vs Actual Dashboard',
    input: 'analyze budget vs actual costs for the dashboard',
    expectedContext: 'data-analysis',
    testResponses: {
      'data-source': 'projects,budget_line_items,purchase_orders,labor_employee_actuals',
      'time-period': 'Year to date',
      'grouping': 'By cost code and month',
      'output-format': 'Chart/Visualization',
      'scope': 'Create a comprehensive budget vs actual comparison',
      'success': 'Clear visualization showing variances with drill-down capability'
    }
  },
  {
    name: 'PO Import Automation',
    input: 'automate the weekly purchase order import process',
    expectedContext: 'process-automation',
    testResponses: {
      'trigger': 'File upload',
      'data-flow': 'Excel upload → validation → PO header creation → line items → audit log',
      'validation-rules': 'Valid project, unique PO numbers, positive amounts, valid cost codes',
      'error-recovery': 'Transaction rollback, detailed error report, allow partial success',
      'scope': 'Streamline weekly PO data import with validation',
      'success': 'Imports complete in under 30 seconds with full audit trail'
    }
  },
  {
    name: 'API Documentation',
    input: 'document the project budget API endpoints',
    expectedContext: 'documentation',
    testResponses: {
      'audience': 'Developers',
      'doc-type': 'API Reference',
      'detail-level': 'Detailed with examples',
      'scope': 'Document all budget-related API endpoints',
      'success': 'Complete API reference with request/response examples and error codes'
    }
  },
  {
    name: 'Debug Slow Query',
    input: 'debug why the project list page is loading slowly',
    expectedContext: 'debugging',
    testResponses: {
      'error-description': 'Project list takes 5+ seconds to load',
      'reproduction-steps': 'Navigate to /projects page with 100+ projects',
      'expected-behavior': 'Page loads in under 1 second',
      'attempted-fixes': 'Added pagination, still slow',
      'scope': 'Identify and fix performance bottleneck',
      'success': 'Page loads in under 500ms'
    }
  }
]

// Function to test a scenario
export async function testScenario(scenario: typeof testScenarios[0]) {
  console.log(`\n=== Testing: ${scenario.name} ===`)
  console.log(`Input: "${scenario.input}"`)
  
  // Test context analysis
  const analysis = getDetailedAnalysis(scenario.input)
  console.log(`\nContext Analysis:`)
  console.log(analysis.explanation)
  console.log(`\nExpected: ${scenario.expectedContext}, Got: ${analysis.analysis.type}`)
  
  // Test prompt generation
  const architect = new PromptArchitect()
  const template = architect.generatePromptWithResponses(scenario.input, scenario.testResponses)
  
  console.log(`\n--- Generated Prompt Template ---`)
  console.log(template.promptText)
  console.log(`\n--- Metadata ---`)
  console.log(`Constraints: ${template.constraints.length}`)
  console.log(`Success Criteria: ${template.successCriteria.length}`)
  console.log(`Adaptations: ${template.metadata.adaptations.join(', ')}`)
  
  return {
    scenario: scenario.name,
    contextMatch: analysis.analysis.type === scenario.expectedContext,
    template
  }
}

// Function to run all tests
export async function runAllTests() {
  console.log('Running Prompt Architect Tests...\n')
  
  const results = []
  for (const scenario of testScenarios) {
    const result = await testScenario(scenario)
    results.push(result)
    console.log('\n' + '='.repeat(50) + '\n')
  }
  
  // Summary
  console.log('Test Summary:')
  console.log(`Total scenarios: ${results.length}`)
  console.log(`Context matches: ${results.filter(r => r.contextMatch).length}/${results.length}`)
  
  return results
}

// Example of using the prompt architect programmatically
export function exampleUsage() {
  const architect = new PromptArchitect({
    maxQuestions: 6,
    includeExamples: true,
    adaptiveFlow: true
  })
  
  // Example 1: Quick prompt generation with responses
  const quickPrompt = architect.generatePromptWithResponses(
    'build a new financial report for executives',
    {
      'data-source': 'projects,budget_line_items,purchase_orders,change_orders',
      'time-period': 'Current quarter',
      'grouping': 'By project and division',
      'output-format': 'PDF Report',
      'scope': 'Executive summary with key metrics and trends',
      'success': 'Report provides actionable insights in 2 pages or less'
    }
  )
  
  console.log('Generated Executive Report Prompt:')
  console.log(quickPrompt.promptText)
  
  // Example 2: Testing context detection
  const contexts = [
    'fix the bug in labor import',
    'create a new dashboard widget',
    'analyze cost overruns',
    'document the authentication flow',
    'migrate data from old system'
  ]
  
  console.log('\nContext Detection Examples:')
  contexts.forEach(ctx => {
    const analysis = getDetailedAnalysis(ctx)
    console.log(`"${ctx}" → ${analysis.analysis.type} (${(analysis.analysis.confidence * 100).toFixed(0)}%)`)
  })
}