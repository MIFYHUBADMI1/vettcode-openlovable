"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import useSWR from "swr"
import {
  Send, Loader2, Square, History, MessageSquare, Eye, RotateCcw,
  FileCode, Terminal, ExternalLink, Check, Clock, Settings, Globe,
  Key, ChevronDown, ChevronUp, Copy, Trash2, RefreshCw, AlertTriangle,
  Server, Zap, Shield, Database, Save, X, Link as LinkIcon,
  Lightbulb, Palette, Layout, Navigation, Type, Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { postJson, patchJson, deleteJson, jsonFetcher, useSession } from "@/lib/client/api"
import { ensureProtocol, cn } from "@/lib/utils"
import { toast } from "sonner"

// ─── Types ──────────────────────────────────────────────────────

interface ProjectData {
  ok: boolean
  data: {
    project: {
      id: string
      name: string
      state: string
      mode: string
      developmentUrl?: string
      totalumProjectId?: string
      sourceUrl?: string
      understanding?: { screenshots?: string[]; purpose?: string }
      deploymentHistory?: Array<{
        id: string
        startedAt: number
        completedAt?: number
        status: string
        productionUrl?: string
        customDomain?: string
        creditsCharged?: number
        error?: string
      }>
      events?: Array<{ id: string; at: number; level: string; stage: string; message: string }>
      conversation?: Array<{ id: string; role: string; content: string; at: number }>
      specification?: { complexity?: string; title?: string; description?: string }
    }
  }
}

interface ConversationMessage {
  id: string
  role: "user" | "assistant"
  content: string
  at: number
}

interface Version {
  _id: string
  name: string
  commitSha?: string
  commitMessage?: string
  prompt?: string
  createdAt: string
  updatedAt: string
}

interface Secret {
  _id: string
  secretName: string
  environment: string
  createdAt?: string
}

type Tab = "preview" | "conversation" | "versions" | "logs"
type SidebarPanel = "prompt" | "settings" | "secrets" | "publish"

interface EditWorkspaceProps {
  projectId: string
  projectName: string
  initialState: string
}

// ─── Main Component ─────────────────────────────────────────────

export function EditWorkspace({ projectId, projectName, initialState }: EditWorkspaceProps) {
  const [prompt, setPrompt] = useState("")
  const [sending, setSending] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>("preview")
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>("prompt")
  const conversationEndRef = useRef<HTMLDivElement>(null)

  // We need a ref to track the latest project data so the status merge
  // can enrich it without being overwritten by stale project endpoint responses.
  const projectRef = useRef<ProjectData["data"]["project"] | null>(null)

  // Poll project for state + developmentUrl. Use a custom fetcher that merges
  // the response with cached data so fields like developmentUrl (set by /status)
  // are never overwritten by stale project endpoint responses.
  const { data: projectData, mutate: refreshProject } = useSWR<ProjectData>(
    `/api/projects/${projectId}`,
    async (url: string) => {
      const fresh = await jsonFetcher<ProjectData>(url)
      // Merge: keep cached fields that the fresh response might be missing
      // (e.g. developmentUrl set by /status merge)
      if (projectRef.current && fresh?.data?.project) {
        const merged = { ...projectRef.current, ...fresh.data.project }
        // Preserve developmentUrl from cache if fresh response is missing it
        if (!merged.developmentUrl && projectRef.current.developmentUrl) {
          merged.developmentUrl = projectRef.current.developmentUrl
        }
        // Preserve deploymentHistory from cache if fresh response is missing it
        if ((!merged.deploymentHistory || merged.deploymentHistory.length === 0) && projectRef.current.deploymentHistory?.length) {
          merged.deploymentHistory = projectRef.current.deploymentHistory
        }
        fresh.data.project = merged
      }
      projectRef.current = fresh.data.project
      return fresh
    },
    { refreshInterval: 10000, revalidateOnFocus: true },
  )

  const project = projectData?.data?.project
  const state = (project?.state ?? initialState) as string
  const isBuilding = state === "building" || state === "deploying"
  // Resolve preview URL: prefer dev URL, fall back to latest successful production URL
  const developmentUrl = project?.developmentUrl ?? (
    project?.deploymentHistory
      ?.filter((d: { status: string }) => d.status === "success")
      ?.slice(-1)[0]?.productionUrl
  )

  // Poll agent status — always, so we can merge fresh project data (including
  // developmentUrl) into the SWR cache. The workspace page does this via a
  // useEffect below; without it the edit page shows stale data.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: statusData } = useSWR<Record<string, any>>(
    `/api/projects/${projectId}/status`,
    jsonFetcher,
    {
      refreshInterval: (latest) => {
        const s = (latest as any)?.data?.state ?? state
        return s === "building" || s === "deploying" ? 3000 : 15000
      },
      keepPreviousData: true,
    },
  )
  const agentStatus = (statusData as any)?.data?.state ?? state
  const realtimeConversation = ((statusData as any)?.data?.realtimeConversation ?? []) as Array<{
    author: string
    message: string
    messageType: string
    createdAt: string
    versionId?: string
  }>

  // Merge fresh project data from /status into the SWR cache so developmentUrl
  // and other fields stay up to date — same pattern as the workspace page.
  useEffect(() => {
    const statusProject = (statusData as any)?.data?.project
    if (statusProject) {
      // Always merge status data — it has the freshest developmentUrl
      const merged = {
        ok: true,
        data: {
          project: {
            ...(projectRef.current ?? {}),
            ...statusProject,
            // Ensure developmentUrl from status is never lost
            developmentUrl: statusProject.developmentUrl ?? projectRef.current?.developmentUrl,
          },
        },
      } as ProjectData
      projectRef.current = merged.data.project
      refreshProject(merged, { revalidate: false })
    }
  }, [(statusData as any)?.data?.project, refreshProject])

  // Conversation (poll during builds, otherwise on-demand)
  const { data: convData, mutate: refreshConv } = useSWR<{ ok: boolean; data: { conversation: ConversationMessage[] } }>(
    `/api/projects/${projectId}/activity`,
    jsonFetcher,
    { refreshInterval: isBuilding ? 5000 : 30000 },
  )

  // Version history
  const { data: versionsData, mutate: refreshVersions } = useSWR<{ ok: boolean; data: { versions: Version[]; totalCount: number } }>(
    `/api/projects/${projectId}/versions?limit=50`,
    jsonFetcher,
    { refreshInterval: 30000 },
  )
  const versions = versionsData?.data?.versions ?? []

  // App credit balance (from MirrorSite's own system, not Totalum)
  const { session } = useSession()
  const credits = session?.credits?.balance ?? 0

  // Auto-scroll conversation
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [convData?.data?.conversation?.length])

  // Refresh project data when build completes
  useEffect(() => {
    if (agentStatus === "ready" || agentStatus === "build_complete") {
      refreshProject()
      refreshConv()
      refreshVersions()
    }
  }, [agentStatus, refreshProject, refreshConv, refreshVersions])

  // Send edit prompt
  const handleSend = useCallback(async () => {
    if (prompt.trim().length < 3 || sending) return
    const text = prompt.trim()
    setPrompt("")
    setSending(true)
    try {
      await postJson(`/api/projects/${projectId}/agent`, { prompt: text })
      toast.success("Instruction sent", { description: "The AI is working on your changes…" })
      refreshConv()
      refreshProject()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send instruction")
      setPrompt(text)
    } finally {
      setSending(false)
    }
  }, [prompt, sending, projectId, refreshConv, refreshProject])

  // Stop agent
  const handleStop = useCallback(async () => {
    try {
      await postJson(`/api/projects/${projectId}/agent/stop`, {})
      toast.success("Agent stopped")
      refreshProject()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to stop agent")
    }
  }, [projectId, refreshProject])

  // Restart server
  const handleRestartServer = useCallback(async () => {
    try {
      await postJson(`/api/projects/${projectId}/server/restart`, {})
      toast.success("Server restart initiated", { description: "The dev server will restart in 2–4 minutes." })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to restart server")
    }
  }, [projectId])

  const tabs: { id: Tab; label: string; icon: typeof Eye }[] = [
    { id: "preview", label: "Preview", icon: Eye },
    { id: "conversation", label: "Activity", icon: MessageSquare },
    { id: "versions", label: "Versions", icon: History },
    { id: "logs", label: "Logs", icon: Terminal },
  ]

  const sidebarTabs: { id: SidebarPanel; label: string; icon: typeof Send }[] = [
    { id: "prompt", label: "Edit", icon: Send },
    { id: "publish", label: "Publish", icon: Globe },
    { id: "settings", label: "Settings", icon: Settings },
    { id: "secrets", label: "Secrets", icon: Key },
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px] lg:items-start">
      {/* ─── Left: Preview + Content Tabs ─── */}
      <div className="flex flex-col gap-4">
        {/* Tab bar */}
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium transition-all",
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              <tab.icon className="size-3.5" />
              {tab.label}
            </button>
          ))}
          <div className="flex-1" />
          {isBuilding && (
            <div className="flex items-center gap-2 pr-3">
              <Loader2 className="size-3.5 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">
                {agentStatus === "deploying" ? "Deploying…" : "Building…"}
              </span>
            </div>
          )}
        </div>

        {/* Tab content */}
        {activeTab === "preview" && (
          <PreviewTab
            url={developmentUrl}
            name={projectName}
            isBuilding={isBuilding}
            realtimeMessages={realtimeConversation}
            screenshotUrl={project?.understanding?.screenshots?.[0]}
            sourceUrl={project?.sourceUrl}
          />
        )}
        {activeTab === "conversation" && (
          <ConversationTab projectId={projectId} isBuilding={isBuilding} />
        )}
        {activeTab === "versions" && (
          <VersionsTab projectId={projectId} versions={versions} />
        )}
        {activeTab === "logs" && (
          <LogsTab projectId={projectId} />
        )}
      </div>

      {/* ─── Right: Sidebar ─── */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
        {/* Sidebar panel tabs */}
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
          {sidebarTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSidebarPanel(tab.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all",
                sidebarPanel === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              <tab.icon className="size-3" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Status card — always visible */}
        <StatusCard state={agentStatus} credits={credits} developmentUrl={developmentUrl} />

        {/* Sidebar content */}
        {sidebarPanel === "prompt" && (
          <PromptPanel
            prompt={prompt}
            setPrompt={setPrompt}
            sending={sending}
            isBuilding={isBuilding}
            onSend={handleSend}
            onStop={handleStop}
            tier={project?.specification?.complexity}
            userCredits={credits}
          />
        )}
        {sidebarPanel === "publish" && (
          <PublishPanel
            projectId={projectId}
            projectName={projectName}
            totalumProjectId={project?.totalumProjectId}
            deploymentHistory={project?.deploymentHistory}
            onRefresh={refreshProject}
          />
        )}
        {sidebarPanel === "settings" && (
          <SettingsPanel
            projectId={projectId}
            projectName={projectName}
            onRefresh={refreshProject}
            onRestartServer={handleRestartServer}
            isBuilding={isBuilding}
          />
        )}
        {sidebarPanel === "secrets" && (
          <SecretsPanel
            projectId={projectId}
            hasTotalumProject={Boolean(project?.totalumProjectId)}
          />
        )}
      </aside>
    </div>
  )
}

