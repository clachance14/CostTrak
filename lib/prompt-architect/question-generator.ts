import { ContextType, Question, QuestionFlow, DomainKnowledge } from './types'

interface QuestionGeneratorOptions {
  context: string
  contextType: ContextType
  domainKnowledge: DomainKnowledge
  maxQuestions: number
}

// Base questions for all context types
const BASE_QUESTIONS: Record<string, Question> = {
  scope: {
    id: 'scope',
    prompt: 'What is the specific scope of this task?',
    type: 'text',
    required: true,
    helpText: 'Be as specific as possible about what needs to be accomplished'
  },
  constraints: {
    id: 'constraints',
    prompt: 'Are there any specific constraints or requirements?',
    type: 'text',
    required: false,
    helpText: 'E.g., performance requirements, compatibility, deadlines'
  },
  successCriteria: {
    id: 'success',
    prompt: 'How will you know when this task is successfully completed?',
    type: 'text',
    required: true,
    helpText: 'Define clear, measurable success criteria'
  }
}

// Context-specific question templates
const CONTEXT_QUESTIONS: Record<ContextType, Question[]> = {
  'code-generation': [
    {
      id: 'component-type',
      prompt: 'What type of component are you building?',
      type: 'choice',
      options: ['API Route', 'React Component', 'Database Service', 'Utility Function', 'Hook', 'Middleware'],
      required: true
    },
    {
      id: 'integration-points',
      prompt: 'Which existing CostTrak features/tables will this integrate with?',
      type: 'multiselect',
      options: ['Projects', 'Budget/Line Items', 'Labor/Employees', 'Purchase Orders', 'Change Orders', 'Authentication', 'Import/Export'],
      required: true
    },
    {
      id: 'error-handling',
      prompt: 'What error scenarios should be handled?',
      type: 'text',
      required: true,
      helpText: 'List potential failure modes and how they should be handled'
    },
    {
      id: 'testing-approach',
      prompt: 'Should I include tests? If so, what type?',
      type: 'choice',
      options: ['Unit tests only', 'Integration tests', 'E2E tests', 'All types', 'No tests needed'],
      required: false
    }
  ],
  
  'data-analysis': [
    {
      id: 'data-source',
      prompt: 'Which data sources/tables will you need?',
      type: 'multiselect',
      options: ['projects', 'budget_line_items', 'purchase_orders', 'po_line_items', 'labor_employee_actuals', 'change_orders', 'employees', 'craft_types'],
      required: true
    },
    {
      id: 'time-period',
      prompt: 'What time period should the analysis cover?',
      type: 'choice',
      options: ['Current week', 'Current month', 'Current quarter', 'Year to date', 'All time', 'Custom range'],
      required: true
    },
    {
      id: 'grouping',
      prompt: 'How should the data be grouped/aggregated?',
      type: 'text',
      required: true,
      helpText: 'E.g., by project, by week, by cost code, by employee'
    },
    {
      id: 'output-format',
      prompt: 'What format should the output be in?',
      type: 'choice',
      options: ['Chart/Visualization', 'Table/Grid', 'CSV Export', 'PDF Report', 'Dashboard Widget'],
      required: true
    }
  ],
  
  'documentation': [
    {
      id: 'audience',
      prompt: 'Who is the target audience?',
      type: 'choice',
      options: ['Developers', 'End Users', 'Project Managers', 'System Administrators', 'Stakeholders'],
      required: true
    },
    {
      id: 'doc-type',
      prompt: 'What type of documentation?',
      type: 'choice',
      options: ['API Reference', 'User Guide', 'Technical Specification', 'Architecture Overview', 'Troubleshooting Guide'],
      required: true
    },
    {
      id: 'detail-level',
      prompt: 'What level of detail is needed?',
      type: 'choice',
      options: ['High-level overview', 'Detailed with examples', 'Step-by-step tutorial', 'Quick reference'],
      required: true
    }
  ],
  
  'process-automation': [
    {
      id: 'trigger',
      prompt: 'What triggers this automation?',
      type: 'choice',
      options: ['Manual trigger', 'Scheduled (cron)', 'File upload', 'API call', 'Database change', 'User action'],
      required: true
    },
    {
      id: 'data-flow',
      prompt: 'Describe the data flow from source to destination',
      type: 'text',
      required: true,
      helpText: 'E.g., Excel file → validation → database tables → notifications'
    },
    {
      id: 'validation-rules',
      prompt: 'What validation rules should be applied?',
      type: 'text',
      required: true,
      helpText: 'List specific business rules and data quality checks'
    },
    {
      id: 'error-recovery',
      prompt: 'How should errors be handled and recovered?',
      type: 'text',
      required: true
    }
  ],
  
  'testing': [
    {
      id: 'test-type',
      prompt: 'What type of testing is needed?',
      type: 'multiselect',
      options: ['Unit Tests', 'Integration Tests', 'E2E Tests', 'Performance Tests', 'Security Tests'],
      required: true
    },
    {
      id: 'coverage-target',
      prompt: 'What code/features need test coverage?',
      type: 'text',
      required: true,
      helpText: 'Specify files, functions, or user flows to test'
    },
    {
      id: 'test-data',
      prompt: 'What test data scenarios should be included?',
      type: 'text',
      required: true,
      helpText: 'E.g., happy path, edge cases, error conditions'
    }
  ],
  
  'debugging': [
    {
      id: 'error-description',
      prompt: 'Describe the error or unexpected behavior',
      type: 'text',
      required: true
    },
    {
      id: 'reproduction-steps',
      prompt: 'What are the steps to reproduce the issue?',
      type: 'text',
      required: true
    },
    {
      id: 'expected-behavior',
      prompt: 'What is the expected behavior?',
      type: 'text',
      required: true
    },
    {
      id: 'attempted-fixes',
      prompt: 'What solutions have you already tried?',
      type: 'text',
      required: false
    }
  ],
  
  'architecture': [
    {
      id: 'current-state',
      prompt: 'Describe the current architecture/implementation',
      type: 'text',
      required: true
    },
    {
      id: 'desired-state',
      prompt: 'What is the desired end state?',
      type: 'text',
      required: true
    },
    {
      id: 'migration-strategy',
      prompt: 'Can this be done incrementally or does it need a big-bang approach?',
      type: 'choice',
      options: ['Incremental migration', 'Big-bang replacement', 'Parallel run', 'Feature flag rollout'],
      required: true
    },
    {
      id: 'risk-areas',
      prompt: 'What are the main risks or challenges?',
      type: 'text',
      required: true
    }
  ],
  
  'migration': [
    {
      id: 'source-system',
      prompt: 'What is the source system/format?',
      type: 'text',
      required: true
    },
    {
      id: 'target-system',
      prompt: 'What is the target system/format?',
      type: 'text',
      required: true
    },
    {
      id: 'data-volume',
      prompt: 'What is the approximate data volume?',
      type: 'choice',
      options: ['< 1000 records', '1K-10K records', '10K-100K records', '> 100K records'],
      required: true
    },
    {
      id: 'rollback-plan',
      prompt: 'What is the rollback strategy if something goes wrong?',
      type: 'text',
      required: true
    }
  ],
  
  'integration': [
    {
      id: 'external-system',
      prompt: 'What external system are you integrating with?',
      type: 'text',
      required: true
    },
    {
      id: 'integration-method',
      prompt: 'What integration method will be used?',
      type: 'choice',
      options: ['REST API', 'GraphQL', 'Webhook', 'File Exchange', 'Database Link', 'Message Queue'],
      required: true
    },
    {
      id: 'data-sync',
      prompt: 'Is this real-time or batch synchronization?',
      type: 'choice',
      options: ['Real-time', 'Near real-time', 'Batch (scheduled)', 'On-demand'],
      required: true
    },
    {
      id: 'auth-method',
      prompt: 'What authentication method does the external system use?',
      type: 'choice',
      options: ['API Key', 'OAuth 2.0', 'Basic Auth', 'JWT', 'Custom Token', 'None'],
      required: true
    }
  ],
  
  'general': [
    {
      id: 'task-category',
      prompt: 'Which category best describes your task?',
      type: 'choice',
      options: ['Building something new', 'Fixing/debugging', 'Analyzing data', 'Documenting', 'Automating', 'Other'],
      required: true
    }
  ]
}

