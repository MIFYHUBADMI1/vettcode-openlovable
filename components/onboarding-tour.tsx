"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  Globe,
  Lightbulb,
  MessageCircle,
  Mic,
  Search,
  Sparkles,
  User,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { postJson, useSession } from "@/lib/client/api"

const STORAGE_KEY = "mirrorsite:onboarded"

// ─── Step 1: How did you find us? ───────────────────────────────────────────

const SOURCE_OPTIONS = [
  { id: "ai", label: "AI / ChatGPT", icon: Bot },
  { id: "llm", label: "LLM / Claude / Gemini", icon: Sparkles },
  { id: "google", label: "Google Search", icon: Search },
  { id: "twitter", label: "Twitter / X", icon: MessageCircle },
  { id: "youtube", label: "YouTube", icon: Mic },
  { id: "friend", label: "Friend / Colleague", icon: User },
  { id: "reddit", label: "Reddit / Hacker News", icon: Globe },
  { id: "other", label: "Other", icon: Search },
]

// ─── Step 2: What's your role? ──────────────────────────────────────────────

const ROLE_OPTIONS = [
  { id: "student", label: "Student" },
  { id: "freelancer", label: "Freelancer" },
  { id: "developer", label: "Developer / Programmer" },
  { id: "designer", label: "Designer" },
  { id: "founder", label: "Founder" },
  { id: "cofounder", label: "Co-Founder" },
  { id: "ceo", label: "CEO / Executive" },
  { id: "pm", label: "Product Manager" },
  { id: "marketer", label: "Marketer" },
  { id: "other", label: "Other" },
]

// ─── Component ──────────────────────────────────────────────────────────────

