# Planning Progress Communication Fix

## Problem
Users cannot see progress during the AI planning/analysis phase at `/project/[id]`. The page appears frozen because:

1. **Planning Orchestrator doesn't append visible events** - Unlike the analysis pipeline which appends events like "Collecting evidence", "Website understanding generated", the planning orchestrator only tracks stages internally in `Planning_Run` records
2. **BuildLoading component filters wrong stages** - It only shows events with stages: `"build"`, `"analyze"`, or `"specify"`, but planning uses stages like: `"idea_understanding"`, `"research"`, `"planning"`, `"critique"`, `"repair"`
3. **No real-time stage updates** - Users see a generic spinner with no indication of which AI stage is running

## Current Flow (Silent Planning)
```
User creates project 
  → State: "analyzing"
  → Generic spinner shows
  → No visible progress for 1-2 minutes
  → User thinks it's frozen 😰
  → Suddenly spec appears ✅
```

## Desired Flow (Communicative Planning)
```
User creates project
  → "Understanding your idea..." (10s)
  → "Researching missing features..." (30s)  
  → "Generating application plan..." (40s)
  → "Quality review in progress..." (20s)
  → "Finalizing specification..." (10s)
  → Spec ready! 🎉
```

## Solution: Add Event Appending to Planning Orchestrator

### Files to Modify:

#### 1. `lib/planning/orchestrator.ts`

Add event appending at each stage transition:

```typescript
import { store } from "@/lib/store/store"

// Helper to create properly formatted events
function planningEvent(stage: string, message: string, level: "info" | "warn" | "error" = "info") {
  return {
    id: crypto.randomUUID(),
    at: Date.now(),
    level,
    stage,
    message,
  }
}

// In executeStage method, add event logging:
private async executeStage<T>(
  runId: string,
  stage: string,
  fn: () => Promise<T>,
  projectId: string  // NEW PARAMETER
): Promise<T> {
  this.tracker.recordStageStart(runId, stage as any)

  // Append visible event to project
  const stageMessages: Record<string, string> = {
    idea_understanding: "Understanding your idea...",
    research: "Researching missing features and best practices...",
    planning: "Generating comprehensive application plan...",
    critique: "Performing quality review...",
    repair: "Refining specification based on review...",
  }
  
  await store.appendEvent(
    projectId,
    planningEvent("planning", stageMessages[stage] || `Processing ${stage}...`)
  )

  try {
    const result = await fn()

    // Record successful completion with event
    await store.appendEvent(
      projectId,
      planningEvent("planning", `✓ ${stageMessages[stage]?.replace("...", "")} complete`)
    )

    const completionData: StageCompletionData = {
      model: "auto",
      tokens: 0,
      success: true,
      retries: 0,
    }

    await this.tracker.recordStageCompletion(runId, stage as any, completionData)

    return result
  } catch (error) {
    await store.appendEvent(
      projectId,
      planningEvent("planning", `${stage} stage failed`, "error")
    )

    const completionData: StageCompletionData = {
      model: "auto",
      tokens: 0,
      success: false,
      retries: 0,
      error: error instanceof Error ? error.message : String(error),
    }

    await this.tracker.recordStageCompletion(runId, stage as any, completionData)

    throw error
  }
}
```

Update all `executeStage` calls to pass projectId:
```typescript
const understanding = await this.executeStage(
  runId,
  "idea_understanding",
  async () => await this.ideaService.generateUnderstanding(idea),
  projectId  // ADD THIS
)
```

#### 2. `components/build-loading.tsx`

Update the event filter to include planning stages:

```typescript
// Line ~169 - Update the filter
const recentEvents = useMemo(() => {
  if (!status?.events?.length) return []
  return status.events
    .filter((e) => 
      e.stage === "build" || 
      e.stage === "analyze" || 
      e.stage === "specify" ||
      e.stage === "planning"  // ADD THIS
    )
    .slice(-8)  // Show more events (8 instead of 5)
}, [status?.events])
```

