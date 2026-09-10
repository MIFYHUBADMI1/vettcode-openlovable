"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import useSWR from "swr"
import { ArrowLeft, Check, X, Clock, Eye, Loader2, User, Phone, CreditCard, AlertTriangle, CheckCircle2, XCircle, RefreshCw, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { postJson, jsonFetcher } from "@/lib/client/api"
import { toast } from "sonner"
import { AdminNav } from "@/components/admin-nav"

// ─── Types ──────────────────────────────────────────────────────────────────

interface AIAnalysis {
  extractedAmount?: number | null
  extractedCurrency?: string | null
  extractedRecipientName?: string | null
  extractedRecipientPhone?: string | null
  extractedSenderName?: string | null
  extractedSenderPhone?: string | null
  extractedTransactionId?: string | null
  extractedPaymentReference?: string | null
  extractedDate?: string | null
  extractedTime?: string | null
  extractedNetwork?: string | null
  extractedTransactionFee?: string | null
  extractedBalance?: string | null
  otherVisibleInformation?: string | null
  confidence: number
  recommendation: "MATCH" | "REVIEW" | "MISMATCH"
}

interface TopUpItem {
  id: string
  userId: string
  userEmail?: string
  userName?: string
  packageId: string
  credits: number
  expectedAmount: number
  paymentReference: string
  payerPhone: string
  paymentNetwork: string
  status: string
  evidenceFileIds: string[]
  aiAnalysis?: AIAnalysis
  verifiedAt?: number
  verifiedBy?: string
  rejectionReason?: string
  createdAt: number
  updatedAt: number
}

interface AdminData {
  topUps: TopUpItem[]
}

interface EvidenceUrl {
  fileId: string
  url: string | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function statusColor(status: string) {
  switch (status) {
    case "payment_submitted": return "bg-blue-500/10 text-blue-500 border-blue-500/30"
    case "analyzing": return "bg-amber-500/10 text-amber-500 border-amber-500/30"
    case "manual_review": return "bg-orange-500/10 text-orange-500 border-orange-500/30"
    case "approved": return "bg-green-500/10 text-green-500 border-green-500/30"
    case "rejected": return "bg-red-500/10 text-red-500 border-red-500/30"
    case "amount_mismatch": return "bg-red-500/10 text-red-500 border-red-500/30"
    case "duplicate": return "bg-red-500/10 text-red-500 border-red-500/30"
    default: return "bg-muted text-muted-foreground"
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "payment_submitted": return "Payment Submitted"
    case "analyzing": return "Analyzing"
    case "manual_review": return "Manual Review"
    case "approved": return "Approved"
    case "rejected": return "Rejected"
    case "amount_mismatch": return "Amount Mismatch"
    case "duplicate": return "Duplicate"
    default: return status
  }
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function AdminPaymentsPage() {
  const { data, error, isLoading, mutate } = useSWR<AdminData>(
    "/api/billing/admin/top-ups",
    jsonFetcher,
    { refreshInterval: 15000 },
  )

  const [selectedTopUp, setSelectedTopUp] = useState<TopUpItem | null>(null)
  const [evidenceUrls, setEvidenceUrls] = useState<EvidenceUrl[]>([])
  const [loadingEvidence, setLoadingEvidence] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [showRejectDialog, setShowRejectDialog] = useState(false)

  const loadEvidence = useCallback(async (topUp: TopUpItem) => {
    if (!topUp.evidenceFileIds.length) {
      setEvidenceUrls([])
      return
    }
    setLoadingEvidence(true)
    try {
      const result = await jsonFetcher<{ evidence: EvidenceUrl[] }>(
        `/api/billing/admin/top-ups/${topUp.id}/evidence`,
      )
      setEvidenceUrls(result.evidence)
    } catch {
      setEvidenceUrls([])
    } finally {
      setLoadingEvidence(false)
    }
  }, [])

  const handleSelect = useCallback(async (topUp: TopUpItem) => {
    setSelectedTopUp(topUp)
    setRejectReason("")
    await loadEvidence(topUp)
  }, [loadEvidence])

  const handleApprove = useCallback(async () => {
    if (!selectedTopUp) return
    setActionBusy(true)
    try {
      await postJson(`/api/billing/admin/top-ups/${selectedTopUp.id}`, { action: "approve" })
      toast.success(`Approved ${selectedTopUp.credits.toLocaleString()} credits for ${selectedTopUp.userName ?? selectedTopUp.userEmail}`)
      setSelectedTopUp(null)
      await mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve")
    } finally {
      setActionBusy(false)
    }
  }, [selectedTopUp, mutate])

  const handleReject = useCallback(async () => {
    if (!selectedTopUp) return
    setActionBusy(true)
    try {
      await postJson(`/api/billing/admin/top-ups/${selectedTopUp.id}`, {
        action: "reject",
        reason: rejectReason || "Rejected by administrator",
      })
      toast.success("Top-up rejected")
      setSelectedTopUp(null)
      setShowRejectDialog(false)
      await mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject")
    } finally {
      setActionBusy(false)
    }
  }, [selectedTopUp, rejectReason, mutate])

  const topUps = data?.topUps ?? []

  // ─── Loading / Error States ─────────────────────────────────────────────

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <AdminNav />
          <div className="mt-10 text-center">
            <AlertTriangle className="size-10 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-semibold">Access Denied</h1>
            <p className="mt-2 text-sm text-muted-foreground">You don&apos;t have permission to access this page.</p>
          </div>
        </div>
      </main>
    )
  }

  // ─── Main Layout ────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AdminNav />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="flex items-start justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Admin</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Payment Verifications</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review and verify Mobile Money top-up payments.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => mutate()} className="gap-1.5">
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </header>

        {/* Summary Cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-4">
          <SummaryCard
            label="Pending Review"
            value={topUps.filter((t) => ["payment_submitted", "analyzing"].includes(t.status)).length}
            color="text-blue-500"
          />
          <SummaryCard
            label="Manual Review"
            value={topUps.filter((t) => t.status === "manual_review").length}
            color="text-orange-500"
          />
          <SummaryCard
            label="Amount Mismatch"
            value={topUps.filter((t) => t.status === "amount_mismatch").length}
            color="text-red-500"
          />
          <SummaryCard
            label="Total Pending"
            value={topUps.length}
            color="text-foreground"
          />
        </div>

        {/* Top-Ups List */}
        <div className="mt-8">
          {topUps.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="size-10 text-success mx-auto mb-3" />
                <p className="text-lg font-medium">All clear</p>
                <p className="mt-1 text-sm text-muted-foreground">No pending payments to review.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {topUps.map((topUp) => (
                <button
                  key={topUp.id}
                  onClick={() => handleSelect(topUp)}
                  className="w-full text-left rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-accent/50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusColor(topUp.status)}`}>
                          {statusLabel(topUp.status)}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          Ref: {topUp.paymentReference}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-sm flex-wrap">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <User className="size-3" />
                          {topUp.userName ?? topUp.userEmail ?? "Unknown"}
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <CreditCard className="size-3" />
                          {topUp.credits.toLocaleString()} credits
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Phone className="size-3" />
                          {topUp.payerPhone}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {topUp.paymentNetwork.toUpperCase()}
                        </span>
                      </div>
                      {topUp.aiAnalysis && (
                        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                          <span>AI Confidence: {topUp.aiAnalysis.confidence}%</span>
                          <span className={`font-medium ${
                            topUp.aiAnalysis.recommendation === "MATCH" ? "text-green-500" :
                            topUp.aiAnalysis.recommendation === "MISMATCH" ? "text-red-500" :
                            "text-amber-500"
                          }`}>
                            {topUp.aiAnalysis.recommendation}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium">{topUp.expectedAmount.toLocaleString()}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{timeAgo(topUp.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedTopUp} onOpenChange={(open) => !open && setSelectedTopUp(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedTopUp && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusColor(selectedTopUp.status)}`}>
                    {statusLabel(selectedTopUp.status)}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {selectedTopUp.paymentReference}
                  </span>
                </DialogTitle>
                <DialogDescription>
                  Top-up #{selectedTopUp.id.slice(-8)} · {formatDate(selectedTopUp.createdAt)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Payment Info */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoRow label="User" value={`${selectedTopUp.userName ?? "Unknown"} (${selectedTopUp.userEmail ?? "no email"})`} />
                  <InfoRow label="Credits" value={`${selectedTopUp.credits.toLocaleString()} credits`} />
                  <InfoRow label="Expected Amount" value={`${selectedTopUp.expectedAmount.toLocaleString()}`} />
                  <InfoRow label="Network" value={selectedTopUp.paymentNetwork.toUpperCase()} />
                  <InfoRow label="Payer Phone" value={selectedTopUp.payerPhone} />
                  <InfoRow label="Payment Reference" value={selectedTopUp.paymentReference} />
                </div>

                {/* AI Analysis */}
                {selectedTopUp.aiAnalysis && (
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Shield className="size-4 text-primary" />
                      AI Analysis
                    </p>
                    <div className="mt-3 grid gap-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Confidence</span>
                        <span className="font-mono">{selectedTopUp.aiAnalysis.confidence}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Recommendation</span>
                        <span className={`font-medium ${
                          selectedTopUp.aiAnalysis.recommendation === "MATCH" ? "text-green-500" :
                          selectedTopUp.aiAnalysis.recommendation === "MISMATCH" ? "text-red-500" :
                          "text-amber-500"
                        }`}>
                          {selectedTopUp.aiAnalysis.recommendation}
                        </span>
                      </div>
                      {selectedTopUp.aiAnalysis.extractedAmount != null && (
                        <InfoRow label="Extracted Amount" value={`${selectedTopUp.aiAnalysis.extractedAmount.toLocaleString()} ${selectedTopUp.aiAnalysis.extractedCurrency ?? "currency"}`} />
                      )}
                      {selectedTopUp.aiAnalysis.extractedRecipientName && (
                        <InfoRow label="Extracted Recipient" value={selectedTopUp.aiAnalysis.extractedRecipientName} />
                      )}
                      {selectedTopUp.aiAnalysis.extractedPaymentReference && (
                        <InfoRow label="Extracted Reference" value={selectedTopUp.aiAnalysis.extractedPaymentReference} />
                      )}
                      {selectedTopUp.aiAnalysis.extractedTransactionId && (
                        <InfoRow label="Transaction ID" value={selectedTopUp.aiAnalysis.extractedTransactionId} />
                      )}
                      {selectedTopUp.aiAnalysis.extractedSenderName && (
                        <InfoRow label="Sender Name" value={selectedTopUp.aiAnalysis.extractedSenderName} />
                      )}
                      {selectedTopUp.aiAnalysis.extractedSenderPhone && (
                        <InfoRow label="Sender Phone" value={selectedTopUp.aiAnalysis.extractedSenderPhone} />
                      )}
                      {selectedTopUp.aiAnalysis.extractedDate && (
                        <InfoRow label="Date" value={selectedTopUp.aiAnalysis.extractedDate} />
                      )}
                      {selectedTopUp.aiAnalysis.extractedTime && (
                        <InfoRow label="Time" value={selectedTopUp.aiAnalysis.extractedTime} />
                      )}
                      {selectedTopUp.aiAnalysis.extractedNetwork && (
                        <InfoRow label="Extracted Network" value={selectedTopUp.aiAnalysis.extractedNetwork} />
                      )}
                    </div>
                  </div>
                )}

                {/* Evidence Screenshots */}
                {selectedTopUp.evidenceFileIds.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Evidence Screenshots ({selectedTopUp.evidenceFileIds.length})</p>
                    {loadingEvidence ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-3 animate-spin" />
                        Loading screenshots...
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {evidenceUrls.map((ev) => (
                          <div key={ev.fileId} className="rounded-lg border border-border overflow-hidden bg-muted/30">
                            {ev.url ? (
                              <img
                                src={ev.url}
                                alt="Payment evidence"
                                className="w-full h-auto object-contain max-h-64"
                              />
                            ) : (
                              <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
                                Image not available
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Rejection reason if rejected */}
                {selectedTopUp.rejectionReason && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-sm font-medium text-destructive">Rejection Reason</p>
                    <p className="mt-1 text-sm text-muted-foreground">{selectedTopUp.rejectionReason}</p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setSelectedTopUp(null)}
                  disabled={actionBusy}
                >
                  Close
                </Button>
                {selectedTopUp.status !== "approved" && selectedTopUp.status !== "rejected" && (
                  <>
                    <Button
                      variant="destructive"
                      onClick={() => setShowRejectDialog(true)}
                      disabled={actionBusy}
                      className="gap-1.5"
                    >
                      <X className="size-3.5" />
                      Reject
                    </Button>
                    <Button
                      onClick={handleApprove}
                      disabled={actionBusy}
                      className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                    >
                      {actionBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                      Approve · {selectedTopUp.credits.toLocaleString()} credits
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Reason Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={(open) => !open && setShowRejectDialog(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject Payment</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this payment. This will be stored for audit purposes.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g., Amount does not match, screenshot is unclear..."
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} disabled={actionBusy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={actionBusy} className="gap-1.5">
              {actionBusy ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-2 text-2xl font-semibold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-sm text-right truncate">{value}</span>
    </div>
  )
}
