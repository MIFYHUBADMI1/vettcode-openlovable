"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import useSWR from "swr"
import { AppHeader } from "@/components/app-header"
import { postJson, deleteJson, jsonFetcher, useSession } from "@/lib/client/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Shield, Key, Mail, Monitor, Smartphone, LogOut, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react"

interface SessionItem {
  id: string
  userAgent?: string
  createdAt: number
  expiresAt: Date
  isCurrent: boolean
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function parseUserAgent(ua?: string): { device: string; browser: string } {
  if (!ua) return { device: "Unknown device", browser: "Unknown browser" }
  let device = "Desktop"
  if (/mobile|android|iphone|ipad/i.test(ua)) device = "Mobile"
  else if (/tablet|ipad/i.test(ua)) device = "Tablet"

  let browser = "Unknown browser"
  if (/chrome/i.test(ua) && !/edge|opr/i.test(ua)) browser = "Chrome"
  else if (/firefox/i.test(ua)) browser = "Firefox"
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = "Safari"
  else if (/edge/i.test(ua)) browser = "Edge"

  return { device, browser }
}

export default function SecuritySettingsPage() {
  const { session } = useSession()
  const isPasswordUser = session?.user?.authProvider === "password"

  // Email change state
  const [newEmail, setNewEmail] = useState("")
  const [emailSent, setEmailSent] = useState(false)
  const [changingEmail, setChangingEmail] = useState(false)

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [changingPassword, setChangingPassword] = useState(false)

  // Sessions state
  const { data: sessionsData, error: sessionsError, isLoading: sessionsLoading, mutate: refreshSessions } = useSWR<{ sessions: SessionItem[] }>(
    "/api/auth/sessions",
    jsonFetcher,
  )

  const handleChangePassword = useCallback(async () => {
    if (!currentPassword || !newPassword) {
      toast.error("Please fill in all fields")
      return
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters")
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match")
      return
    }
    if (currentPassword === newPassword) {
      toast.error("New password must be different from your current password")
      return
    }

    setChangingPassword(true)
    try {
      await postJson("/api/auth/change-password", { currentPassword, newPassword })
      toast.success("Password changed successfully")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password")
    } finally {
      setChangingPassword(false)
    }
  }, [currentPassword, newPassword, confirmPassword])

  const handleChangeEmail = useCallback(async () => {
    if (!newEmail) {
      toast.error("Please enter a new email address")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      toast.error("Please enter a valid email address")
      return
    }
    if (session?.user?.email && newEmail.toLowerCase() === session.user.email.toLowerCase()) {
      toast.error("This is already your current email address")
      return
    }

    setChangingEmail(true)
    try {
      await postJson("/api/auth/change-email", { newEmail })
      setEmailSent(true)
      toast.success("Confirmation link sent! Check your new email inbox.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send confirmation")
    } finally {
      setChangingEmail(false)
    }
  }, [newEmail, session])

  const handleRevokeAll = useCallback(async () => {
    try {
      await deleteJson("/api/auth/sessions")
      toast.success("All other sessions revoked")
      await refreshSessions()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke sessions")
    }
  }, [refreshSessions])

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
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Security</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage your password and active sessions.
          </p>
        </header>

        {/* Sign-in info */}
        <section className="border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <Shield className="size-5 text-primary" />
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Sign-in security
            </p>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Your account uses {isPasswordUser ? "email and password authentication" : "Google authentication"}.
            Sessions are protected with server-side cookies and ownership checks.
          </p>
          {isPasswordUser && (
            <Link href="/forgot-password" className="mt-4 inline-block font-mono text-xs text-primary hover:underline">
              Forgot password? Reset it →
            </Link>
          )}
        </section>

        {/* Email Change */}
        <section className="border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <Mail className="size-5 text-primary" />
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Email address
            </p>
          </div>
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">
              Current email: <span className="font-medium text-foreground">{session?.user?.email ?? "—"}</span>
            </p>
            {session?.user?.authProvider === "google" && (
              <p className="mt-1 text-xs text-muted-foreground">
                Your account was created with Google. You can still add a secondary email for notifications.
              </p>
            )}
          </div>
          {emailSent ? (
            <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/5 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-green-500" />
                <p className="text-sm font-medium text-green-500">Confirmation sent</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a confirmation link to <span className="font-medium">{newEmail}</span>. Click the link in the email to complete the change. The link expires in 1 hour.
              </p>
              <div className="mt-3 flex gap-3">
                <Button variant="outline" size="sm" onClick={() => { setEmailSent(false); setNewEmail("") }}>
                  Change to a different email
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex gap-3 max-w-md">
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="new@email.com"
                className="flex-1"
              />
              <Button
                onClick={handleChangeEmail}
                disabled={changingEmail || !newEmail}
                variant="outline"
              >
                {changingEmail ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                Send confirmation
              </Button>
            </div>
          )}
        </section>

        {/* Password Change (only for password-auth users) */}
        {isPasswordUser && (
          <section className="border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <Key className="size-5 text-primary" />
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Change password
              </p>
            </div>
            <div className="mt-5 space-y-4 max-w-md">
              <div>
                <Label htmlFor="current-password" className="text-sm">Current password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="mt-1.5"
                  placeholder="Enter current password"
                />
              </div>
              <div>
                <Label htmlFor="new-password" className="text-sm">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1.5"
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <Label htmlFor="confirm-password" className="text-sm">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1.5"
                  placeholder="Repeat new password"
                />
              </div>
              <Button
                onClick={handleChangePassword}
                disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
              >
                {changingPassword ? (
                  <><Loader2 className="size-4 animate-spin mr-2" /> Changing...</>
                ) : (
                  "Change password"
                )}
              </Button>
            </div>
          </section>
        )}

        {/* Active Sessions */}
        <section className="border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Monitor className="size-5 text-primary" />
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Active sessions
              </p>
            </div>
            {sessionsData?.sessions && sessionsData.sessions.length > 1 && (
              <Button variant="outline" size="sm" onClick={handleRevokeAll} className="gap-1.5 text-destructive hover:text-destructive">
                <LogOut className="size-3.5" />
                Revoke all others
              </Button>
            )}
          </div>

          {sessionsLoading ? (
            <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading sessions...
            </div>
          ) : sessionsError ? (
            <div className="mt-5 flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="size-4" />
              Could not load sessions
            </div>
          ) : sessionsData?.sessions && sessionsData.sessions.length > 0 ? (
            <div className="mt-5 space-y-3">
              {sessionsData.sessions.map((s) => {
                const { device, browser } = parseUserAgent(s.userAgent)
                const isMobile = device === "Mobile"
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border p-4"
                  >
                    <div className="flex items-center gap-3">
                      {isMobile ? (
                        <Smartphone className="size-5 text-muted-foreground" />
                      ) : (
                        <Monitor className="size-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="text-sm font-medium">
                          {browser} on {device}
                          {s.isCurrent && (
                            <span className="ml-2 inline-flex items-center gap-1 text-xs text-primary">
                              <CheckCircle2 className="size-3" />
                              Current
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Last active: {formatDate(s.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">No active sessions found.</p>
          )}
        </section>

        {/* Danger zone */}
        <section className="border border-destructive/30 bg-destructive/5 p-6">
          <p className="font-mono text-xs uppercase tracking-widest text-destructive">
            Danger zone
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Signing out will end your current session. You can sign in again with your credentials.
          </p>
          <Button
            variant="destructive"
            className="mt-4"
            onClick={async () => {
              try {
                await postJson("/api/auth/logout")
                window.location.href = "/login"
              } catch {
                window.location.href = "/login"
              }
            }}
          >
            <LogOut className="size-4 mr-2" />
            Sign out
          </Button>
        </section>
      </div>
    </main>
  )
}
