"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Globe2, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  PROJECT_ID_MAX_LENGTH,
  projectIdFromName,
  validateProjectId,
} from "@/lib/projects/project-id"

interface ProjectIdDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectName: string
  initialProjectId?: string
  onConfirm: (requestedProjectId: string) => Promise<void>
}

export function ProjectIdDialog({
  open,
  onOpenChange,
  projectName,
  initialProjectId,
  onConfirm,
}: ProjectIdDialogProps) {
  const suggestedProjectId = initialProjectId || projectIdFromName(projectName)
  const [value, setValue] = useState(suggestedProjectId)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setValue(suggestedProjectId)
    setError(null)
  }, [open, suggestedProjectId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const requestedProjectId = value.trim().toLowerCase()
    const validationError = validateProjectId(requestedProjectId)
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(requestedProjectId)
      onOpenChange(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This app address could not be reserved.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!submitting) onOpenChange(next) }}>
      <DialogContent className="sm:max-w-md" showCloseButton={!submitting}>
        <form onSubmit={handleSubmit} className="contents">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe2 className="size-4 text-primary" aria-hidden />
              Choose your app address
            </DialogTitle>
            <DialogDescription>
              This becomes your application&apos;s subdomain. Choose a name that belongs to your product—Atai will not add its branding or a random suffix.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label htmlFor="requested-project-id" className="text-sm font-medium text-foreground">
              Project ID
            </label>
            <Input
              id="requested-project-id"
              value={value}
              onChange={(event) => {
                setValue(event.target.value.toLowerCase().replace(/\s+/g, "-"))
                setError(null)
              }}
              maxLength={PROJECT_ID_MAX_LENGTH}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              aria-invalid={Boolean(error)}
              aria-describedby="project-id-help project-id-error"
              placeholder="my-product"
              className="h-10 font-mono"
            />
            <div className="min-w-0 rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
              <span className="break-all font-medium text-foreground">{value || "your-app"}</span>.totalum-project.com
            </div>
            <p id="project-id-help" className="text-xs leading-5 text-muted-foreground">
              Use 3–63 lowercase letters, numbers, or hyphens. We&apos;ll check that it is available before the build starts.
            </p>
            {error ? <p id="project-id-error" role="alert" className="text-xs font-medium text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !value.trim()}>
              {submitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {submitting ? "Checking & starting…" : "Check & start building"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
