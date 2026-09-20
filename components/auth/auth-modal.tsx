"use client"

import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AuthPanel } from "@/components/auth/auth-panel"
import { useAuthModal } from "@/components/auth/auth-context"

function focusComposer() {
  const el = document.querySelector<HTMLTextAreaElement>(".lp-composer textarea")
  el?.focus()
}

export function AuthModal() {
  const router = useRouter()
  const { isOpen, view, next, busy, closeAuth, setView, setBusy } = useAuthModal()

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeAuth()
          window.setTimeout(focusComposer, 0)
        }
      }}
    >
      <DialogContent
        showCloseButton={!busy}
        overlayClassName="z-[80] bg-black/35 supports-backdrop-filter:backdrop-blur-sm"
        className="z-[90] max-h-[min(44rem,calc(100dvh-2rem))] w-[calc(100vw-32px)] overflow-y-auto rounded-2xl bg-card p-6 pointer-events-auto shadow-[0_24px_80px_-32px_rgba(15,23,42,0.45)] ring-1 ring-border duration-200 sm:max-w-[440px] [scrollbar-width:thin]"
        aria-modal="true"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{view === "signup" ? "Create your Atai account" : "Sign in to Atai"}</DialogTitle>
          <DialogDescription>Authenticate to continue with Atai.</DialogDescription>
        </DialogHeader>
        <AuthPanel
          view={view}
          onViewChange={setView}
          next={next}
          isOpen={isOpen}
          onBusyChange={setBusy}
          onAuthenticated={(destination) => {
            closeAuth(true)
            router.push(destination)
            router.refresh()
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
