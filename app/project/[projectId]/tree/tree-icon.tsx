"use client"

import { FolderTree } from "lucide-react"

export function TreeIcon() {
  return (
    <div className="flex size-10 items-center justify-center rounded-lg border border-green-500/30 bg-green-500/10">
      <FolderTree className="size-5 text-green-600 dark:text-green-400" />
    </div>
  )
}
