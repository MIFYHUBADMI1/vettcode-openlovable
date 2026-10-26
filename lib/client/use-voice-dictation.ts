"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  appendFinal,
  browserSpeechBlockedReason,
  getBrowserSpeechRecognition,
  readSpeechEvent,
  speechRecognitionErrorMessage,
  type BrowserSpeechRecognition,
} from "@/lib/start/browser-speech"

export interface VoiceDictationControls {
  listening: boolean
  /** Unfinished utterance — render as a live preview, never inside the field. */
  partial: string
  /** 0–1 microphone level for audio-reactive UI. */
  level: number
  error: string | null
  toggle: () => void
  stop: () => void
  /** Textarea onChange — re-anchors dictation when the user edits mid-sentence. */
  typeText: (next: string) => void
}

/**
 * Browser dictation for a controlled text field.
 *
 * Uses the browser's SpeechRecognition (Chrome, Edge, Safari) — no server
 * round-trip and no provider credits. Each phrase lands in the field as soon
 * as it is finalized, while a separate mic meter drives the live animation.
 * Mirrors the landing composer's behavior so both composers feel identical.
 */
export function useVoiceDictation({
  value,
  setValue,
}: {
  value: string
  setValue: (next: string) => void
}): VoiceDictationControls {
  const [listening, setListening] = useState(false)
  const [partial, setPartial] = useState("")
  const [level, setLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const valueRef = useRef(value)
  valueRef.current = value
  const setValueRef = useRef(setValue)
  setValueRef.current = setValue

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const listeningRef = useRef(false)
  const baseRef = useRef("")
  const fromDictationRef = useRef(false)
  const silentRef = useRef(false)
  const samplesRef = useRef<number[]>([])
  const rafRef = useRef<number | null>(null)
  const closeMeterRef = useRef<(() => void) | null>(null)

  const stopMeter = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    closeMeterRef.current?.()
    closeMeterRef.current = null
    samplesRef.current = []
    setLevel(0)
  }, [])

  const startMeter = useCallback(async () => {
    // Independent of the recognition service: proves the mic actually hears
    // the user and drives the audio-reactive animation. Best-effort by design.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      const ctx = new Ctor()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.7
      source.connect(analyser)
      const buffer = new Uint8Array(analyser.frequencyBinCount)
      closeMeterRef.current = () => {
        stream.getTracks().forEach((track) => track.stop())
        void ctx.close().catch(() => {})
      }
      const tick = () => {
        analyser.getByteFrequencyData(buffer)
        let sum = 0
        for (let i = 0; i < buffer.length; i += 1) sum += buffer[i] * buffer[i]
        const rms = Math.sqrt(sum / buffer.length) / 255
        const samples = samplesRef.current
        samples.push(rms)
        if (samples.length > 28) samples.shift()
        if (listeningRef.current) setLevel(rms)
        const avg = samples.reduce((acc, value) => acc + value, 0) / samples.length
        if (!listeningRef.current && avg < 0.01 && samples.length >= 20) {
          silentRef.current = true
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch {
      // Meter unavailable (second stream denied, unsupported context).
      // Dictation still runs on the browser's own capture.
    }
  }, [])

  const stop = useCallback(() => {
    listeningRef.current = false
    setListening(false)
    setPartial("")
    stopMeter()
    try {
      recognitionRef.current?.stop()
    } catch {
      recognitionRef.current?.abort()
    }
  }, [stopMeter])

  const toggle = useCallback(() => {
    if (listeningRef.current) {
      stop()
      return
    }
    const blocked = browserSpeechBlockedReason()
    if (blocked) {
      setError(blocked)
      return
    }
    const SpeechRecognition = getBrowserSpeechRecognition()
    if (!SpeechRecognition) {
      setError("Voice dictation isn’t supported in this browser. Use Chrome, Edge, or Safari.")
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = navigator.language || "en-US"
    // continuous=false + fast restart is the reliable dictation pattern: Chrome
    // finalizes each utterance quickly instead of batching until session end.
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    baseRef.current = valueRef.current.trimEnd()
    silentRef.current = false
    let endedNaturally = false

    recognition.onresult = (event) => {
      const { finalized, partial: nextPartial } = readSpeechEvent(event)
      for (const piece of finalized) {
        fromDictationRef.current = true
        baseRef.current = appendFinal(baseRef.current, piece)
        setValueRef.current(baseRef.current)
      }
      setPartial(nextPartial)
    }
    recognition.onerror = (event) => {
      if (event.error === "no-speech") {
        silentRef.current = true
        return
      }
      if (event.error === "aborted") return
      endedNaturally = true
      const message = speechRecognitionErrorMessage(event.error)
      listeningRef.current = false
      setListening(false)
      setPartial("")
      stopMeter()
      if (message) setError(message)
    }
    recognition.onend = () => {
      if (endedNaturally) return
      setPartial("")
      if (!listeningRef.current) {
        stopMeter()
        return
      }
      // This burst produced no speech and the meter heard nothing either —
      // stop with guidance instead of restarting forever.
      if (silentRef.current && samplesRef.current.every((sample) => sample < 0.01)) {
        listeningRef.current = false
        setListening(false)
        stopMeter()
        setError("Didn’t catch that. Check your microphone and speak a little closer, then tap the mic again.")
        return
      }
      // Restart immediately so dictation carries across pauses.
      try {
        recognition.start()
      } catch {
        listeningRef.current = false
        setListening(false)
        stopMeter()
        setError("Voice dictation stopped. Tap the mic to try again.")
      }
    }

    recognitionRef.current = recognition
    listeningRef.current = true
    setError(null)
    setListening(true)
    setPartial("")
    void startMeter()
    try {
      recognition.start()
    } catch {
      listeningRef.current = false
      setListening(false)
      stopMeter()
      setError("Couldn’t start the microphone. Try again.")
    }
  }, [startMeter, stop, stopMeter])

  const typeText = useCallback((next: string) => {
    if (!fromDictationRef.current && listeningRef.current) {
      baseRef.current = next.trimEnd()
    }
    fromDictationRef.current = false
    setValueRef.current(next)
  }, [])

  useEffect(() => stop, [stop])

  return { listening, partial, level, error, toggle, stop, typeText }
}