// ─── Status Card ────────────────────────────────────────────────

function StatusCard({ state, credits, developmentUrl }: { state: string; credits: number; developmentUrl?: string }) {
  const config: Record<string, { label: string; color: string; pulse?: boolean }> = {
    building: { label: "Building", color: "text-primary", pulse: true },
    deploying: { label: "Deploying", color: "text-amber-500", pulse: true },
    ready: { label: "Ready", color: "text-green-500" },
    build_complete: { label: "Build complete", color: "text-green-500" },
    build_failed: { label: "Build failed", color: "text-destructive" },
    analyzing: { label: "Analyzing", color: "text-primary", pulse: true },
  }
  const c = config[state] ?? { label: state, color: "text-muted-foreground" }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Status</p>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("text-[10px] gap-1", c.color, `border-current/30 bg-current/5`)}>
            {c.pulse && <span className={cn("size-1.5 rounded-full bg-current animate-pulse")} />}
            {c.label}
          </Badge>
        </div>
      </div>

      {/* Credit balance */}
      <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 mb-3">
        <div className="flex items-center gap-1.5">
          <Zap className="size-3 text-amber-500" />
          <span className="text-xs text-muted-foreground">Credits</span>
        </div>
        <span className="font-mono text-xs font-medium">{credits.toLocaleString()}</span>
      </div>

      {/* Quick links */}
      <div className="flex flex-col gap-1.5">
        {developmentUrl && (
          <a
            href={ensureProtocol(developmentUrl)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-primary/5 px-3 py-2 text-xs text-primary hover:bg-primary/10 transition-colors"
          >
            <ExternalLink className="size-3" />
            Open preview in new tab
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Prompt Panel ───────────────────────────────────────────────

function PromptPanel({
  prompt, setPrompt, sending, isBuilding, onSend, onStop, tier, userCredits,
}: {
  prompt: string
  setPrompt: (v: string) => void
  sending: boolean
  isBuilding: boolean
  onSend: () => void
  onStop: () => void
  tier?: string
  userCredits: number
}) {
  const TIER_COSTS: Record<string, number> = { simple: 25_000, medium: 50_000, complex: 75_000 }
  const TIER_LABELS: Record<string, string> = { simple: "Simple", medium: "Medium", complex: "Complex" }
  const editCost = TIER_COSTS[tier ?? "medium"] ?? 50_000
  const tierLabel = TIER_LABELS[tier ?? "medium"] ?? "Medium"
  const canAfford = userCredits >= editCost

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {/* Cost indicator */}
      <div className="flex items-center justify-between mb-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Edit instruction
        </p>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-mono",
            canAfford ? "text-muted-foreground border-border" : "text-destructive border-destructive/30 bg-destructive/5",
          )}
        >
          {tierLabel} · {editCost.toLocaleString()} credits
        </Badge>
      </div>
      {!canAfford && (
        <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
          <p className="text-[11px] text-destructive">
            Insufficient credits. You have {userCredits.toLocaleString()} but need {editCost.toLocaleString()} for a {tierLabel.toLowerCase()} edit.
          </p>
        </div>
      )}
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={"Describe the change you want to make…\n\ne.g. \"Add a dark mode toggle to the header\""}
        className="min-h-[140px] resize-none text-sm"
        disabled={sending || isBuilding}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            onSend()
          }
        }}
      />
      <div className="flex items-center justify-between mt-3">
        <p className="text-[10px] text-muted-foreground">
          {prompt.length > 0 ? `${prompt.length} chars` : "Ctrl+Enter to send"}
        </p>
        <div className="flex gap-2">
          {isBuilding && (
            <Button
              onClick={onStop}
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:bg-destructive/10"
            >
              <Square className="size-3" />
              Stop
            </Button>
          )}
          <Button
            onClick={onSend}
            disabled={prompt.trim().length < 3 || sending || isBuilding || !canAfford}
            size="sm"
            className="gap-1.5"
            title={!canAfford ? `Need ${editCost.toLocaleString()} credits (${tierLabel} tier)` : undefined}
          >
            {sending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Send className="size-3" />
            )}
            Send
          </Button>
        </div>
      </div>

      {/* Quick prompts */}
      <QuickPrompts onSelect={setPrompt} disabled={sending || isBuilding} />

      {/* Tips */}
      <div className="mt-4 rounded-lg bg-muted/30 p-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Tips</p>
        <ul className="space-y-1.5 text-[11px] text-muted-foreground">
          <li className="flex items-start gap-1.5">
            <span className="mt-0.5 size-1 rounded-full bg-primary shrink-0" />
            Be specific about what to change
          </li>
          <li className="flex items-start gap-1.5">
            <span className="mt-0.5 size-1 rounded-full bg-primary shrink-0" />
            Reference page names or component names
          </li>
          <li className="flex items-start gap-1.5">
            <span className="mt-0.5 size-1 rounded-full bg-primary shrink-0" />
            Each instruction runs as a new build (10–30 min)
          </li>
          <li className="flex items-start gap-1.5">
            <span className="mt-0.5 size-1 rounded-full bg-primary shrink-0" />
            Check Versions tab to roll back if needed
          </li>
          <li className="flex items-start gap-1.5">
            <span className="mt-0.5 size-1 rounded-full bg-amber-500 shrink-0" />
            Changes appear in preview only after republishing
          </li>
        </ul>
      </div>
    </div>
  )
}

