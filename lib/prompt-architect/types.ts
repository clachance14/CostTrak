export interface PromptArchitectConfig {
  maxQuestions: number
  includeExamples: boolean
  adaptiveFlow: boolean
  outputFormat?: 'markdown' | 'json' | 'text'
}

export type ContextType = 
  | 'code-generation'
  | 'data-analysis'
  | 'documentation'
  | 'process-automation'
  | 'testing'
  | 'debugging'
  | 'architecture'
  | 'migration'
  | 'integration'
  | 'general'

export interface Question {
  id: string
  prompt: string
  type: 'text' | 'choice' | 'multiselect' | 'boolean'
  options?: string[]
  followUp?: Record<string, Question[]>
  required: boolean
  helpText?: string
}

export interface QuestionFlow {
  contextType: ContextType
  questions: Question[]
}

export interface PromptTemplate {
  id: string
  name: string
  contextType: ContextType
  objective: string
  constraints: string[]
  domainContext: string[]
  outputFormat: string
  examples?: string[]
  edgeCases?: string[]
  successCriteria: string[]
  promptText: string
  metadata: {
    created: Date
    userIntent: string
    adaptations: string[]
  }
}

export interface DomainKnowledge {
  tables: TableInfo[]
  businessRules: BusinessRule[]
  techStack: TechStackItem[]
  codePatterns: CodePattern[]
  commonTasks: TaskTemplate[]
}

export interface TableInfo {
  name: string
  description: string
  keyColumns: string[]
  relationships: string[]
  businessPurpose: string
}

export interface BusinessRule {
  name: string
  description: string
  implementation: string
  exceptions?: string[]
}

export interface TechStackItem {
  category: string
  technology: string
  version: string
  usage: string
  constraints?: string[]
}

export interface CodePattern {
  name: string
  description: string
  useCase: string
  example: string
  antipatterns?: string[]
}

export interface TaskTemplate {
  name: string
  category: ContextType
  description: string
  typicalQuestions: string[]
  outputExample?: string
}

export interface ContextAnalysis {
  type: ContextType
  confidence: number
  detectedKeywords: string[]
  suggestedDomain: string
  relatedTables?: string[]
  relatedFeatures?: string[]
}

export interface TemplateBuilderOptions {
  contextType: ContextType
  userIntent: string
  responses: Map<string, string>
  domainKnowledge: DomainKnowledge
  config: PromptArchitectConfig
}