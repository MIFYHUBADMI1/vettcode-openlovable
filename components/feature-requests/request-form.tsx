"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { postJson } from "@/lib/client/api"
import { FEATURE_REQUEST_CATEGORIES } from "@/lib/feature-requests/config"
import type { PublicFeatureRequest } from "@/lib/feature-requests/types"

type Similar = { id: string; title: string; voteCount: number; status: string; score: number }

export function RequestFormDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (created: PublicFeatureRequest) => void
}) {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [whyItMatters, setWhy] = useState("")
  const [category, setCategory] = useState("other")
  const [pending, setPending] = useState(false)
  const [similar, setSimilar] = useState<Similar[]>([])

  function reset() {
    setTitle("")
    setDescription("")
    setWhy("")
    setCategory("other")
    setSimilar([])
  }

  async function submit(force: boolean) {
    setPending(true)
    try {
      const res = await postJson<{ similar: Similar[]; created: PublicFeatureRequest | null }>("/api/feature-requests", {
        title,
        description,
        whyItMatters,
        category,
        force,
      })
      if (res.created) {
        toast.success("Request submitted. We'll review it.")
        onCreated?.(res.created)
        reset()
        onOpenChange(false)
        router.push(`/feature-requests/${res.created.id}`)
        return
      }
      setSimilar(res.similar ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't submit that request.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>What should Atai be able to do?</DialogTitle>
          <DialogDescription>Help shape Atai. Vote on similar ideas if one already exists.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            void submit(false)
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="fr-title">Title</Label>
            <Input
              id="fr-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Allow generated apps to use custom AI models"
              required
              minLength={8}
              maxLength={120}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fr-body">Tell us more</Label>
            <Textarea
              id="fr-body"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What problem are you hitting, and what should Atai do instead?"
              required
              minLength={20}
              maxLength={4000}
              rows={5}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fr-why">Why would this help you? (optional)</Label>
            <Textarea id="fr-why" value={whyItMatters} onChange={(e) => setWhy(e.target.value)} maxLength={2000} rows={3} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fr-cat">Category</Label>
            <select
              id="fr-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              {FEATURE_REQUEST_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          {similar.length > 0 ? (
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-sm font-medium">Is one of these what you&apos;re looking for?</p>
              <ul className="mt-2 space-y-2">
                {similar.map((s) => (
                  <li key={s.id} className="flex items-start justify-between gap-2 text-sm">
                    <button
                      type="button"
                      className="text-left hover:underline"
                      onClick={() => {
                        onOpenChange(false)
                        router.push(`/feature-requests/${s.id}`)
                      }}
                    >
                      {s.title}
                      <span className="mt-0.5 block text-xs text-muted-foreground">{s.voteCount} votes</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <DialogFooter>
            {similar.length > 0 ? (
              <Button type="button" variant="outline" disabled={pending} onClick={() => void submit(true)}>
                Create new request anyway
              </Button>
            ) : null}
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Submit request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
