"use client"

import useSWR from "swr"
import { useState } from "react"

async function fetcher(url: string) { const response = await fetch(url); const body = await response.json(); if (!response.ok || !body.ok) throw new Error(body.error?.message ?? "Unable to load assets"); return body.data as { assets: string[]; screenshots: string[] } }

export function ProjectAssets({ projectId }: { projectId: string }) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const { data, error, mutate } = useSWR(`/api/projects/${projectId}/assets`, fetcher)
  async function upload(file: File) {
    setUploading(true); setUploadError(null)
    try { const form = new FormData(); form.set("file", file); const response = await fetch(`/api/projects/${projectId}/assets`, { method: "POST", body: form }); const body = await response.json(); if (!response.ok || !body.ok) throw new Error(body.error?.message ?? "Upload failed"); await mutate() }
    catch (error) { setUploadError(error instanceof Error ? error.message : "Upload failed") }
    finally { setUploading(false) }
  }
  if (error) return <p className="text-sm text-destructive">{error.message}</p>
  if (!data) return <p className="text-sm text-muted-foreground">Loading captured assets…</p>
  const items = [...new Set([...data.screenshots, ...data.assets])]
  if (!items.length) return <div className="flex flex-col gap-3"><p className="text-sm text-muted-foreground">No screenshots or asset references were captured for this project.</p><label className="w-fit cursor-pointer border border-border px-3 py-2 text-xs"><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file) }} />{uploading ? "Uploading…" : "Upload image"}</label>{uploadError ? <p className="text-sm text-destructive">{uploadError}</p> : null}</div>
  const screenshots = data.screenshots
  const otherAssets = data.assets
  return <div className="flex flex-col gap-3"><label className="w-fit cursor-pointer border border-border px-3 py-2 text-xs"><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file) }} />{uploading ? "Uploading…" : "Upload image"}</label>{uploadError ? <p className="text-sm text-destructive">{uploadError}</p> : null}{screenshots.length > 0 ? <div className="flex flex-col gap-2"><p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Screenshots from scraping</p><div className="grid gap-3 sm:grid-cols-2">{screenshots.slice(0, 6).map((src, index) => <a key={`ss-${index}`} href={src} target="_blank" rel="noreferrer" className="group overflow-hidden border border-border bg-background"><img src={src} alt={`Screenshot ${index + 1}`} className="aspect-video w-full object-cover transition-transform group-hover:scale-[1.02]" loading="lazy" /></a>)}</div></div> : null}{otherAssets.length > 0 ? <div className="flex flex-col gap-2"><p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Other assets</p><div className="grid gap-3 sm:grid-cols-2">{otherAssets.slice(0, 18).map((src, index) => <a key={`a-${index}`} href={src} target="_blank" rel="noreferrer" className="group overflow-hidden border border-border bg-background"><img src={src} alt={`Asset ${index + 1}`} className="aspect-video w-full object-cover transition-transform group-hover:scale-[1.02]" loading="lazy" /></a>)}</div></div> : null}</div>
}
