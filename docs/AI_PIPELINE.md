# 🤖 AI Planning Pipeline

**Complete reference for the 7-stage AI analysis system**

---

## Overview

Atai uses a multi-stage pipeline to turn raw crawl data into a structured `ApplicationSpecification`. Understanding this pipeline is critical because it's the core intellectual property of the platform — the thing that makes results better than competitors.

**File**: `lib/planning/orchestrator.ts` — `PlanningOrchestrator` class  
**Stages file**: `lib/planning/stages/`

---

## When Does the Pipeline Run?

### Mode: Smart Crawl (Legacy)
```
Crawl site (Firecrawl map + scrape)
    → Charge 5 credits
    → Single AI call to analyzeWebsite()
    → Single AI call to generateSpecification()
    → Charge 5 credits
    → Done
```
**No 7-stage pipeline.** Quick and cheap.

### Mode: Deep Crawl Legacy (500 credits)
```
Deep crawl entire site (Firecrawl, up to 50 pages)
    → Charge 500 credits
    → Same single-pass AI analysis as Smart Crawl
    → Done
```
**Still no 7-stage pipeline.** More data, same analysis.

### Mode: Deep Crawl Heavy (1000 credits) ← This uses the 7-stage pipeline
```
Deep crawl entire site (Firecrawl, up to 50 pages)
    → Charge 1000 credits
    → 7-stage AI pipeline runs on evidence
    → High-quality ApplicationSpecification produced
    → Done
```

### Mode: Scratch (Idea mode)
```
User enters an idea description in text
    → 7-stage pipeline runs on the idea text
    → ApplicationSpecification produced
    → Done
```

---

## The 7 Stages

### Stage 1: Idea/Website Understanding
**File**: `lib/planning/stages/idea-understanding.ts`  
**Input**: Raw idea text OR website evidence  
**Output**: `ProjectUnderstanding` object  
**Cost**: Included in operation cost

**What it does**:
- Translates the raw input into a structured understanding object
- Extracts: app type, target users, core purpose, key features
- For websites: reads screenshots, page content, navigation structure
- For ideas: extracts requirements from natural language description

**If it fails**: Pipeline stops. Cannot continue without understanding.

```typescript
interface ProjectUnderstanding {
  appType: string              // "saas" | "ecommerce" | "blog" | etc.
  targetUsers: string[]        // Who uses this app
  corePurpose: string          // One-sentence purpose
  keyFeatures: string[]        // Main features identified
  designNotes: string          // Color, style, visual observations
  technologyHints: string[]    // Tech stack hints from the site
}
```

---

### Stage 2: Research Agent
**File**: `lib/planning/stages/research.ts`  
**Input**: `ProjectUnderstanding`  
**Output**: `ResearchFindings`  
**Status**: NON-BLOCKING (failure = continue with empty findings)

**What it does**:
- Analyzes the understanding for gaps, problems, and opportunities
- Identifies missing features the user probably wants
- Flags security concerns
- Notes UX gaps
- Identifies technical risks

**Why it's non-blocking**: Research enriches the spec but isn't required. If the AI model fails or returns garbage, the pipeline continues with empty research findings. This is intentional.

**Example output**:
```typescript
interface ResearchFindings {
  missingFeatures: string[]     // "Should have email notifications"
  securityConcerns: string[]    // "Login form needs CSRF protection"
  uxGaps: string[]              // "No clear call-to-action on landing page"
  technicalRisks: string[]      // "Real-time features need WebSockets"
  recommendations: string[]     // Specific improvements
  completenessScore: number     // 0-100, how complete the spec is
  analyzedType: "idea" | "website"
}
```

**Schema validation note**: The AI sometimes returns enum values not in the schema (e.g., `"webapp"` instead of `"web_app"`). The `research.ts` stage has sanitization that fixes these before Zod validation. This was a real bug that was fixed.

---

### Stage 3: Primary Planner
**File**: `lib/planning/stages/planner.ts`  
**Input**: `ProjectUnderstanding` + `ResearchFindings`  
**Output**: `ApplicationSpecification` (first draft)  
**Status**: BLOCKING (if this fails, pipeline fails)

**What it does**:
- Generates the complete first-draft application spec
- Produces: pages, components, navigation, data entities, API endpoints
- Incorporates research findings to fill gaps
- Creates design system (colors, fonts, spacing)
- Maps out user flows

**This is the most expensive AI call** — it generates a large, structured JSON output.

