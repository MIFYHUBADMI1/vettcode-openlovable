import "server-only"
import { getSourceCode } from "@/lib/integrations/totalum/service"
import { pushFilesToRepo } from "@/lib/integrations/github/client"
import { projectGitHubCol } from "@/lib/db/collections"
import { logger } from "@/lib/logging/logger"

interface PushOptions {
  projectId:        string
  totalumProjectId: string
  accessToken:      string
  repoOwner:        string
  repoName:         string
  branch:           string
  commitMessage?:   string
}

/**
 * Downloads source code from Totalum and pushes all files to the
 * configured GitHub repository. Updates ProjectGitHubDoc with result.
 * Never throws — all failures are recorded on the doc.
 */
export async function pushProjectToGitHub(opts: PushOptions): Promise<void> {
  const col = await projectGitHubCol()

  try {
    logger.info("github.push", "starting push", { projectId: opts.projectId, repo: `${opts.repoOwner}/${opts.repoName}` })

    // Get source code zip URL from Totalum
    const sourceCode = await getSourceCode(opts.totalumProjectId)

    if (!sourceCode.downloadUrl) {
      logger.warn("github.push", "no downloadUrl, skipping", { projectId: opts.projectId })
      await col.updateOne({ projectId: opts.projectId }, { $set: { pushStatus: "skipped_no_source", updatedAt: Date.now() } })
      return
    }

    // Download the ZIP
    const zipRes = await fetch(sourceCode.downloadUrl)
    if (!zipRes.ok) throw new Error(`Failed to download source ZIP: ${zipRes.status}`)
    const zipBuffer = Buffer.from(await zipRes.arrayBuffer())

    // Unpack ZIP into files array
    const files = await unzipToFiles(zipBuffer)
    if (files.length === 0) {
      logger.warn("github.push", "no files in zip", { projectId: opts.projectId })
      await col.updateOne({ projectId: opts.projectId }, { $set: { pushStatus: "skipped_no_source", updatedAt: Date.now() } })
      return
    }

    logger.info("github.push", "pushing files", { projectId: opts.projectId, fileCount: files.length })

    const result = await pushFilesToRepo(
      opts.accessToken,
      opts.repoOwner,
      opts.repoName,
      opts.branch,
      files,
      opts.commitMessage ?? "chore: sync from Atai",
    )

    await col.updateOne(
      { projectId: opts.projectId },
      { $set: { pushStatus: "ok", lastPushedAt: Date.now(), lastPushedSha: result.commitSha, pushError: undefined, updatedAt: Date.now() } },
    )

    logger.info("github.push", "push complete", { projectId: opts.projectId, commitSha: result.commitSha })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error("github.push", "push failed", { projectId: opts.projectId, error: message })
    await col.updateOne(
      { projectId: opts.projectId },
      { $set: { pushStatus: "failed", pushError: message, updatedAt: Date.now() } },
    ).catch(() => {})
  }
}

/**
 * Unzip a ZIP buffer and return file path + utf-8 content pairs.
 * Uses Node's built-in zlib for decompression — no extra dependency.
 * Skips binary files (images, fonts, etc.) since GitHub push needs text.
 */
async function unzipToFiles(buffer: Buffer): Promise<Array<{ path: string; content: string }>> {
  // Minimal ZIP parser — read local file headers
  const files: Array<{ path: string; content: string }> = []
  let offset = 0
  const TEXT_EXTS = new Set([
    ".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".mdx",
    ".css", ".scss", ".html", ".yml", ".yaml", ".env.example",
    ".gitignore", ".eslintrc", ".prettierrc", ".babelrc",
    ".txt", ".sh", ".mjs", ".cjs", ".toml",
  ])

  while (offset < buffer.length - 4) {
    // Local file header signature: PK\x03\x04
    if (buffer.readUInt32LE(offset) !== 0x04034b50) break

    const compression      = buffer.readUInt16LE(offset + 8)
    const compressedSize   = buffer.readUInt32LE(offset + 18)
    const uncompressedSize = buffer.readUInt32LE(offset + 22)
    const fileNameLen      = buffer.readUInt16LE(offset + 26)
    const extraLen         = buffer.readUInt16LE(offset + 28)
    const fileNameRaw      = buffer.subarray(offset + 30, offset + 30 + fileNameLen)
    const fileName         = fileNameRaw.toString("utf8")
    const dataOffset       = offset + 30 + fileNameLen + extraLen

    offset = dataOffset + compressedSize

    // Skip directories and non-text files
    if (fileName.endsWith("/") || fileName.endsWith("\\")) continue
    const ext = "." + fileName.split(".").pop()!.toLowerCase()
    if (!TEXT_EXTS.has(ext) && !fileName.includes("Dockerfile") && !fileName.includes(".env.example")) continue
    if (uncompressedSize > 512 * 1024) continue // skip >512KB individual files

    try {
      let content: Buffer
      if (compression === 0) {
        // Stored (no compression)
        content = buffer.subarray(dataOffset, dataOffset + uncompressedSize)
      } else if (compression === 8) {
        // Deflate
        const { inflateRawSync } = await import("zlib")
        const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize)
        content = inflateRawSync(compressed)
      } else {
        continue // unsupported compression
      }

      // Strip leading directory component (common in zips)
      const parts = fileName.split("/")
      const cleanPath = parts.length > 1 ? parts.slice(1).join("/") : fileName
      if (!cleanPath) continue

      files.push({ path: cleanPath, content: content.toString("utf8") })
    } catch {
      // Skip files that fail to decompress
    }
  }

  return files
}
