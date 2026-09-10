import { requireAdmin } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { topupsCol } from "@/lib/db/collections"
import { getImageKitConfig, isImageKitConfigured } from "@/lib/env"
import { createHmac } from "crypto"

/** Admin endpoint: get signed ImageKit URLs for viewing evidence screenshots. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params

    const col = await topupsCol()
    const topUp = await col.findOne({ id })
    if (!topUp) {
      return fail("NOT_FOUND", "Top-up not found.", 404)
    }

    if (!topUp.evidenceFileIds.length) {
      return ok({ evidence: [] })
    }

    if (!isImageKitConfigured()) {
      return ok({ evidence: topUp.evidenceFileIds.map((fid) => ({ fileId: fid, url: null })) })
    }

    const config = getImageKitConfig()

    // Build signed URLs for each evidence file
    const evidence = topUp.evidenceFileIds.map((fileId) => {
      // ImageKit signed URL for private files
      const expire = Math.floor(Date.now() / 1000) + 60 * 60 // 1 hour
      const url = `${config.urlEndpoint}/${fileId}`
      const signature = createHmac("sha1", config.privateKey)
        .update(`${expire}${url}`)
        .digest("hex")
      return {
        fileId,
        url: `${url}?sig=${signature}&expire=${expire}`,
      }
    })

    return ok({ evidence })
  } catch (e) {
    return handleRouteError("api.billing.admin.evidence", e)
  }
}
