import { PromptTemplate, TemplateBuilderOptions, ContextType } from './types'

// Template sections for different context types
const CONTEXT_TEMPLATES: Record<ContextType, string> = {
  'code-generation': `You are tasked with implementing a new feature for CostTrak, a construction financial tracking system built with Next.js, TypeScript, and Supabase.

{{objective}}

Technical Context:
{{domainContext}}

Requirements:
{{constraints}}

Expected Output:
{{outputFormat}}

{{examples}}

Success Criteria:
{{successCriteria}}

Important Considerations:
- Follow existing code patterns and conventions
- Ensure proper error handling and validation
- Include TypeScript types for all new code
- Follow the project's code style (no semicolons, single quotes)
- Consider performance implications
{{edgeCases}}`,

  'data-analysis': `You are analyzing financial data for CostTrak, a construction project management system. Your analysis should provide actionable insights.

{{objective}}

Data Context:
{{domainContext}}

Analysis Parameters:
{{constraints}}

Deliverable Format:
{{outputFormat}}

{{examples}}

Analysis should address:
{{successCriteria}}

Special Considerations:
- Ensure accuracy in financial calculations
- Account for the relationship between budget, actuals, and commitments
- Consider the impact of change orders on analysis
{{edgeCases}}`,

  'documentation': `Create comprehensive documentation for CostTrak, ensuring clarity and completeness for the target audience.

{{objective}}

Context:
{{domainContext}}

Documentation Requirements:
{{constraints}}

Format Specifications:
{{outputFormat}}

{{examples}}

Documentation must:
{{successCriteria}}

Style Guidelines:
- Use clear, concise language
- Include relevant examples
- Structure content logically
- Highlight important warnings or notes
{{edgeCases}}`,

  'process-automation': `Design and implement an automated process for CostTrak that improves efficiency and reduces manual work.

{{objective}}

System Context:
{{domainContext}}

Automation Requirements:
{{constraints}}

Implementation Details:
{{outputFormat}}

{{examples}}

The automation must:
{{successCriteria}}

Critical Considerations:
- Ensure data integrity throughout the process
- Include proper logging and monitoring
- Design for failure recovery
- Consider performance at scale
{{edgeCases}}`,

  'testing': `Create comprehensive tests for CostTrak functionality, ensuring reliability and catching edge cases.

{{objective}}

Testing Context:
{{domainContext}}

Test Requirements:
{{constraints}}

Test Structure:
{{outputFormat}}

{{examples}}

Tests should verify:
{{successCriteria}}

Testing Best Practices:
- Cover happy path and error scenarios
- Include edge cases and boundary conditions
- Ensure tests are maintainable and clear
- Mock external dependencies appropriately
{{edgeCases}}`,

  'debugging': `Investigate and resolve an issue in the CostTrak system, providing a thorough analysis and solution.

{{objective}}

Issue Context:
{{domainContext}}

Investigation Parameters:
{{constraints}}

Solution Format:
{{outputFormat}}

{{examples}}

Resolution must:
{{successCriteria}}

Debugging Approach:
- Systematically isolate the root cause
- Document the investigation process
- Provide clear reproduction steps
- Ensure the fix doesn't introduce new issues
{{edgeCases}}`,

  'architecture': `Design an architectural solution for CostTrak that balances technical excellence with practical constraints.

{{objective}}

Current Architecture:
{{domainContext}}

Design Constraints:
{{constraints}}

Deliverable Format:
{{outputFormat}}

{{examples}}

The architecture must:
{{successCriteria}}

Design Principles:
- Maintain simplicity where possible
- Ensure scalability and maintainability
- Follow established patterns
- Consider migration path and risks
{{edgeCases}}`,

  'migration': `Plan and execute a data/system migration for CostTrak with minimal disruption and maximum safety.

{{objective}}

Migration Context:
{{domainContext}}

Migration Constraints:
{{constraints}}

Migration Plan Format:
{{outputFormat}}

{{examples}}

The migration must:
{{successCriteria}}

Migration Guidelines:
- Ensure data integrity throughout
- Plan for rollback scenarios
- Minimize downtime
- Validate data pre and post migration
{{edgeCases}}`,

  'integration': `Implement an integration between CostTrak and an external system, ensuring reliable data exchange.

{{objective}}

Integration Context:
{{domainContext}}

Technical Requirements:
{{constraints}}

Implementation Format:
{{outputFormat}}

{{examples}}

The integration must:
{{successCriteria}}

Integration Best Practices:
- Handle authentication securely
- Implement proper error handling and retries
- Consider rate limiting and throttling
- Ensure data consistency
{{edgeCases}}`,

  'general': `Complete the following task for CostTrak, a construction financial tracking system.

{{objective}}

Context:
{{domainContext}}

Requirements:
{{constraints}}

Expected Output:
{{outputFormat}}

{{examples}}

Success Criteria:
{{successCriteria}}

{{edgeCases}}`
}

