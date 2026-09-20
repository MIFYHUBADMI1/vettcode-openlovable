"use client"

import type { ReactNode } from "react"
import { AuthModalStateProvider } from "@/components/auth/auth-context"
import { AuthModal } from "@/components/auth/auth-modal"

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthModalStateProvider>
      {children}
      <AuthModal />
    </AuthModalStateProvider>
  )
}

export { useAuthModal } from "@/components/auth/auth-context"
