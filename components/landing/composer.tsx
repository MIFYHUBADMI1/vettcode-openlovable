"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowUp,
  AtSign,
  Brain,
  ChevronDown,
  Code2,
  FileText,
  GitBranch,
  Globe,
  Lightbulb,
  Link2,
  Mic,
  Paperclip,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  Wrench,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthModal } from "@/components/auth/auth-provider"
import { useSession } from "@/lib/client/api"
import { savePendingStart } from "@/lib/auth/client-intent"
import {
  detectIntentChips,
  detectStartMode,
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
  browserSpeechBlockedReason,
  getBrowserSpeechRecognition,
  joinSpoken,
  speechRecognitionErrorMessage,
  transcriptFromSpeechEvent,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const MODES: {
  id: StartMode
  title: string
  support: string
  placeholder: string
  examples: string[]
  pills: string[]
  icon: typeof Lightbulb
}[] = [
  {
    id: "idea",
    title: "Idea",
    support: "Start with an idea. Atai will help turn it into a real business and product.",
    placeholder: "Tell Atai what you want to build, solve, or accomplish...",
    examples: [
      "Build a SaaS that helps small businesses manage WhatsApp customers",
      "Turn my idea for a local marketplace into an MVP",
      "Help me turn this problem into a real business",
    ],
    pills: ["Build an MVP", "Turn an idea into a business", "A booking app for clinics"],
    icon: Lightbulb,
  },
  {
    id: "website",
    title: "Mirror",
    support: "Give Atai a reference site and describe what you want to create from it.",
    placeholder: "Paste a website you want Atai to understand as a starting point...",
    examples: [
      "https://linear.app — create a modern version of this experience for my business",
      "Use this product as inspiration and build something better suited to my market",
    ],
    pills: ["Recreate this experience", "Improve this product for my market"],
    icon: Globe,
  },
  {
    id: "url",
    title: "URL",
    support: "Atai will use the website as context for your request.",
    placeholder: "Paste a URL for Atai to analyze...",
    examples: [
      "https://example.com — analyze this website and help me build a better product",
      "Understand this website and create a similar product experience",
    ],
    pills: ["Analyze a website", "Build from this URL"],
    icon: Link2,
  },
  {
    id: "github",
    title: "GitHub",
    support: "Let Atai understand an existing codebase and work from it.",
    placeholder: "Paste a GitHub repository URL...",
    examples: [
      "https://github.com/vercel/next.js — understand this codebase and help me turn it into a product",
      "Analyze this repository and tell me what I need to improve",
    ],
    pills: ["Import a repository", "Extend an existing app"],
    icon: GitBranch,
  },
]

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

function useTypedPlaceholder(examples: string[], enabled: boolean) {
  const [index, setIndex] = useState(0)
  const [count, setCount] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    setIndex(0)
    setCount(0)
    setDeleting(false)
  }, [examples])

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  }, [])

  useEffect(() => {
    if (!enabled) return
    if (reduced) {
      const timer = window.setInterval(() => {
        setIndex((current) => (current + 1) % examples.length)
      }, 4000)
      return () => window.clearInterval(timer)
    }

    const full = examples[index] ?? ""
    const delay = !deleting && count === full.length ? 1600 : deleting && count === 0 ? 280 : deleting ? 18 : 32
    const timer = window.setTimeout(() => {
      if (!deleting) {
        if (count < full.length) setCount((current) => current + 1)
        else setDeleting(true)
        return
      }
      if (count > 0) {
        setCount((current) => current - 1)
        return
      }
      setDeleting(false)
      setIndex((current) => (current + 1) % examples.length)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [enabled, reduced, examples, index, count, deleting])

  if (reduced) return examples[index] ?? ""
  return (examples[index] ?? "").slice(0, count)
}

function resizeTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = "auto"
  el.style.height = `${Math.min(Math.max(el.scrollHeight, 148), 220)}px`
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
  className,
}: {
  lockedMode?: StartMode
  showModes?: boolean
  showIntro?: boolean
  className?: string
} = {}) {
  const router = useRouter()
  const { session } = useSession()
  const { openAuth } = useAuthModal()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const promptRef = useRef("")
  const listeningRef = useRef(false)
  const voiceBaseRef = useRef("")

  const [prompt, setPrompt] = useState("")
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

  const active = MODES.find((item) => item.id === mode) ?? MODES[0]
  const typedPlaceholder = useTypedPlaceholder(active.examples, !prompt && !focused)
  const detected = detectStartMode(prompt)
  const chips = useMemo(() => detectIntentChips(prompt, mode), [prompt, mode])
  const canSend = prompt.trim().length > 0 && !submitting
  const autoLabel = AUTO_MODES.find((item) => item.id === auto)?.name ?? "Auto"

  useEffect(() => {
    const prefs = loadComposerPrefs()
    setPrompt(prefs.prompt)
    setMode(lockedMode ?? prefs.mode)
    setAgents(prefs.agents)
    setTool(prefs.tool)
    setAuto(prefs.auto)
    setFiles(prefs.files)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    saveComposerPrefs({ prompt, mode, agents, tool, auto, files })
  }, [hydrated, prompt, mode, agents, tool, auto, files])

  useEffect(() => {
    promptRef.current = prompt
  }, [prompt])

  useEffect(() => {
    resizeTextarea(textareaRef.current)
  }, [prompt])

  useEffect(() => () => {
    listeningRef.current = false
    recognitionRef.current?.abort()
  }, [])

  function requireAccount() {
    if (session) return true
    saveComposerPrefs({ prompt, mode, agents, tool, auto, files })
    openAuth("signup", { next: "/" })
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

  function stopVoice() {
    listeningRef.current = false
    setListening(false)
    recognitionRef.current?.stop()
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
    recognition.lang = typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-US"
    recognition.continuous = true
    recognition.interimResults = true
    voiceBaseRef.current = promptRef.current.trim()
    recognition.onresult = (event) => {
      const { finalText, interimText } = transcriptFromSpeechEvent(event)
      const spoken = [finalText, interimText].filter(Boolean).join(" ")
      applyPrompt(joinSpoken(voiceBaseRef.current, spoken))
    }
    recognition.onerror = (event) => {
      if (event.error === "no-speech") return
      if (event.error === "aborted") return
      const message = speechRecognitionErrorMessage(event.error)
      listeningRef.current = false
      setListening(false)
      if (message) setError(message)
    }
    recognition.onend = () => {
      if (!listeningRef.current) {
        setListening(false)
        return
      }
      try {
        recognition.start()
      } catch {
        listeningRef.current = false
        setListening(false)
      }
    }
    recognitionRef.current = recognition
    listeningRef.current = true
    setError(null)
    setListening(true)
    try {
      recognition.start()
    } catch {
      listeningRef.current = false
      setListening(false)
      setError("Couldn’t start the microphone. Try again.")
    }
  }

  function submit() {
    const message = validateStartInput(mode, prompt)
    if (message) {
      setError(message)
      return
    }
    const saved = promptForStart(mode, prompt)
    const continueHref = "/start"
    savePendingStart({
      prompt: saved,
      href: continueHref,
      source: mode === "github" ? "landing_github" : mode === "website" ? "landing_mirror" : mode === "url" ? "landing_url" : "landing_idea",
      signalType: mode === "idea" ? "idea" : "url",
      mode,
      pipelineMode: "heavy",
    })
    saveComposerPrefs({ prompt, mode, agents, tool, auto, files })
    setSubmitting(true)
    if (!session) {
      openAuth("signup", { next: continueHref, prompt: saved })
      setSubmitting(false)
      return
    }
    router.push(continueHref)
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

      <div
        className={cn(
          "lp-composer-shell mt-3 rounded-[1.35rem] border bg-card/90 shadow-[0_24px_60px_-36px_rgba(79,70,229,0.5)] backdrop-blur-md transition-[border-color,box-shadow] duration-200",
          focused
            ? "border-indigo-500/35 shadow-[0_24px_70px_-32px_rgba(79,70,229,0.62)]"
            : "border-border/80",
        )}
      >
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
          {active.placeholder}
        </label>
        <textarea
          ref={textareaRef}
          id="landing-prompt"
          value={prompt}
          rows={5}
          onChange={(event) => applyPrompt(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          placeholder={typedPlaceholder || active.placeholder}
          className="min-h-[148px] max-h-[220px] w-full resize-none bg-transparent px-3.5 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground/75"
        />

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

          <DropdownMenu>
            <DropdownMenuTrigger className={cn(toolbarBtn, "sm:hidden")} aria-label="More actions">
              <Plus className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={() => (requireAccount() ? fileRef.current?.click() : undefined)}>
                <Paperclip className="size-3.5" /> Attach file
              </DropdownMenuItem>
              <DropdownMenuItem onClick={startVoice}>
                <Mic className="size-3.5" /> Voice
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            className={cn(toolbarBtn, "hidden sm:inline-flex")}
            onClick={() => (requireAccount() ? fileRef.current?.click() : undefined)}
          >
            <Paperclip className="size-3.5" />
            <span className="hidden md:inline">Attach</span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger className={toolbarBtn}>
              <AtSign className="size-3.5" />
              <span className="hidden sm:inline">Agents</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
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
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger className={toolbarBtn}>
              <Wrench className="size-3.5" />
              <span className="hidden sm:inline">Tools</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
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
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger className={cn(toolbarBtn, "hidden sm:inline-flex")}>
              {autoLabel}
              <ChevronDown className="size-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
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
            </DropdownMenuContent>
          </DropdownMenu>

          <p className="ml-auto hidden min-w-0 truncate px-1 text-[11px] text-muted-foreground lg:block">
            {active.support}
          </p>

          <button
            type="button"
            className={cn(
              "ml-auto grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:ml-0",
              listening && "bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive",
            )}
            aria-pressed={listening}
            aria-label={listening ? "Stop listening" : "Voice input"}
            onClick={startVoice}
          >
            <Mic className={cn("size-3.5", listening && "animate-pulse")} />
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
            <ArrowUp className="size-4" />
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : listening ? (
        <p className="mt-2 text-sm text-muted-foreground">Listening… words appear as you speak. Tap the mic to stop.</p>
      ) : submitting ? (
        <p className="mt-2 text-sm text-muted-foreground">Preparing Atai...</p>
      ) : !session ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Sign in to unlock the AI team, tools, and attachments. Voice works here. Your draft stays here.
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
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
    </form>
  )
}


