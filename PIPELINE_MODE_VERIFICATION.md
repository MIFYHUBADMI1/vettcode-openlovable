# Pipeline Mode Implementation - Verification Checklist

## Quick Start Testing

### 1. Start the Development Server
```bash
npm run dev
```

### 2. Test Idea Flow (Scratch Mode)
1. Navigate to `http://localhost:3000/dashboard`
2. Look for **"Pipeline Mode"** selector above the textarea
3. Click the **?** (question mark) icon
4. Verify modal opens with:
   - Legacy mode details (~10 credits, 30-60s)
   - Heavy mode details (~50-100 credits, 2-5min)
   - "Compare Modes" button
5. Click "Compare Modes" → should navigate to `/modes-comparison`
6. Return to dashboard
7. Toggle between Legacy and Heavy
8. Enter idea: "A todo app with real-time sync"
9. Submit and check Network tab for `pipelineMode` in POST request

### 3. Test Website Flow
1. Navigate to `http://localhost:3000/new/website`
2. Look for **"Pipeline Mode"** selector above URL input
3. Verify same info modal functionality
4. Toggle to "Heavy" mode
5. Enter URL: "example.com"
6. Proceed through dialogs
7. Check Network tab for `pipelineMode: "heavy"` in POST request

### 4. Test Comparison Page
1. Navigate to `http://localhost:3000/modes-comparison`
2. Verify page loads without authentication
3. Check both mode cards display
4. Verify 7-stage pipeline breakdown
5. Check "When to Use Each Mode" section
6. Click "Start a New Project" → should go to dashboard

## Backend Verification

### Check Server Logs
When creating a project, look for these log entries:

#### Heavy Mode Selected:
```
[BackwardCompatibility] User-selected Heavy pipeline (from idea)
{
  userId: "...",
  projectId: "...",
  userSelected: true
}
```

#### Legacy Mode Selected:
```
[BackwardCompatibility] User-selected Legacy pipeline (from idea)
{
  userId: "...",
  projectId: "...",
  userSelected: true
}
```

### Verify Database Storage
Check that `pipelineMode` is stored in the project:
```typescript
{
  id: "...",
  pipelineMode: "heavy", // or "legacy"
  // ... other fields
}
```

## Type Safety Verification

The implementation uses proper TypeScript types:

### Component Level
```typescript
// components/pipeline-mode-selector.tsx
export type PipelineMode = "legacy" | "heavy"
```

### Project Level
```typescript
// lib/types/project.ts
export type UserPipelineMode = "legacy" | "heavy"

interface MirrorProject {
  pipelineMode?: UserPipelineMode
}
```

Note: Renamed to `UserPipelineMode` to avoid conflicts with existing `PipelineMode` in planning system.

## Files to Review

### New Files Created:
- ✅ `components/pipeline-mode-selector.tsx` - Main component
- ✅ `app/modes-comparison/page.tsx` - Comparison page
- ✅ `TEST_PIPELINE_MODE.md` - Testing guide
- ✅ `IMPLEMENTATION_SUMMARY.md` - Implementation summary

### Modified Files:
- ✅ `components/create-idea-form.tsx` - Added selector
- ✅ `components/create-project-form.tsx` - Added selector
- ✅ `app/api/projects/route.ts` - Accepts pipelineMode
- ✅ `lib/types/project.ts` - Added UserPipelineMode type
- ✅ `lib/analysis/pipeline.ts` - Accepts and passes pipelineMode
- ✅ `lib/analysis/specification.ts` - Respects user choice

## Common Issues & Solutions

### Issue: Modal doesn't open
**Solution**: Check that Dialog component is properly imported from `@/components/ui/dialog`

### Issue: Toggle doesn't work
**Solution**: Verify `onChange` handler is called and state updates correctly

### Issue: API doesn't receive pipelineMode
**Solution**: Check Network tab → Request payload should include `pipelineMode: "legacy" | "heavy"`

### Issue: Backend ignores user choice
**Solution**: Check logs for "User-selected" messages. Ensure pipelineMode is passed through pipeline chain.

### Issue: Type errors
**Solution**: Verify imports use correct type:
- Components: import from `pipeline-mode-selector`
- Backend: use `UserPipelineMode` from `lib/types/project`

## Success Criteria

All these should work:
- [ ] Pipeline mode selector appears on both forms
- [ ] Default is "Legacy"
- [ ] Info modal opens and displays correct information
- [ ] Toggle switches between modes
- [ ] "Compare Modes" button navigates correctly
- [ ] Comparison page loads and displays all content
- [ ] API receives pipelineMode in POST body
- [ ] Backend logs show user selection
- [ ] Heavy mode triggers PlanningOrchestrator
- [ ] Legacy mode uses single-stage pipeline
- [ ] User choice overrides rollout logic
- [ ] pipelineMode stored in project

## Performance Notes

- Component is client-side only (`"use client"`)
- Dialog lazy-loads (only renders when opened)
- No impact on page load performance
- Minimal bundle size increase (~3KB)

## Accessibility Verification

- [ ] Keyboard navigation works (Tab through controls)
- [ ] Info button has aria-label
- [ ] Dialog can be closed with Escape
- [ ] Toggle buttons have visible focus states
- [ ] Screen reader announces current selection

## Browser Compatibility

Tested in:
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

## Next Steps After Verification

1. Monitor server logs for user selections
2. Track credit usage per mode
3. Analyze quality differences
4. Gather user feedback
5. Adjust credit costs if needed
6. Consider adding usage analytics
7. Implement A/B testing metrics
