import { ContextType, ContextAnalysis } from './types'

// CostTrak-specific keyword mappings
const CONTEXT_KEYWORDS: Record<ContextType, string[]> = {
  'code-generation': [
    'create', 'build', 'implement', 'add', 'component', 'function', 'api',
    'route', 'endpoint', 'feature', 'service', 'hook', 'utility', 'interface'
  ],
  'data-analysis': [
    'analyze', 'report', 'calculate', 'compare', 'budget', 'actual', 'variance',
    'trend', 'forecast', 'metrics', 'dashboard', 'chart', 'visualization'
  ],
  'documentation': [
    'document', 'explain', 'describe', 'guide', 'readme', 'api doc',
    'user manual', 'specification', 'requirements', 'architecture'
  ],
  'process-automation': [
    'automate', 'workflow', 'import', 'export', 'batch', 'schedule',
    'integration', 'sync', 'migration', 'etl', 'pipeline'
  ],
  'testing': [
    'test', 'validate', 'verify', 'check', 'assert', 'mock', 'stub',
    'e2e', 'unit test', 'integration test', 'coverage', 'spec'
  ],
  'debugging': [
    'debug', 'fix', 'error', 'bug', 'issue', 'problem', 'troubleshoot',
    'investigate', 'trace', 'log', 'exception', 'failure'
  ],
  'architecture': [
    'design', 'architect', 'structure', 'pattern', 'refactor', 'optimize',
    'scale', 'performance', 'security', 'database schema'
  ],
  'migration': [
    'migrate', 'upgrade', 'convert', 'transform', 'port', 'update schema',
    'database migration', 'version upgrade', 'legacy'
  ],
  'integration': [
    'integrate', 'connect', 'api integration', 'webhook', 'third-party',
    'external service', 'oauth', 'authentication', 'supabase'
  ],
  'general': [] // Fallback category
}

// CostTrak domain-specific keywords
const DOMAIN_KEYWORDS = {
  budget: ['budget', 'cost code', 'wbs', 'line item', 'original contract'],
  labor: ['labor', 'employee', 'craft', 'timecard', 'headcount', 'direct', 'indirect'],
  purchaseOrder: ['purchase order', 'po', 'vendor', 'commitment', 'line item'],
  changeOrder: ['change order', 'co', 'contract modification', 'revised contract'],
  project: ['project', 'job', 'division', 'project manager'],
  import: ['import', 'upload', 'excel', 'csv', 'data entry'],
  financial: ['financial', 'cost', 'actual', 'forecast', 'burn rate', 'remaining']
}

// CostTrak table associations
const TABLE_ASSOCIATIONS: Record<string, string[]> = {
  budget: ['budget_line_items', 'projects'],
  labor: ['labor_employee_actuals', 'employees', 'craft_types', 'labor_headcount_forecasts'],
  purchaseOrder: ['purchase_orders', 'po_line_items'],
  changeOrder: ['change_orders'],
  project: ['projects', 'profiles'],
  import: ['data_imports'],
  financial: ['budget_line_items', 'purchase_orders', 'labor_employee_actuals']
}

export function analyzeContext(input: string): ContextType {
  const analysis = performContextAnalysis(input)
  return analysis.type
}

export function performContextAnalysis(input: string): ContextAnalysis {
  const lowerInput = input.toLowerCase()
  const detectedKeywords: string[] = []
  const contextScores: Record<ContextType, number> = {} as Record<ContextType, number>
  
  // Initialize scores
  Object.keys(CONTEXT_KEYWORDS).forEach(key => {
    contextScores[key as ContextType] = 0
  })
  
  // Score based on context keywords
  for (const [context, keywords] of Object.entries(CONTEXT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerInput.includes(keyword)) {
        contextScores[context as ContextType] += 2
        detectedKeywords.push(keyword)
      }
    }
  }
  
  // Boost scores based on domain keywords
  let suggestedDomain = ''
  let relatedTables: string[] = []
  
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerInput.includes(keyword)) {
        suggestedDomain = domain
        relatedTables = TABLE_ASSOCIATIONS[domain] || []
        detectedKeywords.push(keyword)
        
        // Boost relevant context types based on domain
        if (domain === 'import') {
          contextScores['process-automation'] += 3
        } else if (['budget', 'labor', 'purchaseOrder', 'financial'].includes(domain)) {
          contextScores['data-analysis'] += 2
        }
      }
    }
  }
  
  // Find the context with highest score
  let bestContext: ContextType = 'general'
  let highestScore = 0
  
  for (const [context, score] of Object.entries(contextScores)) {
    if (score > highestScore) {
      highestScore = score
      bestContext = context as ContextType
    }
  }
  
  // Calculate confidence based on score distribution
  const totalScore = Object.values(contextScores).reduce((a, b) => a + b, 0)
  const confidence = totalScore > 0 ? (highestScore / totalScore) : 0
  
  // Extract related features based on keywords
  const relatedFeatures = extractRelatedFeatures(lowerInput)
  
  return {
    type: bestContext,
    confidence,
    detectedKeywords: [...new Set(detectedKeywords)],
    suggestedDomain,
    relatedTables,
    relatedFeatures
  }
}

function extractRelatedFeatures(input: string): string[] {
  const features: string[] = []
  
  const featureMap = {
    'import': ['Excel Import', 'Data Validation', 'Import History'],
    'report': ['Dashboard', 'Analytics', 'Export'],
    'api': ['REST API', 'Authentication', 'Error Handling'],
    'component': ['React Component', 'UI/UX', 'State Management'],
    'validation': ['Form Validation', 'Business Rules', 'Error Messages'],
    'calculation': ['Financial Calculations', 'Formulas', 'Aggregation']
  }
  
  for (const [keyword, relatedFeatures] of Object.entries(featureMap)) {
    if (input.includes(keyword)) {
      features.push(...relatedFeatures)
    }
  }
  
  return [...new Set(features)]
}

// Utility function to get detailed context analysis (for debugging/testing)
export function getDetailedAnalysis(input: string): {
  analysis: ContextAnalysis
  allScores: Record<ContextType, number>
  explanation: string
} {
  const analysis = performContextAnalysis(input)
  const lowerInput = input.toLowerCase()
  const contextScores: Record<ContextType, number> = {} as Record<ContextType, number>
  
  // Recalculate scores for detailed view
  Object.keys(CONTEXT_KEYWORDS).forEach(key => {
    contextScores[key as ContextType] = 0
  })
  
  for (const [context, keywords] of Object.entries(CONTEXT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerInput.includes(keyword)) {
        contextScores[context as ContextType] += 2
      }
    }
  }
  
  const explanation = `
Detected context type: ${analysis.type} (confidence: ${(analysis.confidence * 100).toFixed(1)}%)
Keywords found: ${analysis.detectedKeywords.join(', ')}
Suggested domain: ${analysis.suggestedDomain || 'None'}
Related tables: ${analysis.relatedTables?.join(', ') || 'None'}
Related features: ${analysis.relatedFeatures?.join(', ') || 'None'}
  `.trim()
  
  return {
    analysis,
    allScores: contextScores,
    explanation
  }
}