export function generateQuestions(options: QuestionGeneratorOptions): QuestionFlow {
  const { context, contextType, maxQuestions } = options
  const questions: Question[] = []
  
  // Start with context-specific questions
  const contextQuestions = CONTEXT_QUESTIONS[contextType] || CONTEXT_QUESTIONS.general
  questions.push(...contextQuestions)
  
  // Add base questions that apply to all contexts
  questions.push(BASE_QUESTIONS.scope)
  
  // Add adaptive questions based on the context content
  const adaptiveQuestions = generateAdaptiveQuestions(context, contextType, options.domainKnowledge)
  questions.push(...adaptiveQuestions)
  
  // Add success criteria if not already included
  if (!questions.find(q => q.id === 'success')) {
    questions.push(BASE_QUESTIONS.successCriteria)
  }
  
  // Add constraints question if room and not already included
  if (questions.length < maxQuestions && !questions.find(q => q.id === 'constraints')) {
    questions.push(BASE_QUESTIONS.constraints)
  }
  
  // Limit to maxQuestions
  const finalQuestions = questions.slice(0, maxQuestions)
  
  return {
    contextType,
    questions: finalQuestions
  }
}

function generateAdaptiveQuestions(
  context: string, 
  contextType: ContextType,
  domainKnowledge: DomainKnowledge
): Question[] {
  const adaptiveQuestions: Question[] = []
  const lowerContext = context.toLowerCase()
  
  // Add questions based on detected keywords in the context
  if (lowerContext.includes('import') || lowerContext.includes('upload')) {
    adaptiveQuestions.push({
      id: 'import-format',
      prompt: 'What file format will be imported?',
      type: 'choice',
      options: ['Excel (.xlsx)', 'CSV', 'JSON', 'XML', 'Other'],
      required: true
    })
  }
  
  if (lowerContext.includes('performance') || lowerContext.includes('optimize')) {
    adaptiveQuestions.push({
      id: 'performance-metrics',
      prompt: 'What performance metrics are you optimizing for?',
      type: 'multiselect',
      options: ['Response time', 'Database queries', 'Memory usage', 'Bundle size', 'Render performance'],
      required: true
    })
  }
  
  if (lowerContext.includes('security') || lowerContext.includes('auth')) {
    adaptiveQuestions.push({
      id: 'security-requirements',
      prompt: 'What security considerations should be addressed?',
      type: 'multiselect',
      options: ['Authentication', 'Authorization (RLS)', 'Data encryption', 'Input validation', 'Audit logging'],
      required: true
    })
  }
  
  if (lowerContext.includes('ui') || lowerContext.includes('component') || lowerContext.includes('page')) {
    adaptiveQuestions.push({
      id: 'ui-requirements',
      prompt: 'What UI/UX requirements should be considered?',
      type: 'multiselect',
      options: ['Responsive design', 'Accessibility', 'Loading states', 'Error handling', 'Animations', 'Dark mode'],
      required: false
    })
  }
  
  return adaptiveQuestions
}

// Helper function to create follow-up questions based on responses
export function generateFollowUpQuestions(
  questionId: string,
  response: string,
  contextType: ContextType
): Question[] {
  const followUps: Question[] = []
  
  // Example follow-up logic
  if (questionId === 'component-type' && response === 'API Route') {
    followUps.push({
      id: 'http-methods',
      prompt: 'Which HTTP methods will this API support?',
      type: 'multiselect',
      options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      required: true
    })
  }
  
  if (questionId === 'time-period' && response === 'Custom range') {
    followUps.push({
      id: 'date-range',
      prompt: 'Specify the custom date range',
      type: 'text',
      required: true,
      helpText: 'E.g., "Last 30 days", "Q1 2024", "Jan 1 - Mar 31"'
    })
  }
  
  return followUps
}