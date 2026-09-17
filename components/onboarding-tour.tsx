"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight, Check, ChevronRight, Globe, Lightbulb, GitBranch,
  Sparkles, Building2, Users, Briefcase, UserCog, LayoutDashboard,
  Rocket, MessageSquare, CheckCircle2, Brain, TrendingUp,
  Mail, RefreshCw, ShieldCheck, Camera, Loader2, User,
  Code2, Layers, Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { postJson, useSession, useProjects } from "@/lib/client/api"
import type { Project } from "@/lib/types/project"

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "atai:onboarded"
const LEGACY_STORAGE_KEY = "mirrorsite:onboarded"
const RESEND_COOLDOWN_SECONDS = 180
const CORE_STEPS = 4

// ─── Milestones ───────────────────────────────────────────────────────────────

const MILESTONES_UNVERIFIED = [
  { icon: Mail, label: "Verify email" },
  { icon: User, label: "Your profile" },
  { icon: MessageSquare, label: "Your business" },
  { icon: Brain, label: "Your role" },
  { icon: Rocket, label: "First project" },
]
const MILESTONES_VERIFIED = [
  { icon: User, label: "Your profile" },
  { icon: MessageSquare, label: "Your business" },
  { icon: Brain, label: "Your role" },
  { icon: Rocket, label: "First project" },
]

// ─── Role options ─────────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { id: "founder", label: "Founder", icon: Lightbulb },
  { id: "cofounder", label: "Co-Founder", icon: Users },
  { id: "business_owner", label: "Business Owner", icon: Building2 },
  { id: "startup_operator", label: "Startup Operator", icon: Briefcase },
  { id: "product_manager", label: "Product Manager", icon: UserCog },
  { id: "other", label: "Other", icon: LayoutDashboard },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean)
  if (!p.length) return "?"
  return p.length === 1 ? p[0]!.slice(0, 2).toUpperCase() : (p[0]![0]! + p[p.length - 1]![0]!).toUpperCase()
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49 1 .11-.78.42-1.3.76-1.6-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.14 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58C20.57 21.8 24 17.3 24 12 24 5.37 18.63 0 12 0Z" />
    </svg>
  )
}

// ─── Inline forms ─────────────────────────────────────────────────────────────

