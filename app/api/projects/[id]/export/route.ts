import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  const { id } = await params
  const project = await store.getProject(id)
  if (!project || project.userId !== user.id) {
    return Response.json({ ok: false, error: "Project not found" }, { status: 404 })
  }

  const exportData = {
    exportedAt: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      mode: project.mode,
      state: project.state,
      sourceUrl: project.sourceUrl,
      idea: project.idea,
      understanding: project.understanding,
      specification: project.specification,
      developmentUrl: project.developmentUrl,
      events: project.events,
      conversation: project.conversation,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
  }

  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "mirrorsite-project"}.json"`,
      "cache-control": "private, no-store",
    },
  })
}