**Output type**:
```typescript
interface ApplicationSpecification {
  title: string
  description: string
  complexity: "simple" | "medium" | "complex"
  
  pages: PageSpecification[]
  components: ComponentSpecification[]
  navigation: NavigationSpecification
  
  dataEntities: DataEntity[]
  apiEndpoints: APIEndpoint[]
  
  designSystem: {
    colors: ColorPalette
    typography: TypographySpec
    spacing: SpacingScale
  }
  
  coreFlows: UserFlow[]
  suggestedFeatures: Feature[]
  integrations: string[]
  backendRequirements: string[]
}
```

---

### Stage 4: Independent Critic
**File**: `lib/planning/stages/critic.ts`  
**Input**: `ApplicationSpecification` (first draft)  
**Output**: `CritiqueReport`  
**Status**: NON-BLOCKING (failure = assume spec passes validation)

**What it does**:
- A separate AI model reviews the specification as if it were a senior developer
- Checks for: inconsistencies, missing pieces, unrealistic features, poor naming
- Returns a pass/fail verdict with specific issues

**Why non-blocking**: If the critic fails, we assume the spec is "good enough" and skip repair. Better to have an uncritiqued spec than no spec.

**Output**:
```typescript
interface CritiqueReport {
  passesValidation: boolean
  overallScore: number          // 0-100
  issues: CritiqueIssue[]      // Specific problems found
  recommendations: string[]    // How to improve
  summary: string              // Human-readable verdict
}
```

---

### Stage 5: Repair Service
**File**: `lib/planning/stages/repair.ts`  
**Input**: `ApplicationSpecification` + `CritiqueReport`  
**Output**: `ApplicationSpecification` (repaired)  
**Status**: NON-BLOCKING (only runs if critic says spec fails; failure = use original)  
**Condition**: Only runs if `critique.passesValidation === false`

**What it does**:
- Takes the critic's feedback and fixes the issues in the spec
- Regenerates only the problematic parts
- Produces an improved specification

**If it fails**: Uses the original unrepaired spec. The spec still works — it's just not as polished.

---

### Stage 6: Semantic Validator
**File**: `lib/planning/stages/validator.ts`  
**Input**: `ApplicationSpecification` (after repair)  
**Output**: `ValidationResult`  
**Status**: NON-BLOCKING (logs warning but continues)

**What it does**:
- Programmatic (not AI) validation of the spec
- Checks data consistency: referenced components actually exist, page names are unique, etc.
- This is a rule-based validator, not an AI call

**Why non-blocking**: Validation errors are warnings, not blockers. The spec may have minor inconsistencies but still be usable for code generation.

```typescript
interface ValidationResult {
  valid: boolean
  errors: ValidationError[]    // { field, message, severity }
  warnings: ValidationWarning[]
}
```

---

### Stage 7: Sanitizer + Complexity Classifier
**Files**: `lib/planning/orchestrator.ts` (sanitizer inline), `lib/credits/credits.ts` (classifier)  
**Input**: `ApplicationSpecification`  
**Output**: Final `ApplicationSpecification`  
**Status**: ALWAYS RUNS

**Sanitizer does**:
- Removes or replaces invalid technology references
- Normalizes enum values to valid options
- Strips internal AI artifacts from the spec
- Marks spec as `_sanitized: true` if changes were made (shown as a UI warning)

**Complexity Classifier does** (in `lib/credits/credits.ts`):
```typescript
function classifyComplexity(spec): "simple" | "medium" | "complex" {
  let score = 0
  score += enabledFeatures * 2        // Features add to complexity
  score += dataEntities.length        // Each entity adds
  score += integrations.length * 3   // Integrations weigh 3x (hardest to build)
  score += coreFlows.length           // Flows add
  score += backendRequirements.length // Backend adds

  if (score <= 6)  return "simple"
  if (score <= 14) return "medium"
  return "complex"
}
```

**Complexity → Credit cost**:
| Complexity | Legacy cost | Heavy cost |
|-----------|-------------|------------|
| simple    | 25,000 cr   | 50,000 cr  |
| medium    | 50,000 cr   | 75,000 cr  |
| complex   | 75,000 cr   | 100,000 cr |

*(These are the BUILD costs, not analysis costs)*

---

## Pipeline Resilience Design

This is important to understand. The pipeline was designed to ALWAYS produce output, even when AI models fail.

