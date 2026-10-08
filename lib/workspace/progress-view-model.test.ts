import { describe, expect, it } from "vitest"
import type { Project, ProjectEvent } from "@/lib/types/project"
import { buildProgressViewModel, failureMessage, WORKSTREAM_STATUS_LABEL } from "./progress-view-model"

function project(partial: Partial<Project>): Project {
  return {
    id: "p1",
    userId: "u1",
    mode: "scratch",
    name: "MarketFlow",
    state: "created",
    events: [],
    conversation: [],
    deployment: { id: "d", status: "idle", updatedAt: 0 },
    deploymentHistory: [],
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  }
}

function event(partial: Partial<ProjectEvent> & { message: string }): ProjectEvent {
  return { id: Math.random().toString(36).slice(2), at: 1_000, level: "info", stage: "build", ...partial }
}

describe("progress view model", () => {
  it("maps known lifecycle states to honest workstream statuses", () => {
    const building = buildProgressViewModel(project({ state: "building", specification: {} as Project["specification"] }))
    expect(building.now.state).toBe("working")
    expect(building.live).toBe(true)
    expect(building.now.workstream).toBe("engineering")

    const planReady = buildProgressViewModel(project({ state: "plan_ready" }))
    expect(planReady.now.state).toBe("waiting_on_you")
    expect(planReady.workstreams.find((w) => w.id === "cofounder")?.status).toBe("waiting_on_you")

    const ready = buildProgressViewModel(project({ state: "ready", totalumProjectId: "t1", developmentUrl: "https://preview.example" }))
    expect(ready.now.state).toBe("idle")
    expect(ready.workstreams.find((w) => w.id === "launch")?.status).toBe("waiting_on_you")
  })

  it("handles unknown and legacy states without crashing", () => {
    const unknown = buildProgressViewModel(project({ state: "mystery_state" as Project["state"] }))
    expect(unknown.stateKnown).toBe(false)
    expect(unknown.now.state).toBe("unavailable")
    for (const stream of unknown.workstreams) {
      expect(stream.status).toBe("status_unavailable")
    }
  })

  it("never derives activity status from event counts", () => {
    const noisy = buildProgressViewModel(
      project({ state: "ready", events: Array.from({ length: 50 }, (_, i) => event({ message: `Update ${i}`, stage: "build" })) }),
    )
    const quiet = buildProgressViewModel(project({ state: "ready" }))
    expect(noisy.now.state).toBe(quiet.now.state)
    expect(noisy.now.state).not.toBe("working")
  })

  it("does not treat empty events as failure or forced inactivity", () => {
    const empty = buildProgressViewModel(project({ state: "plan_ready", events: [] }))
    expect(empty.now.state).toBe("waiting_on_you")
    expect(empty.history).toEqual([])
  })

  it("surfaces failed builds as needing attention, with the real failure event", () => {
    const failing = buildProgressViewModel(
      project({
        state: "build_failed",
        events: [event({ message: "The build ran out of time", level: "error", stage: "build", at: 5_000 })],
      }),
    )
    expect(failing.now.state).toBe("needs_attention")
    expect(failing.history[0]?.kind).toBe("failure")
    // failureMessage must replay the failure message from the same events;
    // verify it surfaces the known failure rather than being empty.
    const withEvents = project({
      state: "build_failed",
      events: failing.history.map((h) =>
        event({ message: h.message, level: h.kind === "failure" ? "error" : "info", stage: "build", at: h.at }),
      ),
    })
    expect(failureMessage(withEvents.events, "build_failed")).toBeTruthy()
  })

  it("does not let a superseded failure define the current state", () => {
    const recovered = buildProgressViewModel(
      project({
        state: "ready",
        totalumProjectId: "t1",
        events: [event({ message: "Build failed earlier", level: "error", stage: "build", at: 500 })],
      }),
    )
    expect(recovered.now.state).not.toBe("needs_attention")
    // The historical failure stays visible in history, hidden from Now.
    expect(recovered.history).toHaveLength(1)
  })

  it("requires a real preview before claiming validation completed", () => {
    // A project that is ready with a successful deployment but no preview must
    // NOT have its validate stage marked complete — deployment is not proof of
    // validation.
    const noPreview = buildProgressViewModel(
      project({
        state: "ready",
        totalumProjectId: "t1",
        deploymentHistory: [
          { id: "h", startedAt: 1, status: "success", productionUrl: "https://live.example" },
        ],
      }),
    )
    expect(
      noPreview.journey.find((s) => s.id === "validate")?.status,
    ).not.toBe("complete")

    // The same state with a real preview has validate evidence and stays
    // active (review not yet finished) rather than falsely complete.
    const withPreview = buildProgressViewModel(
      project({
        state: "ready",
        totalumProjectId: "t1",
        developmentUrl: "https://preview.example",
      }),
    )
    const validate = withPreview.journey.find((s) => s.id === "validate")
    expect(validate?.status).toBe("active")
    expect(validate?.evidence).toEqual({
      label: "Review the preview",
      href: "https://preview.example",
    })
  })

  it("keeps missing optional artifacts out of deliverables instead of erroring", () => {
    const minimal = buildProgressViewModel(project({ state: "created" }))
    expect(minimal.deliverables).toEqual([])
    expect(minimal.journey.every((s) => s.evidence === null || typeof s.evidence.href === "string")).toBe(true)
  })

  it("shows founder actions only when the existing next-step logic demands them", () => {
    const waiting = buildProgressViewModel(project({ state: "plan_ready", specification: {} as Project["specification"] }))
    expect(waiting.attention.length).toBeGreaterThan(0)
    expect(waiting.attention[0]?.action?.href).toBe("/project/p1/collaborate")

    const calm = buildProgressViewModel(project({ state: "building" }))
    expect(calm.attention).toEqual([])
  })

  it("does not invent workstream activity without structured evidence", () => {
    const clean = buildProgressViewModel(project({ state: "created" }))
    // A freshly created project has no meaningful events, so every workstream
    // should report no note.
    for (const stream of clean.workstreams) {
      expect(stream.latestNote).toBeNull()
    }
    // Even with a known state but no events attributable to a stream, that
    // stream must not invent a note.
    const ready = buildProgressViewModel(
      project({ state: "ready", totalumProjectId: "t1" }),
    )
    const launch = ready.workstreams.find((w) => w.id === "launch")
    expect(launch?.latestNote).toBeNull()
  })

  it("rejects a deployment as proof of validation in the journey", () => {
    const live = buildProgressViewModel(
      project({ state: "deployed", deploymentHistory: [{ id: "h", startedAt: 1, status: "success", productionUrl: "https://live.example" }] }),
    )
    expect(live.journey.find((s) => s.id === "launch")?.status).toBe("complete")
    // Without any preview evidence, validation is not marked complete by deployment.
    const validation = live.journey.find((s) => s.id === "validate")
    expect(validation?.status === "complete").toBe(Boolean(live && validation?.evidence))
  })

  it("tracks data freshness from meaningful events", () => {
    const fresh = buildProgressViewModel(
      project({ state: "building", events: [event({ message: "Build started", at: 9_000 })] }),
    )
    expect(fresh.lastUpdatedAt).toBe(9_000)
  })

  it("treats empty events during a live build as working, not idle", () => {
    const building = buildProgressViewModel(project({ state: "building", events: [] }))
    expect(building.now.state).toBe("working")
    expect(building.workstreams.find((w) => w.id === "engineering")?.status).toBe("working")
  })

  it("displays working as the founder-facing form of at_work", () => {
    expect(WORKSTREAM_STATUS_LABEL.working).toBe("Working")
  })

  it("does not show a retry page action that the app does not have", () => {
    const failed = buildProgressViewModel(project({ state: "build_failed" }))
    expect(failed.attention[0]?.mutation).toBe("retry_build")
    expect(failed.attention[0]?.action).toBeNull()
  })

  it("does not treat historical build events as live work", () => {
    const ready = buildProgressViewModel(
      project({
        state: "ready",
        totalumProjectId: "t1",
        events: [event({ message: "Build started", stage: "build", at: 1 })],
      }),
    )
    expect(ready.now.state).not.toBe("working")
    expect(ready.activeBuildRun).toBeNull()
  })

  it("does not duplicate handoffs for the same phase transition", () => {
    const model = buildProgressViewModel(
      project({
        state: "building",
        specification: {} as Project["specification"],
        events: [
          event({ id: "e1", message: "Plan ready", stage: "plan", at: 1 }),
          event({ id: "e2", message: "Build started", stage: "build", at: 2 }),
          event({ id: "e3", message: "Still building", stage: "build", at: 3 }),
        ],
      }),
    )
    const keys = model.handoffs.map((h) => `${h.from}->${h.to}`)
    expect(keys.length).toBe(new Set(keys).size)
  })

  it("keeps all navigation on the same project id", () => {
    const model = buildProgressViewModel(
      project({
        id: "p1",
        state: "plan_ready",
        idea: "Tutors",
        specification: {} as Project["specification"],
      }),
    )
    for (const item of [...model.deliverables, ...model.founderControls]) {
      if (item.href && item.href.startsWith("/")) expect(item.href).toContain("/p1")
    }
    for (const stream of model.workstreams) {
      if (stream.action?.href.startsWith("/")) expect(stream.action.href).toContain("/p1")
    }
  })

  it("does not put secrets or stacks into founder history", () => {
    const model = buildProgressViewModel(
      project({
        state: "building",
        events: [
          event({ message: "Using key sk-abcdefghijklmnopqrstuvwxyz", stage: "build" }),
          event({ message: "The initial application build completed.", stage: "build", at: 2 }),
        ],
      }),
    )
    expect(model.history.some((h) => /sk-/.test(h.message))).toBe(false)
  })

  it("shows the founder's own idea and notes as the controls teams follow", () => {
    const empty = buildProgressViewModel(project({ state: "created" }))
    expect(empty.founderControls).toEqual([])
    const set = buildProgressViewModel(
      project({
        state: "plan_ready",
        idea: "A marketplace for local tutors",
        preferences: { additionalNotes: "Keep it simple" },
        conversation: [{ id: "m1", role: "user", content: "Focus on parents first", at: 1 }],
      }),
    )
    expect(set.founderControls.some((c) => c.value.includes("marketplace"))).toBe(true)
    expect(set.founderControls.some((c) => c.value.includes("Keep it simple"))).toBe(true)
    expect(set.founderControls.some((c) => c.value.includes("parents"))).toBe(true)
  })

  it("only offers engineering a build command when the backend can start a build", () => {
    const idle = buildProgressViewModel(project({ state: "created" }))
    expect(idle.workstreams.find((w) => w.id === "engineering")?.command?.kind).not.toBe("mutation")
    const readyToBuild = buildProgressViewModel(
      project({ state: "specification_ready", specification: {} as Project["specification"] }),
    )
    expect(readyToBuild.workstreams.find((w) => w.id === "engineering")?.command).toMatchObject({
      kind: "mutation",
      mutation: "build",
    })
  })

  it("exposes start-build mutation only when next-step logic requires it", () => {
    const waiting = buildProgressViewModel(project({ state: "specification_ready", specification: {} as Project["specification"] }))
    expect(waiting.attention[0]?.mutation).toBe("build")
    const live = buildProgressViewModel(project({ state: "building" }))
    expect(live.attention).toEqual([])
  })

  it("does not treat Growth as a live workstream", () => {
    const live = buildProgressViewModel(project({ state: "deployed" }))
    expect(live.workstreams.some((w) => /growth/i.test(w.name))).toBe(false)
  })
})
