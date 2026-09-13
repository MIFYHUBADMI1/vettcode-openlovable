import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { AppHeader } from "@/components/app-header"
import { getCurrentUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"

function Badge({ children, color = "default" }: { children: React.ReactNode; color?: "default" | "green" | "blue" | "purple" | "amber" }) {
  const cls = {
    default: "bg-muted text-muted-foreground",
    green:   "bg-green-500/10 text-green-600 dark:text-green-400",
    blue:    "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    purple:  "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    amber:   "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  }[color]
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{children}</span>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
      <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</h2>
      {children}
    </div>
  )
}

function Tag({ label }: { label: string }) {
  return (
    <span className="rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs text-foreground">
      {label}
    </span>
  )
}

export default async function ProjectPlanPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser()
  const { projectId } = await params
  if (!user) redirect(`/login?next=/project/${projectId}/plan`)

  const project = await store.getProject(projectId)
  if (!project || project.userId !== user.id) notFound()

  const u = project.understanding
  const s = project.specification

  const hasUnderstanding = Boolean(u)
  const hasSpec = Boolean(s)

  if (!hasUnderstanding && !hasSpec) {
    return (
      <main className="min-h-svh bg-background text-foreground">
        <AppHeader />
        <div className="mx-auto max-w-4xl px-6 py-10">
          <Link href={`/project/${projectId}`} className="font-mono text-xs text-primary hover:underline">← Back to workspace</Link>
          <div className="mt-12 flex flex-col items-center gap-4 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              <span className="text-3xl">🔬</span>
            </div>
            <h1 className="text-2xl font-semibold">No plan yet</h1>
            <p className="max-w-md text-muted-foreground">
              The AI hasn't analyzed this project yet. Once analysis completes, the full specification and understanding will appear here.
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
      <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3">
            <Link href={`/project/${projectId}`} className="font-mono text-xs text-primary hover:underline">
              ← Back to workspace
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            <div className="flex flex-wrap items-center gap-2">
              {s?.complexity && <Badge color={complexityColor}>{s.complexity} complexity</Badge>}
              <Badge color="blue">{project.mode} mode</Badge>
              {s?.applicationType && <Badge>{s.applicationType}</Badge>}
            </div>
          </div>
          <Link
            href={`/project/${projectId}`}
            className="shrink-0 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
          >
            Open workspace →
          </Link>
        </div>

        <div className="flex flex-col gap-6">

          {/* ── SPECIFICATION ──────────────────────────────────── */}
          {s && (
            <>
              <Section title="Application Overview">
                <div className="flex flex-col gap-2">
                  <h3 className="text-xl font-semibold text-foreground">{s.title}</h3>
                  <p className="text-sm leading-7 text-muted-foreground">{s.description}</p>
                  {s.purpose && (
                    <div className="mt-2 rounded-lg border-l-2 border-primary bg-primary/5 py-3 pl-4 pr-3">
                      <p className="text-xs font-medium uppercase tracking-widest text-primary">Purpose</p>
                      <p className="mt-1 text-sm leading-6 text-foreground">{s.purpose}</p>
                    </div>
                  )}
                </div>
              </Section>

              <div className="grid gap-6 sm:grid-cols-2">
                {s.targetUsers.length > 0 && (
                  <Section title="Target Users">
                    <div className="flex flex-wrap gap-2">
                      {s.targetUsers.map(u => <Tag key={u} label={u} />)}
                    </div>
                  </Section>
                )}
                {s.userRoles.length > 0 && (
                  <Section title="User Roles">
                    <div className="flex flex-wrap gap-2">
                      {s.userRoles.map(r => <Tag key={r} label={r} />)}
                    </div>
                  </Section>
                )}
              </div>

              {s.coreFlows.length > 0 && (
                <Section title="Core User Flows">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {s.coreFlows.map((flow, i) => (
                      <div key={i} className="flex flex-col gap-1 rounded-lg border border-border bg-background p-4">
                        <div className="flex items-center gap-2">
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-[10px] font-bold text-primary">
                            {i + 1}
                          </span>
                          <p className="font-medium text-sm text-foreground">{flow.name}</p>
                        </div>
                        {flow.description && (
                          <p className="mt-1 pl-7 text-xs leading-5 text-muted-foreground">{flow.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {s.suggestedFeatures.length > 0 && (
                <Section title="Features">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {s.suggestedFeatures.map(f => (
                      <div key={f.key} className={`flex items-start gap-3 rounded-lg border p-3 ${f.enabled ? "border-primary/20 bg-primary/5" : "border-border bg-muted/20 opacity-60"}`}>
                        <span className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${f.enabled ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                          {f.enabled ? "✓" : "○"}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-foreground">{f.label}</p>
                          {f.description && <p className="mt-0.5 text-xs text-muted-foreground">{f.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {s.dataEntities.length > 0 && (
                <Section title="Data Model">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {s.dataEntities.map((entity, i) => (
                      <div key={i} className="rounded-lg border border-border bg-background p-4">
                        <p className="font-mono text-sm font-semibold text-foreground">{entity.name}</p>
                        {entity.description && <p className="mt-0.5 text-xs text-muted-foreground">{entity.description}</p>}
                        {entity.fields.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {entity.fields.map(f => (
                              <code key={f} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{f}</code>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              <div className="grid gap-6 sm:grid-cols-2">
                {s.backendRequirements.length > 0 && (
                  <Section title="Backend Requirements">
                    <ul className="flex flex-col gap-1.5">
                      {s.backendRequirements.map(r => (
                        <li key={r} className="flex items-start gap-2 text-sm">
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                          <span className="text-muted-foreground">{r}</span>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
                {s.integrations.length > 0 && (
                  <Section title="Integrations">
                    <div className="flex flex-wrap gap-2">
                      {s.integrations.map(i => <Tag key={i} label={i} />)}
                    </div>
                  </Section>
                )}
              </div>

              {(s.authenticationRequirements || s.designDirection || s.responsiveRequirements) && (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {s.authenticationRequirements && (
                    <Section title="Auth Requirements">
                      <p className="text-sm leading-6 text-muted-foreground">{s.authenticationRequirements}</p>
                    </Section>
                  )}
                  {s.designDirection && (
                    <Section title="Design Direction">
                      <p className="text-sm leading-6 text-muted-foreground">{s.designDirection}</p>
                    </Section>
                  )}
                  {s.responsiveRequirements && (
                    <Section title="Responsive Behavior">
                      <p className="text-sm leading-6 text-muted-foreground">{s.responsiveRequirements}</p>
                    </Section>
                  )}
                </div>
              )}

              {s.additionalInstructions && (
                <Section title="Additional Instructions">
                  <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{s.additionalInstructions}</p>
                </Section>
              )}
            </>
          )}

          {/* ── UNDERSTANDING ──────────────────────────────────── */}
          {u && (
            <>
              <div className="mt-4 border-t border-border pt-4">
                <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  AI Website Analysis
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  What the AI observed and inferred from the source
                </p>
              </div>

              {u.purpose && (
                <Section title="Website Purpose">
                  <p className="text-sm leading-7 text-muted-foreground">{u.purpose}</p>
                </Section>
              )}

              {(u.observedFunctionality.length > 0 || u.inferredFunctionality.length > 0) && (
                <div className="grid gap-6 sm:grid-cols-2">
                  {u.observedFunctionality.length > 0 && (
                    <Section title="Observed Functionality">
                      <ul className="flex flex-col gap-1.5">
                        {u.observedFunctionality.map(f => (
                          <li key={f} className="flex items-start gap-2 text-sm">
                            <Badge color="green">seen</Badge>
                            <span className="text-muted-foreground">{f}</span>
                          </li>
                        ))}
                      </ul>
                    </Section>
                  )}
                  {u.inferredFunctionality.length > 0 && (
                    <Section title="Inferred Functionality">
                      <ul className="flex flex-col gap-1.5">
                        {u.inferredFunctionality.map(f => (
                          <li key={f} className="flex items-start gap-2 text-sm">
                            <Badge color="blue">inferred</Badge>
                            <span className="text-muted-foreground">{f}</span>
                          </li>
                        ))}
                      </ul>
                    </Section>
                  )}
                </div>
              )}

              {u.userFlows.length > 0 && (
                <Section title="User Flows Detected">
                  <div className="flex flex-col gap-4">
                    {u.userFlows.map((flow, i) => (
                      <div key={i} className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm text-foreground">{flow.name}</p>
                          <Badge color={flow.confidence === "observed" ? "green" : flow.confidence === "inferred" ? "blue" : "amber"}>
                            {flow.confidence}
                          </Badge>
                        </div>
                        {flow.steps.length > 0 && (
                          <ol className="flex flex-col gap-1 pl-2">
                            {flow.steps.map((step, j) => (
                              <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground">
                                <span className="mt-0.5 font-mono text-primary">{j + 1}.</span>
                                {step}
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {u.designSystem && (u.designSystem.colors.length > 0 || u.designSystem.typography.length > 0 || u.designSystem.visualLanguage) && (
                <Section title="Design System">
                  <div className="flex flex-col gap-4">
                    {u.designSystem.visualLanguage && (
                      <p className="text-sm leading-6 text-muted-foreground">{u.designSystem.visualLanguage}</p>
                    )}
                    {u.designSystem.colors.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-medium text-muted-foreground">Colors</p>
                        <div className="flex flex-wrap gap-2">
                          {u.designSystem.colors.map(c => <Tag key={c} label={c} />)}
                        </div>
                      </div>
                    )}
                    {u.designSystem.typography.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-medium text-muted-foreground">Typography</p>
                        <div className="flex flex-wrap gap-2">
                          {u.designSystem.typography.map(t => <Tag key={t} label={t} />)}
                        </div>
                      </div>
                    )}
                  </div>
                </Section>
              )}

              {u.dataEntities.length > 0 && (
                <Section title="Data Entities Detected">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {u.dataEntities.map((e, i) => (
                      <div key={i} className="rounded-lg border border-border bg-background p-4">
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-sm font-semibold text-foreground">{e.name}</p>
                          <Badge color={e.confidence === "observed" ? "green" : e.confidence === "inferred" ? "blue" : "amber"}>
                            {e.confidence}
                          </Badge>
                        </div>
                        {e.fields.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {e.fields.map(f => <code key={f} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{f}</code>)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {u.pages.length > 0 && (
                <Section title="Pages Discovered">
                  <div className="flex flex-col gap-2">
                    {u.pages.map((page, i) => (
                      <div key={i} className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${page.importance === "primary" ? "border-primary/20 bg-primary/5" : "border-border bg-muted/20"}`}>
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs text-muted-foreground">{page.url}</p>
                          {page.title && <p className="mt-0.5 text-sm font-medium text-foreground">{page.title}</p>}
                          {page.summary && <p className="mt-0.5 text-xs text-muted-foreground">{page.summary}</p>}
                        </div>
                        <Badge color={page.importance === "primary" ? "blue" : "default"}>{page.importance}</Badge>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {u.screenshots.length > 0 && (
                <Section title="Captured Screenshots">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {u.screenshots.slice(0, 6).map((src, i) => (
                      <a key={i} href={src} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-lg border border-border bg-background">
                        <img src={src} alt={`Screenshot ${i + 1}`} className="aspect-video w-full object-cover object-top transition-transform duration-300 group-hover:scale-105" />
                      </a>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}

        </div>
      </div>
    </main>
  )
}
