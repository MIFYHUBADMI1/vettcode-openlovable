import { describe, expect, it } from "vitest"
import {
  joinSpoken,
  speechRecognitionErrorMessage,
  transcriptFromSpeechEvent,
} from "@/lib/start/browser-speech"

describe("browser speech", () => {
  it("splits final and interim transcripts", () => {
    expect(
      transcriptFromSpeechEvent({
        results: {
          length: 2,
          0: { isFinal: true, 0: { transcript: "Build a booking app" } },
          1: { isFinal: false, 0: { transcript: " for clinics" } },
        },
      }),
    ).toEqual({ finalText: "Build a booking app", interimText: "for clinics" })
  })

  it("appends spoken text to an existing prompt", () => {
    expect(joinSpoken("Build a SaaS", "for clinics")).toBe("Build a SaaS for clinics")
    expect(joinSpoken("", "hello")).toBe("hello")
  })

  it("explains permission and hardware errors, ignores no-speech", () => {
    expect(speechRecognitionErrorMessage("not-allowed")).toMatch(/Microphone/)
    expect(speechRecognitionErrorMessage("audio-capture")).toMatch(/microphone/i)
    expect(speechRecognitionErrorMessage("no-speech")).toBeNull()
    expect(speechRecognitionErrorMessage("aborted")).toBeNull()
  })
})
