import { redirect } from "next/navigation"
import Link from "next/link"
import { AppHeader } from "@/components/app-header"
import { getCurrentUser } from "@/lib/auth/session"
import { getBalance } from "@/lib/credits/credits"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ProfileAvatarUpload } from "@/components/profile-avatar-upload"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Shield, Link as LinkIcon } from "lucide-react"

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49 1 .11-.78.42-1.3.76-1.6-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.14 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58C20.57 21.8 24 17.3 24 12 24 5.37 18.63 0 12 0Z" />
    </svg>
  )
}

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
        <Link href="/settings" className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-accent hover:text-foreground">
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

        {/* Connected Services */}
        <section className="border border-border bg-card p-6">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Connected services
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Link external services to enable additional features like GitHub repository integration
          </p>

          <div className="mt-5 space-y-3">
            {/* GitHub integration */}
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-[#24292e]">
                  <GitHubIcon className="size-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-sm">GitHub</p>
                  <p className="text-xs text-muted-foreground">
                    {user.githubAccessToken
                      ? `Connected as @${user.githubUsername || 'GitHub user'}`
                      : "Push code to repos or build from existing projects"}
                  </p>
                </div>
              </div>

              {user.githubAccessToken ? (
                <Badge variant="secondary" className="gap-1.5 font-mono text-xs">
                  <CheckCircle2 className="size-3" />
                  Connected
                </Badge>
              ) : (
                <a
                  href="/api/auth/github?next=/settings/profile"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#24292e] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#1a1e22]"
                >
                  <LinkIcon className="size-3.5" />
                  Connect GitHub
                </a>
              )}
            </div>

            {/* Google integration (if not already using Google OAuth) */}
            {user.authProvider !== "google" && (
              <div className="flex items-center justify-between rounded-lg border border-border p-4 opacity-50">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-white">
                    <svg className="size-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Google</p>
                    <p className="text-xs text-muted-foreground">
                      Coming soon
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                  Soon
                </Badge>
              </div>
            )}
          </div>
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
