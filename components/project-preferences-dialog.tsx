"use client"

import { useState } from "react"
import { ArrowRight, ArrowLeft, Database, Server, Globe, Shield, MessageSquare, Sparkles, Check } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { ProjectPreferences, StackType, AuthProviderChoice, DatabaseChoice } from "@/lib/types/project"

interface ProjectPreferencesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (preferences: ProjectPreferences) => void
  mode: "website" | "idea"
}

const TOTAL_STEPS = 5

export function ProjectPreferencesDialog({ open, onOpenChange, onSubmit, mode }: ProjectPreferencesDialogProps) {
  const [step, setStep] = useState(0)
  const [prefs, setPrefs] = useState<ProjectPreferences>({
    stackType: "fullstack",
    databaseChoice: "builtin",
    authProviders: "unknown",
  })

  function update<K extends keyof ProjectPreferences>(key: K, value: ProjectPreferences[K]) {
    setPrefs((prev) => ({ ...prev, [key]: value }))
  }

  function next() {
    if (step < TOTAL_STEPS - 1) setStep((s) => s + 1)
  }

  function prev() {
    if (step > 0) setStep((s) => s - 1)
  }

  function handleSubmit() {
    onSubmit(prefs)
    onOpenChange(false)
    setStep(0)
    setPrefs({ stackType: "fullstack", databaseChoice: "builtin", authProviders: "unknown" })
  }

  const progress = ((step + 1) / TOTAL_STEPS) * 100

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Configure Your Application
          </DialogTitle>
          <DialogDescription>
            Tell us about your {mode === "website" ? "mirrored" : "planned"} app so the AI builds exactly what you need.
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        <div className="relative h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-primary transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
          <span>Step {step + 1} of {TOTAL_STEPS}</span>
          <span>{Math.round(progress)}%</span>
        </div>

        {/* Step content */}
        <div className="min-h-[200px]">
          {step === 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Globe className="size-5 text-primary" />
                <h3 className="text-lg font-medium">What&apos;s the app name?</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                What name or brand should your application use? This becomes the project name and is used in headers, titles, and throughout the UI.
              </p>
              <div className="space-y-2">
                <Label htmlFor="app-name">Application name</Label>
                <Input
                  id="app-name"
                  placeholder={mode === "website" ? "e.g. Interior Design Studio" : "e.g. Habit Tracker"}
                  value={prefs.appName ?? ""}
                  onChange={(e) => update("appName", e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Database className="size-5 text-primary" />
                <h3 className="text-lg font-medium">Database & data</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Do you want the built-in managed database, or will you configure your own external provider?
              </p>
              <div className="grid gap-3">
                <button
                  onClick={() => update("databaseChoice", "builtin")}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors",
                    prefs.databaseChoice === "builtin"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30",
                  )}
                >
                  <Check className={cn("size-4 mt-0.5 shrink-0", prefs.databaseChoice === "builtin" ? "text-primary" : "text-muted-foreground")} />
                  <div>
                    <p className="text-sm font-medium">Use built-in database</p>
                    <p className="text-xs text-muted-foreground mt-1">Managed database with records, tables, and relations — no setup needed.</p>
                  </div>
                </button>
                <button
                  onClick={() => update("databaseChoice", "custom")}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors",
                    prefs.databaseChoice === "custom"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30",
                  )}
                >
                  <Check className={cn("size-4 mt-0.5 shrink-0", prefs.databaseChoice === "custom" ? "text-primary" : "text-muted-foreground")} />
                  <div>
                    <p className="text-sm font-medium">Configure my own</p>
                    <p className="text-xs text-muted-foreground mt-1">I&apos;ll set up my own database provider (PostgreSQL, MongoDB, etc.)</p>
                  </div>
                </button>
              </div>
              {prefs.databaseChoice === "custom" && (
                <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                  <div className="space-y-2">
                    <Label htmlFor="db-provider">Database provider</Label>
                    <Input
                      id="db-provider"
                      placeholder="e.g. PostgreSQL, MongoDB, Supabase"
                      value={prefs.customDbProvider ?? ""}
                      onChange={(e) => update("customDbProvider", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="db-detail">Connection details / notes</Label>
                    <Input
                      id="db-detail"
                      placeholder="e.g. Connection string, host, or setup instructions"
                      value={prefs.customDbProviderDetail ?? ""}
                      onChange={(e) => update("customDbProviderDetail", e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Server className="size-5 text-primary" />
                <h3 className="text-lg font-medium">Application type</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                What kind of application do you want? This determines whether the AI builds a backend, frontend, or both.
              </p>
              <div className="grid gap-3">
                {([
                  { value: "fullstack" as StackType, label: "Full-stack", desc: "Both frontend and backend with database, auth, and APIs.", icon: "🏗️" },
                  { value: "frontend" as StackType, label: "Frontend only", desc: "UI and interface only — no backend or database.", icon: "🎨" },
                  { value: "backend" as StackType, label: "Backend only", desc: "API routes and server logic — no frontend UI.", icon: "⚙️" },
                  { value: "unknown" as StackType, label: "I don&apos;t know yet", desc: "Let the AI decide based on my requirements.", icon: "🤷" },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => update("stackType", opt.value)}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors",
                      prefs.stackType === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30",
                    )}
                  >
                    <span className="text-lg mt-0.5">{opt.icon}</span>
                    <div>
                      <p className="text-sm font-medium" dangerouslySetInnerHTML={{ __html: opt.label }} />
                      <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && prefs.stackType !== "frontend" && prefs.stackType !== "backend" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="size-5 text-primary" />
                <h3 className="text-lg font-medium">Authentication providers</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Which authentication methods should be built into your app?
              </p>
              <div className="grid gap-3">
                {([
                  { value: "google" as AuthProviderChoice, label: "Google sign-in", desc: "OAuth login with Google accounts." },
                  { value: "github" as AuthProviderChoice, label: "GitHub sign-in", desc: "OAuth login with GitHub accounts." },
                  { value: "both" as AuthProviderChoice, label: "Both Google & GitHub", desc: "Support both providers." },
                  { value: "none" as AuthProviderChoice, label: "No OAuth needed", desc: "Email/password only or no auth." },
                  { value: "unknown" as AuthProviderChoice, label: "I don&apos;t know yet", desc: "Let the AI decide based on requirements." },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => update("authProviders", opt.value)}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors",
                      prefs.authProviders === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30",
                    )}
                  >
                    <Check className={cn("size-4 mt-0.5 shrink-0", prefs.authProviders === opt.value ? "text-primary" : "text-muted-foreground")} />
                    <div>
                      <p className="text-sm font-medium" dangerouslySetInnerHTML={{ __html: opt.label }} />
                      <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(step === 3 && (prefs.stackType === "frontend" || prefs.stackType === "backend")) && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-5 text-primary" />
                <h3 className="text-lg font-medium">Anything else?</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Any specific requirements, preferences, or details the AI should know about your application?
              </p>
              <Textarea
                placeholder="e.g. Dark theme preferred, must support RTL, use specific color palette, target mobile users first..."
                className="min-h-[120px]"
                value={prefs.additionalNotes ?? ""}
                onChange={(e) => update("additionalNotes", e.target.value)}
              />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-5 text-primary" />
                <h3 className="text-lg font-medium">Anything else?</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Any specific requirements, preferences, or details the AI should know about your application?
              </p>
              <Textarea
                placeholder="e.g. Dark theme preferred, must support RTL, use specific color palette, target mobile users first..."
                className="min-h-[120px]"
                value={prefs.additionalNotes ?? ""}
                onChange={(e) => update("additionalNotes", e.target.value)}
              />

              {/* Summary */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                <p className="text-xs font-medium text-primary uppercase tracking-wide">Summary</p>
                {prefs.appName && <p className="text-sm"><span className="text-muted-foreground">App name:</span> {prefs.appName}</p>}
                <p className="text-sm"><span className="text-muted-foreground">Stack:</span> {prefs.stackType === "fullstack" ? "Full-stack" : prefs.stackType === "frontend" ? "Frontend only" : prefs.stackType === "backend" ? "Backend only" : "AI decides"}</p>
                <p className="text-sm"><span className="text-muted-foreground">Database:</span> {prefs.databaseChoice === "builtin" ? "Built-in managed database" : `Custom (${prefs.customDbProvider || "unspecified"})`}</p>
                {prefs.stackType !== "frontend" && prefs.stackType !== "backend" && (
                  <p className="text-sm"><span className="text-muted-foreground">Auth:</span> {prefs.authProviders === "google" ? "Google" : prefs.authProviders === "github" ? "GitHub" : prefs.authProviders === "both" ? "Google & GitHub" : prefs.authProviders === "none" ? "None" : "AI decides"}</p>
                )}
                {prefs.additionalNotes && <p className="text-sm"><span className="text-muted-foreground">Notes:</span> {prefs.additionalNotes}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={prev}
            disabled={step === 0}
            className="gap-1.5"
          >
            <ArrowLeft className="size-3.5" />
            Back
          </Button>

          {step < TOTAL_STEPS - 1 ? (
            <Button size="sm" onClick={next} className="gap-1.5">
              Next
              <ArrowRight className="size-3.5" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleSubmit} className="gap-1.5">
              <Sparkles className="size-3.5" />
              Start building
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