export function buildPromptTemplate(options: TemplateBuilderOptions): PromptTemplate {
  const { contextType, userIntent, responses, domainKnowledge, config } = options
  
  // Extract key information from responses
  const scope = responses.get('scope') || userIntent
  const constraints = extractConstraints(responses, contextType)
  const successCriteria = extractSuccessCriteria(responses, contextType)
  const outputFormat = extractOutputFormat(responses, contextType)
  
  // Build domain context from knowledge base
  const domainContext = buildDomainContext(responses, domainKnowledge, contextType)
  
  // Generate examples if requested
  const examples = config.includeExamples ? generateExamples(contextType, responses) : ''
  
  // Identify edge cases
  const edgeCases = identifyEdgeCases(contextType, responses)
  
  // Select and populate template
  const baseTemplate = CONTEXT_TEMPLATES[contextType]
  const promptText = populateTemplate(baseTemplate, {
    objective: formatObjective(scope, contextType),
    domainContext: domainContext.join('\n'),
    constraints: constraints.join('\n'),
    outputFormat,
    examples,
    successCriteria: successCriteria.join('\n'),
    edgeCases: edgeCases.length > 0 ? `\nEdge Cases to Consider:\n${edgeCases.join('\n')}` : ''
  })
  
  return {
    id: generateTemplateId(),
    name: `${contextType}-${Date.now()}`,
    contextType,
    objective: scope,
    constraints,
    domainContext,
    outputFormat,
    examples: examples ? [examples] : undefined,
    edgeCases,
    successCriteria,
    promptText,
    metadata: {
      created: new Date(),
      userIntent,
      adaptations: getAdaptations(responses)
    }
  }
}

function formatObjective(scope: string, contextType: ContextType): string {
  const prefixes: Record<ContextType, string> = {
    'code-generation': 'Implement',
    'data-analysis': 'Analyze',
    'documentation': 'Document',
    'process-automation': 'Automate',
    'testing': 'Test',
    'debugging': 'Debug and fix',
    'architecture': 'Design',
    'migration': 'Migrate',
    'integration': 'Integrate',
    'general': 'Complete'
  }
  
  return `${prefixes[contextType]} the following: ${scope}`
}

function extractConstraints(responses: Map<string, string>, contextType: ContextType): string[] {
  const constraints: string[] = []
  
  // Add user-specified constraints
  const userConstraints = responses.get('constraints')
  if (userConstraints) {
    constraints.push(`User Requirements: ${userConstraints}`)
  }
  
  // Add context-specific constraints
  switch (contextType) {
    case 'code-generation':
      if (responses.get('component-type')) {
        constraints.push(`Component Type: ${responses.get('component-type')}`)
      }
      if (responses.get('integration-points')) {
        constraints.push(`Must integrate with: ${responses.get('integration-points')}`)
      }
      break
      
    case 'data-analysis':
      if (responses.get('time-period')) {
        constraints.push(`Time Period: ${responses.get('time-period')}`)
      }
      if (responses.get('grouping')) {
        constraints.push(`Group data by: ${responses.get('grouping')}`)
      }
      break
      
    case 'process-automation':
      if (responses.get('trigger')) {
        constraints.push(`Triggered by: ${responses.get('trigger')}`)
      }
      if (responses.get('validation-rules')) {
        constraints.push(`Validation: ${responses.get('validation-rules')}`)
      }
      break
  }
  
  // Add CostTrak-specific constraints
  constraints.push('Must follow CostTrak coding standards and patterns')
  constraints.push('Ensure compatibility with existing Supabase RLS policies')
  
  return constraints
}

