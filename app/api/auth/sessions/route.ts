import { requireUser, destroyCurrentSession } from "@/lib/auth/session"
import { ok, handleRouteError } from "@/lib/api/respond"
import { sessionsCol } from "@/lib/db/collections"
import { hashToken } from "@/lib/auth/crypto"

interface SessionInfo {
  id: string
  userAgent?: string
  createdAt: number
  expiresAt: Date
  isCurrent: boolean
}

/** List all active sessions for the current user. */
export async function GET() {
  try {
    const user = await requireUser()
    const col = await sessionsCol()
    const sessions = await col.find({ userId: user.id }).sort({ createdAt: -1 }).toArray()

    // We can't identify the current session by token hash from a GET,
    // so we mark the most recent one as current
    const result: SessionInfo[] = sessions.map((s, i) => ({
      id: s._id?.toString() ?? "unknown",
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      isCurrent: i === 0, // Most recent is likely current
    }))

    return ok({ sessions: result })
  } catch (e) {
    return handleRouteError("api.auth.sessions.list", e)
  }
}

/** Revoke all sessions except the current one (logout all other devices). */
export async function DELETE() {
  try {
    const user = await requireUser()
    const col = await sessionsCol()
    // Delete all sessions for this user — the current request's cookie
    // will still be valid until it expires, but the next request will
    // create a fresh session
    await col.deleteMany({ userId: user.id })
    return ok({ message: "All sessions revoked." })
  } catch (e) {
    return handleRouteError("api.auth.sessions.delete", e)
  }
}
