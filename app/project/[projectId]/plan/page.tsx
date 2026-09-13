import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { AppHeader } from "@/components/app-header"
import { getCurrentUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import Markdown from "react-markdown"

// ─── Small helpers ────────────────────────────────────────────────────────────

function Badge({ children, color = "default" }: { children: React.ReactNode; color?: "default" | "green" | "blue" | "purple" | "amber" | "red" }) {
  const cls = {
    default: "bg-muted text-muted-foreground",
    green: "bg-green-500/10 text-green-600 dark:text-green-400",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    red: "bg-red-500/10 text-red-600 dark:text-red-400",
  }[color]
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{children}</span>
}

function Card({ title, children, icon }: { title: string; children: React.ReactNode; icon?: string }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        {icon && <span className="text-base">{icon}</span>}
        <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Chip({ label }: { label: string }) {
  return <span className="rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs text-foreground">{label}</span>
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 py-2">
      <div className="flex-1 border-t border-border" />
      <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="flex-1 border-t border-border" />
    </div>
  )
}

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
  const conv = (project.conversation ?? []).filter(m => m.role === "assistant" && m.content?.trim())
  const prefs = project.preferences

  const hasAnything = Boolean(u || s || bs || project.idea)

  if (!hasAnything) {
    return (
      <main className="min-h-svh bg-background text-foreground">
        <AppHeader />
        <div className="mx-auto max-w-4xl px-6 py-10">
          <Link href={`/project/${projectId}`} className="font-mono text-xs text-primary hover:underline">← Back to workspace</Link>
          <div className="mt-16 flex flex-col items-center gap-4 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted text-3xl">🔬</div>
            <h1 className="text-2xl font-semibold">No plan yet</h1>
            <p className="max-w-md text-muted-foreground text-sm">
              Analysis hasn't run yet. Once complete, the full specification, AI analysis, and build output will appear here.
            </p>
          </div>
        </div>
      </main>
    )
  }

  const complexityColor = s?.complexity === "complex" ? "purple" : s?.complexity === "medium" ? "amber" : "green"

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AppHeader />
      <div className="mx-auto max-w-5xl px-6 py-10 lg:px-10">

        {/* ── Page header ─────────────────────────────────────── */}
        <div className="mb-8 flex flex-col gap-4 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3">
            <Link href={`/project/${projectId}`} className="font-mono text-xs text-primary hover:underline">← Back to workspace</Link>
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            <div className="flex flex-wrap items-center gap-2">
              {s?.complexity && <Badge color={complexityColor}>{s.complexity} complexity</Badge>}
              <Badge color="blue">{project.mode} mode</Badge>
              {s?.applicationType && <Badge>{s.applicationType}</Badge>}
              {project.state && <Badge color={project.state === "ready" ? "green" : "default"}>{project.state.replace(/_/g, " ")}</Badge>}
            </div>
          </div>
          <Link href={`/project/${projectId}`} className="shrink-0 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">
            Open workspace →
          </Link>
        </div>

        <div className="flex flex-col gap-6">

          {/* ══ ORIGINAL IDEA (scratch mode) ══════════════════════════ */}
          {project.idea && (
            <Card title="Original Idea" icon="💡">
              <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{project.idea}</p>
            </Card>
          )}

          {/* ══ BUILD SUMMARY (post-build AI report) ══════════════════ */}
          {bs && (
            <Card title="AI Build Report" icon="🤖">
              <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                <Markdown>{bs.message}</Markdown>
              </div>
              {bs.secretKeysNeeded && Object.keys(bs.secretKeysNeeded).length > 0 && (
                <div className="mt-4 flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <p className="font-mono text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                    🔑 Secrets Required
                  </p>
                  <div className="flex flex-col gap-2">
                    {Object.entries(bs.secretKeysNeeded).map(([key, val]) => (
                      <div key={key} className="flex items-start justify-between gap-3">
                        <div>
                          <code className="font-mono text-xs font-bold text-foreground">{key}</code>
                          <p className="mt-0.5 text-xs text-muted-foreground">{val.description}</p>
                        </div>
                        <Badge color={val.isProvided ? "green" : "red"}>{val.isProvided ? "Set" : "Missing"}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {bs.versionId && (
                <p className="font-mono text-[10px] text-muted-foreground/60">Version: {bs.versionId}</p>
              )}
            </Card>
          )}

          {/* ══ SPECIFICATION ══════════════════════════════════════════ */}
          {s && (
            <>
              <Divider label="Application Specification" />

              <Card title="Overview" icon="📋">
                <div className="flex flex-col gap-3">
                  <h3 className="text-xl font-bold text-foreground">{s.title}</h3>
                  <p className="text-sm leading-7 text-muted-foreground">{s.description}</p>
                  {s.purpose && (
                    <div className="rounded-lg border-l-4 border-primary bg-primary/5 py-3 pl-4 pr-3">
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-primary">Purpose</p>
                      <p className="mt-1 text-sm leading-6 text-foreground">{s.purpose}</p>
                    </div>
                  )}
                </div>
              </Card>

              {(s.targetUsers.length > 0 || s.userRoles.length > 0) && (
                <div className="grid gap-6 sm:grid-cols-2">
                  {s.targetUsers.length > 0 && (
                    <Card title="Target Users" icon="👥">
                      <div className="flex flex-wrap gap-2">{s.targetUsers.map(u => <Chip key={u} label={u} />)}</div>
                    </Card>
                  )}
                  {s.userRoles.length > 0 && (
                    <Card title="User Roles" icon="🎭">
                      <div className="flex flex-wrap gap-2">{s.userRoles.map(r => <Chip key={r} label={r} />)}</div>
                    </Card>
                  )}
                </div>
              )}

              {s.coreFlows.length > 0 && (
                <Card title="Core User Flows" icon="🔀">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {s.coreFlows.map((flow, i) => (
                      <div key={i} className="flex flex-col gap-1.5 rounded-lg border border-border bg-background p-4">
                        <div className="flex items-center gap-2">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-[11px] font-bold text-primary">{i + 1}</span>
                          <p className="font-semibold text-sm text-foreground">{flow.name}</p>
                        </div>
                        {flow.description && <p className="pl-8 text-xs leading-5 text-muted-foreground">{flow.description}</p>}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {s.suggestedFeatures.length > 0 && (
                <Card title="Features" icon="⚡">
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {s.suggestedFeatures.map(f => (
                      <div key={f.key} className={`flex items-start gap-3 rounded-lg border p-3.5 transition-colors ${f.enabled ? "border-primary/25 bg-primary/5" : "border-border bg-muted/20 opacity-55"}`}>
                        <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${f.enabled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                          {f.enabled ? "✓" : "○"}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{f.label}</p>
                          {f.description && <p className="mt-0.5 text-xs text-muted-foreground">{f.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {s.dataEntities.length > 0 && (
                <Card title="Data Model" icon="🗄️">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {s.dataEntities.map((entity, i) => (
                      <div key={i} className="rounded-lg border border-border bg-background p-4">
                        <p className="font-mono text-sm font-bold text-foreground">{entity.name}</p>
                        {entity.description && <p className="mt-0.5 text-xs text-muted-foreground">{entity.description}</p>}
                        {entity.fields.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {entity.fields.map(f => <code key={f} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{f}</code>)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {(s.backendRequirements.length > 0 || s.integrations.length > 0 || s.authenticationRequirements) && (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {s.authenticationRequirements && (
                    <Card title="Authentication" icon="🔐">
                      <p className="text-sm leading-6 text-muted-foreground">{s.authenticationRequirements}</p>
                    </Card>
                  )}
                  {s.backendRequirements.length > 0 && (
                    <Card title="Backend Requirements" icon="⚙️">
                      <ul className="flex flex-col gap-1.5">
                        {s.backendRequirements.map(r => (
                          <li key={r} className="flex items-start gap-2 text-sm">
                            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                            <span className="text-muted-foreground">{r}</span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )}
                  {s.integrations.length > 0 && (
                    <Card title="Integrations" icon="🔌">
                      <div className="flex flex-wrap gap-2">{s.integrations.map(i => <Chip key={i} label={i} />)}</div>
                    </Card>
                  )}
                </div>
              )}

              {(s.designDirection || s.responsiveRequirements) && (
                <div className="grid gap-6 sm:grid-cols-2">
                  {s.designDirection && (
                    <Card title="Design Direction" icon="🎨">
                      <p className="text-sm leading-6 text-muted-foreground">{s.designDirection}</p>
                    </Card>
                  )}
                  {s.responsiveRequirements && (
                    <Card title="Responsive Requirements" icon="📱">
                      <p className="text-sm leading-6 text-muted-foreground">{s.responsiveRequirements}</p>
                    </Card>
                  )}
                </div>
              )}

              {s.additionalInstructions && (
                <Card title="Additional Instructions" icon="📝">
                  <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{s.additionalInstructions}</p>
                </Card>
              )}
            </>
          )}

          {/* ══ USER PREFERENCES ══════════════════════════════════════ */}
          {prefs && (prefs.appName || prefs.stackType || prefs.authProviders || prefs.additionalNotes) && (
            <>
              <Divider label="User Preferences" />
              <Card title="Setup Preferences" icon="🎯">
                <div className="grid gap-4 sm:grid-cols-2">
                  {prefs.appName && (
                    <div>
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">App Name</p>
                      <p className="mt-1 text-sm text-foreground">{prefs.appName}</p>
                    </div>
                  )}
                  {prefs.stackType && prefs.stackType !== "unknown" && (
                    <div>
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Stack Type</p>
                      <p className="mt-1 text-sm capitalize text-foreground">{prefs.stackType}</p>
                    </div>
                  )}
                  {prefs.authProviders && prefs.authProviders !== "unknown" && (
                    <div>
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Auth Provider</p>
                      <p className="mt-1 text-sm capitalize text-foreground">{prefs.authProviders}</p>
                    </div>
                  )}
                  {prefs.databaseChoice && (
                    <div>
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Database</p>
                      <p className="mt-1 text-sm text-foreground">
                        {prefs.databaseChoice === "builtin" ? "Built-in (Totalum)" : prefs.customDbProvider ?? "Custom"}
                      </p>
                    </div>
                  )}
                  {prefs.additionalNotes && (
                    <div className="sm:col-span-2">
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Additional Notes</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{prefs.additionalNotes}</p>
                    </div>
                  )}
                </div>
              </Card>
            </>
          )}

          {/* ══ AI UNDERSTANDING (website analysis) ══════════════════ */}
          {u && (
            <>
              <Divider label="AI Website Analysis" />

              {(u.purpose || u.description) && (
                <Card title="Website Analysis" icon="🔬">
                  <div className="flex flex-col gap-3">
                    {u.title && <h3 className="font-semibold text-foreground">{u.title}</h3>}
                    {u.description && <p className="text-sm leading-7 text-muted-foreground">{u.description}</p>}
                    {u.purpose && (
                      <div className="rounded-lg border-l-4 border-primary/50 bg-primary/5 py-3 pl-4 pr-3">
                        <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-primary/70">Purpose</p>
                        <p className="mt-1 text-sm leading-6 text-foreground">{u.purpose}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {u.websiteCategory && <Chip label={u.websiteCategory} />}
                      {u.applicationType && <Chip label={u.applicationType} />}
                    </div>
                  </div>
                </Card>
              )}

              {(u.observedFunctionality.length > 0 || u.inferredFunctionality.length > 0 || u.suggestedFeatures.length > 0) && (
                <Card title="Functionality" icon="🧠">
                  <div className="grid gap-6 sm:grid-cols-3">
                    {u.observedFunctionality.length > 0 && (
                      <div>
                        <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-green-600 dark:text-green-400">✓ Observed</p>
                        <ul className="flex flex-col gap-1">
                          {u.observedFunctionality.map(f => <li key={f} className="text-xs leading-5 text-muted-foreground">{f}</li>)}
                        </ul>
                      </div>
                    )}
                    {u.inferredFunctionality.length > 0 && (
                      <div>
                        <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">~ Inferred</p>
                        <ul className="flex flex-col gap-1">
                          {u.inferredFunctionality.map(f => <li key={f} className="text-xs leading-5 text-muted-foreground">{f}</li>)}
                        </ul>
                      </div>
                    )}
                    {u.suggestedFeatures.length > 0 && (
                      <div>
                        <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">+ Suggested</p>
                        <ul className="flex flex-col gap-1">
                          {u.suggestedFeatures.map(f => <li key={f} className="text-xs leading-5 text-muted-foreground">{f}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {u.userFlows.length > 0 && (
                <Card title="User Flows" icon="🔀">
                  <div className="flex flex-col gap-5">
                    {u.userFlows.map((flow, i) => (
                      <div key={i} className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-foreground">{flow.name}</p>
                          <Badge color={flow.confidence === "observed" ? "green" : flow.confidence === "inferred" ? "blue" : "amber"}>{flow.confidence}</Badge>
                        </div>
                        {flow.steps.length > 0 && (
                          <ol className="flex flex-col gap-1.5 pl-2">
                            {flow.steps.map((step, j) => (
                              <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground">
                                <span className="mt-0.5 font-mono font-bold text-primary">{j + 1}.</span>
                                {step}
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {u.components.length > 0 && (
                <Card title="UI Components Detected" icon="🧩">
                  <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {u.components.map((c, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-lg border border-border bg-background p-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-foreground">{c.name}</p>
                            <Badge color={c.confidence === "observed" ? "green" : c.confidence === "inferred" ? "blue" : "amber"}>{c.confidence}</Badge>
                          </div>
                          {c.description && <p className="mt-0.5 text-xs text-muted-foreground">{c.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {u.designSystem && (u.designSystem.colors.length > 0 || u.designSystem.typography.length > 0 || u.designSystem.visualLanguage) && (
                <Card title="Design System" icon="🎨">
                  <div className="flex flex-col gap-4">
                    {u.designSystem.visualLanguage && <p className="text-sm leading-6 text-muted-foreground">{u.designSystem.visualLanguage}</p>}
                    {u.designSystem.imageryStyle && <p className="text-xs text-muted-foreground/70">{u.designSystem.imageryStyle}</p>}
                    {u.designSystem.colors.length > 0 && (
                      <div>
                        <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Colors</p>
                        <div className="flex flex-wrap gap-2">{u.designSystem.colors.map(c => <Chip key={c} label={c} />)}</div>
                      </div>
                    )}
                    {u.designSystem.typography.length > 0 && (
                      <div>
                        <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Typography</p>
                        <div className="flex flex-wrap gap-2">{u.designSystem.typography.map(t => <Chip key={t} label={t} />)}</div>
                      </div>
                    )}
                    {(u.designSystem.spacing || u.designSystem.radius) && (
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        {u.designSystem.spacing && <span><span className="font-medium">Spacing: </span>{u.designSystem.spacing}</span>}
                        {u.designSystem.radius && <span><span className="font-medium">Radius: </span>{u.designSystem.radius}</span>}
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {u.dataEntities.length > 0 && (
                <Card title="Data Entities Detected" icon="🗄️">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {u.dataEntities.map((e, i) => (
                      <div key={i} className="rounded-lg border border-border bg-background p-4">
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-sm font-bold text-foreground">{e.name}</p>
                          <Badge color={e.confidence === "observed" ? "green" : e.confidence === "inferred" ? "blue" : "amber"}>{e.confidence}</Badge>
                        </div>
                        {e.fields.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {e.fields.map(f => <code key={f} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{f}</code>)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {(u.backendRequirements.length > 0 || u.authenticationRequirements.length > 0) && (
                <div className="grid gap-6 sm:grid-cols-2">
                  {u.backendRequirements.length > 0 && (
                    <Card title="Backend Requirements" icon="⚙️">
                      <ul className="flex flex-col gap-1.5">
                        {u.backendRequirements.map(r => <li key={r} className="flex items-start gap-2 text-sm"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" /><span className="text-muted-foreground">{r}</span></li>)}
                      </ul>
                    </Card>
                  )}
                  {u.authenticationRequirements.length > 0 && (
                    <Card title="Auth Requirements" icon="🔐">
                      <ul className="flex flex-col gap-1.5">
                        {u.authenticationRequirements.map(r => <li key={r} className="flex items-start gap-2 text-sm"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" /><span className="text-muted-foreground">{r}</span></li>)}
                      </ul>
                    </Card>
                  )}
                </div>
              )}

              {(u.navigation.length > 0 || u.interactions.length > 0 || u.contentStructure.length > 0) && (
                <div className="grid gap-6 sm:grid-cols-3">
                  {u.navigation.length > 0 && (
                    <Card title="Navigation" icon="🗺️">
                      <ul className="flex flex-col gap-1">
                        {u.navigation.map(n => <li key={n} className="text-xs text-muted-foreground">{n}</li>)}
                      </ul>
                    </Card>
                  )}
                  {u.interactions.length > 0 && (
                    <Card title="Interactions" icon="🖱️">
                      <ul className="flex flex-col gap-1">
                        {u.interactions.map(i => <li key={i} className="text-xs text-muted-foreground">{i}</li>)}
                      </ul>
                    </Card>
                  )}
                  {u.contentStructure.length > 0 && (
                    <Card title="Content Structure" icon="📄">
                      <ul className="flex flex-col gap-1">
                        {u.contentStructure.map(c => <li key={c} className="text-xs text-muted-foreground">{c}</li>)}
                      </ul>
                    </Card>
                  )}
                </div>
              )}

              {u.pages.length > 0 && (
                <Card title="Pages Discovered" icon="📑">
                  <div className="flex flex-col gap-2">
                    {u.pages.map((page, i) => (
                      <div key={i} className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${page.importance === "primary" ? "border-primary/20 bg-primary/5" : "border-border bg-background"}`}>
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs text-muted-foreground">{page.url}</p>
                          {page.title && <p className="mt-0.5 text-sm font-medium text-foreground">{page.title}</p>}
                          {page.role && <p className="mt-0.5 text-xs text-muted-foreground/70">{page.role}</p>}
                          {page.summary && <p className="mt-0.5 text-xs text-muted-foreground">{page.summary}</p>}
                        </div>
                        <Badge color={page.importance === "primary" ? "blue" : "default"}>{page.importance}</Badge>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {u.responsiveBehavior && (
                <Card title="Responsive Behavior" icon="📱">
                  <p className="text-sm leading-6 text-muted-foreground">{u.responsiveBehavior}</p>
                </Card>
              )}

              {u.confidenceNotes && (
                <Card title="AI Confidence Notes" icon="💭">
                  <p className="text-sm leading-6 text-muted-foreground">{u.confidenceNotes}</p>
                </Card>
              )}

              {u.screenshots.length > 0 && (
                <Card title="Captured Screenshots" icon="📸">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {u.screenshots.map((src, i) => (
                      <a key={i} href={src} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-lg border border-border bg-background">
                        <img src={src} alt={`Screenshot ${i + 1}`} className="aspect-video w-full object-cover object-top transition-transform duration-300 group-hover:scale-105" />
                      </a>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}

          {/* ══ AI BUILD CONVERSATION ═════════════════════════════════ */}
          {conv.length > 0 && (
            <>
              <Divider label="AI Build Conversation" />
              <Card title="Builder AI Messages" icon="💬">
                <div className="flex flex-col gap-4">
                  {conv.slice(0, 20).map((msg, i) => (
                    <div key={msg.id ?? i} className="rounded-lg border border-border bg-background p-4">
                      <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        {new Date(msg.at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                        <Markdown>{msg.content}</Markdown>
                      </div>
                    </div>
                  ))}
                  {conv.length > 20 && (
                    <p className="text-center text-xs text-muted-foreground">{conv.length - 20} more messages not shown</p>
                  )}
                </div>
              </Card>
            </>
          )}

        </div>
      </div>
    </main>
  )
}
