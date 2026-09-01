"use client"

import { useState, useCallback, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Check, Copy, CreditCard, Upload, Phone, Shield, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { useSession, postJson } from "@/lib/client/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const PACKAGES = [
  { id: "pkg_5k", credits: 5_000, priceUGX: 5_000, label: "5,000 Credits" },
  { id: "pkg_10k", credits: 10_000, priceUGX: 10_000, label: "10,000 Credits" },
  { id: "pkg_25k", credits: 25_000, priceUGX: 25_000, label: "25,000 Credits", popular: true },
  { id: "pkg_50k", credits: 50_000, priceUGX: 50_000, label: "50,000 Credits" },
  { id: "pkg_100k", credits: 100_000, priceUGX: 100_000, label: "100,000 Credits" },
]

const PAYMENT_RECIPIENT = {
  name: "Biira Keziah",
  phone: "+256 761 819 885",
}

type Step = "select" | "payment" | "upload" | "verifying" | "result"

interface TopUpData {
  id: string
  credits: number
  expectedAmount: number
  paymentReference: string
  payerPhone: string
  paymentNetwork: string
  status: string
}

// ─── localStorage persistence (15 minutes) ───────────────────────────────────

const STORAGE_KEY = "mirrorsite_topup_progress"
const STORAGE_TTL_MS = 15 * 60 * 1000

interface StoredProgress {
  step: Step
  selectedPackageId: string
  network: "mtn" | "airtel"
  phone: string
  topUp: TopUpData | null
  savedAt: number
}

