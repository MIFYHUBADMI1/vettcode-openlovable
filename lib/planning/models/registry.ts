/**
 * ModelRegistry - Manages AI model selection, fallback strategies, and configuration
 * 
 * All models are configured via environment variables. No hardcoded model names.
 * 
 * Environment Variables:
 * - IDEA_UNDERSTANDING_MODEL: Model for idea understanding stage
 * - IDEA_UNDERSTANDING_FALLBACK_MODEL: Fallback for idea understanding
 * - RESEARCH_MODEL: Model for research stage
 * - RESEARCH_FALLBACK_MODEL: Fallback for research
 * - PLANNER_MODEL: Model for planning stage
 * - PLANNER_FALLBACK_MODEL: Fallback for planning
 * - CRITIC_MODEL: Model for critique stage
 * - CRITIC_FALLBACK_MODEL: Fallback for critique
 * - REPAIR_MODEL: Model for repair stage
 * - REPAIR_FALLBACK_MODEL: Fallback for repair
 * - OPENROUTER_MODEL: Default model for all stages (if stage-specific not set)
 * - OPENROUTER_FREE_MODEL: Free tier fallback
 */

/**
 * Pipeline stages that require AI model configuration
 */
export type PipelineStage = 
  | 'idea_understanding'
  | 'research'
  | 'planning'
  | 'critique'
  | 'repair'

/**
 * Configuration for a single AI model including fallbacks and parameters
 */
export interface ModelConfig {
  /** Primary model identifier (e.g., "nvidia/nemotron-3-super-120b-a12b:free") */
  primary: string
  /** Array of fallback model identifiers to try if primary fails */
  fallbacks: string[]
  /** Maximum tokens for generation */
  maxTokens: number
  /** Temperature for generation (0.0 to 1.0) */
  temperature: number
}

/**
 * Complete configuration for all pipeline stages
 */
export interface ModelConfiguration {
  /** Model config for idea understanding stage */
  ideaUnderstanding: ModelConfig
  /** Model config for research agent stage */
  researchAgent: ModelConfig
  /** Model config for primary planner stage */
  primaryPlanner: ModelConfig
  /** Model config for independent critic stage */
  critic: ModelConfig
  /** Model config for repair service stage */
  repairService: ModelConfig
}

/**
 * Default configuration - uses openrouter/auto as ultimate fallback
 */
const DEFAULT_CONFIG: ModelConfiguration = {
  ideaUnderstanding: {
    primary: 'openrouter/auto',
    fallbacks: [],
    maxTokens: 4000,
    temperature: 0.7,
  },
  researchAgent: {
    primary: 'openrouter/auto',
    fallbacks: [],
    maxTokens: 4000,
    temperature: 0.7,
  },
  primaryPlanner: {
    primary: 'openrouter/auto',
    fallbacks: [],
    maxTokens: 8000,
    temperature: 0.7,
  },
  critic: {
    primary: 'openrouter/auto',
    fallbacks: [],
    maxTokens: 4000,
    temperature: 0.3,
  },
  repairService: {
    primary: 'openrouter/auto',
    fallbacks: [],
    maxTokens: 8000,
    temperature: 0.5,
  },
}

/**
 * ModelRegistry manages AI model configuration and selection for all pipeline stages
 */
export class ModelRegistry {
  private config: ModelConfiguration

  constructor() {
    this.config = this.loadConfigFromEnv()
  }

  /**
   * Get the model configuration for a specific pipeline stage
   * 
   * @param stage - The pipeline stage to get configuration for
   * @returns ModelConfig containing primary model, fallbacks, and parameters
   */
  getModelForStage(stage: PipelineStage): ModelConfig {
    switch (stage) {
      case 'idea_understanding':
        return this.config.ideaUnderstanding
      case 'research':
        return this.config.researchAgent
      case 'planning':
        return this.config.primaryPlanner
      case 'critique':
        return this.config.critic
      case 'repair':
        return this.config.repairService
      default:
        console.warn(`[ModelRegistry] Unknown stage: ${stage}, using default config`)
        return DEFAULT_CONFIG.primaryPlanner
    }
  }