// ─── Quick Prompts ─────────────────────────────────────────────

interface QuickPromptCategory {
  label: string
  icon: typeof Lightbulb
  prompts: { text: string; label: string }[]
}

const QUICK_PROMPT_CATEGORIES: QuickPromptCategory[] = [
  {
    label: "Design",
    icon: Palette,
    prompts: [
      { label: "Dark mode", text: "Add a dark mode toggle. Create a theme switcher in the header that lets users toggle between light and dark themes. Use Tailwind's dark mode with a smooth transition." },
      { label: "Color scheme", text: "Update the color scheme to use a modern palette. Make the primary color a deep blue (#1e40af), use soft grays for backgrounds, and ensure all text has strong contrast for accessibility." },
      { label: "Typography", text: "Improve the typography throughout the app. Use a clean sans-serif font for body text, add proper heading hierarchy (h1-h6), and ensure consistent spacing between text elements." },
      { label: "Cards & surfaces", text: "Redesign all card components with subtle shadows, rounded corners (12px), and a clean border. Add hover effects that lift the card slightly." },
    ],
  },
  {
    label: "Layout",
    icon: Layout,
    prompts: [
      { label: "Responsive grid", text: "Make the layout fully responsive. On mobile, stack all columns vertically. On tablet (768px+), use a 2-column grid. On desktop (1024px+), use a 3-column grid with proper spacing." },
      { label: "Sticky header", text: "Make the header/navigation sticky so it stays visible when scrolling. Add a subtle backdrop blur effect and a thin bottom border that appears on scroll." },
      { label: "Sidebar nav", text: "Add a collapsible sidebar navigation on the left side. Include icons for each nav item, show labels on hover or when expanded, and highlight the active page." },
      { label: "Center content", text: "Constrain the main content area to a max-width of 1200px and center it horizontally. Add consistent padding (24px) on all sides." },
    ],
  },
  {
    label: "Navigation",
    icon: Navigation,
    prompts: [
      { label: "Breadcrumbs", text: "Add breadcrumb navigation below the header to show the current page hierarchy. Make each breadcrumb clickable and add a home icon for the root." },
      { label: "Footer links", text: "Add a professional footer with sections for: About, Resources, Legal (Privacy, Terms), and social media links. Use a dark background with light text." },
      { label: "Mobile menu", text: "Add a hamburger menu for mobile devices. When clicked, slide in a full-screen navigation overlay from the right with large touch-friendly links." },
    ],
  },
  {
    label: "Features",
    icon: Sparkles,
    prompts: [
      { label: "Loading states", text: "Add skeleton loading states for all data-fetching pages. Show shimmer placeholders that match the shape of the content being loaded. Use smooth fade-in when data arrives." },
      { label: "Form validation", text: "Add client-side form validation with clear error messages. Show validation errors below each field in red text, validate on blur and on submit, and disable the submit button until the form is valid." },
      { label: "Toast notifications", text: "Add toast notifications for all user actions (save, delete, error). Use a consistent position (bottom-right), auto-dismiss after 5 seconds, and support success, error, and info variants." },
      { label: "Search & filter", text: "Add a search bar at the top of the list view with real-time filtering. Include filter chips for common categories and a sort dropdown." },
      { label: "Pagination", text: "Add pagination to all list views. Show 10 items per page with Previous/Next buttons, page numbers, and an item count indicator." },
    ],
  },
  {
    label: "Fixes",
    icon: AlertTriangle,
    prompts: [
      { label: "Fix spacing", text: "Audit the entire app for inconsistent spacing. Standardize margins and padding to use Tailwind's spacing scale (4, 6, 8, 12, 16, 24). Ensure visual rhythm throughout." },
      { label: "Accessibility", text: "Improve accessibility across the app: add proper ARIA labels to all interactive elements, ensure keyboard navigation works, add focus-visible styles, and verify color contrast ratios." },
      { label: "Performance", text: "Optimize performance: add loading states, lazy-load images below the fold, use Next.js Image component for optimized images, and add proper error boundaries." },
    ],
  },
]