function InlineGitHubForm({ onCreated }: { onCreated: (p: Project) => void }) {
  const { refresh } = useProjects()
  const [repoInput, setRepoInput] = useState("")
  const [subMode, setSubMode] = useState<"clone" | "extend">("clone")
  const [userRequest, setUserRequest] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function parseRepo(raw: string) {
    const t = raw.trim()
    if (!t) return null
    const u = t.match(/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/)
    if (u) return { owner: u[1]!, name: u[2]! }
    const s = t.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/)
    return s ? { owner: s[1]!, name: s[2]! } : null
  }

  const parsed = parseRepo(repoInput)
  const valid = !!parsed && (subMode === "clone" || userRequest.trim().length > 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true); setError(null)
    try {
      const { project } = await postJson<{ project: Project }>("/api/projects", {
        mode: "github", githubRepoOwner: parsed!.owner, githubRepoName: parsed!.name,
        githubBranch: "main", githubSubMode: subMode,
        userRequest: subMode === "extend" ? userRequest.trim() : undefined,
      })
      await refresh(); onCreated(project)
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create project"); setBusy(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        {(["clone", "extend"] as const).map(m => (
          <button key={m} type="button" onClick={() => setSubMode(m)}
            className={cn("flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all",
              subMode === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground")}>
            {m === "clone" ? <Code2 className="size-4" /> : <Layers className="size-4" />}
            {m === "clone" ? "Clone & rebuild" : "Extend existing"}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-semibold text-foreground">GitHub repository</Label>
        <Input value={repoInput} onChange={e => setRepoInput(e.target.value)}
          placeholder="github.com/owner/repo  or  owner/repo"
          className="font-mono h-12 bg-background/60 backdrop-blur-sm" disabled={busy} autoComplete="off" />
        {repoInput && !parsed && <p className="text-xs text-destructive">Enter a valid GitHub URL or owner/repo</p>}
        {parsed && <p className="text-xs text-emerald-500">✓ {parsed.owner}/{parsed.name}</p>}
      </div>
      {subMode === "extend" && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-sm font-semibold text-foreground">What do you want to add or change? <span className="text-primary">*</span></Label>
          <Textarea value={userRequest} onChange={e => setUserRequest(e.target.value)}
            placeholder="Add dark mode, implement user authentication, build a payments flow..."
            className="resize-none min-h-[80px] bg-background/60" disabled={busy} />
        </div>
      )}
      {error && <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={!valid || busy} size="lg" className="gap-2 font-bold">
        {busy ? <><Loader2 className="size-4 animate-spin" />Analysing repo…</> : <><GitHubIcon className="size-4" />Start building</>}
      </Button>
    </form>
  )
}

function InlineWebsiteForm({ onCreated }: { onCreated: (p: Project) => void }) {
  const { refresh } = useProjects()
  const [url, setUrl] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function normalizeUrl(raw: string) {
    const t = raw.trim()
    if (!t) return null
    const s = /^https?:\/\//i.test(t) ? t : `https://${t}`
    try { const u = new URL(s); return u.hostname.includes(".") ? u.toString() : null } catch { return null }
  }

  const normalized = normalizeUrl(url)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!normalized || busy) return
    setBusy(true); setError(null)
    try {
      const { project } = await postJson<{ project: Project }>("/api/projects", { url: normalized, crawlMode: "relevant", pipelineMode: "legacy" })
      await refresh(); onCreated(project)
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create project"); setBusy(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-semibold text-foreground">Website URL <span className="text-primary">*</span></Label>
        <Input value={url} onChange={e => { setUrl(e.target.value); setError(null) }}
          placeholder="stripe.com  or  https://competitor.com"
          className="font-mono h-12 bg-background/60 backdrop-blur-sm" inputMode="url" disabled={busy} />
        {url && !normalized && <p className="text-xs text-destructive">Enter a valid website URL</p>}
        {normalized && <p className="text-xs text-emerald-500">✓ {normalized}</p>}
      </div>
      {error && <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={!normalized || busy} size="lg" className="gap-2 font-bold">
        {busy ? <><Loader2 className="size-4 animate-spin" />Crawling site…</> : <><Globe className="size-4" />Analyse & build</>}
      </Button>
    </form>
  )
}

function InlineIdeaForm({ onCreated }: { onCreated: (p: Project) => void }) {
  const { refresh } = useProjects()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [productName, setProductName] = useState("")
  const [problem, setProblem] = useState("")
  const [audience, setAudience] = useState("")
  const [solution, setSolution] = useState("")
  const [bizModel, setBizModel] = useState("")
  const MODELS = ["SaaS subscription", "One-time purchase", "Marketplace / commission", "Free with paid upgrades", "Other"]
  const canSubmit = problem.trim().length >= 8 && solution.trim().length >= 8 && !busy

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true); setError(null)
    const parts: string[] = []
    if (productName.trim()) parts.push(`Product / business name: ${productName.trim()}`)
    parts.push(`Problem being solved: ${problem.trim()}`)
    if (audience.trim()) parts.push(`Target audience: ${audience.trim()}`)
    parts.push(`Solution: ${solution.trim()}`)
    if (bizModel) parts.push(`Business model: ${bizModel}`)
    try {
      const { project } = await postJson<{ project: Project }>("/api/projects", { mode: "scratch", idea: parts.join("\n\n"), pipelineMode: "legacy" })
      await refresh(); onCreated(project)
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create project"); setBusy(false) }
  }

  const inputCls = "h-11 bg-background/60 backdrop-blur-sm"
  const textCls = "resize-none min-h-[80px] bg-background/60"

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-semibold text-foreground">Business / product name <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
        <Input value={productName} onChange={e => setProductName(e.target.value)} placeholder="e.g. TaskFlow, BudgetBuddy…" maxLength={120} className={inputCls} disabled={busy} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-semibold text-foreground">The problem you are solving <span className="text-primary">*</span></Label>
        <Textarea value={problem} onChange={e => setProblem(e.target.value.slice(0, 1000))} placeholder="e.g. Small businesses spend hours every week tracking invoices manually in spreadsheets." className={textCls} disabled={busy} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-semibold text-foreground">Target audience <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
        <Input value={audience} onChange={e => setAudience(e.target.value)} placeholder="e.g. Freelancers, small business owners…" maxLength={200} className={inputCls} disabled={busy} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-semibold text-foreground">The solution <span className="text-primary">*</span></Label>
        <Textarea value={solution} onChange={e => setSolution(e.target.value.slice(0, 1000))} placeholder="e.g. A simple invoicing app where users create invoices, set reminders, and see who has paid." className={textCls} disabled={busy} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-semibold text-foreground">Business model <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
        <select value={bizModel} onChange={e => setBizModel(e.target.value)} disabled={busy}
          className="h-11 w-full rounded-xl border border-input bg-background/60 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring backdrop-blur-sm">
          <option value="">Select a model (optional)</option>
          {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      {error && <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={!canSubmit} size="lg" className="gap-2 font-bold">
        {busy ? <><Loader2 className="size-4 animate-spin" />Planning your business…</> : <><Sparkles className="size-4" />Generate app plan</>}
      </Button>
    </form>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OnboardingTour() {
  const router = useRouter()
  const { session, isLoading, refresh: refreshSession } = useSession()

  const needsVerification = session?.user ? !session.user.emailVerified : false
  const TOTAL_STEPS = needsVerification ? CORE_STEPS + 1 : CORE_STEPS
  const MILESTONES = needsVerification ? MILESTONES_UNVERIFIED : MILESTONES_VERIFIED

  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const contentStep = needsVerification ? step - 1 : step

  // Profile
  const [displayName, setDisplayName] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Business
  const [businessDesc, setBusinessDesc] = useState("")

  // Role
  const [role, setRole] = useState("")
  const [roleCustom, setRoleCustom] = useState("")

  // Build
  type BuildMode = "idea" | "website" | "github" | null
  const [buildMode, setBuildMode] = useState<BuildMode>(null)
  const [createdProject, setCreatedProject] = useState<Project | null>(null)

  // Resend
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resending, setResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [resendError, setResendError] = useState<string | null>(null)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (session?.user?.name && !displayName) setDisplayName(session.user.name)
    if (session?.user?.imageUrl && !avatarUrl) setAvatarUrl(session.user.imageUrl)
  }, [session]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current) }, [])

  function startCooldown() {
    setResendCooldown(RESEND_COOLDOWN_SECONDS)
    if (cooldownRef.current) clearInterval(cooldownRef.current)
    cooldownRef.current = setInterval(() => {
      setResendCooldown(p => { if (p <= 1) { clearInterval(cooldownRef.current!); cooldownRef.current = null; return 0 } return p - 1 })
    }, 1000)
  }

  const formatCooldown = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`

  async function handleResend() {
    if (resending || resendCooldown > 0) return
    setResending(true); setResendError(null); setResendSuccess(false)
    try { await fetch("/api/auth/resend-verification", { method: "POST", credentials: "include" }); setResendSuccess(true); startCooldown() }
    catch { setResendError("Failed to resend. Please try again.") }
    finally { setResending(false) }
  }

  const handleAvatarFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return
    setUploading(true); setAvatarUrl(URL.createObjectURL(file))
    try {
      const form = new FormData(); form.append("file", file)
      const res = await fetch("/api/me/avatar", { method: "POST", body: form })
      const b = await res.json().catch(() => null)
      if (b?.ok) await refreshSession(); else setAvatarUrl(session?.user?.imageUrl ?? null)
    } catch { setAvatarUrl(session?.user?.imageUrl ?? null) }
    finally { setUploading(false) }
  }, [refreshSession, session])

  async function saveProfileName(name: string) {
    if (!name.trim() || name.trim() === session?.user?.name) return
    try {
      await fetch("/api/me/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: name.trim() }), credentials: "include" })
      await refreshSession()
    } catch { }
  }

  // ── Open/close logic ──────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoading) return
    if (session?.user?.id) {
      try { window.localStorage.removeItem(STORAGE_KEY); window.localStorage.removeItem(LEGACY_STORAGE_KEY) } catch { }
      if (session.user.onboarding?.completedAt) {
        try { window.localStorage.setItem(`${STORAGE_KEY}:${session.user.id}`, "1") } catch { }
        return
      }
      try { if (window.localStorage.getItem(`${STORAGE_KEY}:${session.user.id}`) !== "1") setOpen(true) }
      catch { setOpen(true) }
    }
  }, [session, isLoading])

  // ── Finish — always lands on /projects (or project page) ─────────────────
  async function finish(projectId?: string) {
    try { if (session?.user?.id) window.localStorage.setItem(`${STORAGE_KEY}:${session.user.id}`, "1") } catch { }
    if (session?.user) {
      try {
        await postJson("/api/auth/onboarding", {
          businessDescription: businessDesc.trim() || undefined,
          role: role === "other" ? roleCustom.trim() : role || undefined,
          destination: projectId ? `/project/${projectId}` : "/projects",
        })
      } catch { }
    }
    setOpen(false)
    // Route: created project → project page, skip/skip step → /projects
    router.push(projectId ? `/project/${projectId}` : "/projects")
  }

  const stepValid = [
    ...(needsVerification ? [true] : []),  // verify
    true,                                   // profile
    businessDesc.trim().length >= 10,       // business
    !!(role && (role !== "other" || roleCustom.trim())), // role
    true,                                   // build
  ]

  function handleNext() { if (step < TOTAL_STEPS - 1) setStep(s => s + 1) }
  function handleBack() { if (step > 0) setStep(s => s - 1) }

  if (!open) return null

  // ─── Full-screen overlay ──────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex overflow-hidden">

      {/* ── Ambient background — same as the landing page ── */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse 80% 50% at 10% -10%, color-mix(in oklab, var(--primary) 9%, transparent), transparent 55%), radial-gradient(ellipse 60% 40% at 90% 110%, color-mix(in oklab, var(--accent) 10%, transparent), transparent 55%)" }}
        />
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.035]"
          style={{ backgroundImage: "linear-gradient(90deg,transparent 49.5%,color-mix(in oklab,var(--border) 100%,transparent) 50%,transparent 50.5%),linear-gradient(0deg,transparent 49.5%,color-mix(in oklab,var(--border) 100%,transparent) 50%,transparent 50.5%)", backgroundSize: "48px 48px" }}
        />
      </div>

      {/* ── Left sidebar ── */}
      <aside className="relative z-10 hidden lg:flex w-64 xl:w-72 shrink-0 flex-col border-r border-border/60 bg-background/60 backdrop-blur-xl">

        {/* Brand */}
        <div className="flex items-center gap-3 px-7 py-7 border-b border-border/60">
          <div className="relative flex size-9 shrink-0 items-center justify-center rounded-xl font-black text-sm text-primary-foreground shadow-lg shadow-primary/20"
            style={{ background: "linear-gradient(135deg, var(--primary), color-mix(in oklab, var(--accent) 60%, var(--primary)))" }}>
            A
          </div>
          <div>
            <p className="font-mono text-sm font-bold text-foreground leading-none">Atai</p>
            <p className="font-mono text-[9px] text-muted-foreground/60 uppercase tracking-[0.18em] mt-0.5">Business Platform</p>
          </div>
        </div>

        {/* Milestones */}
        <div className="flex flex-col gap-1 flex-1 px-4 py-6">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 px-3 mb-3">Your journey</p>
          {MILESTONES.map((m, i) => {
            const done = i < step
            const active = i === step
            return (
              <div key={m.label}
                className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200",
                  active ? "bg-primary/10" : done ? "opacity-50" : "opacity-25")}>
                <div className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black transition-all",
                  active ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                    : done ? "bg-primary/20 text-primary"
                      : "bg-border/60 text-muted-foreground/50")}>
                  {done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                </div>
                <span className={cn("text-sm font-semibold", active ? "text-foreground" : "text-muted-foreground")}>
                  {m.label}
                </span>
                {active && (
                  <span className="ml-auto flex size-1.5 rounded-full bg-primary animate-pulse" />
                )}
              </div>
            )
          })}
        </div>

        {/* Tagline */}
        <div className="px-7 py-6 border-t border-border/60">
          <p className="text-xs text-muted-foreground/50 leading-5 italic">
            &ldquo;Built for founders who aren&apos;t thinking small.&rdquo;
          </p>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">

        {/* ── Top bar ── */}
        <header className="flex items-center justify-between border-b border-border/60 bg-background/50 backdrop-blur-xl px-6 py-3.5 lg:px-10">
          {/* Mobile brand */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="flex size-7 items-center justify-center rounded-lg font-black text-xs text-primary-foreground"
              style={{ background: "linear-gradient(135deg, var(--primary), color-mix(in oklab, var(--accent) 60%, var(--primary)))" }}>A</div>
            <span className="font-mono text-sm font-bold text-foreground">Atai</span>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 mx-auto lg:mx-0">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div key={i} className={cn("h-1.5 rounded-full transition-all duration-500",
                i === step ? "w-8 bg-primary shadow-sm shadow-primary/40"
                  : i < step ? "w-4 bg-primary/40"
                    : "w-2 bg-border/60")} />
            ))}
            <span className="ml-3 font-mono text-[11px] text-muted-foreground">{step + 1} / {TOTAL_STEPS}</span>
          </div>

          {/* Skip */}
          {!(needsVerification && step === 0) ? (
            <button onClick={() => finish()}
              className="ml-auto lg:ml-0 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors">
              Skip for now
            </button>
          ) : <div className="ml-auto lg:ml-0 w-16" />}
        </header>

        {/* ── Step content ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-xl px-6 py-12 lg:px-8 lg:py-16">

            {/* ══ STEP: VERIFY EMAIL ══ */}
            {needsVerification && step === 0 && (
              <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary mb-4">
                    Step 1 of {TOTAL_STEPS} — Get started
                  </p>
                  <h1 className="text-4xl font-black tracking-tight leading-[1.05] sm:text-5xl">
                    Check your inbox.
                  </h1>
                  <p className="mt-4 text-base leading-7 text-muted-foreground">
                    We sent a verification link to{" "}
                    <span className="font-semibold text-foreground">{session?.user?.email}</span>.
                    Click it to confirm your account and unlock{" "}
                    <span className="font-semibold text-primary">500 free credits</span>.
                  </p>
                </div>

                {/* Steps */}
                <div className="flex flex-col gap-2">
                  {[
                    { n: 1, text: `Open the email sent to ${session?.user?.email}` },
                    { n: 2, text: "Click the \"Verify my email\" button" },
                    { n: 3, text: "Come back here — the page updates automatically" },
                  ].map(({ n, text }) => (
                    <div key={n} className="flex items-start gap-4 rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm px-5 py-4">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">{n}</span>
                      <p className="text-sm text-foreground leading-6">{text}</p>
                    </div>
                  ))}
                </div>

                {/* Resend */}
                <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm px-6 py-5">
                  <p className="text-sm font-semibold text-foreground">Didn&apos;t get the email?</p>
                  <p className="mt-1 text-sm text-muted-foreground mb-4">Check spam first. Still nothing?</p>
                  {resendSuccess && (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 mb-3">
                      <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                      <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Email sent! Check your inbox.</p>
                    </div>
                  )}
                  {resendError && <p className="text-sm text-destructive mb-3">{resendError}</p>}
                  <button onClick={handleResend} disabled={resending || resendCooldown > 0}
                    className={cn("inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold transition-all",
                      resendCooldown > 0 || resending
                        ? "border-border/50 bg-muted/50 text-muted-foreground cursor-not-allowed"
                        : "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/50")}>
                    <RefreshCw className={cn("size-3.5", resending && "animate-spin")} />
                    {resending ? "Sending…" : resendCooldown > 0 ? `Resend in ${formatCooldown(resendCooldown)}` : "Resend verification email"}
                  </button>
                  {resendCooldown > 0 && <p className="mt-2 text-xs text-muted-foreground">Limited to once every 3 minutes.</p>}
                </div>

                {/* Credits callout */}
                <div className="flex items-start gap-3.5 rounded-2xl border border-primary/20 bg-primary/5 backdrop-blur-sm px-5 py-4">
                  <ShieldCheck className="size-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-foreground">500 free credits — claimed on verification</p>
                    <p className="mt-1 text-sm text-muted-foreground">No payment needed. Added the moment you verify.</p>
                  </div>
                </div>
              </div>
            )}

            {/* ══ STEP: PROFILE ══ */}
            {contentStep === 0 && (
              <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary mb-4">
                    Step {step + 1} of {TOTAL_STEPS} — Your profile
                  </p>
                  <h1 className="text-4xl font-black tracking-tight leading-[1.05] sm:text-5xl">
                    Set up your profile.
                  </h1>
                  <p className="mt-4 text-base leading-7 text-muted-foreground">
                    Add a photo and name so Atai knows who you are. Both are optional — you can update them any time in Settings.
                  </p>
                </div>

                <div className="flex flex-col gap-6">
                  {/* Avatar upload */}
                  <div className="flex items-center gap-6 rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm px-6 py-5">
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                      className="relative group rounded-full outline-none shrink-0">
                      <Avatar className="size-[72px] border-2 border-border ring-2 ring-primary/10 transition-all group-hover:ring-primary/30">
                        <AvatarImage src={avatarUrl ?? undefined} alt={displayName || "Avatar"} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xl font-black">
                          {displayName ? initials(displayName) : <User className="size-7" />}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                        {uploading ? <Loader2 className="size-5 text-white animate-spin" /> : <Camera className="size-5 text-white" />}
                      </div>
                    </button>
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-1">Profile photo</p>
                      <p className="text-xs text-muted-foreground mb-3">JPG, PNG or WebP — max 5 MB</p>
                      <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                        className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
                        <Camera className="size-3.5" />
                        {uploading ? "Uploading…" : "Choose photo"}
                      </button>
                    </div>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarFile(f); e.target.value = "" }} />

                  {/* Name */}
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="display-name" className="text-sm font-semibold text-foreground">
                      Display name <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Input id="display-name" value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      onBlur={e => saveProfileName(e.target.value)}
                      placeholder="Your name" className="h-12 bg-background/60 backdrop-blur-sm text-base" maxLength={80} />
                    <p className="text-xs text-muted-foreground">How you appear across the platform.</p>
                  </div>
                </div>
              </div>
            )}

            {/* ══ STEP: BUSINESS ══ */}
            {contentStep === 1 && (
              <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary mb-4">
                    Step {step + 1} of {TOTAL_STEPS} — Your business
                  </p>
                  <h1 className="text-4xl font-black tracking-tight leading-[1.05] sm:text-5xl">
                    Tell us about your business.
                  </h1>
                  <p className="mt-4 text-base leading-7 text-muted-foreground">
                    This shapes everything — how your AI co-founder works with you, how your app is planned, and how Atai tailors your experience.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <Label htmlFor="biz-desc" className="text-sm font-semibold text-foreground">
                    Describe your business in 1–2 sentences <span className="text-primary">*</span>
                  </Label>
                  <Textarea id="biz-desc" value={businessDesc}
                    onChange={e => setBusinessDesc(e.target.value.slice(0, 300))}
                    placeholder="e.g. I'm building a SaaS platform that helps small restaurants manage online orders without relying on third-party apps."
                    className="resize-none min-h-[120px] bg-background/60 backdrop-blur-sm text-base" autoFocus maxLength={300} />
                  <div className="flex items-center justify-between">
                    <p className={cn("text-xs transition-colors",
                      businessDesc.trim().length > 0 && businessDesc.trim().length < 10 ? "text-amber-500" : "text-muted-foreground/60")}>
                      {businessDesc.trim().length > 0 && businessDesc.trim().length < 10 ? "A bit more detail helps the AI." : "Plain language is perfect."}
                    </p>
                    <span className={cn("font-mono text-xs", businessDesc.length > 270 ? "text-amber-500" : "text-muted-foreground/40")}>
                      {businessDesc.length}/300
                    </span>
                  </div>
                </div>

                {/* Team chips */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { icon: Brain, label: "AI Co-Founder", c: "text-violet-400", b: "bg-violet-500/8 border-violet-500/15" },
                    { icon: Rocket, label: "Engineering", c: "text-primary", b: "bg-primary/8 border-primary/15" },
                    { icon: TrendingUp, label: "Growth Team", c: "text-emerald-400", b: "bg-emerald-500/8 border-emerald-500/15" },
                  ].map(({ icon: Icon, label, c, b }) => (
                    <div key={label} className={cn("flex items-center gap-2 rounded-xl border px-3 py-2.5 backdrop-blur-sm", b)}>
                      <Icon className={cn("size-3.5 shrink-0", c)} />
                      <span className="text-xs font-medium text-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ══ STEP: ROLE ══ */}
            {contentStep === 2 && (
              <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary mb-4">
                    Step {step + 1} of {TOTAL_STEPS} — About you
                  </p>
                  <h1 className="text-4xl font-black tracking-tight leading-[1.05] sm:text-5xl">
                    What&apos;s your role?
                  </h1>
                  <p className="mt-4 text-base leading-7 text-muted-foreground">
                    We&apos;ll tailor your experience to match where you are in the journey.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {ROLE_OPTIONS.map(({ id, label, icon: Icon }) => {
                    const selected = role === id
                    return (
                      <button key={id} type="button" onClick={() => setRole(id)}
                        className={cn("flex flex-col items-center gap-3 rounded-2xl border px-4 py-5 text-sm transition-all duration-200",
                          selected
                            ? "border-primary bg-primary/8 shadow-lg shadow-primary/10 scale-[1.02]"
                            : "border-border/60 bg-card/40 backdrop-blur-sm hover:border-primary/30 hover:bg-card/60")}>
                        <div className={cn("flex size-10 items-center justify-center rounded-xl transition-colors",
                          selected ? "bg-primary/15" : "bg-muted/60")}>
                          <Icon className={cn("size-5", selected ? "text-primary" : "text-muted-foreground")} />
                        </div>
                        <span className={cn("font-semibold text-sm text-center leading-tight", selected ? "text-primary" : "text-foreground")}>
                          {label}
                        </span>
                        {selected && <span className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="size-2.5" strokeWidth={3} /></span>}
                      </button>
                    )
                  })}
                </div>

                {role === "other" && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="role-custom" className="text-sm font-semibold text-foreground">Tell us your role</Label>
                    <Input id="role-custom" value={roleCustom} onChange={e => setRoleCustom(e.target.value)}
                      placeholder="e.g. Solopreneur, Consultant, Investor…"
                      className="h-12 bg-background/60 backdrop-blur-sm text-base" autoFocus maxLength={80} />
                  </div>
                )}
              </div>
            )}

            {/* ══ STEP: BUILD FIRST PROJECT ══ */}
            {contentStep === 3 && (
              <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                {!createdProject ? (
                  <>
                    <div>
                      <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary mb-4">
                        Step {step + 1} of {TOTAL_STEPS} — First project
                      </p>
                      <h1 className="text-4xl font-black tracking-tight leading-[1.05] sm:text-5xl">
                        Build your first business.
                      </h1>
                      <p className="mt-4 text-base leading-7 text-muted-foreground">
                        Choose how you want to start. Atai handles the planning, building, and deployment — you just describe what you want.
                      </p>
                    </div>

                    {/* Mode cards */}
                    {!buildMode && (
                      <div className="flex flex-col gap-3">
                        {[
                          {
                            mode: "idea" as BuildMode,
                            icon: Lightbulb,
                            label: "Start from an idea",
                            sub: "Describe the problem and solution — Atai plans and builds the full product",
                            accent: "border-primary/25 hover:border-primary/50 hover:bg-primary/5",
                            iconBg: "bg-primary/10", iconColor: "text-primary",
                            tag: "Most popular",
                          },
                          {
                            mode: "website" as BuildMode,
                            icon: Globe,
                            label: "Build on a competitor",
                            sub: "Paste a URL — we analyse it and rebuild the concept as your own product",
                            accent: "border-violet-500/25 hover:border-violet-500/50 hover:bg-violet-500/5",
                            iconBg: "bg-violet-500/10", iconColor: "text-violet-400",
                            tag: null,
                          },
                          {
                            mode: "github" as BuildMode,
                            icon: GitHubIcon,
                            label: "From a GitHub repo",
                            sub: "Link a repository — we clone or extend your existing codebase",
                            accent: "border-purple-500/25 hover:border-purple-500/50 hover:bg-purple-500/5",
                            iconBg: "bg-purple-500/10", iconColor: "text-purple-400",
                            tag: "New",
                          },
                        ].map(({ mode, icon: Icon, label, sub, accent, iconBg, iconColor, tag }) => (
                          <button key={mode as string} type="button" onClick={() => setBuildMode(mode)}
                            className={cn("group flex items-start gap-4 rounded-2xl border bg-card/40 backdrop-blur-sm px-5 py-5 text-left transition-all duration-200 hover:shadow-lg", accent)}>
                            <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl mt-0.5", iconBg)}>
                              <Icon className={cn("size-5", iconColor)} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-base text-foreground leading-snug">{label}</p>
                                {tag && <span className="rounded-full border border-primary/25 bg-primary/8 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-primary">{tag}</span>}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1 leading-5">{sub}</p>
                            </div>
                            <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all mt-1 shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Inline form */}
                    {buildMode && (
                      <div>
                        <button type="button" onClick={() => setBuildMode(null)}
                          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                          ← Back to modes
                        </button>

                        {/* Mode badge */}
                        <div className="flex items-center gap-2.5 mb-5 rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm px-4 py-3">
                          {buildMode === "idea" && <><Lightbulb className="size-4 text-primary" /><span className="text-sm font-bold text-foreground">Idea mode</span></>}
                          {buildMode === "website" && <><Globe className="size-4 text-violet-400" /><span className="text-sm font-bold text-foreground">Competitor mode</span></>}
                          {buildMode === "github" && <><GitHubIcon className="size-4 text-purple-400" /><span className="text-sm font-bold text-foreground">GitHub mode</span></>}
                        </div>

                        {buildMode === "idea" && <InlineIdeaForm onCreated={p => setCreatedProject(p)} />}
                        {buildMode === "website" && <InlineWebsiteForm onCreated={p => setCreatedProject(p)} />}
                        {buildMode === "github" && <InlineGitHubForm onCreated={p => setCreatedProject(p)} />}
                      </div>
                    )}
                  </>
                ) : (
                  /* ── Success state ── */
                  <div className="flex flex-col gap-6">
                    {/* Hero check */}
                    <div className="flex flex-col items-center text-center gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 backdrop-blur-sm px-6 py-8">
                      <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/15 shadow-xl shadow-emerald-500/10">
                        <CheckCircle2 className="size-8 text-emerald-500" />
                      </div>
                      <div>
                        <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-emerald-500 mb-2">Project created</p>
                        <h2 className="text-2xl font-black tracking-tight text-foreground">{createdProject.name}</h2>
                        <p className="mt-2 text-sm text-muted-foreground leading-6 max-w-sm mx-auto">
                          Atai is analysing your input and building your app plan. Takes a minute or two — you can review it before the build starts.
                        </p>
                      </div>
                    </div>

                    {/* What happens next */}
                    <div>
                      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-3">What happens next</p>
                      <div className="flex flex-col gap-2">
                        {[
                          { icon: Zap, c: "text-primary", b: "bg-primary/10", label: "Plan generated", sub: "AI analyses your input and creates a full app plan" },
                          { icon: MessageSquare, c: "text-violet-400", b: "bg-violet-500/10", label: "Review & refine", sub: "Chat with AI to adjust features, flows, and the business model" },
                          { icon: Rocket, c: "text-emerald-400", b: "bg-emerald-500/10", label: "Build & launch", sub: "Atai builds and deploys your full application" },
                        ].map(({ icon: Icon, c, b, label, sub }) => (
                          <div key={label} className="flex items-start gap-3.5 rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm px-4 py-3.5">
                            <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg mt-0.5", b)}>
                              <Icon className={cn("size-4", c)} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">{label}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="border-t border-border/60 bg-background/50 backdrop-blur-xl px-6 py-5 lg:px-10">
          <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-4">
            {/* Back */}
            <div>
              {step > 0 && !(contentStep === 3 && !!buildMode && !createdProject) ? (
                <Button variant="outline" onClick={handleBack} className="gap-2 h-11 px-5 border-border/60 bg-card/40 backdrop-blur-sm">
                  ← Back
                </Button>
              ) : <div />}
            </div>

            {/* Forward */}
            <div className="flex items-center gap-3">

              {/* Verify */}
              {needsVerification && step === 0 && <>
                <Button variant="ghost" onClick={handleNext} className="h-11 px-5 text-muted-foreground text-sm">
                  I&apos;ll verify later
                </Button>
                <Button onClick={handleNext} className="gap-2 h-11 px-6 font-bold">
                  <Mail className="size-4" /> I&apos;ve verified <ChevronRight className="size-4" />
                </Button>
              </>}

              {/* Profile, business, role */}
              {(contentStep === 0 || contentStep === 1 || contentStep === 2) && (
                <Button onClick={handleNext} disabled={!stepValid[step]} className="gap-2 h-11 px-6 font-bold">
                  Continue <ChevronRight className="size-4" />
                </Button>
              )}

              {/* Build step */}
              {contentStep === 3 && (
                createdProject ? (
                  <Button onClick={() => finish(createdProject.id)} className="gap-2 h-11 px-7 font-bold text-base">
                    <Rocket className="size-4" /> Go to my project <ArrowRight className="size-4" />
                  </Button>
                ) : !buildMode ? (
                  <Button variant="ghost" onClick={() => finish()} className="h-11 px-5 text-muted-foreground text-sm">
                    I&apos;ll do this later
                  </Button>
                ) : null
              )}
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
