"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { chunkForSpeech, speechTextFromMarkdown } from "@/lib/client/speech-text"

/**
 * Read-aloud for co-founder replies, on the browser's own speech engine
 * (`window.speechSynthesis`) — no library, no server round-trip, no credits.
 */
export interface SpeechReadout {
  /** False when the browser has no speech synthesis at all. */
  supported: boolean
  /** id of the message currently being spoken, else null. */
  speakingId: string | null
  /** Speak this message, or stop it if it is already speaking. False when the
   * reply holds nothing a voice could read. */
  toggle: (id: string, markdown: string) => boolean
  stop: () => void
}

function readVoices(): SpeechSynthesisVoice[] {
  try {
    return window.speechSynthesis.getVoices() ?? []
  } catch {
    return []
  }
}

/** Prefer a natural-sounding voice in the founder's own language. */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null
  const lang = (navigator.language || "en-US").toLowerCase()
  const base = lang.slice(0, 2)
  const matching = voices.filter((v) => (v.lang || "").toLowerCase().startsWith(base))
  const pool = matching.length ? matching : voices
  const score = (v: SpeechSynthesisVoice) => {
    const name = `${v.name} ${v.voiceURI}`.toLowerCase()
    let points = 0
    if (/natural|neural|premium|enhanced|google|siri/.test(name)) points += 3
    if (name.includes(base)) points += 1
    if (v.localService) points += 1
    return points
  }
  return [...pool].sort((a, b) => score(b) - score(a))[0] ?? null
}

export function useSpeechReadout(): SpeechReadout {
  const [supported, setSupported] = useState(false)
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const speakingRef = useRef(false)
  // Browsers fire end/error on the utterances `cancel()` throws away, so each
  // read gets a generation number and only the newest one may clear the UI.
  const generationRef = useRef(0)
  const keepAliveRef = useRef<number | null>(null)

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window)
  }, [])

  const clear = useCallback(() => {
    speakingRef.current = false
    setSpeakingId(null)
    if (keepAliveRef.current !== null) {
      window.clearInterval(keepAliveRef.current)
      keepAliveRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    generationRef.current += 1
    if (!supported) return
    try {
      window.speechSynthesis.cancel()
    } catch {
      // Nothing queued — the engine just isn't cooperating.
    }
    clear()
  }, [supported, clear])

  // Leaving the panel (or the conversation) must not leave a reply talking.
  useEffect(() => () => stop(), [stop])

  const toggle = useCallback(
    (id: string, markdown: string) => {
      if (!supported) return false
      if (speakingRef.current && speakingId === id) {
        stop()
        return true
      }
      const text = speechTextFromMarkdown(markdown)
      const chunks = chunkForSpeech(text)
      if (!chunks.length) return false

      try {
        window.speechSynthesis.cancel()
      } catch {
        // Ignore — the queue is empty anyway.
      }
      const generation = ++generationRef.current
      const mine = () => generationRef.current === generation && speakingRef.current

      const voice = pickVoice(readVoices())
      const lang = voice?.lang || navigator.language || "en-US"
      const utterances = chunks.map((chunk) => {
        const utterance = new SpeechSynthesisUtterance(chunk)
        if (voice) utterance.voice = voice
        utterance.lang = lang
        utterance.rate = 1
        utterance.pitch = 1
        return utterance
      })

      speakingRef.current = true
      setSpeakingId(id)
      if (keepAliveRef.current !== null) window.clearInterval(keepAliveRef.current)
      // Chrome stops a long utterance after ~10s without firing any event and
      // the limit isn't exposed. Nudging pause/resume keeps it talking; speech
      // is already split into sentences, so this is belt and braces.
      keepAliveRef.current = window.setInterval(() => {
        if (!mine()) return
        try {
          const synth = window.speechSynthesis
          if (!synth.speaking || synth.paused) return
          synth.pause()
          synth.resume()
        } catch {
          // Keep-alive is best effort.
        }
      }, 7000)

      // Only the last chunk's end means the message finished; earlier ones hand
      // over to the next utterance in the queue.
      const final = utterances[utterances.length - 1]
      final.onend = () => {
        if (mine()) clear()
      }
      // An error anywhere in the queue abandons the rest, so every chunk needs
      // to release the "speaking" state — otherwise the button stays lit on a
      // reply the engine walked away from.
      for (const utterance of utterances) {
        utterance.onerror = () => {
          if (mine()) clear()
        }
      }

      try {
        for (const utterance of utterances) window.speechSynthesis.speak(utterance)
      } catch {
        clear()
        return false
      }
      return true
    },
    [supported, speakingId, stop, clear],
  )

  // Chrome populates getVoices() asynchronously; nothing to wait for beyond
  // making sure the first read isn't left with an empty list.
  useEffect(() => {
    if (!supported) return
    const warm = () => readVoices()
    try {
      window.speechSynthesis.addEventListener("voiceschanged", warm)
      return () => window.speechSynthesis.removeEventListener("voiceschanged", warm)
    } catch {
      return undefined
    }
  }, [supported])

  return { supported, speakingId, toggle, stop }
}
