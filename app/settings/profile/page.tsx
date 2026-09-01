import { redirect } from "next/navigation"
import Link from "next/link"
import { AppHeader } from "@/components/app-header"
import { getCurrentUser } from "@/lib/auth/session"
import { getBalance } from "@/lib/credits/credits"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ProfileAvatarUpload } from "@/components/profile-avatar-upload"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Shield } from "lucide-react"

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  const years = Math.floor(months / 12)
  return `${years}y ago`
}

export default async function ProfileSettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login?next=%2Fsettings%2Fprofile")

  const balance = await getBalance(user.id)

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AppHeader />
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10">
        <Link href="/settings" className="font-mono text-xs text-primary hover:underline">
          ← Settings
        </Link>

        <header>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Account
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Profile</h1>
        </header>

        {/* Profile header card */}
        <section className="border border-border bg-card p-6">
          <div className="flex items-start gap-6">
            <ProfileAvatarUpload
              currentImageUrl={user.imageUrl}
              userName={user.name}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-semibold tracking-tight">{user.name}</h2>
                {user.emailVerified ? (
                  <Badge variant="secondary" className="gap-1 font-mono text-xs">
                    <CheckCircle2 className="size-3" />
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 font-mono text-xs text-muted-foreground">
                    Unverified
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Shield className="size-3" />
                  {user.authProvider === "google" ? "Google authentication" : "Email & password"}
                </span>
                <span className="font-mono">Member since {formatDate(user.createdAt)}</span>
                <span className="font-mono">{timeAgo(user.createdAt)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Account details */}
        <section className="border border-border bg-card p-6">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Account details
          </p>
          <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="mt-1 font-medium">{user.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="mt-1 font-medium">{user.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email status</dt>
              <dd className="mt-1 font-medium">
                {user.emailVerified ? "Verified" : "Not verified"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Sign-in method</dt>
              <dd className="mt-1 font-medium">
                {user.authProvider === "google" ? "Google" : "Email & password"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Account created</dt>
              <dd className="mt-1 font-medium">{formatDate(user.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Available credits</dt>
              <dd className="mt-1 font-medium font-mono">{balance.toLocaleString()}</dd>
            </div>
          </dl>
        </section>

        {/* Quick links */}
        <section className="border border-border bg-card p-6">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Manage account
          </p>
          <div className="mt-5 flex flex-col gap-3">
            <Link
              href="/settings/security"
              className="flex items-center justify-between rounded-lg border border-border p-4 text-sm transition-colors hover:bg-accent"
            >
              <div>
                <p className="font-medium">Security</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Change password, manage sessions
                </p>
              </div>
              <span className="text-primary font-mono text-xs">→</span>
            </Link>
            <Link
              href="/settings/billing"
              className="flex items-center justify-between rounded-lg border border-border p-4 text-sm transition-colors hover:bg-accent"
            >
              <div>
                <p className="font-medium">Credits & billing</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  View usage history and transactions
                </p>
              </div>
              <span className="text-primary font-mono text-xs">→</span>
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
