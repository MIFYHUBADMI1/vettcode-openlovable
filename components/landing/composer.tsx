"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowUp,
  AtSign,
  Brain,
  ChevronRight,
  Code2,
  FileText,
  GitBranch,
  Globe,
  Lightbulb,
  Link2,
  Loader2,
  Mic,
  Paperclip,
  Search,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Wrench,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  trackStartMethodSelected,
  trackStartSubmitted,
  trackStartValidationFailed,
} from "@/lib/analytics/start-funnel"
import { useAuthModal } from "@/components/auth/auth-provider"
import { useSession } from "@/lib/client/api"
import { savePendingStart } from "@/lib/auth/client-intent"
import {
  detectIntentChips,
  detectStartMode,
  MAX_PROJECT_TITLE_LENGTH,
  suggestProjectTitle,
  validateProjectTitle,
  type StartMode,
  validateStartInput,
  promptForStart,
} from "@/lib/start/detect-input"
import {
  DEFAULT_COMPOSER_PREFS,
  loadComposerPrefs,
  saveComposerPrefs,
  type ComposerAttachment,
} from "@/lib/start/composer-prefs"
import {
  appendFinal,
  browserSpeechBlockedReason,
  getBrowserSpeechRecognition,
  readSpeechEvent,
  speechRecognitionErrorMessage,
  type BrowserSpeechRecognition,
} from "@/lib/start/browser-speech"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

const MODES: {
  id: StartMode
  title: string
  support: string
  placeholder: string
  example: string
  pills: string[]
  icon: typeof Lightbulb
}[] = [
  {
    id: "idea",
    title: "Idea",
    support: "Start with an idea. Atai will help turn it into a real business and product.",
    placeholder: "Describe the business in your own words — the problem, who it's for, what should exist.",
    example: "Example: “A platform that helps small clinics manage bookings, patients, and payments in one place.”",
    pills: [
      "Build an MVP for my idea",
      "Turn my business idea into a product",
      "Create a booking platform for clinics",
    ],
    icon: Lightbulb,
  },
  {
    id: "website",
    title: "Mirror",
    support: "Give Atai a reference site and describe what you want to create from it.",
    placeholder: "Paste a website you want Atai to understand as a starting point...",
    example: "Example: “https://linear.app — build a version of this experience for my business.”",
    pills: ["Recreate this experience", "Improve this product for my market"],
    icon: Globe,
  },
  {
    id: "url",
    title: "URL",
    support: "Atai will use the website as context for your request.",
    placeholder: "Paste a URL and tell Atai what to do with it...",
    example: "Example: “https://example.com — analyze this site and help me build something better.”",
    pills: ["Analyze a website", "Build from this URL"],
    icon: Link2,
  },
  {
    id: "github",
    title: "GitHub",
    support: "Let Atai understand an existing codebase and work from it.",
    placeholder: "Paste a GitHub repository URL...",
    example: "Example: “https://github.com/vercel/next.js — understand this codebase and help me productize it.”",
    pills: ["Import a repository", "Extend an existing app"],
    icon: GitBranch,
  },
]

const TYPING_HINTS: Record<StartMode, string[]> = {
  idea: [
    "Describe the business in your own words — the problem, who it's for, what should exist.",
    "A booking platform for small clinics…",
    "A marketplace connecting local farmers with restaurants…",
    "An AI assistant for independent freelancers…",
  ],
  website: [
    "Paste a website you want Atai to understand as a starting point…",
    "https://linear.app — build a version of this experience for my business.",
    "https://www.doctolib.com — a booking platform for my market.",
  ],
  url: [
    "Paste a URL and tell Atai what to do with it…",
    "https://example.com — analyze this site and help me build something better.",
  ],
  github: [
    "Paste a GitHub repository URL…",
    "https://github.com/vercel/next.js — understand this codebase and help me productize it.",
  ],
}