function extractSuccessCriteria(responses: Map<string, string>, contextType: ContextType): string[] {
  const criteria: string[] = []
  
  // Add user-specified success criteria
  const userCriteria = responses.get('success')
  if (userCriteria) {
    criteria.push(userCriteria)
  }
  
  // Add context-specific criteria
  switch (contextType) {
    case 'code-generation':
      criteria.push('Code compiles without TypeScript errors')
      criteria.push('All tests pass')
      criteria.push('Follows existing patterns and conventions')
      break
      
    case 'data-analysis':
      criteria.push('Analysis is accurate and verifiable')
      criteria.push('Results are presented clearly')
      criteria.push('Insights are actionable')
      break
      
    case 'testing':
      criteria.push('Tests cover all specified scenarios')
      criteria.push('Tests are maintainable and clear')
      criteria.push('Edge cases are handled')
      break
  }
  
  return criteria
}

function extractOutputFormat(responses: Map<string, string>, contextType: ContextType): string {
  const outputResponse = responses.get('output-format')
  if (outputResponse) {
    return `Deliver as: ${outputResponse}`
  }
  
  // Default formats by context
  const defaults: Record<ContextType, string> = {
    'code-generation': 'TypeScript code with proper types and error handling',
    'data-analysis': 'Clear visualizations or tables with insights',
    'documentation': 'Markdown format with proper structure',
    'process-automation': 'Step-by-step implementation with code',
    'testing': 'Test files using appropriate framework (Vitest/Playwright)',
    'debugging': 'Root cause analysis and solution code',
    'architecture': 'Technical design document with diagrams',
    'migration': 'Migration plan with scripts and validation steps',
    'integration': 'Integration code with configuration',
    'general': 'Appropriate format for the task'
  }
  
  return defaults[contextType]
}

function buildDomainContext(
  responses: Map<string, string>,
  domainKnowledge: any,
  contextType: ContextType
): string[] {
  const context: string[] = []
  
  // Add relevant tables if specified
  const dataSources = responses.get('data-source')
  if (dataSources) {
    context.push(`Working with tables: ${dataSources}`)
  }
  
  // Add tech stack context
  context.push('Tech Stack: Next.js 15, React 19, TypeScript, Supabase, Tailwind CSS')
  
  // Add business context
  context.push('Domain: Construction project financial tracking')
  context.push('Key entities: Projects, Budgets, Labor, Purchase Orders, Change Orders')
  
  // Add relevant business rules
  if (responses.get('integration-points')?.includes('Authentication')) {
    context.push('Authentication: Email must be @ics.ac domain')
  }
  
  return context
}

function generateExamples(contextType: ContextType, responses: Map<string, string>): string {
  // Generate relevant examples based on context and responses
  const examples: string[] = ['Examples:']
  
  switch (contextType) {
    case 'code-generation':
      examples.push('- Similar pattern: /api/projects/route.ts for API structure')
      examples.push('- Component example: /components/project/budget-breakdown-tab.tsx')
      break
      
    case 'data-analysis':
      examples.push('- Budget vs Actual comparison format')
      examples.push('- Weekly trend analysis structure')
      break
  }
  
  return examples.join('\n')
}

function identifyEdgeCases(contextType: ContextType, responses: Map<string, string>): string[] {
  const edgeCases: string[] = []
  
  // Common edge cases
  edgeCases.push('- Handle empty or null data gracefully')
  edgeCases.push('- Consider concurrent user actions')
  
  // Context-specific edge cases
  if (contextType === 'code-generation' || contextType === 'process-automation') {
    edgeCases.push('- Handle network failures and timeouts')
    edgeCases.push('- Validate all user inputs')
  }
  
  if (contextType === 'data-analysis') {
    edgeCases.push('- Account for incomplete data periods')
    edgeCases.push('- Handle division by zero in calculations')
  }
  
  return edgeCases
}

function populateTemplate(template: string, values: Record<string, string>): string {
  let result = template
  
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value)
  }
  
  // Clean up empty sections
  result = result.replace(/\n\n\n+/g, '\n\n')
  
  return result
}

function generateTemplateId(): string {
  return `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function getAdaptations(responses: Map<string, string>): string[] {
  const adaptations: string[] = []
  
  // Track what adaptations were made based on responses
  if (responses.get('component-type')) {
    adaptations.push(`Specialized for ${responses.get('component-type')} development`)
  }
  
  if (responses.get('data-source')) {
    adaptations.push(`Focused on ${responses.get('data-source')} data`)
  }
  
  if (responses.get('performance-metrics')) {
    adaptations.push('Added performance optimization focus')
  }
  
  return adaptations
}