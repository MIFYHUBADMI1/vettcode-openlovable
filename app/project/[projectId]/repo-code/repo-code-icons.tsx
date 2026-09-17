"use client"

import { FileArchive, Download, ExternalLink } from "lucide-react"

export const RepoCodeIcons = {
  HeaderIcon() {
    return (
      <div className="flex size-10 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10">
        <FileArchive className="size-5 text-amber-600 dark:text-amber-400" />
      </div>
    )
  },
  CardIcon() {
    return (
      <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10">
        <FileArchive className="size-6 text-amber-600 dark:text-amber-400" />
      </div>
    )
  },
  ExternalLink({ href, label }: { href: string; label: string }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
      >
        {label}
        <ExternalLink className="size-3" />
      </a>
    )
  },
  DownloadLink({ href }: { href: string }) {
    return (
      <a
        href={href}
        download
        className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-500/20 dark:text-amber-300"
      >
        <Download className="size-4" />
        Download ZIP archive
      </a>
    )
  },
}
