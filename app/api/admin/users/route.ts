import { requireAdmin } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { usersCol } from "@/lib/db/collections"

interface AdminUserItem {
  id: string
  email: string
  name: string
  authProvider: string
  emailVerified: boolean
  credits: number
  isAdmin: boolean
  suspended?: boolean
  banned?: boolean
  createdAt: number
  lastLoginAt?: number
  onboarding?: {
    source?: string
    role?: string
    signalType?: string
    completedAt?: number
  }
}

/** Admin endpoint: list all users with key info. */
export async function GET() {
  try {
    await requireAdmin()
    const col = await usersCol()
    const users = await col
      .find({ deletedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray()

    const items: AdminUserItem[] = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      authProvider: u.authProvider,
      emailVerified: u.emailVerified,
      credits: u.credits,
      isAdmin: u.isAdmin ?? false,
      suspended: u.suspended,
      banned: u.banned,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      onboarding: u.onboarding ? {
        source: u.onboarding.source,
        role: u.onboarding.role,
        signalType: u.onboarding.signalType,
        completedAt: u.onboarding.completedAt,
      } : undefined,
    }))

    return ok({ users: items })
  } catch (e) {
    return handleRouteError("api.admin.users.list", e)
  }
}
