"use client"

import useSWR from "swr"
import { useEffect } from "react"

async function fetcher(url: string) { const response = await fetch(url); const body = await response.json(); if (!response.ok || !body.ok) throw new Error(body.error?.message ?? "Unable to load assets"); return body.data as { assets: string[]; screenshots: string[] } }

export function ProjectAssets({ projectId }: { projectId: string }) {
  const { data, error } = useSWR(`/api/projects/${projectId}/assets`, fetcher)
  useEffect(() => { if (error) console.log("[v0] Project assets failed to load:", error.message) }, [error])
  if (error) return <p className="text-sm text-destructive">{error.message}</p>
  if (!data) return <p className="text-sm text-muted-foreground">Loading captured assets…</p>
  const items = [...new Set([...data.screenshots, ...data.assets])]
  if (!items.length) return <p className="text-sm text-muted-foreground">No screenshots or asset references were captured for this project.</p>
  return <div className="grid gap-3 sm:grid-cols-2">{items.slice(0, 24).map((src, index) => <a key={`${src}-${index}`} href={src} target="_blank" rel="noreferrer" className="group overflow-hidden border border-border bg-background"><img src={src} alt={`Captured project asset ${index + 1}`} className="aspect-video w-full object-cover transition-transform group-hover:scale-[1.02]" /></a>)}</div>
}
