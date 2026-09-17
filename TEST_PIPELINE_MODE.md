# Pipeline Mode Selector Implementation - Testing Guide

## Implementation Summary

Successfully implemented a user-facing toggle UI for choosing between "Atai Legacy" and "Atai Heavy" pipeline modes.

### Components Created/Modified:

1. **`components/pipeline-mode-selector.tsx`** ✅
   - New client component with toggle switch
   - Info modal with explanations
   - "Compare Modes" button linking to `/modes-comparison`
   - Defaults to "legacy"

2. **`app/modes-comparison/page.tsx`** ✅
   - New public comparison page  
   - Side-by-side mode comparison
   - 7-stage pipeline breakdown
   - When to use each mode guidance

3. **`components/create-idea-form.tsx`** ✅
   - Added PipelineModeSelector component
   - Tracks selected mode in state
   - Passes `pipelineMode` to API

4. **`components/create-project-form.tsx`** ✅
   - Added PipelineModeSelector component
   - Tracks selected mode in state
   - Passes `pipelineMode` to API

5. **`app/api/projects/route.ts`** ✅
   - Accepts `pipelineMode?: 'legacy' | 'heavy'` in POST body
   - Passes to pipeline functions
   - Stores in project metadata

6. **`lib/types/project.ts`** ✅
   - Added `PipelineMode` type export
   - Added `pipelineMode?: PipelineMode` to MirrorProject interface

7. **`lib/analysis/pipeline.ts`** ✅
   - Updated `runWebsiteAnalysis()` to accept `pipelineMode` parameter
   - Updated `runScratchAnalysis()` to accept `pipelineMode` parameter
   - Passes mode to specification generation functions

8. **`lib/analysis/specification.ts`** ✅
   - Updated `generateSpecificationFromUnderstanding()` to accept `pipelineMode`
   - Updated `generateSpecificationFromIdea()` to accept `pipelineMode`
   - User selection overrides rollout logic:
     - `pipelineMode === "heavy"` → forces enhanced pipeline
     - `pipelineMode === "legacy"` → forces legacy pipeline
     - No selection → uses existing rollout logic
   - Logs user's choice for tracking

## Manual Testing Checklist

### Test 1: UI Components
- [ ] Navigate to `/new/website` - verify PipelineModeSelector appears above URL input
- [ ] Navigate to `/dashboard` (scratch mode) - verify PipelineModeSelector appears above textarea
- [ ] Toggle defaults to "Legacy"
- [ ] Click between Legacy and Heavy - verify visual state changes
- [ ] Click info icon (?) - verify modal opens
- [ ] Modal shows correct information for both modes
- [ ] "Compare Modes" button in modal works
- [ ] Modal closes correctly

### Test 2: Modes Comparison Page
- [ ] Navigate to `/modes-comparison`
- [ ] Page loads without authentication
- [ ] Both mode cards display correctly
- [ ] 7-stage pipeline breakdown shows
- [ ] "When to Use Each Mode" section displays
- [ ] "Start a New Project" button links to `/dashboard`
- [ ] Back button returns to dashboard

### Test 3: Idea Flow (Scratch Mode)
- [ ] Open browser DevTools Network tab
- [ ] Go to `/dashboard`
- [ ] Set pipeline mode to "Heavy"
- [ ] Enter an idea: "A task management app with real-time collaboration"
- [ ] Click "Start from idea"
- [ ] Check Network tab - verify POST to `/api/projects` includes `"pipelineMode": "heavy"`
- [ ] Check browser console for log: "User-selected Heavy pipeline (from idea)"
- [ ] Repeat with "Legacy" mode selected

### Test 4: Website Flow
- [ ] Open browser DevTools Network tab
- [ ] Go to `/new/website`
- [ ] Set pipeline mode to "Heavy"
- [ ] Enter URL: "example.com"
- [ ] Choose crawl mode and proceed
- [ ] Check Network tab - verify POST includes `"pipelineMode": "heavy"`
- [ ] Check server logs for: "User-selected Heavy pipeline (from understanding)"
- [ ] Repeat with "Legacy" mode selected

### Test 5: Backend Pipeline Routing
Check server logs after creating projects to verify:
- [ ] Legacy selection logs: `[BackwardCompatibility] User-selected Legacy pipeline`
- [ ] Heavy selection logs: `[BackwardCompatibility] User-selected Heavy pipeline`
- [ ] Heavy selection triggers PlanningOrchestrator
- [ ] Legacy selection skips enhanced pipeline
- [ ] User choice overrides rollout percentage

### Test 6: Accessibility
- [ ] Tab through form - PipelineModeSelector is keyboard accessible
- [ ] Info button has proper aria-label
- [ ] Toggle buttons are keyboard operable
- [ ] Dialog can be closed with Escape key
- [ ] Screen reader announces current selection

### Test 7: Responsive Design
- [ ] Test on mobile viewport (375px)
- [ ] Test on tablet viewport (768px)
- [ ] Test on desktop viewport (1280px)
- [ ] Toggle buttons resize appropriately
- [ ] Modal displays correctly on all sizes

## Expected Behavior

### When User Selects "Legacy":
1. UI shows "Legacy" as active
2. API receives `pipelineMode: "legacy"`
3. Backend logs: "User-selected Legacy pipeline"
4. Uses single-stage generation (fast)
5. Bypasses PlanningOrchestrator
6. ~10 credits charged

### When User Selects "Heavy":
1. UI shows "Heavy" as active
2. API receives `pipelineMode: "heavy"`
3. Backend logs: "User-selected Heavy pipeline"
4. Invokes PlanningOrchestrator
5. Runs 7-stage pipeline
6. ~50-100 credits charged

### When No Selection (Default):
1. UI shows "Legacy" as active (default)
2. API receives `pipelineMode: "legacy"`
3. Existing rollout logic is NOT used
4. User choice always takes precedence

## Key Implementation Details

### Priority Order (in specification.ts):
1. **User explicit choice** (pipelineMode parameter)
2. Rollout-based routing (only if no explicit choice)
3. Legacy fallback

### Credit Transparency:
- Modal clearly states credit costs
- Comparison page emphasizes cost differences
- Users can make informed decisions

### Design Consistency:
- Matches existing component styles
- Uses shadcn/ui Dialog component
- Follows monospace label pattern
- Uses lucide-react icons

## Notes for Developers

- Pipeline mode is stored in project metadata (`project.pipelineMode`)
- Mode selection happens at project creation time
- Cannot change mode after project is created
- Deep crawl mode ignores pipeline mode (always uses direct clone)
- User selection overrides environment variables
- Logs track user vs. rollout-based decisions

## Future Enhancements

Consider implementing:
- [ ] Pipeline mode selection after project creation
- [ ] Usage analytics dashboard
- [ ] A/B testing metrics comparison
- [ ] Cost preview based on project complexity
- [ ] "Recommended" badge based on project type
