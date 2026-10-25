import Link from "next/link"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { MarketStudio } from "@/components/marketing/market-studio"
import { StudioNav, isStudioTab, type StudioTab } from "@/components/marketing/studio-nav"
import { StudioLibrary } from "@/components/marketing/studio-library"
import { StudioCalendar } from "@/components/marketing/studio-calendar"
import { StudioBrandForm } from "@/components/marketing/studio-brand-form"
import { ProjectComingSoon } from "@/components/workspace/project-coming-soon"
import { getCurrentUser } from "@/lib/auth/session"
import { isStudioWorkspaceEnabled } from "@/lib/marketing/feature-flags"
import { getBrandProfile } from "@/lib/marketing/studio/brand"
import { listPlannedContent, searchContentItems } from "@/lib/marketing/studio/library"
import { requireOwnedProject } from "@/lib/workspace/require-owned-project"

/**
 * Unified Marketing Studio (Phase 4 v2).
 *
 * This is the single canonical studio surface. It hosts the creation engine
 * (Home / Create), the content library, the planning calendar and brand
 * settings, all scoped to the verified project and gated server-side.
 *
 * Authorization is the same uniform `requireOwnedProject` used by every
 * project page (404 for non-owners, no existence leak). Every tab is a real
 * URL (`?tab=`), so refresh and bookmarking work.
 */

const SHORTCUTS = [
  { label: "Social posts", hint: "Platform-native posts for one or more channels" },
  { label: "Marketing email", hint: "Subject, preview text, body and one CTA" },
  { label: "Website copy", hint: "Headlines, value props and page copy" },
  { label: "Blog article", hint: "A structured draft with headings" },
  { label: "Ad concepts", hint: "Headlines, angles and creative direction" },
  { label: "Launch announcement", hint: "What is launching and why it matters" },
  { label: "Strategy brief", hint: "Audience, problem, messaging, channels, next steps" },
  { label: "Content calendar", hint: "A multi-day plan of ideas and channels" },
] as const

