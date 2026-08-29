"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { LogOut, User } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { useSession, postJson } from "@/lib/client/api"
import { toast } from "sonner"

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

export function AccountMenu() {
  const router = useRouter()
  const { session, isLoading } = useSession()
  const [signingOut, setSigningOut] = useState(false)

  if (isLoading) {
    return <Skeleton className="size-9 rounded-full" />
  }

  if (!session) return null

  const { user } = session

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await postJson("/api/auth/logout")
      router.push("/login")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't sign out. Please try again.")
      setSigningOut(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        <Avatar className="size-9 border border-border">
          <AvatarImage src={user.imageUrl || undefined} alt={user.name} />
          <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-medium">
            {initials(user.name)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-foreground">{user.name}</span>
          <span className="truncate text-xs text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="gap-2">
          <User className="size-4" />
          {user.authProvider === "google" ? "Signed in with Google" : "Signed in with email"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={signingOut} onSelect={handleSignOut} className="gap-2">
          <LogOut className="size-4" />
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
