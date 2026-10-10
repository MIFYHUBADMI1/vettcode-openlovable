import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import {
  Activity,
  Brain,
  Camera,
  ChevronRight,
  ClipboardList,
  Code2,
  Component,
  Compass,
  Database,
  ExternalLink,
  FileText,
  Gauge,
  Globe,
  Hammer,
  Image as ImageIcon,
  Layers,
  Lightbulb,
  ListChecks,
  MessageSquare,
  Palette,
  Pencil,
  Rocket,
  Route,
  Server,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { PlanOutline, type PlanOutlineGroup, type PlanOutlineItem } from "@/components/project-plan/plan-outline"
import {
  BulletList,
  ChipRow,
  Field,
  MarkdownBlock,
  Meter,
  PlanBadge,
  SectionCard,
  StatTile,
  type Tone,
} from "@/components/project-plan/plan-primitives"
import { getCurrentUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { STATE_LABELS, type Project } from "@/lib/types/project"

// ─── Business-plan layer ──────────────────────────────────────────────────────

type BusinessFieldKey =
  | "vision"
  | "problem"
  | "solution"
  | "valueProposition"
  | "businessModel"
  | "revenueModel"
  | "pricingTiers"
  | "pricingStructure"
  | "brandIdentity"
  | "themePreferences"
  | "appearance"
  | "typography"
  | "runtimeIntegrations"
  | "seoPlan"
  | "marketPositioning"
  | "marketingPlan"
  | "launchPlan"
  | "growthPlan"

const BUSINESS_FIELDS: { key: BusinessFieldKey; label: string }[] = [
  { key: "vision", label: "Vision" },
  { key: "problem", label: "Problem" },
  { key: "solution", label: "Solution" },
  { key: "valueProposition", label: "Value proposition" },
  { key: "businessModel", label: "Business model" },
  { key: "revenueModel", label: "Revenue model" },
  { key: "pricingTiers", label: "Pricing tiers" },
  { key: "pricingStructure", label: "Pricing structure" },
  { key: "brandIdentity", label: "Brand identity" },
  { key: "themePreferences", label: "Theme preferences" },
  { key: "appearance", label: "Appearance" },
  { key: "typography", label: "Typography" },
  { key: "runtimeIntegrations", label: "Runtime integrations" },
  { key: "seoPlan", label: "SEO plan" },
  { key: "marketPositioning", label: "Market positioning" },
  { key: "marketingPlan", label: "Marketing plan" },
  { key: "launchPlan", label: "Launch plan" },
  { key: "growthPlan", label: "Growth plan" },
]

// ─── Formatting helpers ───────────────────────────────────────────────────────

function formatDate(ts?: number) {
  if (!ts) return "—"
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatDateTime(ts?: number) {
  if (!ts) return "—"
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return "—"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  return `${value.toFixed(i === 0 || value >= 100 ? 0 : 1)} ${units[i]}`
}

function stateLabel(project: Project) {
  return STATE_LABELS[project.state] ?? String(project.state).replace(/_/g, " ")
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function hostnameOf(url?: string) {
  if (!url) return null
  try {
    return new URL(url).hostname
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0] || url
  }
}

const DEPLOY_TONE: Record<string, Tone> = {
  idle: "neutral",
  building: "info",
  deploying: "info",
  success: "success",
  failed: "danger",
}

const SEVERITY_TONE: Record<string, Tone> = { gap: "danger", weakness: "warning", strength: "success" }

const CONFIDENCE_TONE: Record<string, Tone> = { observed: "success", inferred: "info", suggested: "warning" }

const PRIMARY_BTN =
  "inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
const GHOST_BTN =
  "inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-accent hover:text-foreground"

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProjectPlanPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser()
  const { projectId } = await params
  if (!user) redirect(`/login?next=/project/${projectId}/plan`)

  const project = await store.getProject(projectId)
  if (!project || project.userId !== user.id) notFound()

  const u = project.understanding
  const s = project.specification
  const bs = project.buildSummary
  const pa = project.planAnalysis
  const prefs = project.preferences
  const infra = project.infrastructure
  const deployment = project.deployment
  const history = project.deploymentHistory ?? []
  const events = project.events ?? []
  const convo = project.conversation ?? []

  const hasAnything = Boolean(u || s || bs || pa || project.idea)

  if (!hasAnything) {
    return (
      <DashboardShell title={project.name} projectId={project.id}>
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-6 py-20 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
            <Sparkles className="size-6 text-primary" />
          </div>
          <h2 className="mt-5 text-xl font-semibold tracking-tight">No plan yet</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Analysis hasn&rsquo;t run yet. Once your AI co-founder drafts the specification, the full plan, website
            analysis and build output are collected here.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Link href={`/project/${project.id}`} className={GHOST_BTN}>
              Back to workspace
            </Link>
            <Link href={`/project/${project.id}/collaborate`} className={PRIMARY_BTN}>
              <Sparkles className="size-4" />
              Draft the plan
            </Link>
          </div>
        </div>
      </DashboardShell>
    )
  }

  // ── Derived data ────────────────────────────────────────────────────────────
  const targetUsers = s?.targetUsers ?? []
  const userRoles = s?.userRoles ?? []
  const coreFlows = s?.coreFlows ?? []
  const features = s?.suggestedFeatures ?? []
  const specEntities = s?.dataEntities ?? []
  const backendReqs = s?.backendRequirements ?? []
  const integrations = s?.integrations ?? []
  const enabledFeatures = features.filter((f) => f.enabled)

  const business = BUSINESS_FIELDS.map((f) => ({ ...f, value: (s?.[f.key] ?? "").trim() })).filter(
    (f) => f.value.length > 0,
  )

  const designRows = [
    s?.designDirection ? { label: "Design direction", value: s.designDirection } : null,
    s?.responsiveRequirements ? { label: "Responsive requirements", value: s.responsiveRequirements } : null,
    s?.additionalInstructions ? { label: "Additional instructions", value: s.additionalInstructions } : null,
  ].filter((r): r is { label: string; value: string } => Boolean(r))

  const prefRows = [
    prefs?.appName ? { label: "App name", value: prefs.appName } : null,
    prefs?.stackType && prefs.stackType !== "unknown"
      ? { label: "Stack type", value: capitalize(prefs.stackType) }
      : null,
    prefs?.authProviders && prefs.authProviders !== "unknown"
      ? { label: "Auth provider", value: prefs.authProviders.toUpperCase() }
      : null,
    prefs?.databaseChoice
      ? {
          label: "Database",
          value:
            prefs.databaseChoice === "builtin"
              ? "Built-in (Totalum)"
              : [prefs.customDbProvider, prefs.customDbProviderDetail].filter(Boolean).join(" — ") || "Custom",
        }
      : null,
  ].filter((r): r is { label: string; value: string } => Boolean(r))

  const observed = u?.observedFunctionality ?? []
  const inferred = u?.inferredFunctionality ?? []
  const suggested = u?.suggestedFeatures ?? []
  const functionalityTotal = observed.length + inferred.length + suggested.length
  const navigation = u?.navigation ?? []
  const interactions = u?.interactions ?? []
  const contentStructure = u?.contentStructure ?? []
  const structureTotal = navigation.length + interactions.length + contentStructure.length
  const pages = u?.pages ?? []
  const components = u?.components ?? []
  const userFlows = u?.userFlows ?? []
  const detectedEntities = u?.dataEntities ?? []
  const assets = u?.assets ?? []
  const screenshots = u?.screenshots ?? []
  const evidenceRefs = u?.rawEvidenceReferences ?? []
  const ds = u?.designSystem
  const hasDesignSystem = Boolean(
    ds && (ds.colors.length || ds.typography.length || ds.visualLanguage || ds.imageryStyle || ds.spacing || ds.radius),
  )

  const secrets = Object.entries(bs?.secretKeysNeeded ?? {})
  const missingSecrets = secrets.filter(([, v]) => !v.isProvided)
  const findings = pa?.findings ?? []
  const proposals = pa?.proposals ?? []
  const githubArtifacts = [project.githubReadme, project.githubFileTree, project.githubZipUrl].some(Boolean)
  const hasDeployStory =
    Boolean(deployment?.productionUrl) || history.length > 0 || Boolean(project.developmentUrl)
  const specSectionCount = [
    Boolean(s),
    coreFlows.length > 0,
    features.length > 0,
    specEntities.length > 0,
    backendReqs.length > 0,
    business.length > 0,
  ].filter(Boolean).length

  // ── Outline (single source of truth for nav order + section ids) ───────────
  const outlineGroups: PlanOutlineGroup[] = []
  const add = (group: string, item: PlanOutlineItem) => {
    let bucket = outlineGroups.find((g) => g.label === group)
    if (!bucket) {
      bucket = { label: group, items: [] }
      outlineGroups.push(bucket)
    }
    bucket.items.push(item)
  }

  const PLAN = "Application plan"
  const ANALYSIS = "Website analysis"
  const QUALITY = "Plan quality"
  const DELIVERY = "Build & delivery"

  if (s) add(PLAN, { id: "overview", label: "Overview", icon: "overview" })
  if (project.idea) add(PLAN, { id: "idea", label: "Original idea", icon: "idea" })
  if (targetUsers.length || userRoles.length)
    add(PLAN, { id: "audience", label: "Audience & roles", icon: "audience", count: targetUsers.length + userRoles.length })
  if (coreFlows.length) add(PLAN, { id: "flows", label: "Core flows", icon: "flows", count: coreFlows.length })
  if (features.length)
    add(PLAN, { id: "features", label: "Features", icon: "features", count: enabledFeatures.length })
  if (specEntities.length) add(PLAN, { id: "data", label: "Data model", icon: "data", count: specEntities.length })
  if (backendReqs.length || integrations.length || s?.authenticationRequirements)
    add(PLAN, {
      id: "technical",
      label: "Technical",
      icon: "technical",
      count: backendReqs.length + integrations.length,
    })
  if (designRows.length) add(PLAN, { id: "design", label: "Design & rules", icon: "design", count: designRows.length })
  if (business.length) add(PLAN, { id: "business", label: "Business plan", icon: "business", count: business.length })
  if (prefRows.length || prefs?.additionalNotes)
    add(PLAN, { id: "preferences", label: "Your preferences", icon: "preferences" })
  add(PLAN, { id: "record", label: "Project record", icon: "metadata" })
  if (githubArtifacts) add(PLAN, { id: "repo", label: "Repository", icon: "repo" })

  if (u) add(ANALYSIS, { id: "analysis", label: "Analysis summary", icon: "analysis" })
  if (functionalityTotal)
    add(ANALYSIS, { id: "functionality", label: "Functionality", icon: "functionality", count: functionalityTotal })
  if (userFlows.length) add(ANALYSIS, { id: "user-flows", label: "Flows detected", icon: "userFlows", count: userFlows.length })
  if (components.length) add(ANALYSIS, { id: "components", label: "Components", icon: "components", count: components.length })
  if (detectedEntities.length)
    add(ANALYSIS, { id: "detected-entities", label: "Entities detected", icon: "entities", count: detectedEntities.length })
  if (hasDesignSystem) add(ANALYSIS, { id: "design-system", label: "Design system", icon: "designSystem" })
  if (structureTotal)
    add(ANALYSIS, { id: "structure", label: "Site structure", icon: "structure", count: structureTotal })
  if (pages.length) add(ANALYSIS, { id: "pages", label: "Pages crawled", icon: "pages", count: pages.length })
  if (assets.length) add(ANALYSIS, { id: "assets", label: "Assets", icon: "assets", count: assets.length })
  if (screenshots.length)
    add(ANALYSIS, { id: "screenshots", label: "Screenshots", icon: "screenshots", count: screenshots.length })
  if (evidenceRefs.length) add(ANALYSIS, { id: "evidence", label: "Evidence", icon: "evidence", count: evidenceRefs.length })
  if (u?.confidenceNotes) add(ANALYSIS, { id: "confidence", label: "Confidence notes", icon: "health" })

  if (pa) add(QUALITY, { id: "health", label: "Plan health", icon: "health", count: findings.length })
  if (project.planUpdateNotes?.length)
    add(QUALITY, { id: "decisions", label: "Accepted changes", icon: "notes", count: project.planUpdateNotes.length })

  if (bs) add(DELIVERY, { id: "build", label: "Build report", icon: "build" })
  if (secrets.length)
    add(DELIVERY, { id: "secrets", label: "Secrets", icon: "secrets", count: secrets.length })
  if (hasDeployStory) add(DELIVERY, { id: "deployment", label: "Deployment", icon: "deploy", count: history.length })
  if (infra) add(DELIVERY, { id: "infrastructure", label: "Infrastructure", icon: "infrastructure" })
  if (events.length) add(DELIVERY, { id: "activity", label: "Activity", icon: "activity", count: events.length })
  if (convo.length) add(DELIVERY, { id: "conversation", label: "Conversation", icon: "conversation", count: convo.length })

  const complexityTone: Tone = s?.complexity === "complex" ? "danger" : s?.complexity === "medium" ? "warning" : "success"

  return (
    <DashboardShell title={project.name} projectId={project.id}>
      {/* ── Masthead ─────────────────────────────────────────────── */}
      <section className="border-b border-border bg-card/40">
        <div className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 lg:py-9 xl:px-8">
          <nav className="flex items-center gap-1.5 text-[13px] text-muted-foreground" aria-label="Breadcrumb">
            <Link href={`/project/${project.id}`} className="transition-colors hover:text-foreground">
              Workspace
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="text-foreground">Plan</span>
          </nav>

          <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">Application plan</p>
              <h1 className="mt-2 text-balance text-2xl font-bold tracking-tight sm:text-3xl">{project.name}</h1>
              <p className="mt-2.5 max-w-2xl text-sm leading-6 text-muted-foreground">
                {s?.purpose || s?.description || project.idea || "Everything Atai knows about this business, in one review."}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <PlanBadge tone="primary">{project.mode} mode</PlanBadge>
                {s?.complexity ? <PlanBadge tone={complexityTone}>{s.complexity} complexity</PlanBadge> : null}
                {s?.applicationType ? <PlanBadge>{s.applicationType}</PlanBadge> : null}
                <PlanBadge tone={project.state === "ready" || project.state === "deployed" ? "success" : "neutral"}>
                  {stateLabel(project)}
                </PlanBadge>
                {project.visibility ? <PlanBadge>{project.visibility}</PlanBadge> : null}
                {pa ? (
                  <PlanBadge tone={pa.healthPercent >= 75 ? "success" : pa.healthPercent >= 45 ? "warning" : "danger"}>
                    {pa.healthPercent}% plan health
                  </PlanBadge>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Link href={`/project/${project.id}/edit`} className={PRIMARY_BTN}>
                <Pencil className="size-4" />
                Edit plan
              </Link>
              <Link href={`/project/${project.id}`} className={GHOST_BTN}>
                Open workspace
              </Link>
              <a href={`/api/projects/${project.id}/export`} className={GHOST_BTN}>
                Export
              </a>
            </div>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-border bg-background/60 px-3 py-2.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Plan health</p>
              {pa ? (
                <>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Meter
                      value={pa.healthPercent}
                      tone={pa.healthPercent >= 75 ? "success" : pa.healthPercent >= 45 ? "warning" : "danger"}
                    />
                    <span className="shrink-0 text-base font-semibold tabular-nums">{pa.healthPercent}%</span>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">
                    {findings.length} finding{findings.length === 1 ? "" : "s"} · {formatDateTime(pa.generatedAt)}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Not analysed yet</p>
              )}
            </div>
            <StatTile label="Plan sections" value={specSectionCount} hint={`${business.length} business fields`} />
            <StatTile
              label="Features"
              value={features.length ? `${enabledFeatures.length}/${features.length}` : "—"}
              hint="enabled of planned"
            />
            <StatTile
              label="Source evidence"
              value={pages.length || (u?.sourceUrl ? 1 : 0)}
              hint={hostnameOf(project.sourceUrl) ?? (project.mode === "scratch" ? "Scratch idea" : "No source site")}
            />
          </div>
        </div>
      </section>

      {/* ── Body ─────────────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 xl:px-8">
        <div className="xl:grid xl:grid-cols-[236px_minmax(0,1fr)] xl:items-start xl:gap-8">
          <PlanOutline groups={outlineGroups} />

          <div className="flex min-w-0 flex-col gap-5">
            {/* ═══ Overview ═══ */}
            {s ? (
              <SectionCard id="overview" icon={FileText} title="Overview" description="What is being built and why">
                <div className="flex flex-col gap-4">
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight text-foreground">{s.title}</h3>
                    <p className="mt-1.5 text-sm leading-7 text-muted-foreground">{s.description}</p>
                  </div>
                  {s.purpose ? (
                    <div className="rounded-xl border-l-4 border-primary bg-primary/5 py-3 pl-4 pr-3">
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">Purpose</p>
                      <p className="mt-1 text-sm leading-6 text-foreground">{s.purpose}</p>
                    </div>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Application type">{s.applicationType}</Field>
                    <Field label="Complexity">{s.complexity ?? "Not set"}</Field>
                    <Field label="Build mode">{project.mode}</Field>
                  </div>
                </div>
              </SectionCard>
            ) : null}

            {/* ═══ Original idea ═══ */}
            {project.idea ? (
              <SectionCard id="idea" icon={Lightbulb} title="Original idea" description="What you asked for, in your words">
                <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{project.idea}</p>
              </SectionCard>
            ) : null}

            {/* ═══ Audience ═══ */}
            {targetUsers.length || userRoles.length ? (
              <SectionCard
                id="audience"
                icon={Users}
                title="Audience & roles"
                description="Who this is built for"
                count={targetUsers.length + userRoles.length}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  {targetUsers.length ? (
                    <Field label="Target users">
                      <ChipRow labels={targetUsers} />
                    </Field>
                  ) : null}
                  {userRoles.length ? (
                    <Field label="User roles">
                      <ChipRow labels={userRoles} />
                    </Field>
                  ) : null}
                </div>
              </SectionCard>
            ) : null}

            {/* ═══ Core flows ═══ */}
            {coreFlows.length ? (
              <SectionCard id="flows" icon={Route} title="Core user flows" description="The paths that must work" count={coreFlows.length}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {coreFlows.map((flow, i) => (
                    <div key={`${flow.name}-${i}`} className="flex gap-3 rounded-xl border border-border bg-background/60 p-4">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-[11px] font-bold text-primary">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{flow.name}</p>
                        {flow.description ? (
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{flow.description}</p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {/* ═══ Features ═══ */}
            {features.length ? (
              <SectionCard
                id="features"
                icon={Zap}
                title="Features"
                description={`${enabledFeatures.length} of ${features.length} enabled for the build`}
                count={features.length}
              >
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {features.map((f) => (
                    <div
                      key={f.key}
                      className={`flex items-start gap-3 rounded-xl border p-3.5 ${
                        f.enabled ? "border-primary/25 bg-primary/5" : "border-border bg-background/40 opacity-70"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                          f.enabled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {f.enabled ? "✓" : "—"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{f.label}</p>
                        {f.description ? <p className="mt-0.5 text-xs text-muted-foreground">{f.description}</p> : null}
                        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
                          {f.key}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {/* ═══ Data model ═══ */}
            {specEntities.length ? (
              <SectionCard id="data" icon={Database} title="Data model" description="Planned entities and fields" count={specEntities.length}>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {specEntities.map((entity, i) => (
                    <div key={`${entity.name}-${i}`} className="rounded-xl border border-border bg-background/60 p-4">
                      <p className="font-mono text-sm font-bold text-foreground">{entity.name}</p>
                      {entity.description ? (
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{entity.description}</p>
                      ) : null}
                      {entity.fields.length ? (
                        <div className="mt-2.5 flex flex-wrap gap-1">
                          {entity.fields.map((field, j) => (
                            <code key={`${field}-${j}`} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                              {field}
                            </code>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {/* ═══ Technical ═══ */}
            {backendReqs.length || integrations.length || s?.authenticationRequirements ? (
              <SectionCard
                id="technical"
                icon={Server}
                title="Technical requirements"
                description="Backend, auth and third-party services"
                count={backendReqs.length + integrations.length}
              >
                <div className="flex flex-col gap-4">
                  {s?.authenticationRequirements ? (
                    <Field label="Authentication">{s.authenticationRequirements}</Field>
                  ) : null}
                  {backendReqs.length ? (
                    <div>
                      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        Backend
                      </p>
                      <BulletList items={backendReqs} />
                    </div>
                  ) : null}
                  {integrations.length ? (
                    <Field label="Integrations">
                      <ChipRow labels={integrations} />
                    </Field>
                  ) : null}
                </div>
              </SectionCard>
            ) : null}

            {/* ═══ Design & rules ═══ */}
            {designRows.length ? (
              <SectionCard id="design" icon={Palette} title="Design & rules" description="Look, feel and standing instructions" count={designRows.length}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {designRows.map((row) => (
                    <Field key={row.label} label={row.label} multiline className={row.label === "Additional instructions" ? "sm:col-span-2" : undefined}>
                      {row.value}
                    </Field>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {/* ═══ Business plan ═══ */}
            {business.length ? (
              <SectionCard
                id="business"
                icon={TrendingUp}
                title="Business plan"
                description="The commercial layer drafted with your co-founder"
                count={business.length}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {business.map((row) => (
                    <Field key={row.key} label={row.label} multiline className="sm:col-span-2 lg:col-span-1">
                      {row.value}
                    </Field>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {/* ═══ Preferences ═══ */}
            {prefRows.length || prefs?.additionalNotes ? (
              <SectionCard id="preferences" icon={SlidersHorizontal} title="Your preferences" description="Choices you made when setting this up">
                <div className="flex flex-col gap-3">
                  {prefRows.length ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {prefRows.map((row) => (
                        <Field key={row.label} label={row.label}>
                          {row.value}
                        </Field>
                      ))}
                    </div>
                  ) : null}
                  {prefs?.additionalNotes ? (
                    <Field label="Additional notes" multiline>
                      {prefs.additionalNotes}
                    </Field>
                  ) : null}
                </div>
              </SectionCard>
            ) : null}

            {/* ═══ Project record ═══ */}
            <SectionCard id="record" icon={Layers} title="Project record" description="Identifiers, source and lifecycle">
              <div className="flex flex-col gap-4">
                {project.error ? (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-destructive">Last error</p>
                    <p className="mt-1 text-sm leading-6 text-foreground/90">{project.error}</p>
                  </div>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Project ID">
                    <code className="font-mono text-xs break-all">{project.id}</code>
                  </Field>
                  <Field label="State">{stateLabel(project)}</Field>
                  <Field label="Visibility">{project.visibility ?? "private"}</Field>
                  <Field label="Created">{formatDateTime(project.createdAt)}</Field>
                  <Field label="Last updated">{formatDateTime(project.updatedAt)}</Field>
                  <Field label="Crawl / pipeline">
                    {[project.crawlMode, project.pipelineMode].filter(Boolean).join(" · ") || "—"}
                  </Field>
                  {project.totalumProjectId ? (
                    <Field label="Runtime project">
                      <code className="font-mono text-xs break-all">{project.totalumProjectId}</code>
                    </Field>
                  ) : null}
                  {project.developmentUrl ? (
                    <Field label="Development URL">
                      <a href={project.developmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline">
                        {project.developmentUrl}
                        <ExternalLink className="size-3" />
                      </a>
                    </Field>
                  ) : null}
                  {s ? (
                    <Field label="Specification">
                      {project.specSanitized ? "Sanitized for build" : "As generated"}
                    </Field>
                  ) : null}
                </div>
                {project.sourceUrl ? (
                  <Field label="Source website">
                    <a href={project.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                      {project.sourceUrl}
                      <ExternalLink className="size-3.5" />
                    </a>
                  </Field>
                ) : null}
              </div>
            </SectionCard>

            {/* ═══ Repository (github mode) ═══ */}
            {githubArtifacts ? (
              <SectionCard id="repo" icon={Code2} title="Source repository" description="Imported from the linked GitHub repository">
                <div className="flex flex-col gap-4">
                  {project.githubReadme ? (
                    <div>
                      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">README</p>
                      <div className="rounded-xl border border-border bg-background/60 p-4">
                        <MarkdownBlock text={project.githubReadme} />
                      </div>
                    </div>
                  ) : null}
                  {project.githubFileTree ? (
                    <div>
                      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">File tree</p>
                      <pre className="max-h-80 overflow-auto rounded-xl border border-border bg-background/60 p-4 font-mono text-[11px] leading-5 text-muted-foreground">
                        {project.githubFileTree}
                      </pre>
                    </div>
                  ) : null}
                  {project.githubZipUrl ? (
                    <a href={project.githubZipUrl} target="_blank" rel="noreferrer" className={GHOST_BTN}>
                      <ExternalLink className="size-4" />
                      Download source archive
                    </a>
                  ) : null}
                </div>
              </SectionCard>
            ) : null}

            {/* ═══ Analysis summary ═══ */}
            {u ? (
              <SectionCard id="analysis" icon={Brain} title="Analysis summary" description="What the AI read from the live site">
                <div className="flex flex-col gap-4">
                  {u.title ? <h3 className="text-lg font-semibold tracking-tight text-foreground">{u.title}</h3> : null}
                  {u.description ? <p className="text-sm leading-7 text-muted-foreground">{u.description}</p> : null}
                  {u.purpose ? (
                    <div className="rounded-xl border-l-4 border-primary/60 bg-primary/5 py-3 pl-4 pr-3">
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary/80">Purpose</p>
                      <p className="mt-1 text-sm leading-6 text-foreground">{u.purpose}</p>
                    </div>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Category">{u.websiteCategory ?? "—"}</Field>
                    <Field label="Application type">{u.applicationType ?? "—"}</Field>
                    <Field label="Responsive behaviour">{u.responsiveBehavior ?? "—"}</Field>
                  </div>
                  {u.targetUsers.length || u.userRoles.length ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {u.targetUsers.length ? (
                        <Field label="Observed audience">
                          <ChipRow labels={u.targetUsers} />
                        </Field>
                      ) : null}
                      {u.userRoles.length ? (
                        <Field label="Observed roles">
                          <ChipRow labels={u.userRoles} />
                        </Field>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </SectionCard>
            ) : null}

            {/* ═══ Functionality ═══ */}
            {functionalityTotal ? (
              <SectionCard id="functionality" icon={ListChecks} title="Functionality" description="Observed facts kept separate from guesses" count={functionalityTotal}>
                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    { label: "Observed", items: observed, tone: "success" as Tone, dot: "bg-success" },
                    { label: "Inferred", items: inferred, tone: "info" as Tone, dot: "bg-blue-500" },
                    { label: "Suggested", items: suggested, tone: "warning" as Tone, dot: "bg-amber-500" },
                  ]
                    .filter((col) => col.items.length)
                    .map((col) => (
                      <div key={col.label} className="rounded-xl border border-border bg-background/60 p-4">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <p className={`font-mono text-[10px] uppercase tracking-[0.16em] ${col.tone === "success" ? "text-success" : col.tone === "info" ? "text-blue-600 dark:text-blue-400" : "text-amber-600 dark:text-amber-400"}`}>
                            {col.label}
                          </p>
                          <PlanBadge tone={col.tone} className="font-mono tabular-nums">
                            {col.items.length}
                          </PlanBadge>
                        </div>
                        <ul className="flex flex-col gap-2">
                          {col.items.map((item, i) => (
                            <li key={`${item}-${i}`} className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                              <span className={`mt-1.5 size-1 shrink-0 rounded-full ${col.dot}`} />
                              <span className="min-w-0">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                </div>
              </SectionCard>
            ) : null}

            {/* ═══ Detected user flows ═══ */}
            {userFlows.length ? (
              <SectionCard id="user-flows" icon={Route} title="Flows detected" description="How the live site is used today" count={userFlows.length}>
                <div className="flex flex-col gap-4">
                  {userFlows.map((flow, i) => (
                    <div key={`${flow.name}-${i}`} className="rounded-xl border border-border bg-background/60 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{flow.name}</p>
                        <PlanBadge tone={CONFIDENCE_TONE[flow.confidence] ?? "neutral"}>{flow.confidence}</PlanBadge>
                      </div>
                      {flow.steps.length ? (
                        <ol className="mt-3 flex flex-col gap-1.5">
                          {flow.steps.map((step, j) => (
                            <li key={j} className="flex items-start gap-2.5 text-xs leading-5 text-muted-foreground">
                              <span className="font-mono text-[11px] font-bold text-primary">{j + 1}.</span>
                              <span className="min-w-0">{step}</span>
                            </li>
                          ))}
                        </ol>
                      ) : null}
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {/* ═══ Components ═══ */}
            {components.length ? (
              <SectionCard id="components" icon={Component} title="UI components" description="Interface pieces identified on the site" count={components.length}>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {components.map((c, i) => (
                    <div key={`${c.name}-${i}`} className="rounded-xl border border-border bg-background/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{c.name}</p>
                        <PlanBadge tone={CONFIDENCE_TONE[c.confidence] ?? "neutral"}>{c.confidence}</PlanBadge>
                      </div>
                      {c.description ? <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{c.description}</p> : null}
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {/* ═══ Detected entities ═══ */}
            {detectedEntities.length ? (
              <SectionCard id="detected-entities" icon={Database} title="Entities detected" description="Data the current site appears to hold" count={detectedEntities.length}>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {detectedEntities.map((e, i) => (
                    <div key={`${e.name}-${i}`} className="rounded-xl border border-border bg-background/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-mono text-sm font-bold text-foreground">{e.name}</p>
                        <PlanBadge tone={CONFIDENCE_TONE[e.confidence] ?? "neutral"}>{e.confidence}</PlanBadge>
                      </div>
                      {e.fields.length ? (
                        <div className="mt-2.5 flex flex-wrap gap-1">
                          {e.fields.map((field, j) => (
                            <code key={`${field}-${j}`} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                              {field}
                            </code>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {/* ═══ Design system ═══ */}
            {hasDesignSystem && ds ? (
              <SectionCard id="design-system" icon={Palette} title="Design system" description="Visual language read off the source site">
                <div className="flex flex-col gap-4">
                  {ds.visualLanguage ? <Field label="Visual language" multiline>{ds.visualLanguage}</Field> : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {ds.colors.length ? (
                      <Field label="Colours">
                        <div className="flex flex-wrap items-center gap-2">
                          {ds.colors.map((c, i) => (
                            <span key={`${c}-${i}`} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/70 py-0.5 pr-2 pl-1 text-xs">
                              <span className="size-3.5 shrink-0 rounded-[3px] border border-border" style={{ background: /^(#|rgb|hsl|oklch|var)/.test(c) ? c : undefined }} />
                              <span className="font-mono text-[11px]">{c}</span>
                            </span>
                          ))}
                        </div>
                      </Field>
                    ) : null}
                    {ds.typography.length ? (
                      <Field label="Typography">
                        <ChipRow labels={ds.typography} />
                      </Field>
                    ) : null}
                  </div>
                  {ds.imageryStyle ? <Field label="Imagery" multiline>{ds.imageryStyle}</Field> : null}
                  {ds.spacing || ds.radius ? (
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {ds.spacing ? <span><span className="font-medium text-foreground">Spacing:</span> {ds.spacing}</span> : null}
                      {ds.radius ? <span><span className="font-medium text-foreground">Radius:</span> {ds.radius}</span> : null}
                    </div>
                  ) : null}
                </div>
              </SectionCard>
            ) : null}

            {/* ═══ Site structure ═══ */}
            {structureTotal ? (
              <SectionCard id="structure" icon={ClipboardList} title="Site structure" description="Navigation, interactions and content layout" count={structureTotal}>
                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    { label: "Navigation", items: navigation },
                    { label: "Interactions", items: interactions },
                    { label: "Content structure", items: contentStructure },
                  ]
                    .filter((col) => col.items.length)
                    .map((col) => (
                      <div key={col.label}>
                        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{col.label}</p>
                        <BulletList items={col.items} tone="neutral" />
                      </div>
                    ))}
                </div>
              </SectionCard>
            ) : null}

            {/* ═══ Pages ═══ */}
            {pages.length ? (
              <SectionCard id="pages" icon={Compass} title="Pages crawled" description="Every page the analysis walked through" count={pages.length}>
                <div className="flex flex-col gap-2">
                  {pages.map((page, i) => (
                    <div
                      key={`${page.url}-${i}`}
                      className={`flex flex-col gap-2 rounded-xl border p-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4 ${
                        page.importance === "primary" ? "border-primary/25 bg-primary/5" : "border-border bg-background/60"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="break-all font-mono text-[11px] text-muted-foreground">{page.url}</p>
                        {page.title ? <p className="mt-0.5 text-sm font-medium text-foreground">{page.title}</p> : null}
                        {page.role ? <p className="mt-0.5 text-xs text-muted-foreground/80">{page.role}</p> : null}
                        {page.summary ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{page.summary}</p> : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <a href={page.url} target="_blank" rel="noreferrer" className="text-muted-foreground transition-colors hover:text-primary" aria-label={`Open ${page.url}`}>
                          <ExternalLink className="size-3.5" />
                        </a>
                        <PlanBadge tone={page.importance === "primary" ? "primary" : "neutral"}>{page.importance}</PlanBadge>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {/* ═══ Assets ═══ */}
            {assets.length ? (
              <SectionCard id="assets" icon={ImageIcon} title="Assets" description="Media and static resources referenced by the site" count={assets.length}>
                <div className="max-h-72 overflow-y-auto rounded-xl border border-border bg-background/60 p-4">
                  <ul className="flex flex-col gap-1.5">
                    {assets.map((asset, i) => (
                      <li key={`${asset}-${i}`} className="break-all font-mono text-[11px] text-muted-foreground">{asset}</li>
                    ))}
                  </ul>
                </div>
              </SectionCard>
            ) : null}

            {/* ═══ Screenshots ═══ */}
            {screenshots.length ? (
              <SectionCard id="screenshots" icon={Camera} title="Screenshots" description="Captured during the crawl" count={screenshots.length}>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {screenshots.map((src, i) => (
                    <a
                      key={`${src}-${i}`}
                      href={src}
                      target="_blank"
                      rel="noreferrer"
                      className="group block overflow-hidden rounded-xl border border-border bg-background transition-colors hover:border-primary/40"
                    >
                      <img src={src} alt={`Screenshot ${i + 1}`} className="aspect-video w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]" />
                    </a>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {/* ═══ Evidence ═══ */}
            {evidenceRefs.length ? (
              <SectionCard id="evidence" icon={ClipboardList} title="Evidence references" description="Raw sources behind the analysis" count={evidenceRefs.length}>
                <ul className="flex flex-col gap-1.5">
                  {evidenceRefs.map((ref, i) => (
                    <li key={`${ref}-${i}`} className="break-all font-mono text-[11px] text-muted-foreground">{ref}</li>
                  ))}
                </ul>
              </SectionCard>
            ) : null}

            {/* ═══ Confidence notes ═══ */}
            {u?.confidenceNotes ? (
              <SectionCard id="confidence" icon={Gauge} title="Confidence notes" description="Where the analysis is uncertain">
                <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{u.confidenceNotes}</p>
              </SectionCard>
            ) : null}

            {/* ═══ Plan health ═══ */}
            {pa ? (
              <SectionCard id="health" icon={Gauge} title="Plan health" description={`Scored ${formatDateTime(pa.generatedAt)}${pa.creditsCharged ? ` · ${pa.creditsCharged} credits` : ""}`} count={findings.length}>
                <div className="flex flex-col gap-5">
                  <div className="rounded-xl border border-border bg-background/60 p-4">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-2xl font-bold tabular-nums text-foreground">{pa.healthPercent}</span>
                      <span className="font-mono text-xs text-muted-foreground">/ 100</span>
                      <div className="flex flex-1 items-center">
                        <Meter value={pa.healthPercent} tone={pa.healthPercent >= 75 ? "success" : pa.healthPercent >= 45 ? "warning" : "danger"} />
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{pa.summary}</p>
                  </div>

                  {pa.nextBestAction ? (
                    <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3.5">
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">Next best action</p>
                      <p className="mt-1.5 text-sm font-semibold text-foreground">{pa.nextBestAction.title}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{pa.nextBestAction.why}</p>
                      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        Section · {pa.nextBestAction.section}
                      </p>
                    </div>
                  ) : null}

                  {findings.length ? (
                    <div>
                      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Findings</p>
                      <div className="flex flex-col gap-3">
                        {findings.map((f, i) => (
                          <div key={`${f.title}-${i}`} className="rounded-xl border border-border bg-background/60 p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <PlanBadge tone={SEVERITY_TONE[f.severity] ?? "neutral"}>{f.severity}</PlanBadge>
                              <p className="text-sm font-semibold text-foreground">{f.title}</p>
                              <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{f.section}</span>
                            </div>
                            <dl className="mt-3 flex flex-col gap-2 text-xs leading-5">
                              <div className="flex gap-2">
                                <dt className="shrink-0 font-medium text-muted-foreground/70">Now:</dt>
                                <dd className="min-w-0 text-muted-foreground">{f.currentState}</dd>
                              </div>
                              <div className="flex gap-2">
                                <dt className="shrink-0 font-medium text-muted-foreground/70">Why:</dt>
                                <dd className="min-w-0 text-muted-foreground">{f.why}</dd>
                              </div>
                              <div className="flex gap-2">
                                <dt className="shrink-0 font-medium text-success">Fix:</dt>
                                <dd className="min-w-0 text-foreground/90">{f.recommendation}</dd>
                              </div>
                            </dl>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {proposals.length ? (
                    <div>
                      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        Pending proposals ({proposals.length})
                      </p>
                      <div className="flex flex-col gap-3">
                        {proposals.map((p) => (
                          <div key={p.id} className="rounded-xl border border-border bg-background/60 p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <PlanBadge tone="info">{p.source}</PlanBadge>
                              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{p.section}</span>
                              <span className="ml-auto text-[11px] text-muted-foreground">{formatDate(Date.parse(p.createdAt))}</span>
                            </div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Current</p>
                                <p className="mt-1 text-xs leading-5 whitespace-pre-wrap text-muted-foreground">{p.currentValue}</p>
                              </div>
                              <div className="rounded-lg border border-success/30 bg-success/5 px-3 py-2">
                                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-success">Proposed</p>
                                <p className="mt-1 text-xs leading-5 whitespace-pre-wrap text-foreground/90">{p.proposedValue}</p>
                              </div>
                            </div>
                            <p className="mt-2.5 text-xs leading-5 text-muted-foreground">{p.reason}</p>
                          </div>
                        ))}
                      </div>
                      <Link href={`/project/${project.id}/collaborate`} className={`${GHOST_BTN} mt-3`}>
                        <Sparkles className="size-4" />
                        Review proposals in Collaborate
                      </Link>
                    </div>
                  ) : null}
                </div>
              </SectionCard>
            ) : null}

            {/* ═══ Accepted decisions ═══ */}
            {project.planUpdateNotes?.length ? (
              <SectionCard id="decisions" icon={ListChecks} title="Accepted changes" description="Decisions you approved, fed back into the AI context" count={project.planUpdateNotes.length}>
                <BulletList items={project.planUpdateNotes} tone="success" />
              </SectionCard>
            ) : null}

            {/* ═══ Build report ═══ */}
            {bs ? (
              <SectionCard id="build" icon={Hammer} title="Build report" description={`Captured ${formatDateTime(bs.createdAt)}`}>
                <div className="rounded-xl border border-border bg-background/60 p-4">
                  <MarkdownBlock text={bs.message} />
                </div>
                {bs.versionId ? (
                  <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    Version · <span className="text-foreground">{bs.versionId}</span>
                  </p>
                ) : null}
              </SectionCard>
            ) : null}

            {/* ═══ Secrets ═══ */}
            {secrets.length ? (
              <SectionCard id="secrets" icon={ShieldCheck} title="Secrets" description="Keys the built app expects at runtime" count={secrets.length}>
                <div className="flex flex-col gap-4">
                  {missingSecrets.length ? (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                      <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                        {missingSecrets.length} secret{missingSecrets.length === 1 ? "" : "s"} still missing
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        The deployed app will error until these are set in Environment.
                      </p>
                      <Link href={`/project/${project.id}/env`} className={`${GHOST_BTN} mt-3 bg-card`}>
                        <Settings2 className="size-4" />
                        Open environment
                      </Link>
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-2">
                    {secrets.map(([key, val]) => (
                      <div key={key} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background/60 px-4 py-3">
                        <div className="min-w-0">
                          <code className="font-mono text-xs font-bold text-foreground">{key}</code>
                          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{val.description}</p>
                        </div>
                        <PlanBadge tone={val.isProvided ? "success" : "danger"}>{val.isProvided ? "Set" : "Missing"}</PlanBadge>
                      </div>
                    ))}
                  </div>
                </div>
              </SectionCard>
            ) : null}

            {/* ═══ Deployment ═══ */}
            {hasDeployStory ? (
              <SectionCard id="deployment" icon={Rocket} title="Deployment" description="Where this build currently lives" count={history.length}>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background/60 px-4 py-3">
                    <PlanBadge tone={DEPLOY_TONE[deployment?.status ?? "idle"] ?? "neutral"}>{deployment?.status ?? "idle"}</PlanBadge>
                    {deployment?.productionUrl ? (
                      <a href={deployment.productionUrl} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1.5 text-sm text-primary hover:underline">
                        <span className="truncate">{deployment.productionUrl}</span>
                        <ExternalLink className="size-3.5 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground">Not deployed yet</span>
                    )}
                    <span className="ml-auto text-[11px] text-muted-foreground">Updated {formatDateTime(deployment?.updatedAt)}</span>
                  </div>
                  {deployment?.error ? (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-destructive">Deploy error</p>
                      <p className="mt-1 text-sm leading-6 text-foreground/90">{deployment.error}</p>
                    </div>
                  ) : null}
                  {history.length ? (
                    <div>
                      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">History</p>
                      <div className="flex flex-col gap-2">
                        {history.map((entry) => (
                          <div key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-background/60 px-4 py-2.5 text-xs">
                            <PlanBadge tone={DEPLOY_TONE[entry.status] ?? "neutral"}>{entry.status}</PlanBadge>
                            <span className="text-muted-foreground">{formatDateTime(entry.startedAt)}</span>
                            {entry.customDomain ? <code className="font-mono text-[11px] text-foreground/80">{entry.customDomain}</code> : null}
                            {typeof entry.creditsCharged === "number" ? (
                              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{entry.creditsCharged} credits</span>
                            ) : null}
                            {entry.productionUrl ? (
                              <a href={entry.productionUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-primary hover:underline">
                                Visit <ExternalLink className="size-3" />
                              </a>
                            ) : null}
                            {entry.error ? <span className="w-full text-destructive">{entry.error}</span> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <Link href={`/project/${project.id}/hosting`} className={GHOST_BTN}>
                    <Globe className="size-4" />
                    Hosting settings
                  </Link>
                </div>
              </SectionCard>
            ) : null}

            {/* ═══ Infrastructure ═══ */}
            {infra ? (
              <SectionCard id="infrastructure" icon={Server} title="Infrastructure" description="Plan, quota and sync status">
                <div className="flex flex-col gap-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Plan">{infra.planName}</Field>
                    <Field label="Status">{infra.status}</Field>
                    <Field label="Auto-renew">{infra.autoRenew ? "On" : "Off"}</Field>
                    <Field label="Renews / expires">{formatDate(infra.expiresAt)}</Field>
                  </div>
                  <div className="flex flex-col gap-3 rounded-xl border border-border bg-background/60 p-4">
                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Storage</span>
                        <span className="font-mono tabular-nums text-muted-foreground">
                          {formatBytes(infra.storageUsedBytes)} / {formatBytes(infra.storageLimitBytes)}
                        </span>
                      </div>
                      <Meter
                        value={infra.storageLimitBytes ? (infra.storageUsedBytes ?? 0) / infra.storageLimitBytes * 100 : 0}
                        tone={infra.overQuota ? "danger" : "primary"}
                      />
                    </div>
                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Runtime credits</span>
                        <span className="font-mono tabular-nums text-muted-foreground">
                          {infra.totalumCreditsUsed ?? 0} / {infra.totalumInfrastructureCreditLimit}
                        </span>
                      </div>
                      <Meter
                        value={infra.totalumInfrastructureCreditLimit ? ((infra.totalumCreditsUsed ?? 0) / infra.totalumInfrastructureCreditLimit) * 100 : 0}
                        tone="primary"
                      />
                    </div>
                    {infra.syncStatus ? (
                      <p className="text-[11px] text-muted-foreground">
                        Sync {infra.syncStatus}
                        {infra.lastUsageSyncAt ? ` · ${formatDateTime(infra.lastUsageSyncAt)}` : ""}
                      </p>
                    ) : null}
                  </div>
                </div>
              </SectionCard>
            ) : null}

            {/* ═══ Activity ═══ */}
            {events.length ? (
              <SectionCard id="activity" icon={Activity} title="Activity" description="Pipeline events recorded for this project" count={events.length}>
                <details className="group" open={events.length <= 12}>
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-border bg-background/60 px-4 py-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent/50 [&::-webkit-details-marker]:hidden">
                    <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
                    Showing {Math.min(12, events.length)} of {events.length} events
                  </summary>
                  <ol className="mt-3 flex flex-col gap-1">
                    {events.slice(-12).reverse().map((ev) => (
                      <li key={ev.id} className="flex gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/40">
                        <span
                          className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                            ev.level === "error" ? "bg-destructive" : ev.level === "warn" ? "bg-amber-500" : "bg-primary"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{ev.stage}</p>
                            <time className="ml-auto text-[11px] text-muted-foreground/70">{formatDateTime(ev.at)}</time>
                          </div>
                          <p className="mt-0.5 text-sm leading-6 text-foreground/90">{ev.message}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </details>
              </SectionCard>
            ) : null}

            {/* ═══ Conversation ═══ */}
            {convo.length ? (
              <SectionCard id="conversation" icon={MessageSquare} title="Conversation" description="Everything exchanged with the builder AI" count={convo.length}>
                <details className="group" open={convo.length <= 8}>
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-border bg-background/60 px-4 py-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent/50 [&::-webkit-details-marker]:hidden">
                    <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
                    Showing {Math.min(12, convo.length)} of {convo.length} messages
                  </summary>
                  <div className="mt-3 flex flex-col gap-3">
                    {convo.slice(-12).reverse().map((msg, i) => (
                      <div
                        key={msg.id ?? i}
                        className={`rounded-xl border p-4 ${
                          msg.role === "user"
                            ? "border-primary/25 bg-primary/5"
                            : msg.role === "system"
                              ? "border-border bg-muted/30"
                              : "border-border bg-background/60"
                        }`}
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <PlanBadge tone={msg.role === "user" ? "primary" : msg.role === "system" ? "neutral" : "info"}>
                            {msg.role}
                          </PlanBadge>
                          <time className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                            {formatDateTime(msg.at)}
                          </time>
                        </div>
                        {msg.role === "user" ? (
                          <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/90">{msg.content}</p>
                        ) : (
                          <MarkdownBlock text={msg.content} />
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              </SectionCard>
            ) : null}

            <p className="pt-2 text-center text-[11px] text-muted-foreground">
              <Link href={`/project/${project.id}`} className="hover:text-foreground">
                ← Back to workspace
              </Link>
            </p>
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