#### 3. Add Stage Indicator Badge

In `build-loading.tsx`, add a current stage indicator:

```typescript
// After the spinner, before agent status
{recentEvents.length > 0 && recentEvents[recentEvents.length - 1] && (
  <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
    <span className="size-1.5 rounded-full bg-primary animate-pulse" />
    {recentEvents[recentEvents.length - 1].message}
  </div>
)}
```

### Stage Messages for Heavy Mode

For Heavy mode (7 stages), the user will see:

1. **Idea Understanding** (~10s)
   - "Understanding your idea..."
   - "✓ Understanding your idea complete"

2. **Research** (~30-60s)  
   - "Researching missing features and best practices..."
   - Detects: Admin Dashboard, User Management, Analytics (mandatory)
   - Detects: Totalum features to recommend (Email, Stripe, etc.)
   - "✓ Researching missing features and best practices complete"

3. **Planning** (~30-50s)
   - "Generating comprehensive application plan..."
   - "✓ Generating comprehensive application plan complete"

4. **Critique** (~20-30s)
   - "Performing quality review..."
   - "✓ Performing quality review complete"

5. **Repair** (conditional, ~20s)
   - "Refining specification based on review..."
   - "✓ Refining specification based on review complete"

6. **Validation** (~5s - instant)
   - Semantic validation (silent, no event needed)

7. **Sanitization** (~5s - instant)
   - Sanitization (silent, or show warning if replacements made)

### For Legacy Mode (5 stages)

Same flow, just without Critique and Repair stages.

## Additional Enhancement: Live Stage Progress

Optional: Add a micro-progress indicator showing which stage is running:

```typescript
<div className="mt-4 flex items-center justify-center gap-1">
  {['understand', 'research', 'plan', 'review', 'finalize'].map((s, i) => (
    <div 
      key={s}
      className={cn(
        "h-1 w-8 rounded-full transition-all",
        i < currentStageIndex ? "bg-success" : 
        i === currentStageIndex ? "bg-primary animate-pulse" :
        "bg-muted"
      )}
    />
  ))}
</div>
```

## Expected User Experience After Fix

### Before (Current - Silent)
```
User: *stares at spinner for 90 seconds*
User: "Is this frozen? Should I refresh?"
User: *refreshes* 
User: *loses progress* 😫
```

### After (Fixed - Communicative)
```
User: "Understanding your idea..." ✓
User: "Researching missing features..." ✓
User: "Generating plan..." ✓  
User: "Quality review..." ✓
User: "Done! Here's your spec" 🎉
User: "Wow, that was thorough!" 😊
```

## Testing Checklist

1. Create a new project with Heavy mode
2. Watch the `/project/[id]` page during analysis
3. Verify events appear in the "Build log" section:
   - ✓ "Understanding your idea..."
   - ✓ "Researching missing features..."
   - ✓ "Generating comprehensive application plan..."
   - ✓ "Performing quality review..."
4. Verify no "frozen" feeling - constant updates every 10-30s
5. Check that failed stages show error messages
6. Verify mode label: "Planning credits charged (Heavy mode)"

## Benefits

1. **No More "Frozen" Feeling** - Users see constant progress updates
2. **Transparency** - Users know exactly what the AI is doing
3. **Trust Building** - Professional, communicative interface
4. **Reduced Abandonment** - Users less likely to refresh/leave
5. **Educational** - Users learn about the planning stages
6. **Debugging** - Easier to see where pipeline fails

## Implementation Priority

**HIGH PRIORITY** - This directly impacts user experience and trust during the most critical phase (first impression of AI capabilities).

---

**Status**: Solution documented, ready for implementation
**Files to modify**: 2 (orchestrator.ts, build-loading.tsx)
**Estimated time**: 30-45 minutes
**Testing time**: 15 minutes
