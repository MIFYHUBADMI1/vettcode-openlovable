"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, ListChecks, Plus, Check, RotateCcw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Growth tasks panel (Phase 5 — W4). Client surface on the tasks route.
 *
 * A MANUAL to-do list the founder works through. It creates tasks (self-authored
 * or seeded from a rule-based next step), and moves them between open/done/
 * dismissed — all through the ownership-gated, flag-gated endpoint. Nothing here
 * schedules or runs anything: there is no job substrate, and a task is never a
 * measured result. AI-proposed tasks arrive separately via the approval-gated
 * co-founder tool (`propose_growth_task`), not from this form.
 */

export interface GrowthTaskView {
  id: string
  title: string
  detail: string | null
  status: "open" | "done" | "dismissed"
  priority: "low" | "medium" | "high"
  dueAt: number | null
  origin: "ai_generated" | "user_created" | "next_step_seed"
  sourceNextStepId: string | null
  createdAt: number
  updatedAt: number
  completedAt: number | null
}

export interface NextStepSeed {
  id: string
  kind: string
  title: string
  detail: string
  executed: false
  navigation: { target: string; projectId: string } | null
}

export interface GrowthTasksState {
  enabled: boolean
  tasks: GrowthTaskView[]
  nextSteps: NextStepSeed[]
}

const PRIORITIES: Array<GrowthTaskView["priority"]> = ["low", "medium", "high"]

function formatDue(dueAt: number | null): string | null {
  if (dueAt === null) return null
  const d = new Date(dueAt)
  if (!Number.isFinite(d.getTime())) return null
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function GrowthTasksPanel({ projectId, state }: { projectId: string; state: GrowthTasksState }) {
  const router = useRouter()
  const [tasks, setTasks] = useState<GrowthTaskView[]>(state.tasks)
  const [title, setTitle] = useState("")
  const [priority, setPriority] = useState<GrowthTaskView["priority"]>("medium")
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const open = tasks.filter((t) => t.status === "open")
  const done = tasks.filter((t) => t.status === "done")
  const dismissed = tasks.filter((t) => t.status === "dismissed")

  async function createTask(body: Record<string, unknown>, resetTitle = false) {
    setCreating(true)
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/tasks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await response.json()
      if (!response.ok || !json.ok) {
        toast.error(json?.error?.message ?? "The task couldn't be added.")
        return
      }
      setTasks((prev) => [json.data as GrowthTaskView, ...prev])
      if (resetTitle) {
        setTitle("")
        setPriority("medium")
      }
      toast.success("Task added.")
    } catch {
      toast.error("The task couldn't be added. Please try again.")
    } finally {
      setCreating(false)
    }
  }

  async function addOwnTask() {
    const trimmed = title.trim()
    if (trimmed.length < 3) {
      toast.error("Give the task a short title (at least 3 characters).")
      return
    }
    await createTask({ title: trimmed, priority, origin: "user_created" }, true)
  }

  async function seedFromNextStep(step: NextStepSeed) {
    await createTask({ title: step.title, detail: step.detail, origin: "next_step_seed", sourceNextStepId: step.id })
  }

  async function setStatus(task: GrowthTaskView, status: GrowthTaskView["status"]) {
    setBusyId(task.id)
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/tasks`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: task.id, status }),
      })
      const json = await response.json()
      if (!response.ok || !json.ok) {
        toast.error(json?.error?.message ?? "That change didn't save.")
        return
      }
      const updated = json.data as GrowthTaskView
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      router.refresh()
    } catch {
      toast.error("That change didn't save.")
    } finally {
      setBusyId(null)
    }
  }

  if (!state.enabled) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Growth tasks</h2>
        <p className="rounded-2xl border border-dashed border-border bg-transparent p-5 text-sm leading-6 text-muted-foreground">
          Growth tasks are not enabled for this account yet.
        </p>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <ListChecks className="h-5 w-5 text-primary" /> Growth tasks
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          A manual list of the next actions for this project. Tasks are
          to-dos you work through yourself — nothing here runs on a schedule, and completing a task is
          never a measured result. The AI co-founder can also propose a task, which you approve before it lands.
        </p>
      </div>

      {/* Create row */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task — e.g. Publish the landing page hero copy"
          className="w-full rounded-xl border border-border bg-transparent p-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={
                  "rounded-full border px-3 py-1 text-xs capitalize transition-colors " +
                  (priority === p ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")
                }
              >
                {p}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={addOwnTask} disabled={creating || title.trim().length < 3}>
            {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Add task
          </Button>
        </div>
      </div>

      {/* Open tasks */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-muted-foreground">To do ({open.length})</h3>
        {open.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-5 text-sm leading-6 text-muted-foreground">
            No open tasks. Add one above, turn a suggested next step into a task, or ask your co-founder to propose one.
          </p>
        ) : (
          open.map((t) => <TaskRow key={t.id} task={t} busy={busyId === t.id} onSetStatus={setStatus} />)
        )}
      </div>

      {/* Suggested next steps (rule-based seed) */}
      {state.nextSteps.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Sparkles className="h-4 w-4" /> Suggested next steps
          </h3>
          <p className="text-xs leading-5 text-muted-foreground">
            Derived from your project's observed state. These are suggestions, not actions Atai has taken.
          </p>
          {state.nextSteps.map((s) => (
            <div key={s.id} className="flex flex-col gap-2 rounded-2xl border border-dashed border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{s.detail}</p>
                </div>
              </div>
              <div>
                <Button size="sm" variant="outline" onClick={() => seedFromNextStep(s)} disabled={creating}>
                  <Plus className="mr-2 h-4 w-4" /> Add as task
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Completed */}
      {done.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Completed ({done.length})</h3>
          {done.map((t) => <TaskRow key={t.id} task={t} busy={busyId === t.id} onSetStatus={setStatus} />)}
        </div>
      ) : null}

      {/* Dismissed */}
      {dismissed.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Dismissed ({dismissed.length})</h3>
          {dismissed.map((t) => <TaskRow key={t.id} task={t} busy={busyId === t.id} onSetStatus={setStatus} />)}
        </div>
      ) : null}
    </section>
  )
}

function TaskRow({
  task,
  busy,
  onSetStatus,
}: {
  task: GrowthTaskView
  busy: boolean
  onSetStatus: (task: GrowthTaskView, status: GrowthTaskView["status"]) => void
}) {
  const due = formatDue(task.dueAt)
  const originLabel =
    task.origin === "ai_generated" ? "AI-proposed" : task.origin === "next_step_seed" ? "From a next step" : "You added"
  return (
    <article className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={task.status === "done" ? "font-medium text-muted-foreground line-through" : "font-medium"}>
          {task.title}
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 capitalize text-muted-foreground">{task.priority}</span>
        {due ? <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">due {due}</span> : null}
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{originLabel}</span>
      </div>
      {task.detail ? <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{task.detail}</p> : null}
      <div className="flex gap-2">
        {task.status !== "done" ? (
          <Button size="sm" variant="outline" onClick={() => onSetStatus(task, "done")} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Mark done
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => onSetStatus(task, "open")} disabled={busy}>
            <RotateCcw className="mr-2 h-4 w-4" /> Reopen
          </Button>
        )}
        {task.status !== "dismissed" ? (
          <Button size="sm" variant="ghost" onClick={() => onSetStatus(task, "dismissed")} disabled={busy}>
            Dismiss
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => onSetStatus(task, "open")} disabled={busy}>
            Restore
          </Button>
        )}
      </div>
    </article>
  )
}
