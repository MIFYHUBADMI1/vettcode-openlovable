export type BrowserSpeechRecognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

export type BrowserSpeechRecognitionEvent = {
  results: {
    length: number
    [index: number]: {
      isFinal: boolean
      0?: { transcript?: string }
    }
  }
}

export function getBrowserSpeechRecognition(): (new () => BrowserSpeechRecognition) | null {
  if (typeof window === "undefined") return null
  const w = window as Window & {
    SpeechRecognition?: new () => BrowserSpeechRecognition
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function browserSpeechBlockedReason(): string | null {
  if (typeof window === "undefined") return "Voice dictation isn’t available here."
  if (!window.isSecureContext) {
    return "Voice dictation needs a secure page (https or localhost)."
  }
  if (!getBrowserSpeechRecognition()) {
    return "Voice dictation isn’t supported in this browser. Use Chrome, Edge, or Safari."
  }
  return null
}

export function transcriptFromSpeechEvent(event: BrowserSpeechRecognitionEvent): { finalText: string; interimText: string } {
  let finalText = ""
  let interimText = ""
  for (let i = 0; i < event.results.length; i += 1) {
    const result = event.results[i]
    const piece = result?.[0]?.transcript ?? ""
    if (result?.isFinal) finalText += piece
    else interimText += piece
  }
  return { finalText: finalText.replace(/\s+/g, " ").trim(), interimText: interimText.replace(/\s+/g, " ").trim() }
}

export function joinSpoken(base: string, spoken: string): string {
  const a = base.trim()
  const b = spoken.trim()
  if (!b) return a
  if (!a) return b
  return `${a} ${b}`
}

export function speechRecognitionErrorMessage(code: string): string | null {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access was blocked. Allow it in the browser, then tap voice again."
    case "audio-capture":
      return "No microphone was found. Plug one in or check system settings."
    case "network":
      return "Voice dictation needs a network connection in this browser."
    case "aborted":
    case "no-speech":
      return null
    default:
      return "Voice dictation stopped. Try again."
  }
}