function QuickPrompts({ onSelect, disabled }: { onSelect: (text: string) => void; disabled: boolean }) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="size-3.5 text-amber-500" />
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Quick edits
        </p>
      </div>

      <div className="space-y-1.5">
        {QUICK_PROMPT_CATEGORIES.map((cat) => {
          const isExpanded = expandedCategory === cat.label
          const CatIcon = cat.icon
          return (
            <div key={cat.label}>
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : cat.label)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                  isExpanded
                    ? "bg-primary/5 text-primary"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
                disabled={disabled}
              >
                <CatIcon className="size-3.5 shrink-0" />
                <span className="flex-1 text-left">{cat.label}</span>
                <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                  {cat.prompts.length}
                </Badge>
                {isExpanded ? (
                  <ChevronUp className="size-3 shrink-0" />
                ) : (
                  <ChevronDown className="size-3 shrink-0" />
                )}
              </button>

              {isExpanded && (
                <div className="ml-2 mt-1 space-y-1">
                  {cat.prompts.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => onSelect(p.text)}
                      disabled={disabled}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 text-left text-[11px] transition-all",
                        disabled
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:border-primary/30 hover:bg-primary/5 hover:text-foreground cursor-pointer",
                      )}
                    >
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                        {p.label}
                      </span>
                      <span className="flex-1 text-muted-foreground line-clamp-2">
                        {p.text.slice(0, 80)}…
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-3 text-[10px] text-muted-foreground">
        Click a suggestion to populate the editor, then customize it before sending.
      </p>
    </div>
  )
}

// ─── Publish Panel ──────────────────────────────────────────────

function PublishPanel({
  projectId, projectName, totalumProjectId, deploymentHistory, onRefresh,
}: {
  projectId: string
  projectName: string
  totalumProjectId?: string
  deploymentHistory?: Array<{
    id: string; startedAt: number; completedAt?: number; status: string
    productionUrl?: string; customDomain?: string; creditsCharged?: number; error?: string
  }>
  onRefresh: () => void
}) {
  const [deploying, setDeploying] = useState(false)
  const [domainHostname, setDomainHostname] = useState("")
  const [domainLoading, setDomainLoading] = useState(false)
  const [domainResult, setDomainResult] = useState<{
    hostname: string; status: string
    dnsRecordsToAdd?: Array<{ type: string; name: string; value: string }>
  } | null>(null)

  // Poll deployment status
  const { data: deployData } = useSWR<{ ok: boolean; data: { status: string | null; productionUrl?: string; customDomain?: { hostname: string; status: string } | null } }>(
    totalumProjectId ? `/api/projects/${projectId}/deploy` : null,
    jsonFetcher,
    { refreshInterval: deploying ? 10000 : 0 },
  )

  const deployInfo = deployData?.data
  const isDeployed = deployInfo?.status === "success"
  const isDeploying = deployInfo?.status === "deploying" || deploying
  const productionUrl = deployInfo?.productionUrl
  const customDomain = deployInfo?.customDomain

  async function handleDeploy() {
    setDeploying(true)
    try {
      const result = await postJson<{ message: string; creditsCharged: number }>(`/api/projects/${projectId}/deploy`, {})
      toast.success("Deployment started", { description: `${result.message} (${result.creditsCharged} credits)` })
      onRefresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deployment failed")
    } finally {
      setDeploying(false)
    }
  }

  async function handleAddDomain() {
    if (!domainHostname.trim()) return
    setDomainLoading(true)
    try {
      const result = await postJson<{
        message: string; hostname: string; status: string
        dnsRecordsToAdd?: Array<{ type: string; name: string; value: string }>
      }>(`/api/projects/${projectId}/domain`, { hostname: domainHostname.trim() })
      setDomainResult(result)
      toast.success("Custom domain added", { description: result.message })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add domain")
    } finally {
      setDomainLoading(false)
    }
  }

  async function handleRemoveDomain() {
    try {
      await deleteJson<{ message: string }>(`/api/projects/${projectId}/domain`)
      toast.success("Custom domain removed")
      onRefresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove domain")
    }
  }

  const sortedHistory = [...(deploymentHistory ?? [])].sort((a, b) => b.startedAt - a.startedAt)

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Publish
      </p>

      {/* Live URL banner */}
      {isDeployed && productionUrl && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="size-4 text-green-500" />
              <span className="text-xs font-medium text-green-600">Live</span>
            </div>
            <a
              href={ensureProtocol(productionUrl)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-green-700 transition-colors"
            >
              Open <ExternalLink className="size-2.5" />
            </a>
          </div>
          <a
            href={ensureProtocol(productionUrl)}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 block truncate font-mono text-[11px] text-green-600 hover:underline"
          >
            {ensureProtocol(productionUrl)}
          </a>
          {customDomain && customDomain.status === "active" && (
            <a
              href={ensureProtocol(customDomain.hostname)}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block truncate font-mono text-[11px] text-green-600 hover:underline"
            >
              {customDomain.hostname}
            </a>
          )}
        </div>
      )}

      {/* Important note about republishing */}
      {isDeployed && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="size-3.5 mt-0.5 text-amber-500 shrink-0" />
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              Changes to your preview only appear on your live domain after you <strong>republish</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Deploy button */}
      <Button
        onClick={handleDeploy}
        disabled={isDeploying || !totalumProjectId}
        className="w-full gap-1.5"
      >
        {isDeploying ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            Publishing…
          </>
        ) : isDeployed ? (
          <>
            <RefreshCw className="size-3.5" />
            Republish (500 credits)
          </>
        ) : (
          <>
            <Globe className="size-3.5" />
            Publish to Production (500 credits)
          </>
        )}
      </Button>

      <Separator />

      {/* Custom domain */}
      <div className="space-y-2">
        <p className="text-xs font-medium">Custom Domain</p>
        {customDomain && (
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <LinkIcon className="size-3 text-muted-foreground shrink-0" />
              <span className="truncate font-mono text-[11px]">{customDomain.hostname}</span>
              <Badge variant="outline" className={cn(
                "text-[9px] shrink-0",
                customDomain.status === "active" ? "text-green-600 border-green-500/30" : "text-amber-600 border-amber-500/30"
              )}>
                {customDomain.status}
              </Badge>
            </div>
            <Button
              onClick={handleRemoveDomain}
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-destructive hover:bg-destructive/10 shrink-0"
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        )}

        {/* Domain result with DNS instructions */}
        {domainResult && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 space-y-2">
            <p className="text-[11px] font-medium text-green-600">Domain added — configure DNS:</p>
            {domainResult.dnsRecordsToAdd?.map((record, i) => (
              <div key={i} className="rounded-md bg-background/50 p-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="font-mono text-[9px]">{record.type}</Badge>
                  <button
                    onClick={() => { navigator.clipboard.writeText(record.value); toast.success("Copied") }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="size-3" />
                  </button>
                </div>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">{record.name} → {record.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            value={domainHostname}
            onChange={(e) => setDomainHostname(e.target.value)}
            placeholder="app.yourdomain.com"
            className="font-mono text-xs"
            disabled={domainLoading}
          />
          <Button
            onClick={handleAddDomain}
            disabled={!domainHostname.trim() || domainLoading}
            variant="outline"
            size="sm"
            className="shrink-0 gap-1"
          >
            {domainLoading ? <Loader2 className="size-3 animate-spin" /> : <LinkIcon className="size-3" />}
            Add
          </Button>
        </div>
      </div>

      <Separator />

      {/* Deployment history */}
      {sortedHistory.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium">Recent deploys</p>
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {sortedHistory.slice(0, 5).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-1.5">
                <div className="flex items-center gap-2">
                  {entry.status === "success" ? (
                    <Check className="size-3 text-green-500" />
                  ) : entry.status === "failed" ? (
                    <X className="size-3 text-destructive" />
                  ) : (
                    <Loader2 className="size-3 text-primary animate-spin" />
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(entry.startedAt).toLocaleDateString()} {new Date(entry.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {entry.productionUrl && (
                  <a
                    href={ensureProtocol(entry.productionUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-primary hover:underline"
                  >
                    Live ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Settings Panel ─────────────────────────────────────────────

function SettingsPanel({
  projectId, projectName, onRefresh, onRestartServer, isBuilding,
}: {
  projectId: string
  projectName: string
  onRefresh: () => void
  onRestartServer: () => void
  isBuilding: boolean
}) {
  const [name, setName] = useState(projectName)
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await patchJson(`/api/projects/${projectId}/settings`, {
        name: name.trim() || projectName,
        description: description.trim() || undefined,
      })
      toast.success("Settings saved")
      onRefresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings")
    } finally {
      setSaving(false)
    }
  }, [name, description, projectId, projectName, onRefresh])

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Project Settings
      </p>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">Project Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 text-sm"
            placeholder="My App"
          />
        </div>
        <div>
          <Label className="text-xs">Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 text-sm resize-none"
            placeholder="Optional description for this project"
            rows={2}
          />
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || name.trim() === projectName}
          size="sm"
          className="gap-1.5"
        >
          {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
          Save changes
        </Button>
      </div>

      <Separator />

      {/* Server controls */}
      <div className="space-y-2">
        <p className="text-xs font-medium">Server</p>
        <Button
          onClick={onRestartServer}
          disabled={isBuilding}
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
        >
          <RefreshCw className="size-3" />
          Restart Dev Server
        </Button>
        <p className="text-[10px] text-muted-foreground">
          Restarts the preview server (takes 2–4 minutes). Useful if the preview is unresponsive.
        </p>
      </div>

      <Separator />

      {/* Danger zone */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-destructive">Danger zone</p>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={async () => {
            if (!confirm("Are you sure you want to delete this project? This cannot be undone.")) return
            try {
              await deleteJson(`/api/projects/${projectId}`)
              toast.success("Project deleted")
              window.location.href = "/dashboard"
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed to delete project")
            }
          }}
        >
          <Trash2 className="size-3" />
          Delete Project
        </Button>
      </div>
    </div>
  )
}

// ─── Secrets Panel ──────────────────────────────────────────────

function SecretsPanel({ projectId, hasTotalumProject }: { projectId: string; hasTotalumProject: boolean }) {
  const [showAdd, setShowAdd] = useState(false)
  const [secretName, setSecretName] = useState("")
  const [secretValue, setSecretValue] = useState("")
  const [secretEnv, setSecretEnv] = useState("both")
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: secretsData, mutate: refreshSecrets } = useSWR<{ ok: boolean; data: { secrets: Secret[] } }>(
    hasTotalumProject ? `/api/projects/${projectId}/secrets` : null,
    jsonFetcher,
    { refreshInterval: 30000 },
  )
  const secrets = secretsData?.data?.secrets ?? []

  const handleCreate = useCallback(async () => {
    if (!secretName.trim() || !secretValue.trim()) return
    setCreating(true)
    try {
      await postJson(`/api/projects/${projectId}/secrets`, {
        secretName: secretName.trim(),
        secretValue: secretValue.trim(),
        environment: secretEnv,
      })
      toast.success("Secret created")
      setSecretName("")
      setSecretValue("")
      setShowAdd(false)
      refreshSecrets()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create secret")
    } finally {
      setCreating(false)
    }
  }, [secretName, secretValue, secretEnv, projectId, refreshSecrets])

  const handleDelete = useCallback(async (secretId: string) => {
    setDeletingId(secretId)
    try {
      await deleteJson(`/api/projects/${projectId}/secrets?id=${secretId}`)
      toast.success("Secret removed")
      refreshSecrets()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove secret")
    } finally {
      setDeletingId(null)
    }
  }, [projectId, refreshSecrets])

  if (!hasTotalumProject) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col items-center py-6 text-center">
          <Key className="size-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Build your project first to manage secrets.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Environment Variables
        </p>
        <Button
          onClick={() => setShowAdd(!showAdd)}
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-[11px]"
        >
          {showAdd ? <X className="size-3" /> : <Key className="size-3" />}
          {showAdd ? "Cancel" : "Add"}
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Secrets are encrypted and synced to the sandbox <code>.env</code> file.
      </p>

      {/* Add form */}
      {showAdd && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
          <Input
            value={secretName}
            onChange={(e) => setSecretName(e.target.value)}
            placeholder="SECRET_NAME"
            className="font-mono text-xs"
          />
          <Input
            value={secretValue}
            onChange={(e) => setSecretValue(e.target.value)}
            placeholder="Value"
            type="password"
            className="font-mono text-xs"
          />
          <select
            value={secretEnv}
            onChange={(e) => setSecretEnv(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs"
          >
            <option value="both">Both (dev + prod)</option>
            <option value="development">Development only</option>
            <option value="production">Production only</option>
          </select>
          <Button
            onClick={handleCreate}
            disabled={creating || !secretName.trim() || !secretValue.trim()}
            size="sm"
            className="w-full gap-1"
          >
            {creating ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
            Create secret
          </Button>
        </div>
      )}

      {/* Secrets list */}
      {secrets.length === 0 ? (
        <div className="py-4 text-center">
          <p className="text-xs text-muted-foreground">No secrets configured yet.</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
          {secrets.map((s) => (
            <div key={s._id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <Key className="size-3 text-muted-foreground shrink-0" />
                <span className="truncate font-mono text-[11px]">{s.secretName}</span>
                <Badge variant="outline" className="text-[9px] shrink-0">
                  {s.environment}
                </Badge>
              </div>
              <Button
                onClick={() => handleDelete(s._id)}
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-destructive hover:bg-destructive/10 shrink-0"
                disabled={deletingId === s._id}
              >
                {deletingId === s._id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Preview Tab ────────────────────────────────────────────────

type Viewport = "desktop" | "tablet" | "mobile"

const VIEWPORTS: Record<Viewport, { width: string; label: string; icon: string }> = {
  desktop: { width: "100%", label: "Desktop", icon: "🖥" },
  tablet: { width: "768px", label: "Tablet", icon: "📱" },
  mobile: { width: "375px", label: "Mobile", icon: "📲" },
}

function PreviewTab({ url, name, isBuilding, realtimeMessages, screenshotUrl, sourceUrl }: { url?: string; name: string; isBuilding: boolean; realtimeMessages?: Array<{ author: string; message: string; messageType: string; createdAt: string; versionId?: string }>; screenshotUrl?: string; sourceUrl?: string }) {
  const [viewport, setViewport] = useState<Viewport>("desktop")
  const [height, setHeight] = useState(600)
  const [previewKey, setPreviewKey] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const vp = VIEWPORTS[viewport]

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [realtimeMessages?.length])

  const hasMessages = realtimeMessages && realtimeMessages.length > 0

  if (!url) {
    return (
      <div className="flex flex-col rounded-xl border border-border bg-card overflow-hidden">
        {/* Source screenshot — same as workspace page */}
        {screenshotUrl ? (
          <div className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border bg-muted/60 px-4 py-2.5">
              <span className="flex gap-1.5" aria-hidden>
                <span className="size-2.5 rounded-full bg-destructive/50" />
                <span className="size-2.5 rounded-full bg-primary/50" />
                <span className="size-2.5 rounded-full bg-success/50" />
              </span>
              <span className="ml-2 flex-1 truncate rounded-sm bg-background/70 px-3 py-1 font-mono text-[11px] text-muted-foreground">
                {sourceUrl ?? "source preview"}
              </span>
              {sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 font-mono text-[11px] text-primary hover:underline"
                >
                  Visit ↗
                </a>
              ) : null}
            </div>
            <a
              href={screenshotUrl}
              target="_blank"
              rel="noreferrer"
              className="block bg-muted"
            >
              <img
                src={screenshotUrl}
                alt={`Screenshot of ${sourceUrl ?? name}`}
                className="max-h-[520px] w-full object-cover object-top"
              />
            </a>
          </div>
        ) : (
          /* Empty state when no screenshot and no URL */
          <div className="flex flex-col items-center justify-center p-16 text-center">
            <Eye className="size-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">No preview available yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              {isBuilding ? "Building your app — this may take a few minutes…" : "Send an instruction to build or edit your app."}
            </p>
            {isBuilding && (
              <Loader2 className="size-6 animate-spin text-primary mt-4" />
            )}
          </div>
        )}

        {/* Live agent messages during build */}
        {isBuilding && hasMessages && (
          <LiveConversationPanel messages={realtimeMessages} messagesEndRef={messagesEndRef} />
        )}
      </div>
    )
  }

  const safeUrl = ensureProtocol(url)

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Browser chrome + controls */}
      <div className="flex items-center justify-between border-b border-border bg-muted/60 px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex gap-1.5 shrink-0" aria-hidden>
            <span className="size-2.5 rounded-full bg-destructive/50" />
            <span className="size-2.5 rounded-full bg-primary/50" />
            <span className="size-2.5 rounded-full bg-success/50" />
          </span>
          <span className="ml-2 truncate rounded-sm bg-background/70 px-3 py-1 font-mono text-[11px] text-muted-foreground">
            {safeUrl}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Viewport toggles */}
          {(['desktop', 'tablet', 'mobile'] as Viewport[]).map((v) => (
            <button
              key={v}
              onClick={() => setViewport(v)}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                viewport === v
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title={VIEWPORTS[v].label}
            >
              <span className="text-xs">{VIEWPORTS[v].icon}</span>
              <span className="hidden sm:inline">{VIEWPORTS[v].label}</span>
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-border" />
          {/* Refresh */}
          <button
            onClick={() => setPreviewKey((k) => k + 1)}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh preview"
          >
            <RefreshCw className="size-3.5" />
          </button>
          {/* Open in new tab */}
          <a
            href={safeUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>

      {/* Iframe */}
      <div className="flex justify-center bg-muted/30">
        <div
          className="transition-[width] duration-300 ease-in-out overflow-hidden bg-background"
          style={{ width: vp.width, maxWidth: "100%" }}
        >
          <iframe
            key={previewKey}
            src={safeUrl}
            title={`${name} preview`}
            className="w-full border-0 bg-background"
            style={{ height: `${height}px` }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      </div>

      {/* Height control */}
      <div className="flex items-center justify-center border-t border-border bg-muted/60 px-4 py-2 gap-3">
        <span className="font-mono text-[10px] text-muted-foreground">Height</span>
        <input
          type="range"
          min={200}
          max={1200}
          value={height}
          onChange={(e) => setHeight(Number(e.target.value))}
          className="w-48 accent-primary"
        />
        <span className="font-mono text-[10px] text-muted-foreground w-12 text-right">{height}px</span>
      </div>

      {/* Live agent messages during build */}
      {isBuilding && hasMessages && (
        <LiveConversationPanel messages={realtimeMessages} messagesEndRef={messagesEndRef} />
      )}
    </div>
  )
}

// ─── Live Conversation Panel ───────────────────────────────────

type RealtimeMsg = { author: string; message: string; messageType: string; createdAt: string; versionId?: string }

function LiveConversationPanel({
  messages,
  messagesEndRef,
}: {
  messages: RealtimeMsg[]
  messagesEndRef: React.RefObject<HTMLDivElement | null>
}) {
  const [expanded, setExpanded] = useState(true)

  // Group messages: skip the first "user" message (it's the prompt we already know)
  const displayMessages = messages.filter(
    (m) => !(m.author === "user" && m.messageType === "regular" && messages.indexOf(m) === 0),
  )

  if (displayMessages.length === 0) return null

  function messageTypeConfig(type: string): { icon: typeof Loader2; color: string; label: string } {
    switch (type) {
      case "building": return { icon: Loader2, color: "text-primary", label: "Building" }
      case "starting": return { icon: Zap, color: "text-amber-500", label: "Starting" }
      case "finished": return { icon: Check, color: "text-green-500", label: "Done" }
      case "error": return { icon: AlertTriangle, color: "text-destructive", label: "Error" }
      case "limit-reached": return { icon: AlertTriangle, color: "text-amber-500", label: "Limit" }
      default: return { icon: MessageSquare, color: "text-muted-foreground", label: "Update" }
    }
  }

  return (
    <div className="border-t border-border bg-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-medium hover:bg-muted/50 transition-colors"
      >
        <Loader2 className="size-3.5 animate-spin text-primary" />
        <span className="text-muted-foreground">Live agent activity</span>
        <Badge variant="secondary" className="text-[9px] ml-1">
          {displayMessages.length} message{displayMessages.length !== 1 ? "s" : ""}
        </Badge>
        <div className="flex-1" />
        {expanded ? <ChevronUp className="size-3.5 text-muted-foreground" /> : <ChevronDown className="size-3.5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="max-h-[300px] overflow-y-auto border-t border-border">
          <ol className="flex flex-col gap-2 p-4">
            {displayMessages.map((msg, i) => {
              const config = messageTypeConfig(msg.messageType)
              const Icon = config.icon
              return (
                <li key={i} className="flex gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                      config.color,
                      `border-current/30 bg-current/5`,
                    )}
                  >
                    <Icon className={cn("size-3", msg.messageType === "building" && "animate-spin")} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn("text-[9px]", config.color, `border-current/30`) }>
                        {config.label}
                      </Badge>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
                      {msg.message}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  )
}

// ─── Conversation Tab ───────────────────────────────────────────

function ConversationTab({ projectId, isBuilding }: { projectId: string; isBuilding: boolean }) {
  const { data } = useSWR<{ ok: boolean; data: { events: Array<{ id: string; at: number; level: string; stage: string; message: string }> } }>(
    `/api/projects/${projectId}/activity`,
    jsonFetcher,
    { refreshInterval: isBuilding ? 5000 : 15000 },
  )

  const events = (data?.data?.events ?? []).slice().reverse()

  if (!events.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-16 text-center">
        <MessageSquare className="size-12 text-muted-foreground/30 mb-4" />
        <p className="text-sm text-muted-foreground">No activity yet.</p>
        <p className="text-xs text-muted-foreground mt-1">Activity will appear as your app is built and edited.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 max-h-[700px] overflow-y-auto">
      <ol className="flex flex-col gap-3">
        {events.map((event) => (
          <li key={event.id} className="flex gap-3">
            <span
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                event.level === "error"
                  ? "border-destructive/40 bg-destructive/15 text-destructive"
                  : event.level === "warn"
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-success/40 bg-success/15 text-success",
              )}
            >
              {event.level === "error" ? "!" : event.level === "warn" ? "•" : "✓"}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm leading-relaxed">{event.message}</p>
              <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                {event.stage} · {new Date(event.at).toLocaleTimeString()}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ─── Versions Tab ───────────────────────────────────────────────

function VersionsTab({ projectId, versions }: { projectId: string; versions: Version[] }) {
  const [expandedDiff, setExpandedDiff] = useState<string | null>(null)
  const [diffContent, setDiffContent] = useState<string>("")
  const [loadingDiff, setLoadingDiff] = useState(false)
  const [recoveringId, setRecoveringId] = useState<string | null>(null)

  const loadDiff = useCallback(async (commitSha: string) => {
    if (expandedDiff === commitSha) {
      setExpandedDiff(null)
      return
    }
    setLoadingDiff(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/version-diff?commitSha=${commitSha}`)
      const body = await res.json()
      setDiffContent(body?.data?.diff ?? "")
      setExpandedDiff(commitSha)
    } catch {
      setDiffContent("Failed to load diff.")
      setExpandedDiff(commitSha)
    } finally {
      setLoadingDiff(false)
    }
  }, [expandedDiff, projectId])

  const handleRecover = useCallback(async (versionId: string) => {
    setRecoveringId(versionId)
    try {
      await postJson(`/api/projects/${projectId}/recover`, { versionId })
      toast.success("Version recovery started", { description: "This may take 1–4 minutes." })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to recover version")
    } finally {
      setRecoveringId(null)
    }
  }, [projectId])

  if (!versions.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-16 text-center">
        <History className="size-12 text-muted-foreground/30 mb-4" />
        <p className="text-sm text-muted-foreground">No versions yet.</p>
        <p className="text-xs text-muted-foreground mt-1">Versions are created each time a prompt completes.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 max-h-[700px] overflow-y-auto">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
        {versions.length} version{versions.length !== 1 ? "s" : ""}
      </p>
      <ol className="flex flex-col gap-2">
        {versions.map((v, i) => (
          <li key={v._id} className="rounded-lg border border-border bg-background/50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{v.name}</span>
                  {i === 0 && <Badge className="text-[9px] bg-primary/10 text-primary border-primary/30">Latest</Badge>}
                </div>
                {v.commitMessage && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{v.commitMessage}</p>
                )}
                {v.prompt && (
                  <p className="text-xs text-muted-foreground mt-0.5 italic truncate">Prompt: {v.prompt}</p>
                )}
                <p className="font-mono text-[10px] text-muted-foreground mt-1">
                  <Clock className="inline size-3 mr-1" />
                  {new Date(v.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {v.commitSha && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => loadDiff(v.commitSha!)}
                    disabled={loadingDiff && expandedDiff === v.commitSha}
                    className="h-7 gap-1 text-[11px]"
                  >
                    <FileCode className="size-3" />
                    Diff
                  </Button>
                )}
                {i > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRecover(v._id)}
                    disabled={recoveringId === v._id}
                    className="h-7 gap-1 text-[11px] text-amber-600 hover:text-amber-700"
                  >
                    {recoveringId === v._id ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <RotateCcw className="size-3" />
                    )}
                    Recover
                  </Button>
                )}
              </div>
            </div>
            {/* Diff view */}
            {expandedDiff === v.commitSha && (
              <div className="mt-2 rounded-md bg-muted/50 p-3 overflow-x-auto">
                <pre className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground">
                  {diffContent || "No changes in this version."}
                </pre>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

// ─── Logs Tab ───────────────────────────────────────────────────

function LogsTab({ projectId }: { projectId: string }) {
  const [logType, setLogType] = useState<"dev" | "prod">("dev")
  const [searchTerm, setSearchTerm] = useState("")

  const { data: logsData } = useSWR<{ ok: boolean; data: { logs?: string } }>(
    `/api/projects/${projectId}/logs?type=${logType}${searchTerm ? `&regexSearch=${encodeURIComponent(searchTerm)}` : ""}`,
    jsonFetcher,
    { refreshInterval: 10000 },
  )

  const logs = logsData?.data?.logs ?? "No logs available."

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-muted/60 px-4 py-2">
        <Terminal className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">Server Logs</span>
        <div className="flex-1" />
        <div className="flex gap-1">
          {(["dev", "prod"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setLogType(t)}
              className={cn(
                "rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors",
                logType === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "dev" ? "Development" : "Production"}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="border-b border-border px-4 py-2">
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search logs…"
          className="h-7 text-xs"
        />
      </div>

      <div className="max-h-[500px] overflow-y-auto p-4">
        <pre className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
          {logs}
        </pre>
      </div>
    </div>
  )
}
