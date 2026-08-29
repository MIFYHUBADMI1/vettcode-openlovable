"use client"

import useSWR from "swr"

async function fetcher(url: string) { const response = await fetch(url); const body = await response.json(); if (!response.ok || !body.ok) throw new Error(body.error?.message ?? "Unable to load activity"); return body.data as { events: { id: string; at: number; level: string; stage: string; message: string }[] } }

export function ProjectActivity({ projectId }: { projectId: string }) {
  const { data, error } = useSWR(`/api/projects/${projectId}/activity`, fetcher, { refreshInterval: 5000 })
  if (error) return <p className="text-sm text-destructive">{error.message}</p>
  if (!data) return <p className="text-sm text-muted-foreground">Loading activity…</p>
  if (!data.events.length) return <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
  return <ol className="flex flex-col gap-3">{data.events.slice().reverse().map((event) => <li key={event.id} className="border-l-2 border-border pl-3"><p className="text-sm">{event.message}</p><p className="mt-1 font-mono text-[10px] uppercase text-muted-foreground">{event.stage} · {new Date(event.at).toLocaleString()}</p></li>)}</ol>
}
