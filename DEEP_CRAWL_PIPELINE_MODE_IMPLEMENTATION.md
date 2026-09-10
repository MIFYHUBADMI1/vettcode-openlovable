# Deep Crawl Pipeline Mode Implementation

## Overview
Deep crawl now supports both **legacy** and **heavy** pipeline modes, allowing users to choose between standard AI analysis or comprehensive 7-stage validated specifications.

## Implementation Summary

### Changes Made

#### 1. **lib/credits/credits.ts**
- Added `DEEP_CRAWL_HEAVY_COST = 1000` constant
- Added `getDeepCrawlCost(pipelineMode)` function to return correct cost based on mode
- Updated `chargeDeepCrawlCredits()` to accept `pipelineMode` parameter and charge accordingly
  - Legacy: 500 credits
  - Heavy: 1000 credits

#### 2. **lib/analysis/pipeline.ts**
- Updated `runDeepCrawlAnalysis()` to accept optional `pipelineMode` parameter
- Added dual-mode processing logic:
  - **Legacy Mode**: Uses original AI website analysis (generateSpecificationFromUnderstanding with legacy mode)
  - **Heavy Mode**: Runs full 7-stage pipeline via PlanningOrchestrator.executeWebsitePipeline()
- Converts crawled evidence into ProjectUnderstanding before spec generation
- Uses `getDeepCrawlCost(mode)` to get correct credit amount
- Added comprehensive logging for mode selection, cost, and execution

#### 3. **app/api/projects/route.ts**
- Updated deep crawl invocation to pass `pipelineMode` parameter
- Now calls: `runDeepCrawlAnalysis(project.id, pipelineMode)`

#### 4. **lib/integrations/firecrawl/client.ts** (Previous Fix)
- Increased initial POST timeout to 60 seconds
- Increased overall timeout to 5 minutes (300 seconds)
- Added comprehensive logging for crawl job lifecycle
- Added error resilience in polling loop

#### 5. **lib/integrations/firecrawl/service.ts** (Previous Fix)
- Updated crawl timeout from 2 minutes to 5 minutes

## Pipeline Mode Behavior

### Deep Crawl + Legacy Mode
1. **Crawl website** - Firecrawl collects up to 50 pages
2. **Convert to understanding** - Map crawled data to ProjectUnderstanding structure
3. **AI analysis** - Use original `generateSpecificationFromUnderstanding()` with legacy mode
4. **Auto-launch build** - Direct to Totalum builder

**Cost: 500 credits**
**Time: ~2-5 minutes for crawl + 30-60 seconds for AI spec generation**

### Deep Crawl + Heavy Mode
1. **Crawl website** - Firecrawl collects up to 50 pages
2. **Convert to understanding** - Map crawled data to ProjectUnderstanding structure
3. **7-Stage Pipeline** - Full AI planning pipeline:
   - Research Stage: Identify gaps and missing features
   - Planning Stage: Generate comprehensive specification
   - Critique Stage: Independent validation
   - Repair Stage: Fix inconsistencies
   - Validation Stage: Semantic checks
   - Sanitization Stage: Totalum SDK compliance
4. **Auto-launch build** - Validated spec to Totalum builder

**Cost: 1000 credits (all-inclusive)**
**Time: ~2-5 minutes for crawl + 2-4 minutes for pipeline**

## Flow Diagram

```
User Creates Project (Deep Crawl Mode)
         ↓
   Select Pipeline Mode
    /              \
Legacy Mode      Heavy Mode
   ↓                  ↓
Charge 500       Charge 1000
   ↓                  ↓
Crawl 50 Pages   Crawl 50 Pages
   ↓                  ↓
Convert to       Convert to
Understanding    Understanding
   ↓                  ↓
Original AI      7-Stage Pipeline
Analysis         (Research →
   ↓              Planning →
Generate Spec     Critique →
   ↓              Repair →
                  Validation →
                  Sanitization)
                       ↓
                  Generate Spec
                       ↓
         Both paths merge here
                       ↓
              Auto-launch Build
```

## Credit Breakdown

| Mode | Total Cost | Breakdown |
|------|------------|-----------|
| **Legacy** | **500 credits** | All-inclusive (crawl + AI analysis) |
| **Heavy** | **1000 credits** | All-inclusive (crawl + 7-stage pipeline) |

## User Experience

### In `/new/website` Page:
1. User enters URL
2. Selects **Pipeline Mode** (Legacy/Heavy)
3. Selects **Crawl Mode** (Smart/Deep)
4. If Deep + Legacy: "500 credits - Deep crawl with AI analysis"
5. If Deep + Heavy: "1000 credits - Deep crawl with full 7-stage validated specification"

### Event Timeline Example (Heavy Mode):
```
✓ Deep crawling https://example.com — collecting entire site (heavy mode)
✓ Deep crawl complete — 45 pages collected
✓ Deep crawl credits charged (1000)
✓ Starting AI planning pipeline (heavy mode)
✓ Research stage complete — 3 gaps identified
✓ Planning stage complete — comprehensive spec generated
✓ Critique stage complete — quality score: 85
✓ Repair stage complete — 2 issues fixed
✓ Validation complete — spec is consistent
✓ Sanitization complete — Totalum SDK compatible
✓ Specification ready (heavy mode pipeline) — medium tier
✓ Build launched automatically
```

## Benefits

### Legacy Mode (500 credits):
- ✅ Standard pricing for deep crawl
- ✅ Good for simple, well-structured sites
- ✅ AI-enhanced specs (not just templates)
- ✅ Fast turnaround

### Heavy Mode (1000 credits):
- ✅ Premium quality specifications
- ✅ Gap identification and feature suggestions
- ✅ Independent validation and repair
- ✅ Semantic consistency checks
- ✅ Best for complex sites requiring comprehensive analysis
- ✅ Worth 2x cost for enterprise/production sites

## Comparison with Other Modes

| Mode | Credits | Features |
|------|---------|----------|
| **Website Smart + Legacy** | 15 | Basic scrape + AI spec |
| **Website Smart + Heavy** | 120 | Scrape + 7-stage pipeline |
| **Website Deep + Legacy** | 500 | Full crawl (50 pages) + AI spec |
| **Website Deep + Heavy** | 1000 | Full crawl + 7-stage pipeline |

## Testing Recommendations

1. **Test with small site (5-10 pages)**
   - Verify both modes complete successfully
   - Verify legacy charges 500 credits
   - Verify heavy charges 1000 credits
   - Compare spec quality

2. **Test with complex site (20-50 pages)**
   - Verify timeout improvements work
   - Check heavy mode provides better specs
   - Monitor execution time

3. **Test error scenarios**
   - Insufficient credits for each mode
   - Crawl timeout handling
   - Pipeline failure recovery

## Notes

- Deep crawl legacy is now 500 credits all-inclusive (was complicated before)
- Deep crawl heavy is 1000 credits all-inclusive (double the cost for double the quality)
- Both modes now use AI (no more template-based generation)
- Heavy mode includes the full 7-stage pipeline just like other heavy modes
- Credit charges happen upfront for the entire operation