  /**
   * Get the fallback model for a stage after the specified attempt number
   * 
   * @param stage - The pipeline stage
   * @param attempt - The attempt number (0 = primary, 1 = first fallback, etc.)
   * @returns ModelConfig for the fallback, or null if no more fallbacks available
   */
  getFallbackModel(stage: PipelineStage, attempt: number): ModelConfig | null {
    const stageConfig = this.getModelForStage(stage)
    
    const fallbackIndex = attempt - 1
    
    if (fallbackIndex < 0 || fallbackIndex >= stageConfig.fallbacks.length) {
      return null
    }

    return {
      primary: stageConfig.fallbacks[fallbackIndex],
      fallbacks: stageConfig.fallbacks.slice(fallbackIndex + 1),
      maxTokens: stageConfig.maxTokens,
      temperature: stageConfig.temperature,
    }
  }

  /**
   * Load configuration from environment variables.
   *
   * Priority:
   *   1. Stage-specific env var  (e.g. PLANNER_MODEL)
   *   2. Global OPENROUTER_MODEL
   *   3. Global OPENROUTER_FREE_MODEL
   *   4. Default: "openrouter/auto"
   */
  private loadConfigFromEnv(): ModelConfiguration {
    // Get global fallback models
    const globalModel = process.env.OPENROUTER_MODEL || process.env.OPENROUTER_FREE_MODEL || 'openrouter/auto'
    const globalFallback = process.env.OPENROUTER_FREE_MODEL || 'openrouter/auto'

    // Helper: validate and clean model name
    const resolveModel = (model: string | undefined, envVarName: string, fallback: string): string => {
      if (!model || !model.trim()) {
        return fallback
      }
      return model.trim()
    }

    // Helper: build fallback array
    const buildFallbacks = (fallbackModel: string | undefined): string[] => {
      const fallbacks: string[] = []
      if (fallbackModel && fallbackModel.trim()) {
        fallbacks.push(fallbackModel.trim())
      }
      if (globalFallback && !fallbacks.includes(globalFallback)) {
        fallbacks.push(globalFallback)
      }
      if (!fallbacks.includes('openrouter/auto')) {
        fallbacks.push('openrouter/auto')
      }
      return fallbacks
    }

    const config: ModelConfiguration = {
      ideaUnderstanding: {
        primary: resolveModel(process.env.IDEA_UNDERSTANDING_MODEL, 'IDEA_UNDERSTANDING_MODEL', globalModel),
        fallbacks: buildFallbacks(process.env.IDEA_UNDERSTANDING_FALLBACK_MODEL),
        maxTokens: 4000,
        temperature: 0.7,
      },
      researchAgent: {
        primary: resolveModel(process.env.RESEARCH_MODEL, 'RESEARCH_MODEL', globalModel),
        fallbacks: buildFallbacks(process.env.RESEARCH_FALLBACK_MODEL),
        maxTokens: 4000,
        temperature: 0.7,
      },
      primaryPlanner: {
        primary: resolveModel(process.env.PLANNER_MODEL, 'PLANNER_MODEL', globalModel),
        fallbacks: buildFallbacks(process.env.PLANNER_FALLBACK_MODEL),
        maxTokens: 8000,
        temperature: 0.7,
      },
      critic: {
        primary: resolveModel(process.env.CRITIC_MODEL, 'CRITIC_MODEL', globalModel),
        fallbacks: buildFallbacks(process.env.CRITIC_FALLBACK_MODEL),
        maxTokens: 4000,
        temperature: 0.3,
      },
      repairService: {
        primary: resolveModel(process.env.REPAIR_MODEL, 'REPAIR_MODEL', globalModel),
        fallbacks: buildFallbacks(process.env.REPAIR_FALLBACK_MODEL),
        maxTokens: 8000,
        temperature: 0.5,
      },
    }

    return config
  }

  /**
   * Log current configuration (useful for debugging)
   */
  logConfiguration(): void {
    console.log('[ModelRegistry] Current configuration:')
    console.log(`  Idea Understanding: ${this.config.ideaUnderstanding.primary} (fallbacks: ${this.config.ideaUnderstanding.fallbacks.join(', ')})`)
    console.log(`  Research Agent: ${this.config.researchAgent.primary} (fallbacks: ${this.config.researchAgent.fallbacks.join(', ')})`)
    console.log(`  Primary Planner: ${this.config.primaryPlanner.primary} (fallbacks: ${this.config.primaryPlanner.fallbacks.join(', ')})`)
    console.log(`  Critic: ${this.config.critic.primary} (fallbacks: ${this.config.critic.fallbacks.join(', ')})`)
    console.log(`  Repair Service: ${this.config.repairService.primary} (fallbacks: ${this.config.repairService.fallbacks.join(', ')})`)
  }
}
