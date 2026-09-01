"use client"

import { useState } from "react"
import { Globe, ExternalLink, Loader2, AlertTriangle, Check, Copy, Server, Link as LinkIcon, Shield, Zap, DollarSign, Settings, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { postJson, deleteJson, jsonFetcher } from "@/lib/client/api"
import { ensureProtocol } from "@/lib/utils"
import { toast } from "sonner"
import useSWR from "swr"

interface DeployInfo {
  status: string | null
  productionUrl?: string
  customDomain?: { hostname: string; status: string; dnsRecordsToAdd?: Array<{ type: string; name: string; value: string }> } | null
}

interface PublishMenuProps {
  projectId: string
  projectName: string
  totalumProjectId?: string
  onDeployed?: () => void
}

type PublishStep = "closed" | "choose" | "deploying-subdomain" | "deploying-custom" | "custom-dns" | "confirm-remove-domain" | "done"

export function PublishMenu({ projectId, projectName, totalumProjectId, onDeployed }: PublishMenuProps) {
  const [step, setStep] = useState<PublishStep>("closed")
  const [deploying, setDeploying] = useState(false)
  const [domainHostname, setDomainHostname] = useState("")
  const [domainLoading, setDomainLoading] = useState(false)
  const [domainResult, setDomainResult] = useState<{
    hostname: string
    status: string
    dnsRecordsToAdd?: Array<{ type: string; name: string; value: string }>
  } | null>(null)
  const [removingDomain, setRemovingDomain] = useState(false)

  // Poll deployment status
  const { data: deployData } = useSWR<{ ok: boolean; data: DeployInfo }>(
    totalumProjectId ? `/api/projects/${projectId}/deploy` : null,
    jsonFetcher,
    { refreshInterval: deploying ? 10000 : 0 },
  )

  const deployInfo = deployData?.data
  const isDeployed = deployInfo?.status === "success"
  const isDeploying = deployInfo?.status === "deploying" || deploying
  const productionUrl = deployInfo?.productionUrl
  const customDomain = deployInfo?.customDomain

  async function handleDeploySubdomain() {
    setDeploying(true)
    setStep("deploying-subdomain")
    try {
      const result = await postJson<{ message: string; creditsCharged: number }>(`/api/projects/${projectId}/deploy`, {})
      toast.success("Deployment started", { description: `${result.message} (${result.creditsCharged} credits)` })
      onDeployed?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deployment failed")
      setStep("choose")
    } finally {
      setDeploying(false)
    }
  }

  async function handleDeployCustomDomain() {
    if (!domainHostname.trim()) return
    setDomainLoading(true)
    try {
      // First deploy if not already deployed
      if (!isDeployed) {
        setDeploying(true)
        setStep("deploying-custom")
        const deployResult = await postJson<{ message: string; creditsCharged: number }>(`/api/projects/${projectId}/deploy`, {})
        toast.success("Deployment started", { description: deployResult.message })
        onDeployed?.()
      }

      // Then add the custom domain
      const result = await postJson<{
        message: string
        hostname: string
        status: string
        dnsRecordsToAdd?: Array<{ type: string; name: string; value: string }>
      }>(`/api/projects/${projectId}/domain`, { hostname: domainHostname.trim() })
      setDomainResult(result)
      setStep("custom-dns")
      toast.success("Custom domain added", { description: result.message })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add domain")
      setStep("choose")
    } finally {
      setDomainLoading(false)
      setDeploying(false)
    }
  }

  async function handleRemoveDomain() {
    setRemovingDomain(true)
    try {
      await deleteJson<{ message: string }>(`/api/projects/${projectId}/domain`)
      toast.success("Custom domain removed", { description: "Your app is now only available on the free subdomain." })
      setStep("choose")
      onDeployed?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove domain")
    } finally {
      setRemovingDomain(false)
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  }

  // Don't show if no totalum project
  if (!totalumProjectId) return null

  const openDialog = () => setStep("choose")

  // ─── DEPLOYING STATE ───────────────────────────────────────────
  if (step === "deploying-subdomain" || step === "deploying-custom") {
    return (
      <div className="flex items-center gap-3">
        <Loader2 className="size-5 animate-spin text-primary" />
        <div>
          <p className="text-sm font-medium">Publishing your app…</p>
          <p className="text-xs text-muted-foreground">
            {step === "deploying-custom" && !isDeployed
              ? "Deploying to production, then configuring your custom domain…"
              : "This typically takes 3-5 minutes. You can continue using the workspace."}
          </p>
        </div>
      </div>
    )
  }

  // ─── CONFIRM REMOVE DOMAIN ────────────────────────────────────
  if (step === "confirm-remove-domain") {
    return (
      <Dialog open onOpenChange={(open) => { if (!open) setStep("choose") }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="size-5 text-destructive" />
              Remove Custom Domain
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove your custom domain? This action cannot be undone from here.
            </DialogDescription>
          </DialogHeader>

          {customDomain && (
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm font-medium">Domain to remove:</p>
              <p className="mt-1 font-mono text-sm text-foreground">{customDomain.hostname}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                After removal, your app will only be accessible at the free subdomain URL.
                You can re-add a custom domain at any time.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setStep("choose")} disabled={removingDomain}>
              Cancel
            </Button>
            <Button
              onClick={handleRemoveDomain}
              disabled={removingDomain}
              variant="destructive"
              className="gap-1.5"
            >
              {removingDomain ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Removing…
                </>
              ) : (
                <>
                  <Trash2 className="size-4" />
                  Remove Domain
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // ─── CUSTOM DOMAIN DNS INSTRUCTIONS ────────────────────────────
  if (step === "custom-dns" && domainResult) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
          <div className="flex items-center gap-2">
            <Check className="size-4 text-green-600" />
            <span className="text-sm font-medium text-green-600">Domain added successfully</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Status: <span className="font-mono">{domainResult.status}</span>
          </p>
        </div>

        {domainResult.dnsRecordsToAdd && domainResult.dnsRecordsToAdd.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-medium mb-3">Configure these DNS records at your domain provider:</p>
            <div className="space-y-2">
              {domainResult.dnsRecordsToAdd.map((record, i) => (
                <div key={i} className="rounded-md border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="font-mono text-xs">{record.type}</Badge>
                    <button
                      onClick={() => copyToClipboard(record.value)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy value"
                    >
                      <Copy className="size-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-12">Name:</span>
                      <span className="font-mono text-xs">{record.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-12">Value:</span>
                      <span className="font-mono text-xs break-all">{record.value}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">
            After configuring DNS, it may take a few minutes for the domain to become active.
            The domain status will update automatically once validated.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isDeployed && productionUrl && (
            <a
              href={ensureProtocol(productionUrl)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
            >
              <Globe className="size-4" />
              Live Site
              <ExternalLink className="size-3" />
            </a>
          )}
          <Button variant="outline" onClick={() => setStep("choose")}>
            Back
          </Button>
        </div>
      </div>
    )
  }

  // ─── CHOOSE OPTION ─────────────────────────────────────────────
  return (
    <>
      {/* Standalone Publish button — shown when not deployed and dialog closed */}
      {!isDeployed && step === "closed" && (
        <Button onClick={openDialog} className="gap-1.5">
          <Globe className="size-4" />
          Publish
        </Button>
      )}

      {/* Current deployment status — shown if already deployed */}
      {isDeployed && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          {productionUrl && (
            <a
              href={ensureProtocol(productionUrl)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
            >
              <Globe className="size-4" />
              Live Site
              <ExternalLink className="size-3" />
            </a>
          )}
          {customDomain && customDomain.status === "active" && (
            <a
              href={ensureProtocol(customDomain.hostname)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-medium text-green-600 transition-colors hover:bg-green-500/20"
            >
              <Globe className="size-4" />
              {customDomain.hostname}
              <ExternalLink className="size-3" />
            </a>
          )}
          {customDomain && (
            <Button
              onClick={() => setStep("confirm-remove-domain")}
              variant="outline"
              className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" />
              Remove Domain
            </Button>
          )}
          <Button
            onClick={openDialog}
            variant="outline"
            className="gap-1.5"
          >
            <Server className="size-4" />
            Republish
          </Button>
          {!customDomain && (
            <Button
              onClick={openDialog}
              variant="outline"
              className="gap-1.5"
            >
              <Globe className="size-4" />
              Add Custom Domain
            </Button>
          )}
        </div>
      )}

      {/* Two-option comparison dialog */}
      <Dialog open={step === "choose"} onOpenChange={(open) => { if (!open) setStep("closed") }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="size-5 text-primary" />
              Publish to Production
              <Badge variant="secondary" className="text-[10px] ml-1 bg-amber-500/10 text-amber-600 border-amber-500/30">Beta</Badge>
            </DialogTitle>
            <DialogDescription>
              Choose how you want to publish your application. Both options cost 500 credits and include HTTPS, CDN, and lifetime hosting.
            </DialogDescription>
          </DialogHeader>

          {/* Two cards side by side */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* ── OPTION A: Free Subdomain ── */}
            <div className="relative rounded-xl border-2 border-primary/30 bg-primary/5 p-5 flex flex-col">
              <Badge className="absolute -top-2.5 left-4 bg-primary text-primary-foreground text-[10px] px-2 py-0.5">
                Recommended
              </Badge>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15">
                  <Zap className="size-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Free Subdomain</h3>
                  <p className="text-[11px] text-muted-foreground">Zero setup required</p>
                </div>
              </div>

              <p className="mb-3 font-mono text-xs text-foreground">
                {projectName}.totalum-project.com
              </p>

              {/* Benefits */}
              <div className="mb-3 space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Benefits</p>
                <ul className="space-y-1.5">
                  {[
                    "Free forever — no hosting fees, ever",
                    "Instant deploy — no DNS configuration",
                    "Auto HTTPS & global CDN included",
                    "Lifetime hosting at no extra cost",
                    "Perfect for prototyping & demos",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-foreground">
                      <Check className="size-3.5 mt-0.5 shrink-0 text-green-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Downsides */}
              <div className="mb-4 space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Trade-offs</p>
                <ul className="space-y-1.5">
                  {[
                    "Uses *.totalum-project.com subdomain",
                    "Less professional for client-facing projects",
                    "Cannot use your own branding in the URL",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <AlertTriangle className="size-3.5 mt-0.5 shrink-0 text-amber-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-auto pt-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">Cost</span>
                  <Badge variant="secondary" className="font-mono">500 credits</Badge>
                </div>
                <Button
                  onClick={handleDeploySubdomain}
                  disabled={isDeploying}
                  className="w-full gap-1.5"
                >
                  {isDeploying ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Publishing…
                    </>
                  ) : (
                    <>
                      <Globe className="size-4" />
                      {isDeployed ? "Republish" : "Publish Now"}
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* ── OPTION B: Custom Domain ── */}
            <div className="relative rounded-xl border border-border bg-card p-5 flex flex-col">
              <Badge variant="outline" className="absolute -top-2.5 left-4 text-[10px] px-2 py-0.5">
                Advanced
              </Badge>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
                  <LinkIcon className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Custom Domain</h3>
                  <p className="text-[11px] text-muted-foreground">Use your own domain</p>
                </div>
              </div>

              <p className="mb-3 font-mono text-xs text-muted-foreground">
                app.yourdomain.com
              </p>

              {/* Benefits */}
              <div className="mb-3 space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Benefits</p>
                <ul className="space-y-1.5">
                  {[
                    "Professional branding with your own domain",
                    "Better SEO — your domain builds authority",
                    "Full control over your web identity",
                    "Auto HTTPS setup — no certificate management",
                    "Ideal for production apps & businesses",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-foreground">
                      <Check className="size-3.5 mt-0.5 shrink-0 text-green-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Downsides */}
              <div className="mb-4 space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Trade-offs</p>
                <ul className="space-y-1.5">
                  {[
                    "Requires DNS configuration at your provider",
                    "DNS propagation may take up to 24 hours",
                    "Hosting free for 6 months, then paid",
                    "Manual steps needed for DNS records",
                    "Requires owning a domain name",
                    "Ongoing hosting cost varies by usage",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <AlertTriangle className="size-3.5 mt-0.5 shrink-0 text-amber-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-auto pt-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">Cost</span>
                  <Badge variant="secondary" className="font-mono">500 credits</Badge>
                </div>
                {isDeployed ? (
                  <Button
                    onClick={() => {
                      setStep("choose")
                      // Open domain dialog inline
                      document.getElementById("custom-domain-input")?.focus()
                    }}
                    variant="outline"
                    className="w-full gap-1.5"
                  >
                    <Globe className="size-4" />
                    Add Custom Domain
                  </Button>
                ) : (
                  <Button
                    onClick={handleDeployCustomDomain}
                    disabled={isDeploying || !domainHostname.trim()}
                    variant="outline"
                    className="w-full gap-1.5"
                  >
                    {isDeploying || domainLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Publishing…
                      </>
                    ) : (
                      <>
                        <LinkIcon className="size-4" />
                        Deploy & Add Domain
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Custom domain input — shown below cards if not deployed yet */}
          {!isDeployed && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 mt-2">
              <Label className="text-xs">Custom Domain Hostname (optional)</Label>
              <Input
                id="custom-domain-input"
                value={domainHostname}
                onChange={(e) => setDomainHostname(e.target.value)}
                placeholder="app.yourdomain.com"
                className="mt-1.5 font-mono"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Enter a subdomain if you want to use a custom domain. Leave blank to use the free subdomain.
              </p>
            </div>
          )}

          {/* Comparison link */}
          <div className="flex items-center justify-center gap-2 pt-2">
            <a
              href="/pricing"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <DollarSign className="size-3" />
              View full pricing & feature comparison
              <ExternalLink className="size-2.5" />
            </a>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStep("closed")} disabled={deploying || domainLoading}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
