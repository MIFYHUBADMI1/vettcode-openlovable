"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { useSession } from "@/lib/client/api"
import { useAuthModal } from "@/components/auth/auth-context"
import { AuthTrigger } from "@/components/auth/auth-trigger"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function AuthGate({ next, children }: { next: string; children: ReactNode }) {
  const { session, isLoading } = useSession()
  const { openAuth } = useAuthModal()
  const opened = useRef(false)

  useEffect(() => {
    if (isLoading || session || opened.current) return
    opened.current = true
    openAuth("login", { next })
  }, [isLoading, session, next, openAuth])

  if (isLoading) return null
  if (!session) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-6">
        <div className="max-w-sm text-center">
          <p className="text-lg font-semibold">Sign in to continue</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Create an account or sign in to keep building with Atai.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <AuthTrigger view="login" next={next} className={cn(buttonVariants(), "h-11 px-5")}>
              Sign in
            </AuthTrigger>
            <AuthTrigger view="signup" next={next} className={cn(buttonVariants({ variant: "outline" }), "h-11 px-5")}>
              Create account
            </AuthTrigger>
          </div>
        </div>
      </div>
    )
  }

  return children
}
