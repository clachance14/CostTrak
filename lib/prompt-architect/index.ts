import { PromptArchitectConfig, ContextType, QuestionFlow, PromptTemplate } from './types'
import { analyzeContext } from './context-analyzer'
import { generateQuestions } from './question-generator'
import { buildPromptTemplate } from './template-builder'
import { COSTTRAK_KNOWLEDGE } from './domain-knowledge'

export class PromptArchitect {
  private config: PromptArchitectConfig
  private contextType: ContextType | null = null
  private userResponses: Map<string, string> = new Map()

  constructor(config: Partial<PromptArchitectConfig> = {}) {
    this.config = {
      maxQuestions: 5,
      includeExamples: true,
      adaptiveFlow: true,
      ...config
    }
  }

  /**
   * Main entry point for the prompt architect command
   * @param initialContext The user's initial command input after /prompt-architect
   */
  async execute(initialContext: string): Promise<PromptTemplate> {
    // Step 1: Analyze the initial context
    this.contextType = analyzeContext(initialContext)
    
    // Step 2: Generate adaptive questions based on context
    const questions = await this.getAdaptiveQuestions(initialContext)
    
    // Step 3: Collect user responses (this would be interactive in practice)
    const responses = await this.collectResponses(questions)
    
    // Step 4: Build the optimized prompt template
    const template = buildPromptTemplate({
      contextType: this.contextType,
      userIntent: initialContext,
      responses,
      domainKnowledge: COSTTRAK_KNOWLEDGE,
      config: this.config
    })
    
    return template
  }

  private async getAdaptiveQuestions(context: string): Promise<QuestionFlow> {
    return generateQuestions({
      context,
      contextType: this.contextType!,
      domainKnowledge: COSTTRAK_KNOWLEDGE,
      maxQuestions: this.config.maxQuestions
    })
  }

  private async collectResponses(questions: QuestionFlow): Promise<Map<string, string>> {
    // In a real implementation, this would be interactive
    // For now, we'll return the structure for the responses
    const responses = new Map<string, string>()
    
    for (const question of questions.questions) {
      // This would actually prompt the user and wait for response
      console.log(`Question: ${question.prompt}`)
      if (question.options) {
        console.log(`Options: ${question.options.join(', ')}`)
      }
      // Store placeholder response
      responses.set(question.id, '')
    }
    
    return responses
  }

  /**
   * Utility method to test prompt generation with predefined responses
   */
  generatePromptWithResponses(
    context: string, 
    responses: Record<string, string>
  ): PromptTemplate {
    this.contextType = analyzeContext(context)
    const responseMap = new Map(Object.entries(responses))
    
    return buildPromptTemplate({
      contextType: this.contextType,
      userIntent: context,
      responses: responseMap,
      domainKnowledge: COSTTRAK_KNOWLEDGE,
      config: this.config
    })
  }
}

// Export convenience function for CLI usage
export async function promptArchitect(initialContext: string): Promise<PromptTemplate> {
  const architect = new PromptArchitect()
  return architect.execute(initialContext)
}