const TYPE_CUES: Record<StartMode, string> = {
  idea: "Type your idea here",
  website: "Paste a website",
  url: "Paste a URL",
  github: "Paste a repo",
}

const AGENTS = [
  { id: "atai", name: "Atai", role: "AI Co-Founder", locked: true, icon: Brain },
  { id: "research", name: "Research & Strategy", role: "Market and competitor research", locked: false, icon: Search },
  { id: "product", name: "Product & Engineering", role: "Turn the idea into a working product", locked: false, icon: Code2 },
  { id: "growth", name: "Growth Team", role: "Launch, acquisition, and analytics", locked: false, icon: TrendingUp },
  { id: "funding", name: "Funding Support", role: "Prepare for fundraising when ready", locked: false, icon: Sparkles },
]

const TOOLS = [
  { id: "plan", name: "Plan", hint: "Structure the business and product" },
  { id: "research", name: "Research", hint: "Understand a market or website" },
  { id: "analyze", name: "Analyze", hint: "Inspect a URL, file, or repository" },
  { id: "design", name: "Design", hint: "Shape the product experience" },
  { id: "build", name: "Build", hint: "Create the first version" },
]

const AUTO_MODES = [
  { id: "auto", name: "Auto", hint: "Let Atai decide" },
  { id: "fast", name: "Fast", hint: "Quick tasks and answers" },
  { id: "think", name: "Think", hint: "More careful reasoning" },
  { id: "research", name: "Research", hint: "Research-heavy work" },
  { id: "build", name: "Build", hint: "Product and app creation" },
]

function resizeTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = "auto"
  el.style.height = `${Math.min(Math.max(el.scrollHeight, 88), 240)}px`
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function LandingComposer({
  lockedMode,
  showModes = true,
  showIntro = true,
  surface = "landing",
  className,
}: {
  lockedMode?: StartMode
  showModes?: boolean
  showIntro?: boolean
  /** Where the composer is mounted — keeps /new funnel events separate from the landing hero. */
  surface?: string
  className?: string
} = {}) {
  const router = useRouter()
  const { session } = useSession()
  const { openAuth } = useAuthModal()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const nameConfirmedRef = useRef(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const promptRef = useRef("")
  const titleTouchedRef = useRef(false)
  const listeningRef = useRef(false)
  const voiceBaseRef = useRef("")
  const fromDictationRef = useRef(false)
  const speechSilentRef = useRef(false)
  const levelSamplesRef = useRef<number[]>([])
  const levelRafRef = useRef<number | null>(null)
  const levelCloseRef = useRef<(() => void) | null>(null)

  const [prompt, setPrompt] = useState("")
  const [title, setTitle] = useState("")
  const [mode, setMode] = useState<StartMode>(lockedMode ?? "idea")
  const [agents, setAgents] = useState<string[]>(["atai"])
  const [tool, setTool] = useState<string | null>(null)
  const [auto, setAuto] = useState("auto")
  const [files, setFiles] = useState<ComposerAttachment[]>([])
  const [focused, setFocused] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [listening, setListening] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [nameDialogOpen, setNameDialogOpen] = useState(false)
  const [nameAttempted, setNameAttempted] = useState(false)
  const [dictationPartial, setDictationPartial] = useState("")
  const [speechLevel, setSpeechLevel] = useState(0)

  const active = MODES.find((item) => item.id === mode) ?? MODES[0]
  const hasPrompt = prompt.length > 0
  const detected = detectStartMode(prompt)
  const chips = useMemo(() => detectIntentChips(prompt, mode), [prompt, mode])
  const suggestedTitle = useMemo(() => suggestProjectTitle(mode, prompt), [mode, prompt])
  const nameError = title.trim().length > 0 ? validateProjectTitle(title) : null
  const canSend = prompt.trim().length > 0 && !submitting
  const autoLabel = AUTO_MODES.find((item) => item.id === auto)?.name ?? "Auto"
  const advancedCount = (agents.length > 1 ? 1 : 0) + (tool ? 1 : 0) + (auto !== "auto" ? 1 : 0)

  useEffect(() => {
    const prefs = loadComposerPrefs()
    setPrompt(prefs.prompt)
    if (prefs.title.trim()) {
      setTitle(prefs.title)
      titleTouchedRef.current = true
    }
    setMode(lockedMode ?? prefs.mode)
    setAgents(prefs.agents)
    setTool(prefs.tool)
    setAuto(prefs.auto)
    setFiles(prefs.files)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    saveComposerPrefs({ prompt, title, mode, agents, tool, auto, files })
  }, [hydrated, prompt, title, mode, agents, tool, auto, files])

  // Keep the name field a confirmed, prefilled input rather than a silent
  // derivation: until the user edits it, mirror the suggestion for the current
  // intent/mode. Once touched, the field is theirs.
  useEffect(() => {
    if (titleTouchedRef.current) return
    setTitle((current) => (current === suggestedTitle ? current : suggestedTitle))
  }, [suggestedTitle])

  useEffect(() => {
    promptRef.current = prompt
  }, [prompt])

  // Type an animated, mode-specific hint into the empty textarea so the field
  // reads as "type here" rather than another block of copy. DOM-driven to
  // avoid re-rendering the whole composer on every character.
  useEffect(() => {
    const el = textareaRef.current
    if (!el || hasPrompt) return

    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    if (reduceMotion) {
      el.placeholder = active.placeholder
      return
    }

    const phrases = TYPING_HINTS[mode] ?? TYPING_HINTS.idea
    let phraseIndex = 0
    let charIndex = 0
    let deleting = false
    let timer: number | undefined

    const tick = () => {
      const phrase = phrases[phraseIndex] ?? ""
      if (!deleting) {
        charIndex += 1
        el.placeholder = phrase.slice(0, charIndex)
        if (charIndex >= phrase.length) {
          deleting = true
          timer = window.setTimeout(tick, 1800)
          return
        }
        timer = window.setTimeout(tick, 34)
        return
      }
      charIndex -= 1
      el.placeholder = phrase.slice(0, Math.max(0, charIndex))
      if (charIndex <= 0) {
        deleting = false
        phraseIndex = (phraseIndex + 1) % phrases.length
        timer = window.setTimeout(tick, 320)
        return
      }
      timer = window.setTimeout(tick, 18)
    }

    el.placeholder = ""
    timer = window.setTimeout(tick, 420)
    return () => {
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [mode, hasPrompt, active.placeholder])

  useEffect(() => {
    resizeTextarea(textareaRef.current)
  }, [prompt])

  useEffect(() => () => {
    listeningRef.current = false
    recognitionRef.current?.abort()
    if (levelRafRef.current !== null) cancelAnimationFrame(levelRafRef.current)
    levelCloseRef.current?.()
  }, [])

  function requireAccount() {
    if (session) return true
    saveComposerPrefs({ prompt, title, mode, agents, tool, auto, files })
    openAuth("signup", { next: "/new/idea" })
    return false
  }

  function applyPrompt(next: string) {
    setPrompt(next)
    setError(null)
  }

  function selectMode(next: StartMode) {
    if (lockedMode) return
    setMode(next)
    setError(null)
    trackStartMethodSelected(next, surface)
  }

  function toggleAgent(id: string) {
    if (id === "atai") return
    if (!requireAccount()) return
    setAgents((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  function selectTool(id: string) {
    if (!requireAccount()) return
    setTool(id)
  }

  function selectAuto(id: string) {
    if (id !== "auto" && !requireAccount()) return
    setAuto(id)
  }

  function addFiles(list: FileList | null) {
    if (!requireAccount()) return
    if (!list?.length) return
    const next = Array.from(list).slice(0, 6).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      name: file.name,
      size: file.size,
    }))
    setFiles((current) => {
      const merged = [...current]
      for (const file of next) {
        if (!merged.some((item) => item.id === file.id)) merged.push(file)
      }
      return merged.slice(0, 6)
    })
  }

  function handlePromptChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const value = event.target.value
    if (!fromDictationRef.current) {
      // The user edited the text (or typed while dictating) — re-anchor
      // dictation so the next final segment appends after their edit.
      voiceBaseRef.current = listeningRef.current ? value.trimEnd() : ""
    }
    fromDictationRef.current = false
    applyPrompt(value)
  }

  function stopLevelMeter() {
    if (levelRafRef.current !== null) {
      cancelAnimationFrame(levelRafRef.current)
      levelRafRef.current = null
    }
    levelCloseRef.current?.()
    levelCloseRef.current = null
    levelSamplesRef.current = []
    setSpeechLevel(0)
  }

  async function startLevelMeter() {
    // Independent of the recognition service: proves the mic actually hears the
    // user and drives the audio-reactive animation. Best-effort by design.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
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
      levelCloseRef.current = () => {
        stream.getTracks().forEach((track) => track.stop())
        void ctx.close().catch(() => {})
      }
      const tick = () => {
        analyser.getByteFrequencyData(buffer)
        let sum = 0
        for (let i = 0; i < buffer.length; i += 1) sum += buffer[i] * buffer[i]
        const rms = Math.sqrt(sum / buffer.length) / 255
        const samples = levelSamplesRef.current
        samples.push(rms)
        if (samples.length > 28) samples.shift()
        if (listeningRef.current) setSpeechLevel(rms)
        const avg = samples.reduce((acc, value) => acc + value, 0) / samples.length
        if (!listeningRef.current && avg < 0.01 && samples.length >= 20) {
          speechSilentRef.current = true
        }
        levelRafRef.current = requestAnimationFrame(tick)
      }
      levelRafRef.current = requestAnimationFrame(tick)
    } catch {
      // Meter unavailable (permission denied for the second stream, unsupported
      // context). Dictation itself still runs on the browser's own capture.
    }
  }

  function stopVoice() {
    listeningRef.current = false
    setListening(false)
    setDictationPartial("")
    stopLevelMeter()
    try {
      recognitionRef.current?.stop()
    } catch {
      recognitionRef.current?.abort()
    }
  }

  function startVoice() {
    if (listeningRef.current) {
      stopVoice()
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
    // finalizes each utterance quickly instead of batching transcripts until the
    // session ends (the old bug: text appeared only after you stopped speaking).
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    voiceBaseRef.current = promptRef.current.trimEnd()
    speechSilentRef.current = false
    let endedNaturally = false

    recognition.onresult = (event) => {
      const { finalized, partial } = readSpeechEvent(event)
      for (const piece of finalized) {
        fromDictationRef.current = true
        const next = appendFinal(voiceBaseRef.current, piece)
        voiceBaseRef.current = next
        setPrompt(next)
      }
      setDictationPartial(partial)
    }
    recognition.onerror = (event) => {
      if (event.error === "no-speech") {
        speechSilentRef.current = true
        return
      }
      if (event.error === "aborted") return
      endedNaturally = true
      const message = speechRecognitionErrorMessage(event.error)
      listeningRef.current = false
      setListening(false)
      setDictationPartial("")
      stopLevelMeter()
      if (message) setError(message)
    }
    recognition.onend = () => {
      if (endedNaturally) return
      setDictationPartial("")
      if (!listeningRef.current) {
        stopLevelMeter()
        return
      }
      // This burst produced no speech and the meter heard nothing either —
      // stop cleanly with guidance instead of restarting forever.
      if (speechSilentRef.current && levelSamplesRef.current.every((value) => value < 0.01)) {
        listeningRef.current = false
        setListening(false)
        stopLevelMeter()
        setError("Didn’t catch that. Check your microphone and speak a little closer, then tap voice again.")
        return
      }
      // Restart immediately so dictation carries across pauses.
      try {
        recognition.start()
      } catch {
        listeningRef.current = false
        setListening(false)
        stopLevelMeter()
        setError("Voice dictation stopped. Tap voice to try again.")
      }
    }

    recognitionRef.current = recognition
    listeningRef.current = true
    setError(null)
    setListening(true)
    setDictationPartial("")
    void startLevelMeter()
    try {
      recognition.start()
    } catch {
      listeningRef.current = false
      setListening(false)
      stopLevelMeter()
      setError("Couldn’t start the microphone. Try again.")
    }
  }

  function startPending(nextMode: StartMode, savedTitle: string) {
    const saved = promptForStart(nextMode, prompt)
    const continueHref = "/start"
    savePendingStart({
      prompt: saved,
      title: savedTitle,
      href: continueHref,
      source: nextMode === "github" ? "landing_github" : nextMode === "website" ? "landing_mirror" : nextMode === "url" ? "landing_url" : "landing_idea",
      signalType: nextMode === "idea" ? "idea" : "url",
      mode: nextMode,
      pipelineMode: "heavy",
    })
    saveComposerPrefs({ prompt, title: savedTitle, mode: nextMode, agents, tool, auto, files })
    trackStartSubmitted({ method: nextMode, surface, authenticated: Boolean(session) })
    setSubmitting(true)
    if (!session) {
      // Both are dialogs — close the name popup before the sign-in modal opens.
      setNameDialogOpen(false)
      openAuth("signup", { next: continueHref, prompt: saved })
      setSubmitting(false)
      return
    }
    router.push(continueHref)
  }

  function confirmBusinessName() {
    const message = validateProjectTitle(title)
    if (message) {
      setNameAttempted(true)
      trackStartValidationFailed(mode, surface, "missing_title")
      return
    }
    nameConfirmedRef.current = true
    setNameDialogOpen(false)
    startPending(mode, title.trim())
  }

  function submit() {
    const message = validateStartInput(mode, prompt)
    if (message) {
      setError(message)
      trackStartValidationFailed(mode, surface, prompt.trim() ? "invalid_input" : "empty")
      return
    }
    // The business-name dialog runs before anything else — including the
    // sign-in modal — so the two never collide.
    if (!nameConfirmedRef.current) {
      setError(null)
      setNameDialogOpen(true)
      return
    }
    startPending(mode, title.trim())
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  const toolbarBtn =
    "inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  return (
    <form
      className={cn("lp-composer w-full min-w-0 px-0", showIntro && "max-w-xl", className)}
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      {showIntro ? (
        <>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Start with Atai</p>
          <h2 className="mt-1.5 text-base font-semibold tracking-tight sm:text-lg">Tell Atai what you want to build.</h2>
        </>
      ) : null}

      {showModes ? (
      <div
        role="tablist"
        aria-label="Starting point"
        className={cn("flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", showIntro && "mt-3")}
      >
        {MODES.map((item) => {
          const Icon = item.icon
          const selected = item.id === mode
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => selectMode(item.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "border-indigo-500/40 bg-indigo-500/10 text-foreground"
                  : "border-border/70 bg-card/60 text-muted-foreground hover:border-indigo-500/25 hover:text-foreground",
              )}
            >
              <Icon className={cn("size-3.5", selected ? "text-indigo-500" : "text-muted-foreground")} />
              {item.title}
            </button>
          )
        })}
      </div>
      ) : null}

      <div className="lp-composer-shell mt-3 rounded-[1.35rem] border border-transparent bg-card/90 backdrop-blur-md">
        {!focused && !hasPrompt ? (
          <span
            aria-hidden
            className="lp-type-badge pointer-events-none absolute -top-3 right-4 z-10 inline-flex items-center gap-1.5 rounded-full border border-indigo-400/50 bg-background/95 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-600 shadow-[0_8px_24px_-12px_rgba(79,70,229,0.7)] dark:border-indigo-400/40 dark:text-indigo-300"
          >
            <span className="lp-type-badge-dot size-1.5 rounded-full bg-indigo-500" />
            {TYPE_CUES[mode]}
          </span>
        ) : null}
        {(chips.length > 0 || agents.length > 1 || tool || auto !== "auto") && (
          <div className="flex flex-wrap gap-1.5 px-3.5 pt-3">
            {chips.map((chip) => (
              <span
                key={chip.id}
                className="inline-flex items-center rounded-full border border-indigo-500/20 bg-indigo-500/8 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-300"
              >
                {chip.label}
              </span>
            ))}
            {agents.filter((id) => id !== "atai").map((id) => {
              const agent = AGENTS.find((item) => item.id === id)
              if (!agent) return null
              return (
                <button
                  key={id}
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border border-violet-500/20 bg-violet-500/8 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:text-violet-300"
                  onClick={() => toggleAgent(id)}
                >
                  {agent.name}
                  <X className="size-3" />
                </button>
              )
            })}
            {tool ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                onClick={() => setTool(null)}
              >
                {TOOLS.find((item) => item.id === tool)?.name}
                <X className="size-3" />
              </button>
            ) : null}
            {auto !== "auto" ? (
              <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {autoLabel}
              </span>
            ) : null}
            {detected && detected !== mode && !lockedMode ? (
              <button
                type="button"
                className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                onClick={() => selectMode(detected)}
              >
                Use {detected === "github" ? "GitHub" : detected === "website" ? "Mirror" : "URL"} mode
              </button>
            ) : null}
          </div>
        )}

        <label htmlFor="landing-prompt" className="sr-only">
          Describe what you want Atai to build
        </label>
        <textarea
          ref={textareaRef}
          id="landing-prompt"
          value={prompt}
          rows={3}
          onChange={handlePromptChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          placeholder={active.placeholder}
          className="min-h-[88px] max-h-[240px] w-full resize-none bg-transparent px-3.5 pt-3 pb-1.5 text-sm leading-6 outline-none caret-indigo-500 placeholder:text-indigo-600/75 dark:placeholder:text-indigo-300/75"
        />
        <p aria-hidden className="px-3.5 pb-2.5 text-xs leading-5 text-muted-foreground/80 italic">
          {active.example}
        </p>

        {files.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 px-3.5 pb-2">
            {files.map((file) => (
              <span
                key={file.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2 py-1 text-[11px]"
              >
                <FileText className="size-3 text-muted-foreground" />
                <span className="max-w-[9rem] truncate">{file.name}</span>
                <span className="text-muted-foreground">{formatSize(file.size)}</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => setFiles((current) => current.filter((item) => item.id !== file.id))}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex items-center gap-1 border-t border-border/70 px-2 py-1.5">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            multiple
            onChange={(event) => {
              addFiles(event.target.files)
              event.target.value = ""
            }}
          />

          <button
            type="button"
            className={toolbarBtn}
            aria-label="Attach file"
            onClick={() => (requireAccount() ? fileRef.current?.click() : undefined)}
          >
            <Paperclip className="size-3.5" />
            <span className="hidden md:inline">Attach</span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger className={toolbarBtn} aria-label="Advanced options">
              <SlidersHorizontal className="size-3.5" />
              <span className="hidden sm:inline">Advanced</span>
              {advancedCount > 0 ? (
                <span className="ml-0.5 grid size-4 place-items-center rounded-full bg-primary/15 font-mono text-[10px] text-primary">
                  {advancedCount}
                </span>
              ) : null}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <AtSign className="size-3.5" />
                  Agents
                  {agents.length > 1 ? (
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">{agents.length - 1}</span>
                  ) : null}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-72">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>AI team</DropdownMenuLabel>
                    {AGENTS.map((agent) => {
                      const Icon = agent.icon
                      return (
                        <DropdownMenuCheckboxItem
                          key={agent.id}
                          checked={agents.includes(agent.id)}
                          disabled={agent.locked}
                          onCheckedChange={() => toggleAgent(agent.id)}
                          className="items-start py-2"
                        >
                          <Icon className="mt-0.5 size-3.5 text-violet-500" />
                          <span>
                            <span className="block text-sm font-medium">{agent.name}</span>
                            <span className="block text-[11px] text-muted-foreground">{agent.role}</span>
                          </span>
                        </DropdownMenuCheckboxItem>
                      )
                    })}
                  </DropdownMenuGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Wrench className="size-3.5" />
                  Tools
                  {tool ? (
                    <span className="ml-auto truncate font-mono text-[10px] text-muted-foreground">
                      {TOOLS.find((item) => item.id === tool)?.name}
                    </span>
                  ) : null}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-64">
                  <DropdownMenuRadioGroup value={tool ?? ""} onValueChange={selectTool}>
                    <DropdownMenuLabel>Tools</DropdownMenuLabel>
                    {TOOLS.map((item) => (
                      <DropdownMenuRadioItem key={item.id} value={item.id} className="items-start py-2">
                        <span>
                          <span className="block text-sm font-medium">{item.name}</span>
                          <span className="block text-[11px] text-muted-foreground">{item.hint}</span>
                        </span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ChevronRight className="size-3.5 opacity-0" aria-hidden />
                  {autoLabel}
                  <ChevronRight className="size-3.5 opacity-0" aria-hidden />
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-60">
                  <DropdownMenuRadioGroup value={auto} onValueChange={selectAuto}>
                    <DropdownMenuLabel>How Atai should work</DropdownMenuLabel>
                    {AUTO_MODES.map((item) => (
                      <DropdownMenuRadioItem key={item.id} value={item.id} className="items-start py-2">
                        <span>
                          <span className="block text-sm font-medium">{item.name}</span>
                          <span className="block text-[11px] text-muted-foreground">{item.hint}</span>
                        </span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>

          <p className="ml-auto hidden min-w-0 truncate px-1 text-[11px] text-muted-foreground lg:block">
            {active.support}
          </p>

          <button
            type="button"
            className={cn(
              "relative ml-auto grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:ml-0",
              listening && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
            )}
            aria-pressed={listening}
            aria-label={listening ? "Stop listening" : "Voice input"}
            onClick={startVoice}
          >
            {listening ? (
              <span className="voice-halo absolute -inset-1 rounded-xl border border-primary/50" aria-hidden />
            ) : null}
            <Mic className={cn("size-3.5", listening && "relative animate-none")} />
          </button>

          <button
            type="submit"
            disabled={!canSend}
            aria-label={submitting ? "Preparing Atai" : "Start with Atai"}
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px",
              canSend
                ? "bg-primary text-primary-foreground hover:bg-primary/85"
                : "bg-muted text-muted-foreground",
            )}
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </button>
        </div>
      </div>

      <div aria-live="polite" className="min-h-[1.25rem]">
        {error ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}{" "}
            <span className="text-muted-foreground">Your draft stays below — adjust it and send again.</span>
          </p>
        ) : listening ? (
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70 motion-reduce:animate-none" />
              <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
            </span>
            Listening — speak now. Words land in the box as you finish each phrase.
          </p>
        ) : submitting ? (
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Atai is reading your idea and preparing a plan to review…
          </p>
        ) : !session ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Sign in to unlock the AI team, tools, and attachments. Voice works here. Your draft stays here.
          </p>
        ) : null}
      </div>

      <div className="mt-1">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Need some inspiration?
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {active.pills.map((pill) => (
            <button
              key={pill}
              type="button"
              className="rounded-full border border-border/70 bg-card/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-indigo-500/30 hover:text-foreground"
              onClick={() => {
                applyPrompt(pill)
                textareaRef.current?.focus()
              }}
            >
              {pill}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
        Atai prepares a plan first. Your application is only built after you review and approve it.
      </p>

      {listening ? (
        <div
          className="voice-panel fixed inset-x-4 bottom-5 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-primary/30 bg-card/95 px-4 py-3 shadow-[0_24px_60px_-24px_rgba(79,70,229,0.45)] backdrop-blur-md lg:inset-x-auto lg:right-8 lg:bottom-8 lg:left-auto"
          role="status"
        >
          <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-primary/10">
            <span className="voice-halo absolute inset-0 rounded-full border border-primary/40" aria-hidden />
            <span className="flex h-5 items-end gap-[3px]" aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="voice-bar w-[3px] rounded-full bg-primary"
                  style={{
                    height: `${Math.max(4, Math.min(20, 5 + speechLevel * 64 + (i % 2 === 0 ? 3 : 0)))}px`,
                  }}
                />
              ))}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Listening</span>
            <span className="mt-0.5 block truncate text-sm text-foreground">
              {dictationPartial ? (
                <>
                  {dictationPartial}
                  <span className="voice-caret ml-0.5 inline-block h-4 w-px translate-y-0.5 bg-primary align-middle" aria-hidden />
                </>
              ) : (
                <span className="text-muted-foreground">Say something — your idea, a product, anything…</span>
              )}
            </span>
          </span>
          <button
            type="button"
            onClick={stopVoice}
            className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Stop
          </button>
        </div>
      ) : null}

      <Dialog
        open={nameDialogOpen}
        onOpenChange={(open) => {
          setNameDialogOpen(open)
          if (!open) {
            nameConfirmedRef.current = false
            setNameAttempted(false)
          }
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Name your business</DialogTitle>
            <DialogDescription>
              This becomes your workspace title. You can rename it any time from the workspace.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              confirmBusinessName()
            }}
          >
            <label htmlFor="landing-business-name" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Business name
              <span className="ml-1.5 font-normal normal-case tracking-normal text-destructive">*</span>
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                id="landing-business-name"
                type="text"
                inputMode="text"
                autoComplete="off"
                autoFocus
                maxLength={MAX_PROJECT_TITLE_LENGTH}
                value={title}
                onChange={(event) => {
                  titleTouchedRef.current = true
                  setTitle(event.target.value)
                  setNameAttempted(false)
                }}
                placeholder={suggestedTitle || "e.g. ClinicFlow"}
                aria-required="true"
                aria-invalid={nameError ? true : undefined}
                className={cn(
                  "h-11 w-full rounded-xl border bg-card/70 px-3.5 text-sm text-foreground outline-none transition-colors",
                  "placeholder:text-muted-foreground/60 focus-visible:border-indigo-500/50 focus-visible:ring-2 focus-visible:ring-ring",
                  nameError ? "border-destructive/50" : "border-border/70",
                )}
              />
              {suggestedTitle && title.trim() !== suggestedTitle ? (
                <button
                  type="button"
                  onClick={() => {
                    titleTouchedRef.current = false
                    setTitle(suggestedTitle)
                    setNameAttempted(false)
                  }}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-card/60 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-indigo-500/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Sparkles className="size-3 text-indigo-500" />
                  Use suggestion
                </button>
              ) : null}
            </div>
            <p aria-live="polite" className={cn("mt-1 min-h-[1rem] text-[11px] leading-4", nameError ? "text-destructive" : "text-muted-foreground")}>
              {nameError ?? (nameAttempted ? "Business name is required." : "")}
            </p>
            <DialogFooter className="mt-2">
              <DialogClose render={<Button type="button" variant="ghost" />}>
                Cancel
              </DialogClose>
              <Button type="submit">Continue</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </form>
  )
}


