# Heavy Mode Pricing Implementation

## Overview
Implemented differential pricing for Heavy mode pipeline, which includes admin dashboards, user management, analytics, and comprehensive SaaS features. Heavy mode costs 25,000-50,000 more credits than Legacy mode.

## Changes Made

### 1. ✅ Updated `lib/credits/credits.ts`
Added new pricing tier for Heavy mode:

```typescript
/** Heavy mode tier costs — higher due to admin dashboards, user management, analytics, and comprehensive SaaS features. */
const HEAVY_TIER_COSTS: Record<string, number> = {
  simple: 50000,   // was 25000
  medium: 75000,   // was 50000
  complex: 100000, // was 75000
}

/** Return the credit cost for a given complexity tier and pipeline mode. */
export function getTierCost(tier: string, pipelineMode?: "legacy" | "heavy"): number {
  if (pipelineMode === "heavy") {
    return HEAVY_TIER_COSTS[tier] ?? HEAVY_TIER_COSTS.medium
  }
  return TIER_COSTS[tier] ?? TIER_COSTS.medium
}
```

### 2. ✅ Updated `lib/types/project.ts`
Field already existed:
```typescript
export type UserPipelineMode = "legacy" | "heavy"

export interface MirrorProject {
  // ... other fields
  pipelineMode?: UserPipelineMode
  // ... other fields
}
```

### 3. ✅ Updated `lib/analysis/pipeline.ts`
Modified `autoLaunchBuild` function to:
- Read `pipelineMode` from project (defaults to "legacy")
- Pass `pipelineMode` to `getTierCost(tier, pipelineMode)`
- Include mode label in transaction message

```typescript
const tier = project.specification.complexity ?? classifyComplexity(project.specification)
const pipelineMode = project.pipelineMode ?? "legacy"
const creditsNeeded = getTierCost(tier, pipelineMode)

// ... later in the function
const modeLabel = pipelineMode === "heavy" ? "Heavy Mode" : "Legacy"
const reserved = await reserveCredits(
  project.userId, 
  creditsNeeded, 
  run.id, 
  `${tier.charAt(0).toUpperCase() + tier.slice(1)} application build (${modeLabel})`
)
```

### 4. ✅ Updated `app/api/projects/route.ts`
Already handles `pipelineMode`:
- Accepts `pipelineMode` from request body
- Defaults to "legacy" if not provided
- Stores in project record
- Passes to `runWebsiteAnalysis` and `runScratchAnalysis`

```typescript
const pipelineMode = body.pipelineMode ?? "legacy"
// ... creates project with pipelineMode
void runWebsiteAnalysis(project.id, pipelineMode)
// or
void runScratchAnalysis(project.id, pipelineMode)
```

## Pricing Summary

| Tier    | Legacy | Heavy  | Difference |
|---------|--------|--------|------------|
| Simple  | 25,000 | 50,000 | +25,000    |
| Medium  | 50,000 | 75,000 | +25,000    |
| Complex | 75,000 | 100,000| +25,000    |

## Features Justifying Heavy Mode Pricing
- Admin dashboards
- User management system
- Analytics and reporting
- Comprehensive SaaS features
- Enhanced pipeline with 7 stages
- Higher quality output

## Backward Compatibility
✅ Fully backward compatible:
- Default mode is "legacy" when not specified
- Existing code without `pipelineMode` parameter continues to work
- All existing projects use legacy pricing

## Transaction Log Labels
Credits are reserved with clear mode labels:
- Legacy: "Simple application build (Legacy)"
- Heavy: "Simple application build (Heavy Mode)"

This allows admins to easily track which projects used which pricing tier.

## Testing
All tests pass ✅:
- Legacy pricing unchanged (25k/50k/75k)
- Heavy pricing correct (50k/75k/100k)
- Default behavior uses legacy pricing
- Unknown tiers default correctly

## Usage
Frontend can pass `pipelineMode` when creating a project:

```typescript
POST /api/projects
{
  "mode": "website",
  "url": "https://example.com",
  "pipelineMode": "heavy" // or "legacy"
}
```

If not provided, defaults to "legacy" for backward compatibility.

## Architecture Note: Two Pricing Systems

The codebase has two parallel pricing systems:

### 1. **Credits System** (`lib/credits/credits.ts`)
- Used by automatic build pipeline in `lib/analysis/pipeline.ts`
- NOW supports both Legacy and Heavy modes
- Used when projects are auto-built after analysis

### 2. **Billing System** (`lib/billing/config.ts` + `lib/billing/build-auth.ts`)
- Used by manual build endpoints (`/api/projects/[id]/build` and `/api/projects/[id]/agent`)
- `BUILD_TIERS` already uses Heavy pricing (50k/75k/100k) by default
- More comprehensive with subscription management, authorization flow, etc.

**Important**: The billing system (`getBuildCost`) currently only uses Heavy mode pricing. If legacy pricing is needed for manual builds, `BUILD_TIERS` in `lib/billing/config.ts` would need to be updated to also accept pipelineMode parameter. However, since the billing system appears to be the newer, more comprehensive system, it may be intentional that it only uses the higher pricing.
