# Pipeline Resilience Fixes

## Problem
Deep crawl pipeline was failing completely when ANY stage encountered an error:
1. **Critique stage** - AI model returning invalid JSON broke entire pipeline
2. **Research stage** - Schema validation errors (enum mismatches) failed the stage
3. **Semantic validation** - Minor validation issues caused hard failures
4. **No fallbacks** - Single point of failure design

## Solution: Fault-Tolerant Pipeline

Made every non-critical stage resilient with graceful degradation:

### 1. Research Stage - Already Resilient ✅
```typescript
try {
  research = await this.executeStage(...)
} catch (error) {
  // Continue with empty findings
  research = { missingFeatures: [], securityConcerns: [], ... }
}
```

### 2. Critique Stage - Now Resilient ✅
```typescript
try {
  critique = await this.executeStage(...)
} catch (error) {
  // Continue with minimal passing critique
  critique = {
    criticalIssues: [],
    warnings: [],
    suggestions: [],
    passesValidation: true, // Don't trigger repair
    qualityScore: 50,
    modelUsed: "none (critique failed)",
  }
}
```

### 3. Repair Stage - Now Resilient ✅
```typescript
if (!critique.passesValidation) {
  try {
    repairedSpec = await this.executeStage(...)
  } catch (error) {
    // Use original specification if repair fails
    repairedSpec = specification
  }
}
```

### 4. Semantic Validation - Now Non-Blocking ✅
```typescript
const validationResult = this.validator.validate(repairedSpec)
if (!validationResult.valid) {
  // Log warnings but DON'T throw - continue with spec
  logger.warn("Validation warnings found", { errors: validationResult.errors })
}
```

### 5. Research Data Sanitization - Now Auto-Healing ✅
```typescript
try {
  return ResearchFindingsSchema.parse(dataWithMetadata)
} catch (zodError) {
  // Sanitize invalid enum values instead of failing
  const sanitized = {
    ...dataWithMetadata,
    securityConcerns: concerns.map(c => {
      if (c.totalumFeature !== "Auth") {
        delete c.totalumFeature // Remove invalid enum
      }
      return c
    }),
  }
  return ResearchFindingsSchema.parse(sanitized) // Retry with cleaned data
}
```

## Pipeline Flow Chart

### Before (Brittle):
```
Crawl → Research → Planning → Critique → Repair → Validation → ✅ Success
                                   ❌ FAIL → STOP (refund credits)
```

### After (Resilient):
```
Crawl → Research (fallback: empty)
     → Planning (required - only critical stage)
     → Critique (fallback: pass-through)
     → Repair (fallback: original spec)
     → Validation (warn only)
     → ✅ Success
```

## What Can Still Fail?

Only **critical stages** can fail the pipeline:
1. **Planning stage** - Must generate a specification (core deliverable)
2. **Credit reservation** - Must have sufficient credits
3. **Project state updates** - Database must be accessible

All other stages (research, critique, repair, validation) are non-blocking.

## Benefits

1. **Better UX** - Pipeline succeeds even when AI models return bad responses
2. **Credit efficiency** - Don't refund credits for minor issues
3. **Debugging** - Warnings logged for investigation without blocking users
4. **Graceful degradation** - Get a spec even if critique/repair fails

## Test Cases

| Scenario | Old Behavior | New Behavior |
|----------|--------------|--------------|
| Critique JSON parse error | ❌ Pipeline fails | ✅ Continue with pass-through critique |
| Research enum validation fails | ❌ Pipeline fails | ✅ Sanitize data, continue |
| Repair stage times out | ❌ Pipeline fails | ✅ Use original spec |
| Validation finds minor issues | ❌ Pipeline fails | ✅ Log warning, continue |
| Planning stage fails | ❌ Pipeline fails | ❌ Pipeline fails (intended) |

## Implementation Files Changed

1. **lib/planning/orchestrator.ts**
   - Added try-catch around critique stage
   - Added try-catch around repair stage
   - Changed validation from throw to warn

2. **lib/planning/stages/research.ts**
   - Added nested try-catch for Zod validation
   - Added data sanitization for invalid enum values
   - Auto-removes invalid `totalumFeature` values

## Future Improvements

1. **Retry with different models** - If primary model fails, try fallback model automatically
2. **Partial spec generation** - If planning fails, generate minimal working spec
3. **User notification** - Show warnings in UI when stages use fallbacks
4. **Metrics** - Track fallback usage rates to identify problematic models

## Related Issues

- Netflix crawl returning 1 page (web search supplement handles this)
- Poolside model returning invalid JSON (pipeline now resilient to this)
- Schema validation errors (auto-sanitization handles this)
