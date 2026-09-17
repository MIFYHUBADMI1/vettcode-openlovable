import "server-only"
import { scrapeUrl } from "@/lib/integrations/firecrawl/client"
import { uploadImageToImageKit } from "@/lib/imagekit/upload"
import { store } from "@/lib/store/store"
import { logger } from "@/lib/logging/logger"

/**
 * Captures a screenshot of the built/deployed app URL and stores it as
 * the project's preview image (prepended to understanding.screenshots).
 *
 * Reuses the existing Firecrawl scrapeUrl client (v2) — same infrastructure
 * already used for source-URL screenshots. No new dependencies needed.
 *
 * Always called fire-and-forget. Never throws in a way that blocks callers.
 */
export async function captureAppPreview(projectId: string, appUrl: string): Promise<void> {
  try {
    logger.info("capture-app-preview", "starting", { projectId, appUrl })

    if (!process.env.FIRECRAWL_API_KEY) {
      logger.warn("capture-app-preview", "FIRECRAWL_API_KEY not set — skipping", { projectId })
      return
    }

    // Use the existing Firecrawl v2 scrape client with screenshot=true
    // 45s timeout — the built app may be cold-starting
    const result = await scrapeUrl(appUrl, true, 45_000)
    const screenshot = result?.data?.screenshot as string | undefined

    if (!screenshot) {
      logger.warn("capture-app-preview", "no screenshot returned — app may not be publicly reachable yet", { projectId, appUrl })
      return
    }

    let imageUrl: string

    if (screenshot.startsWith("data:")) {
      // Base64 data URI — decode and upload to ImageKit
      const [meta, b64] = screenshot.split(",")
      const mimeMatch = meta?.match(/data:(image\/\w+);base64/)
      const mimeType = mimeMatch?.[1] ?? "image/png"
      const buffer = Buffer.from(b64 ?? "", "base64")

      const uploaded = await uploadImageToImageKit({
        file: buffer,
        fileName: `app-preview-${Date.now()}.png`,
        mimeType,
        folder: `/Atai/projects/${projectId}/screenshots`,
      })
      imageUrl = uploaded.url
    } else {
      // Firecrawl returned a hosted URL — use directly
      imageUrl = screenshot
    }

    logger.info("capture-app-preview", "screenshot captured", { projectId, imageUrl })

    // Prepend to understanding.screenshots so it becomes thumbnailUrl everywhere
    const project = await store.getProject(projectId)
    if (!project) return

    const existing = project.understanding?.screenshots ?? []
    if (existing.includes(imageUrl)) return // already saved — idempotent

    await store.updateProject(projectId, {
      understanding: {
        ...(project.understanding ?? {}),
        screenshots: [imageUrl, ...existing],
      } as typeof project.understanding,
    })

    logger.info("capture-app-preview", "screenshot saved as thumbnail", { projectId })
  } catch (err) {
    // Never block the caller
    logger.error("capture-app-preview", "failed (non-fatal)", {
      projectId,
      error: (err as Error).message,
    })
  }
}
