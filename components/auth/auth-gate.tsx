"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { useSession } from "@/lib/client/api"
import { useAuthModal } from "@/components/auth/auth-context"
import { AuthTrigger } from "@/components/auth/auth-trigger"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function AuthGate({ next, children }: { next: string; children: ReactNode }) {
  const { session, isLoading } = useSession()
  const { openAuth } = useAuthModal()
  const opened = useRef(false)
  const [waitedOut, setWaitedOut] = useState(false)

  useEffect(() => {
    if (!isLoading) return
    const timer = window.setTimeout(() => setWaitedOut(true), 8_000)
    return () => window.clearTimeout(timer)
  }, [isLoading])

  const blocked = !session && (!isLoading || waitedOut)

  useEffect(() => {
    if (!blocked || opened.current) return
    opened.current = true
    openAuth("login", { next })
  }, [blocked, next, openAuth])

  if (session) return children
  if (isLoading && !waitedOut) return null

  const loginHref = `/login?next=${encodeURIComponent(next)}`
  const registerHref = `/register?next=${encodeURIComponent(next)}`

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
        <p className="mt-4 text-xs text-muted-foreground">
          Or go to the{" "}
          <Link href={loginHref} className="font-medium text-primary hover:underline">sign in page</Link>
          {" · "}
          <Link href={registerHref} className="font-medium text-primary hover:underline">create account page</Link>
        </p>
      </div>
    </div>
  )
}
