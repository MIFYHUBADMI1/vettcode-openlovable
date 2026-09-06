import { redirect } from "next/navigation"
import Link from "next/link"
import { getCurrentUser } from "@/lib/auth/session"
import { getMongoClient } from "@/lib/db/mongodb"
import { ArrowLeft, TrendingDown, Users, MessageSquare } from "lucide-react"

interface CancellationFeedback {
  _id: string
  userId: string
  userEmail: string
  userName: string
  planName: string
  reason: string
  feedback: string | null
  createdAt: Date
  timestamp: number
}

const REASON_LABELS: Record<string, string> = {
  too_expensive: "Too expensive",
  not_using_enough: "Not using enough",
  missing_features: "Missing features",
  switching_competitor: "Switching to competitor",
  technical_issues: "Technical issues",
  temporary_pause: "Temporary pause",
  project_completed: "Project completed",
  other: "Other",
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default async function CancellationsPage() {
  const user = await getCurrentUser()

  // Check if user is admin
  if (!user || user.role !== "admin") {
    redirect("/")
  }

  // Fetch cancellation feedback
  const client = await getMongoClient()
  const db = client.db()
  const collection = db.collection("cancellation_feedback")

  const feedbacks = (await collection
    .find({})
    .sort({ timestamp: -1 })
    .limit(100)
    .toArray()) as unknown as CancellationFeedback[]

  // Calculate stats
  const totalCancellations = feedbacks.length
  const reasonCounts = feedbacks.reduce((acc, fb) => {
    acc[fb.reason] = (acc[fb.reason] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0]

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to Admin
          </Link>
          <h1 className="mt-4 text-3xl font-semibold">Subscription Cancellations</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            View and analyze cancellation feedback from users
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingDown className="size-4" />
              Total Cancellations
            </div>
            <p className="mt-2 text-3xl font-semibold">{totalCancellations}</p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="size-4" />
              Top Reason
            </div>
            <p className="mt-2 text-lg font-medium">
              {topReason ? REASON_LABELS[topReason[0]] : "N/A"}
            </p>
            <p className="text-sm text-muted-foreground">
              {topReason ? `${topReason[1]} users` : ""}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageSquare className="size-4" />
              With Feedback
            </div>
            <p className="mt-2 text-3xl font-semibold">
              {feedbacks.filter((f) => f.feedback).length}
            </p>
          </div>
        </div>

        {/* Reason Breakdown */}
        <div className="mt-6 rounded-lg border border-border bg-card p-6">
          <h2 className="font-semibold">Cancellation Reasons Breakdown</h2>
          <div className="mt-4 space-y-3">
            {Object.entries(reasonCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([reason, count]) => {
                const percentage = ((count / totalCancellations) * 100).toFixed(1)
                return (
                  <div key={reason}>
                    <div className="flex items-center justify-between text-sm">
                      <span>{REASON_LABELS[reason] || reason}</span>
                      <span className="font-medium">
                        {count} ({percentage}%)
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        {/* Feedback List */}
        <div className="mt-6 rounded-lg border border-border bg-card">
          <div className="border-b border-border p-4">
            <h2 className="font-semibold">Recent Cancellation Feedback</h2>
          </div>
          <div className="divide-y divide-border">
            {feedbacks.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No cancellation feedback yet
              </div>
            ) : (
              feedbacks.map((fb) => (
                <div key={fb._id.toString()} className="p-4 hover:bg-accent/50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{fb.userName || "Unknown"}</span>
                        <span className="text-sm text-muted-foreground">{fb.userEmail}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                          {fb.planName}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                          {REASON_LABELS[fb.reason] || fb.reason}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(fb.createdAt)}
                        </span>
                      </div>
                      {fb.feedback && (
                        <div className="mt-3 rounded-md bg-muted p-3 text-sm">
                          <p className="text-muted-foreground italic">"{fb.feedback}"</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}