function saveProgress(state: {
  step: Step
  selectedPackage: typeof PACKAGES[0] | null
  network: "mtn" | "airtel"
  phone: string
  topUp: TopUpData | null
}) {
  try {
    const data: StoredProgress = {
      step: state.step,
      selectedPackageId: state.selectedPackage?.id ?? "",
      network: state.network,
      phone: state.phone,
      topUp: state.topUp,
      savedAt: Date.now(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // localStorage may be unavailable — silently ignore
  }
}

function loadProgress(): StoredProgress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as StoredProgress
    // Expire after 15 minutes
    if (Date.now() - data.savedAt > STORAGE_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    // Don't restore terminal states
    if (data.step === "result" || data.step === "verifying") {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return data
  } catch {
    return null
  }
}

function clearProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function TopUpPage() {
  const { session, isLoading: sessionLoading } = useSession()

  // Initialize from localStorage or defaults
  const [initialized, setInitialized] = useState(false)
  const [step, setStep] = useState<Step>("select")
  const [selectedPackage, setSelectedPackage] = useState<typeof PACKAGES[0] | null>(null)
  const [network, setNetwork] = useState<"mtn" | "airtel">("mtn")
  const [phone, setPhone] = useState("")
  const [topUp, setTopUp] = useState<TopUpData | null>(null)
  const [uploading, setUploading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [resultMessage, setResultMessage] = useState("")
  const [resultStatus, setResultStatus] = useState<"approved" | "rejected" | "review" | "">("")

  // Restore from localStorage on mount
  useEffect(() => {
    const saved = loadProgress()
    if (saved) {
      setStep(saved.step)
      setNetwork(saved.network)
      setPhone(saved.phone)
      setTopUp(saved.topUp)
      if (saved.selectedPackageId) {
        const pkg = PACKAGES.find((p) => p.id === saved.selectedPackageId)
        if (pkg) setSelectedPackage(pkg)
      }
    }
    setInitialized(true)
  }, [])

  // Persist to localStorage whenever relevant state changes (after init)
  useEffect(() => {
    if (!initialized) return
    // Don't persist terminal or idle states
    if (step === "select" || step === "result" || step === "verifying") {
      if (step === "result" || step === "select") clearProgress()
      return
    }
    saveProgress({ step, selectedPackage, network, phone, topUp })
  }, [step, selectedPackage, network, phone, topUp, initialized])

  const handleSelectPackage = useCallback((pkg: typeof PACKAGES[0]) => {
    setSelectedPackage(pkg)
    setStep("payment")
  }, [])

  const handleCreateTopUp = useCallback(async () => {
    if (!selectedPackage || !phone) return

    try {
      const result = await postJson<{ topUp: TopUpData }>("/api/billing/top-up", {
        packageId: selectedPackage.id,
        paymentNetwork: network,
        payerPhone: phone,
      })
      setTopUp(result.topUp)
      setStep("upload")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create top-up")
    }
  }, [selectedPackage, network, phone])

  const handleUpload = useCallback(async (file: File) => {
    if (!topUp) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch(`/api/billing/top-up/${topUp.id}/evidence`, {
        method: "POST",
        body: formData,
        // Do NOT set Content-Type — browser sets multipart/form-data with boundary automatically
      })
      const body = await res.json().catch(() => null)
      if (!body?.ok) throw new Error(body?.error?.message ?? "Upload failed")
      setStep("verifying")
      clearProgress()

      // Poll for status
      const pollInterval = setInterval(async () => {
        try {
          const statusResult = await postJson<{ topUp: { status: string } }>(`/api/billing/top-up/${topUp.id}/verify`)
          if (statusResult.topUp.status === "approved") {
            clearInterval(pollInterval)
            setResultMessage(`Payment verified! ${topUp.credits.toLocaleString()} credits have been added to your account.`)
            setResultStatus("approved")
            setStep("result")
          } else if (statusResult.topUp.status === "rejected" || statusResult.topUp.status === "amount_mismatch" || statusResult.topUp.status === "duplicate") {
            clearInterval(pollInterval)
            setResultMessage(statusResult.topUp.status === "amount_mismatch"
              ? "The payment amount doesn't match the selected package."
              : statusResult.topUp.status === "duplicate"
                ? "This transaction has already been used."
                : "We couldn't verify this payment automatically.")
            setResultStatus("rejected")
            setStep("result")
          } else if (statusResult.topUp.status === "manual_review") {
            clearInterval(pollInterval)
            setResultMessage("Your payment is being reviewed by our team. You'll be notified once the review is complete. Contact support if you have questions.")
            setResultStatus("review")
            setStep("result")
          }
          // Otherwise keep polling (analyzing, payment_submitted, etc.)
        } catch {
          // Keep polling on error
        }
      }, 5000)

      // Stop polling after 2 minutes
      setTimeout(() => clearInterval(pollInterval), 120000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload screenshot")
      setUploading(false)
    }
  }, [topUp])

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  // Don't render until we've checked localStorage
  if (!initialized || sessionLoading) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    )
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Please sign in to top up credits.</p>
          <Link href="/login" className={cn(buttonVariants({ className: "mt-4" }))}>Sign in</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <Link href="/settings/billing" className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline mb-8">
          <ArrowLeft className="size-3" /> Back to Billing
        </Link>

        <header className="mb-8">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Top Up</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Add Credits</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Credits are used to build, improve and customize applications with MirrorSite AI.
          </p>
        </header>

        {/* Step: Package Selection */}
        {step === "select" && (
          <div className="space-y-4">
            <div className="grid gap-3">
              {PACKAGES.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => handleSelectPackage(pkg)}
                  className={cn(
                    "flex items-center justify-between rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-accent",
                    pkg.popular && "border-primary/30",
                  )}
                >
                  <div>
                    <p className="font-medium">{pkg.label}</p>
                    <p className="text-sm text-muted-foreground">{pkg.priceUGX.toLocaleString()} UGX</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {pkg.popular && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Popular</span>
                    )}
                    <span className="font-mono text-sm text-primary">{pkg.credits.toLocaleString()} credits</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Payment Details */}
        {step === "payment" && selectedPackage && (
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Selected Package</p>
              <p className="mt-3 text-2xl font-semibold">{selectedPackage.credits.toLocaleString()} Credits</p>
              <p className="mt-1 text-sm text-muted-foreground">{selectedPackage.priceUGX.toLocaleString()} UGX</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Payment Network</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setNetwork("mtn")}
                    className={cn(
                      "flex-1 rounded-lg border p-3 text-center text-sm font-medium transition-colors",
                      network === "mtn" ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-border/80",
                    )}
                  >
                    MTN Mobile Money
                  </button>
                  <button
                    onClick={() => setNetwork("airtel")}
                    className={cn(
                      "flex-1 rounded-lg border p-3 text-center text-sm font-medium transition-colors",
                      network === "airtel" ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-border/80",
                    )}
                  >
                    Airtel Money
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Your Mobile Money Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0761 234 567"
                  className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="mt-1 text-xs text-muted-foreground">Enter the phone number you will pay from.</p>
              </div>
            </div>

            <button
              onClick={handleCreateTopUp}
              disabled={!phone || phone.replace(/\D/g, "").length < 9}
              className={cn(
                buttonVariants({ className: "w-full" }),
                "h-12",
                (!phone || phone.replace(/\D/g, "").length < 9) && "opacity-50 cursor-not-allowed",
              )}
            >
              Continue to Payment
            </button>
          </div>
        )}

        {/* Step: Payment Instructions */}
        {step === "upload" && topUp && (
          <div className="space-y-6">
            <div className="rounded-lg border border-primary/30 bg-card p-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <CreditCard className="size-5 text-primary" />
                Send Mobile Money
              </h2>

              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Recipient</span>
                  <span className="font-medium">{PAYMENT_RECIPIENT.name}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Phone</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{PAYMENT_RECIPIENT.phone}</span>
                    <button
                      onClick={() => copyToClipboard(PAYMENT_RECIPIENT.phone)}
                      className="text-primary hover:text-primary/80"
                    >
                      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="font-mono font-semibold">{topUp.expectedAmount.toLocaleString()} UGX</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">Payment Reference</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-bold text-primary">{topUp.paymentReference}</span>
                    <button
                      onClick={() => copyToClipboard(topUp.paymentReference)}
                      className="text-primary hover:text-primary/80"
                    >
                      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-lg bg-muted/50 p-4">
                <p className="text-sm font-medium">How to pay ({network.toUpperCase()}):</p>
                <ol className="mt-2 space-y-1 text-sm text-muted-foreground list-decimal list-inside">
                  <li>Open {network === "mtn" ? "MTN" : "Airtel"} Mobile Money</li>
                  <li>Select Send Money</li>
                  <li>Enter recipient phone number: <span className="font-mono">{PAYMENT_RECIPIENT.phone}</span></li>
                  <li>Enter amount: <span className="font-mono">{topUp.expectedAmount.toLocaleString()} UGX</span></li>
                  <li>Use reference: <span className="font-mono font-bold">{topUp.paymentReference}</span></li>
                  <li>Confirm the payment</li>
                </ol>
              </div>
            </div>

            {/* Upload Section */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="font-medium flex items-center gap-2">
                <Upload className="size-4 text-primary" />
                Upload Confirmation
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Upload your Mobile Money confirmation screenshot after completing the payment.
              </p>

              <div className="mt-4">
                {uploading ? (
                  /* ── Loading state ── */
                  <div className="flex flex-col items-center justify-center w-full h-32 rounded-lg border-2 border-primary/30 bg-primary/5">
                    <Loader2 className="size-8 animate-spin text-primary mb-3" />
                    <p className="text-sm font-medium text-primary">Uploading screenshot...</p>
                    <p className="mt-1 text-xs text-muted-foreground">Analyzing payment confirmation</p>
                  </div>
                ) : (
                  /* ── File input ── */
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                    <Upload className="size-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Click to upload screenshot</span>
                    <span className="text-xs text-muted-foreground mt-1">PNG, JPEG, or WEBP (max 10MB)</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleUpload(file)
                      }}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Fraud Notice */}
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <Shield className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Payment Verification & Fraud Policy</p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Payment submissions may be automatically analyzed and manually reviewed to verify credit purchases.
                    Submitting falsified, manipulated, duplicated, or fraudulent payment evidence may result in immediate
                    account suspension. If your legitimate payment cannot be verified automatically, contact support for
                    manual verification.
                  </p>
                </div>
              </div>
            </div>

            {/* Support */}
            <div className="text-center text-sm text-muted-foreground">
              <p>Need help? Contact support at <span className="font-mono">{PAYMENT_RECIPIENT.phone}</span></p>
            </div>
          </div>
        )}

        {/* Step: Verifying */}
        {step === "verifying" && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="relative mb-4">
              <Loader2 className="size-12 animate-spin text-primary" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="size-4 rounded-full bg-primary/20 animate-pulse" />
              </div>
            </div>
            <h2 className="text-xl font-semibold">Verifying Payment</h2>
            <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm">
              We&apos;re analyzing your payment confirmation. This usually takes a few moments...
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="size-3" />
              <span>This may take up to 2 minutes</span>
            </div>
            {/* Animated progress dots */}
            <div className="mt-6 flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="size-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="size-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        {/* Step: Result */}
        {step === "result" && (
          <div className="flex flex-col items-center justify-center py-16">
            {resultStatus === "approved" ? (
              <CheckCircle2 className="size-16 text-success mb-4" />
            ) : resultStatus === "review" ? (
              <Clock className="size-16 text-yellow-500 mb-4" />
            ) : (
              <XCircle className="size-16 text-destructive mb-4" />
            )}
            <h2 className="text-xl font-semibold">
              {resultStatus === "approved" ? "Payment Verified!" : resultStatus === "review" ? "Under Review" : "Verification Issue"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm">
              {resultMessage}
            </p>
            <div className="mt-8 flex gap-3">
              <Link href="/settings/billing" className={buttonVariants({ variant: "outline" })}>
                View Billing
              </Link>
              {resultStatus !== "approved" && (
                <button
                  onClick={() => {
                    setStep("select")
                    setSelectedPackage(null)
                    setTopUp(null)
                    setResultMessage("")
                    setResultStatus("")
                    clearProgress()
                  }}
                  className={buttonVariants()}
                >
                  Try Again
                </button>
              )}
            </div>
            {resultStatus !== "approved" && (
              <div className="mt-6 rounded-lg border border-border bg-card p-4 max-w-sm">
                <div className="flex items-start gap-3">
                  <Phone className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium">Need help?</p>
                    <p className="mt-1 text-muted-foreground">
                      Contact support with your account email, top-up reference <span className="font-mono">{topUp?.paymentReference}</span>, and confirmation screenshot.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
