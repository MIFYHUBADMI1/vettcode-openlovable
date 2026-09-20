"use client"

import type { ButtonHTMLAttributes, ReactNode } from "react"
import { useAuthModal, type OpenAuthOptions } from "@/components/auth/auth-context"
import type { AuthView } from "@/lib/auth/client-intent"
import { cn } from "@/lib/utils"

export function AuthTrigger({
  view = "login",
  next,
  prompt,
  className,
  children,
  onClick,
  ...props
}: {
  view?: Extract<AuthView, "login" | "signup">
  next?: string
  prompt?: string
  className?: string
  children: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const { openAuth } = useAuthModal()

  return (
    <button
      type="button"
      className={cn(className)}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        const options: OpenAuthOptions = { view, next, prompt }
        openAuth(view, options)
      }}
      {...props}
    >
      {children}
    </button>
  )
}