export function OnboardingTour() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [confirmSkip, setConfirmSkip] = useState(false)

  // Step 1 state
  const [source, setSource] = useState("")
  const [sourceCustom, setSourceCustom] = useState("")

  // Step 2 state
  const [role, setRole] = useState("")
  const [roleCustom, setRoleCustom] = useState("")

  // Step 3 state
  const [signalType, setSignalType] = useState<"url" | "idea" | "">("")
  const [signalInput, setSignalInput] = useState("")

  const { session } = useSession()

  useEffect(() => {
    // If user is logged in and already completed onboarding on the server, skip
    if (session?.user?.onboarding) {
      try {
        window.localStorage.setItem(STORAGE_KEY, "1")
      } catch {}
      return
    }
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) setOpen(true)
    } catch {
      // localStorage unavailable — skip silently
    }
  }, [session])

  async function finish(redirect?: string) {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1")
    } catch {}

    // Save to database if logged in
    if (session?.user) {
      try {
        await postJson("/api/auth/onboarding", {
          source: source === "other" ? sourceCustom : source || undefined,
          role: role === "other" ? roleCustom : role || undefined,
          signalType: signalType || undefined,
        })
      } catch {
        // Non-critical — localStorage fallback is enough
      }
    }

    setOpen(false)
    setConfirmSkip(false)
    if (redirect) router.push(redirect)
  }

  const totalSteps = 3
  const sourceValid = source && (source !== "other" || sourceCustom.trim())
  const roleValid = role && (role !== "other" || roleCustom.trim())
  const signalValid = signalType && signalInput.trim()

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : finish())}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" showCloseButton>
        {/* Progress bar */}
        <div className="flex items-center gap-1.5 mb-2" aria-hidden>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1 rounded-full transition-all",
                i === step ? "w-8 bg-primary" : i < step ? "w-4 bg-primary/40" : "w-2 bg-border",
              )}
            />
          ))}
        </div>

        {/* ── Step 1: Source ──────────────────────────────────────────── */}
        {step === 0 && (
          <>
            <DialogHeader>
              <p className="font-mono text-xs uppercase tracking-widest text-primary">
                Welcome · Step 1 of {totalSteps}
              </p>
              <DialogTitle className="text-xl font-semibold">
                How did you find MirrorSite AI?
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                This helps us understand where our community comes from.
              </p>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-2 mt-4">
              {SOURCE_OPTIONS.map((opt) => {
                const selected = source === opt.id
                return (
                  <button
                    key={opt.id}
                    onClick={() => setSource(opt.id)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border p-3 text-sm text-left transition-colors",
                      selected
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-primary/30 hover:bg-accent/50",
                    )}
                  >
                    <opt.icon className="size-4 shrink-0" />
                    <span className="flex-1">{opt.label}</span>
                    {selected && <Check className="size-4 shrink-0" />}
                  </button>
                )
              })}
            </div>

            {source === "other" && (
              <div className="mt-3">
                <Label className="text-xs">Tell us how you found us</Label>
                <Input
                  value={sourceCustom}
                  onChange={(e) => setSourceCustom(e.target.value)}
                  placeholder="e.g. Podcast, conference, blog post..."
                  className="mt-1.5"
                  autoFocus
                />
              </div>
            )}
          </>
        )}

        {/* ── Step 2: Role ────────────────────────────────────────────── */}
        {step === 1 && (
          <>
            <DialogHeader>
              <p className="font-mono text-xs uppercase tracking-widest text-primary">
                Getting to know you · Step 2 of {totalSteps}
              </p>
              <DialogTitle className="text-xl font-semibold">
                What best describes your role?
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                We'll tailor your experience based on what you're building.
              </p>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-2 mt-4">
              {ROLE_OPTIONS.map((opt) => {
                const selected = role === opt.id
                return (
                  <button
                    key={opt.id}
                    onClick={() => setRole(opt.id)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border p-3 text-sm text-left transition-colors",
                      selected
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-primary/30 hover:bg-accent/50",
                    )}
                  >
                    <span className="flex-1">{opt.label}</span>
                    {selected && <Check className="size-4 shrink-0" />}
                  </button>
                )
              })}
            </div>

            {role === "other" && (
              <div className="mt-3">
                <Label className="text-xs">What's your role?</Label>
                <Input
                  value={roleCustom}
                  onChange={(e) => setRoleCustom(e.target.value)}
                  placeholder="e.g. Researcher, Teacher, Artist..."
                  className="mt-1.5"
                  autoFocus
                />
              </div>
            )}
          </>
        )}

        {/* ── Step 3: Bring your signal ───────────────────────────────── */}
        {step === 2 && (
          <>
            <DialogHeader>
              <p className="font-mono text-xs uppercase tracking-widest text-primary">
                Let's build · Step 3 of {totalSteps}
              </p>
              <DialogTitle className="text-xl font-semibold">
                Bring your signal
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Give us a starting point — a website to mirror or an idea to build from.
              </p>
            </DialogHeader>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setSignalType("url")}
                className={cn(
                  "flex-1 flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors",
                  signalType === "url"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-primary/30 hover:bg-accent/50",
                )}
              >
                <Globe className="size-5" />
                <span className="font-medium">Mirror a website</span>
                <span className="text-xs text-muted-foreground">Paste a URL</span>
              </button>
              <button
                onClick={() => setSignalType("idea")}
                className={cn(
                  "flex-1 flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors",
                  signalType === "idea"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-primary/30 hover:bg-accent/50",
                )}
              >
                <Lightbulb className="size-5" />
                <span className="font-medium">Start from an idea</span>
                <span className="text-xs text-muted-foreground">Describe what you need</span>
              </button>
            </div>

            {signalType === "url" && (
              <div className="mt-4">
                <Label className="text-xs">Website URL</Label>
                <Input
                  value={signalInput}
                  onChange={(e) => setSignalInput(e.target.value)}
                  placeholder="https://example.com"
                  className="mt-1.5"
                  type="url"
                  autoFocus
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  We'll crawl it, understand its structure, and build a plan.
                </p>
              </div>
            )}

            {signalType === "idea" && (
              <div className="mt-4">
                <Label className="text-xs">Describe your idea</Label>
                <Textarea
                  value={signalInput}
                  onChange={(e) => setSignalInput(e.target.value)}
                  placeholder="e.g. A task management app with team workspaces, real-time updates, and a kanban board..."
                  className="mt-1.5"
                  rows={3}
                  autoFocus
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Be as specific as you like — we'll turn it into a structured build plan.
                </p>
              </div>
            )}
          </>
        )}

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => setStep(step - 1)} className="text-muted-foreground gap-1">
                ← Back
              </Button>
            ) : confirmSkip ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Skip onboarding?</span>
                <Button variant="ghost" size="sm" onClick={() => setConfirmSkip(false)} className="text-xs h-7">
                  Go back
                </Button>
                <Button variant="destructive" size="sm" onClick={() => finish()} className="text-xs h-7">
                  Yes, skip
                </Button>
              </div>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmSkip(true)} className="text-muted-foreground">
                Skip for now
              </Button>
            )}
          </div>
          {step < totalSteps - 1 ? (              <Button
              onClick={() => { setStep(step + 1); setConfirmSkip(false) }}
              disabled={
                (step === 0 && !sourceValid) || (step === 1 && !roleValid)
              }
              className="gap-1.5"
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button
              onClick={() => {
                if (signalType === "url") {
                  finish("/new/website")
                } else if (signalType === "idea") {
                  finish("/new/idea")
                } else {
                  finish("/dashboard")
                }
              }}
              disabled={signalType === "url" && !/^https?:\/\/.+/i.test(signalInput.trim())}
              className="gap-1.5"
            >
              <Sparkles className="size-4" />
              {signalType ? "Start building" : "Go to dashboard"}
              {signalType && <ArrowRight className="size-4" />}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
