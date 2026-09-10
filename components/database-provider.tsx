"use client"

import { DatabaseStoreProvider } from "@/lib/store/database-store"

/**
 * Thin client wrapper so server-component pages can wrap their tree in
 * the shared database store with a single <DatabaseProvider projectId={…}>.
 */
export function DatabaseProvider({
  projectId,
  children,
}: {
  projectId: string
  children: React.ReactNode
}) {
  return (
    <DatabaseStoreProvider projectId={projectId}>
      {children}
    </DatabaseStoreProvider>
  )
}