export default async function ProjectStudioPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { projectId } = await params
  const { tab: rawTab } = await searchParams
  const tab: StudioTab = isStudioTab(rawTab) ? rawTab : "home"

  const project = await requireOwnedProject(projectId, `/project/${projectId}/studio`)
  const user = await getCurrentUser()

  if (!user || !isStudioWorkspaceEnabled(user.id)) {
    return (
      <ProjectComingSoon
        projectId={project.id}
        projectName={project.name}
        kicker="Create & publish"
        title={`Marketing Studio for ${project.name}`}
        description="This is where you will draft marketing content in your own brand voice. The experience is not available yet."
      />
    )
  }

  const [brand, recent, planned] = await Promise.all([
    getBrandProfile(project.id),
    searchContentItems(project.id, { limit: 5 }),
    listPlannedContent(project.id, { limit: 50 }),
  ])

  const valueProp = project.specification?.valueProposition?.trim()
  const audience = (project.specification?.targetUsers ?? []).map((t) => (t ?? "").trim()).filter(Boolean).slice(0, 3)
  const liveUrl = project.deployment?.status === "success" ? project.deployment?.productionUrl : undefined

  // Deterministic suggestions from actual studio data — never presented as
  // analytics, because Atai does not collect campaign performance.
  const suggestions: Array<{ title: string; body: string; tab: StudioTab }> = []
  if (!brand) {
    suggestions.push({
      title: "Set your brand voice",
      body: "Add tone, audience and words to avoid once — every draft will reuse them.",
      tab: "brand",
    })
  }
  if (recent.items.length === 0) {
    suggestions.push({
      title: "Create your first draft",
      body: "Pick a channel in Create and describe what you want to say.",
      tab: "create",
    })
  }
  if (planned.length === 0 && recent.items.length > 0) {
    suggestions.push({
      title: "Plan when to use a draft",
      body: "Add a planned date in the Library so it appears on the calendar.",
      tab: "calendar",
    })
  }

  return (
    <DashboardShell title={project.name} projectId={project.id}>
      <div className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Marketing Studio</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Drafts and plans for {project.name}. Nothing here is published or sent anywhere.
            </p>
          </div>
          <Link
            href={`/project/${project.id}/market`}
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            ← Market &amp; grow
          </Link>
        </div>

        <StudioNav projectId={project.id} active={tab} />

        {tab === "home" ? (
          <div className="flex flex-col gap-6">
            <section aria-labelledby="studio-context-heading" className="rounded-2xl border border-border bg-card p-5">
              <h3 id="studio-context-heading" className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                What Atai knows about this business
              </h3>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Product</dt>
                  <dd className="text-sm font-medium">{project.name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Live site</dt>
                  <dd className="truncate text-sm">{liveUrl ?? "Not deployed yet"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">Value proposition</dt>
                  <dd className="text-sm">{valueProp || "Not set in your plan yet — add it in Brand settings."}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">Audience</dt>
                  <dd className="text-sm">{audience.length ? audience.join(", ") : "Not set in your plan yet."}</dd>
                </div>
              </dl>
              {!brand ? (
                <p className="mt-3 rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
                  No brand profile yet. Drafts fall back to your plan prose.{" "}
                  <Link href={`/project/${project.id}/studio?tab=brand`} className="underline underline-offset-4">
                    Set your brand voice
                  </Link>
                  .
                </p>
              ) : null}
            </section>

            <section aria-labelledby="studio-shortcuts-heading" className="flex flex-col gap-3">
              <h3 id="studio-shortcuts-heading" className="text-lg font-semibold tracking-tight">
                Start something
              </h3>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {SHORTCUTS.map((shortcut) => (
                  <li key={shortcut.label}>
                    <Link
                      href={`/project/${project.id}/studio?tab=create`}
                      className="flex h-full flex-col gap-1 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="text-sm font-medium">{shortcut.label}</span>
                      <span className="text-xs leading-5 text-muted-foreground">{shortcut.hint}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="studio-recent-heading" className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 id="studio-recent-heading" className="text-lg font-semibold tracking-tight">
                  Recent work
                </h3>
                <Link
                  href={`/project/${project.id}/studio?tab=library`}
                  className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Open library
                </Link>
              </div>
              {recent.items.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No drafts yet. Your saved work will appear here.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card">
                  {recent.items.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                      <span className="font-medium">{item.title}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {item.assetKind ?? item.template}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {item.status === "ready_for_review" ? "ready for review" : "draft"}
                        {item.plannedAt ? " · planned" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="studio-next-heading" className="flex flex-col gap-3">
              <h3 id="studio-next-heading" className="text-lg font-semibold tracking-tight">
                Suggested next steps
              </h3>
              {suggestions.length === 0 ? (
                <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                  Your studio is set up. Create another draft or plan the next one.
                </p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {suggestions.map((s) => (
                    <li key={s.title} className="rounded-2xl border border-border bg-card p-4">
                      <p className="text-sm font-medium">{s.title}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{s.body}</p>
                      <Link
                        href={`/project/${project.id}/studio?tab=${s.tab}`}
                        className="mt-2 inline-block text-xs font-medium underline underline-offset-4"
                      >
                        Go to {s.tab}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground">
                These suggestions come from what is in your studio, not from analytics — Atai does not measure campaign
                performance.
              </p>
            </section>
          </div>
        ) : tab === "create" ? (
          <MarketStudio projectId={project.id} projectName={project.name} enabled />
        ) : tab === "library" ? (
          <StudioLibrary projectId={project.id} />
        ) : tab === "calendar" ? (
          <StudioCalendar projectId={project.id} />
        ) : (
          <StudioBrandForm projectId={project.id} initial={brand} />
        )}
      </div>
    </DashboardShell>
  )
}
