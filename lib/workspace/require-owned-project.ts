import { notFound, redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"

export async function requireOwnedProject(projectId: string, nextPath: string) {
  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  const project = await store.getProject(projectId)
  if (!project || project.userId !== user.id) notFound()
  return project
}
