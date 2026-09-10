# AI Planning Pipeline - Environment Configuration

## Feature Flags

### USE_ENHANCED_PIPELINE
- **Type**: Boolean (true/false)
- **Default**: false
- **Description**: Explicitly enable the enhanced multi-stage planning pipeline
- **Example**: `USE_ENHANCED_PIPELINE=true`

### ENHANCED_PIPELINE_ROLLOUT_PERCENT
- **Type**: Integer (0-100)
- **Default**: 0
- **Description**: Percentage of users to route to enhanced pipeline (gradual rollout)
- **Example**: `ENHANCED_PIPELINE_ROLLOUT_PERCENT=25` (25% of users)
- **Note**: Uses deterministic hashing for consistent user cohorts

## Model Configuration

### OPENROUTER_API_KEY
- **Type**: String
- **Required**: Yes
- **Description**: OpenRouter API key for AI model access

### PLANNER_MODEL
- **Type**: String
- **Default**: Falls back to OPENROUTER_MODEL
- **Description**: Model for primary planning stage
- **Example**: `PLANNER_MODEL=anthropic/claude-3.5-sonnet`

### RESEARCH_MODEL
- **Type**: String
- **Default**: Falls back to OPENROUTER_MODEL
- **Description**: Model for research/gap analysis stage
- **Example**: `RESEARCH_MODEL=anthropic/claude-3-haiku`

### CRITIC_MODEL
- **Type**: String
- **Default**: Falls back to OPENROUTER_MODEL
- **Description**: Model for independent critique stage
- **Example**: `CRITIC_MODEL=anthropic/claude-3-opus`

### REPAIR_MODEL
- **Type**: String
- **Default**: Falls back to OPENROUTER_MODEL
- **Description**: Model for specification repair stage
- **Example**: `REPAIR_MODEL=anthropic/claude-3.5-sonnet`

### OPENROUTER_MODEL
- **Type**: String
- **Description**: Fallback model for all stages if stage-specific not set
- **Example**: `OPENROUTER_MODEL=anthropic/claude-3.5-sonnet`

### Fallback Models
- **PLANNER_FALLBACK_MODEL**: Fallback for planner (optional)
- **RESEARCH_FALLBACK_MODEL**: Fallback for research (optional)
- **CRITIC_FALLBACK_MODEL**: Fallback for critic (optional)
- **REPAIR_FALLBACK_MODEL**: Fallback for repair (optional)

## Strategy Presets

### PLANNING_STRATEGY
- **Type**: String (cost_optimized | quality_optimized | speed_optimized)
- **Default**: None (manual configuration)
- **Description**: Pre-configured model selections for different priorities

#### cost_optimized
- Planner: anthropic/claude-3-haiku
- Research: anthropic/claude-3-haiku
- Critic: anthropic/claude-3-haiku
- Repair: anthropic/claude-3-haiku

#### quality_optimized
- Planner: anthropic/claude-3-opus
- Research: anthropic/claude-3.5-sonnet
- Critic: anthropic/claude-3-opus
- Repair: anthropic/claude-3.5-sonnet

#### speed_optimized
- Planner: anthropic/claude-3.5-sonnet
- Research: anthropic/claude-3-haiku
- Critic: anthropic/claude-3.5-sonnet
- Repair: anthropic/claude-3.5-sonnet

## Recommended Configurations

### Development
```
USE_ENHANCED_PIPELINE=false
ENHANCED_PIPELINE_ROLLOUT_PERCENT=0
PLANNING_STRATEGY=cost_optimized
```

### Staging
```
USE_ENHANCED_PIPELINE=false
ENHANCED_PIPELINE_ROLLOUT_PERCENT=10
PLANNING_STRATEGY=speed_optimized
```

### Production (Initial)
```
USE_ENHANCED_PIPELINE=false
ENHANCED_PIPELINE_ROLLOUT_PERCENT=5
PLANNER_MODEL=anthropic/claude-3.5-sonnet
RESEARCH_MODEL=anthropic/claude-3-haiku
CRITIC_MODEL=anthropic/claude-3.5-sonnet
REPAIR_MODEL=anthropic/claude-3.5-sonnet
```

### Production (Full Rollout)
```
USE_ENHANCED_PIPELINE=true
ENHANCED_PIPELINE_ROLLOUT_PERCENT=100
PLANNING_STRATEGY=quality_optimized
```

## Credits

- **PLAN_COST**: 10 credits (standard planning)
- **DEEP_CRAWL_COST**: 20 credits (deep website cloning)

## Monitoring

Health check endpoint: `GET /api/health/planning`

Returns:
- Database connectivity status
- Model configuration status
- Environment variable status
- Pipeline status