```
Stage 1 (Understanding): REQUIRED — fail = abort
Stage 2 (Research):      OPTIONAL — fail = empty findings, continue
Stage 3 (Planning):      REQUIRED — fail = abort
Stage 4 (Critic):        OPTIONAL — fail = assume passes, skip repair
Stage 5 (Repair):        OPTIONAL — fail = use original spec
Stage 6 (Validator):     OPTIONAL — fail = log warning, continue
Stage 7 (Sanitizer):     ALWAYS   — runs regardless
```

**Why?** Free AI models (used during development) are unreliable. A model might time out, return malformed JSON, or be rate limited. Having non-blocking stages means a single model failure doesn't waste the user's credits and time.

---

## Pipeline Modes: Legacy vs Heavy

### Legacy Mode
- Uses simpler, faster, cheaper AI models
- Single-pass analysis
- Good for most websites
- Less thorough than heavy mode

### Heavy Mode (7-stage pipeline)
- Uses stronger AI models with more tokens
- Multi-pass analysis with critique and repair
- Better at catching edge cases
- Produces higher quality specs
- Costs 2x more

### Which to Use?
- **Testing / development**: Legacy (faster, cheaper)
- **Important clients / complex sites**: Heavy
- **Simple websites (blog, portfolio)**: Legacy is fine
- **SaaS / complex applications**: Always use Heavy

---

## AI Models Used

Models are configured in `lib/planning/stages/*.ts` and `lib/integrations/openrouter/`.

The system uses **OpenRouter** which provides access to multiple AI providers through one API key.

### Current Models (check code for latest)
- **Planning / main generation**: High-quality models with large context windows
- **Research / critique**: Can use smaller, faster models
- **Fallbacks**: Each stage has fallback models if primary fails

### Finding the Model Config
```
lib/integrations/openrouter/client.ts  ← OpenRouter API client
lib/planning/stages/planner.ts         ← Planner model config
lib/planning/stages/critic.ts          ← Critic model config
lib/planning/stages/research.ts        ← Research model config
```

---

## Planning Run Tracking

Every pipeline execution is recorded in the `planning_runs` MongoDB collection.

**File**: `lib/planning/tracking/planning-run.ts`

```typescript
// Start a run
runId = await tracker.startRun(projectId, userId, "idea" | "website")

// The orchestrator calls this automatically
// Each stage result is saved to the run record
// Errors are recorded per-stage

// Runs auto-delete after 90 days (TTL index)
```

**Use the admin panel** (`/admin/infrastructure`) to view planning run logs when debugging failures.

---

## Common Pipeline Failures

### "Specification failed semantic validation"
**Cause**: AI generated inconsistent data (referenced component doesn't exist)  
**Status**: Should be non-blocking now (logs warning)  
**Fix**: If still blocking, check `orchestrator.ts` validation section

### "Research stage failed, continuing with empty findings"
**Cause**: AI model timeout or invalid JSON response  
**Status**: Expected and handled — not a real error  
**Action**: None needed, pipeline continues

### "Some unsupported technologies were automatically replaced"
**Cause**: Sanitizer replaced tech the AI suggested  
**Status**: Normal, shown as UI warning  
**Action**: None needed

### Pipeline stuck in "analyzing" state
**Cause**: Unhandled exception in a required stage  
**Fix**: Check server logs, look for the project ID in `planning_runs` collection  
**Recovery**: Admin can reset project state via admin panel

---

## Code Navigation

```
lib/planning/
├── orchestrator.ts           ← Main entry point, all 3 pipeline types
├── tracking/
│   └── planning-run.ts       ← Logs each pipeline execution to DB
└── stages/
    ├── idea-understanding.ts ← Stage 1 (idea mode)
    ├── research.ts           ← Stage 2 (gap analysis)
    ├── planner.ts            ← Stage 3 (spec generation)
    ├── critic.ts             ← Stage 4 (quality review)
    ├── repair.ts             ← Stage 5 (fix issues)
    └── validator.ts          ← Stage 6 (consistency check)

lib/analysis/
└── pipeline.ts               ← Entry point: crawl → analyze → spec → build
```

---

## How to Debug a Failed Pipeline

1. **Get the project ID** from the URL: `/projects/{projectId}`
2. **Check planning_runs collection** in MongoDB for that projectId
3. **Look at stageResults** — find which stage has an error
4. **Check server logs** — filter by projectId
5. **Check admin panel** at `/admin/infrastructure`

**Quick log search**:
```
[v0][Atai] ... "stage":"pipeline.deepCrawl" ... projectId: "your-id"
```

---

**Related**: `CREDIT_SYSTEM.md` for how credits are charged per stage
