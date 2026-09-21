"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Boxes,
  Braces,
  CheckCircle2,
  Code2,
  Coins,
  Compass,
  Copy,
  Cpu,
  CreditCard,
  Database,
  FileText,
  Gauge,
  Globe,
  KeyRound,
  LifeBuoy,
  Lock,
  MapPin,
  MessageSquare,
  Mic,
  PlugZap,
  RefreshCw,
  Rocket,
  Search,
  Send,
  Server,
  Shield,
  ShieldCheck,
  Terminal,
  Webhook,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { ScrollProgress } from "@/components/scroll-progress"
import { BrandMark } from "@/components/brand-logo"

/* ═══════════════════════════════════════════════════════════════
   SECTION METADATA (for search + scroll-spy)
   ═══════════════════════════════════════════════════════════════ */

const sectionMeta = [
  { id: "overview", label: "Overview", icon: Compass, keywords: ["sdk", "runtime", "api", "what is", "architecture", "overview", "introduction"] },
  { id: "installation", label: "Installation", icon: Terminal, keywords: ["install", "npm", "setup", "requirements", "node", "environments", "browser", "edge"] },
  { id: "api-keys", label: "API Keys", icon: KeyRound, keywords: ["api key", "atai_api_key", "secret", "format", "create", "rotate", "revoke", "scopes", "environments", "provisioning", "security"] },
  { id: "quickstart", label: "Quickstart", icon: Rocket, keywords: ["quickstart", "first call", "example", "hello world", "initialize", "client", "atai"] },
  { id: "capabilities", label: "Capabilities", icon: Boxes, keywords: ["capabilities", "ai", "voice", "search", "scrape", "email", "sms", "whatsapp", "notifications", "maps", "calendar", "vectors", "database", "payments", "list"] },
  { id: "rest-endpoints", label: "REST API Reference", icon: Server, keywords: ["rest", "endpoints", "http", "curl", "post", "get", "request", "response", "envelope", "json", "api"] },
  { id: "errors", label: "Errors & Retries", icon: Shield, keywords: ["errors", "ataierror", "codes", "retry", "429", "timeout", "aborted", "status", "handling"] },
  { id: "limits", label: "Limits & Quotas", icon: Gauge, keywords: ["limits", "rate limit", "quota", "payload", "256 kb", "300 requests", "concurrency", "size"] },
  { id: "credits", label: "Credits & Billing", icon: Coins, keywords: ["credits", "billing", "charge", "cost", "metering", "usage", "tokens"] },
  { id: "security", label: "Security Best Practices", icon: ShieldCheck, keywords: ["security", "secret", "server-side", "browser", "leak", "rotate", "best practices"] },
  { id: "provisioning", label: "Auto-Provisioning", icon: PlugZap, keywords: ["provisioning", "generated app", "automatic", "atai_api_key", "secret store", "build"] },
  { id: "faq", label: "FAQ", icon: LifeBuoy, keywords: ["faq", "question", "help", "support", "private", "public", "open source", "typescript", "javascript"] },
]

/* ═══════════════════════════════════════════════════════════════
   SMALL SHARED PIECES
   ═══════════════════════════════════════════════════════════════ */

function SectionHeader({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <div className="mb-6 flex items-center gap-3 border-b border-border pb-4">
      <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="size-5 text-primary" />
      </div>
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
    </div>
  )
}

function CodeBlock({ code, lang, title }: { code: string; lang?: string; title?: string }) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard unavailable — no-op.
    }
  }, [code])

  return (
    <div className="group relative my-4 overflow-hidden rounded-xl border border-border bg-muted/40">
      <div className="flex items-center justify-between border-b border-border bg-card/60 px-4 py-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{title ?? lang ?? "code"}</span>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          aria-label="Copy code"
        >
          {copied ? <CheckCircle2 className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="collab-scroll overflow-x-auto px-4 py-3 text-[13px] leading-6">
        <code className="font-mono text-foreground">{code}</code>
      </pre>
    </div>
  )
}

/** Endpoint pill row — method + path, Stripe-docs style. */
function Endpoint({ method, path, auth }: { method: "GET" | "POST" | "DELETE"; path: string; auth?: string }) {
  const tone =
    method === "GET"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
      : method === "POST"
        ? "bg-primary/10 text-primary border-primary/20"
        : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold ${tone}`}>{method}</span>
      <code className="rounded-md bg-muted px-2 py-0.5 font-mono text-[13px] text-foreground">{path}</code>
      {auth && <span className="text-[11px] text-muted-foreground">· {auth}</span>}
    </div>
  )
}

function ParamTable({ rows }: { rows: Array<{ name: string; type: string; required?: boolean; description: string }> }) {
  return (
    <div className="my-4 overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-card/60 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Parameter</th>
            <th className="px-4 py-2.5 font-medium">Type</th>
            <th className="px-4 py-2.5 font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-border/60 last:border-0 align-top">
              <td className="whitespace-nowrap px-4 py-3">
                <code className="font-mono text-[13px] text-foreground">{r.name}</code>
                {r.required ? (
                  <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-primary">required</span>
                ) : (
                  <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">optional</span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">{r.type}</td>
              <td className="px-4 py-3 leading-6 text-muted-foreground">{r.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** One capability card in the capability grid. */
function CapabilityCard({
  icon: Icon,
  name,
  sdk,
  operations,
  description,
}: {
  icon: LucideIcon
  name: string
  sdk: string
  operations: readonly string[]
  description: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="size-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{name}</p>
          <code className="font-mono text-[11px] text-primary">{sdk}</code>
        </div>
      </div>
      <p className="mt-2.5 text-sm leading-6 text-muted-foreground">{description}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {operations.map((op) => (
          <code key={op} className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {op}
          </code>
        ))}
      </div>
    </div>
  )
}

function ScrollSpyNav({ sectionIds, visibleIds }: { sectionIds: string[]; visibleIds: string[] }) {
  const [activeId, setActiveId] = useState("")
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    observerRef.current?.disconnect()

    const callbacks = new Map<string, IntersectionObserverCallback>()
    for (const id of sectionIds) {
      callbacks.set(id, ([entry]) => {
        if (entry?.isIntersecting) setActiveId(id)
      })
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const cb = callbacks.get(entry.target.id)
          if (cb) cb([entry] as IntersectionObserverEntry[], observerRef.current!)
        }
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    )

    for (const id of sectionIds) {
      const el = document.getElementById(id)
      if (el) observerRef.current.observe(el)
    }

    return () => observerRef.current?.disconnect()
  }, [sectionIds])

  const metaMap = Object.fromEntries(sectionMeta.map((s) => [s.id, s]))

  return (
    <nav className="sticky top-24 space-y-1">
      {sectionIds.map((id) => {
        const meta = metaMap[id]
        if (!meta) return null
        const Icon = meta.icon
        const isActive = id === activeId
        const isVisible = visibleIds.includes(id)

        return (
          <a
            key={id}
            href={`#${id}`}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all ${isActive
              ? "bg-primary/5 text-foreground font-medium border-l-2 border-primary pl-4"
              : isVisible
                ? "text-muted-foreground hover:bg-accent/50 hover:text-foreground border-l-2 border-transparent"
                : "text-muted-foreground/30 border-l-2 border-transparent"
              }`}
          >
            <Icon className="size-4 shrink-0" />
            {meta.label}
          </a>
        )
      })}
    </nav>
  )
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export function SdkDocsContent() {
  const [visibleIds, setVisibleIds] = useState<string[]>(sectionMeta.map((s) => s.id))
  const isVisible = (id: string) => visibleIds.includes(id)

  const filter = useCallback((ids: string[]) => setVisibleIds(ids), [])

  return (
    <>
      <ScrollProgress />
      <SiteHeader activePage="/sdk" />

      {/* Hero */}
      <section className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
          <Link
            href="/docs"
            className="mb-6 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to Docs
          </Link>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <BrandMark size={32} />
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">SDK &amp; API Reference</p>
            <span className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 font-mono text-[10px] font-medium text-primary">v1.0.0</span>
          </div>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            The @atai/sdk and the Atai Runtime API
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
            One typed client, one API key, and every capability your application needs — AI, messaging,
            payments, search, maps and more. Everything a generated (or any) application can do with Atai,
            documented end to end.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/sdk#quickstart" className={buttonVariants({ size: "sm" })}>
              Get started <ArrowRight className="size-3.5" />
            </Link>
            <Link href="/sdk#rest-endpoints" className={buttonVariants({ variant: "outline", size: "sm" })}>
              API reference
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10 lg:grid lg:grid-cols-[220px_1fr] lg:gap-12">
        {/* Sidebar */}
        <aside className="hidden lg:block">
          <ScrollSpyNav sectionIds={sectionMeta.map((s) => s.id)} visibleIds={visibleIds} />
        </aside>

        {/* Content */}
        <div className="max-w-3xl space-y-16">

          {/* ─── OVERVIEW ─── */}
          <section id="overview" style={{ opacity: isVisible("overview") ? 1 : 0.25, transition: "opacity 0.2s" }}>
            <SectionHeader icon={Compass} title="Overview" />
            <div className="space-y-6 leading-7 text-muted-foreground">
              <p>
                The <strong className="text-foreground">Atai Runtime API</strong> is the single service boundary between
                your application and everything Atai operates: AI generation, voice, web search and scraping, email,
                SMS, WhatsApp, push notifications, maps, scheduling, vector storage, the app database, and checkout.
                The <strong className="text-foreground">@atai/sdk</strong> is its official typed client.
              </p>

              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { icon: Lock, title: "One credential", body: "A project-scoped Atai API key is the only secret your app needs. Provider accounts and provider keys stay inside Atai — always." },
                  { icon: Boxes, title: "One vocabulary", body: "Your app speaks Atai capabilities (ai.text, email, payments…). Atai normalizes every provider response — you never see a provider's wire format." },
                  { icon: Gauge, title: "One meter", body: "Usage is metered and billed in Atai credits per request. No per-provider billing, no per-provider rate limits to juggle." },
                ].map(({ icon: Icon, title, body }) => (
                  <div key={title} className="rounded-xl border border-border bg-card p-5">
                    <Icon className="mb-3 size-5 text-primary" />
                    <h3 className="font-medium text-foreground">{title}</h3>
                    <p className="mt-2 text-sm leading-6">{body}</p>
                  </div>
                ))}
              </div>

              <h3 className="mt-8 text-lg font-semibold text-foreground">How the pieces fit together</h3>
              <CodeBlock
                lang="text"
                title="architecture"
                code={`Your application (@atai/sdk)
        │  Authorization: Bearer atai_<environment>_<secret>
        ▼
Atai Runtime API  (https://atai.ink/api/runtime/v1)
   authenticate → authorize → validate → route
        ▼
Atai providers & infrastructure  (never visible to your app)`}
              />

              <ul className="space-y-2">
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" /> <span><strong className="text-foreground">Typed to the contract.</strong> Every capability method mirrors the Runtime API request/response contract 1:1 — invalid input is caught client-side before it ever hits the network.</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" /> <span><strong className="text-foreground">Zero runtime dependencies.</strong> Pure fetch + standard JavaScript. Runs in Node.js ≥ 18, serverless, edge runtimes, and browsers.</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" /> <span><strong className="text-foreground">Safe by design.</strong> The key is never logged or serialized into errors; error objects carry only code, status, message, and a request ID for support.</span></li>
              </ul>

              <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-5 py-4">
                <BookOpen className="size-5 shrink-0 text-primary" />
                <p className="text-sm">
                  Building the product behind the code? The plan-first flow lives in{" "}
                  <Link href="/docs#collaborate" className="font-medium text-primary underline-offset-2 hover:underline">Collaborate &amp; Refine Your Plan →</Link>
                </p>
              </div>
            </div>
          </section>

          {/* ─── INSTALLATION ─── */}
          <section id="installation" style={{ opacity: isVisible("installation") ? 1 : 0.25, transition: "opacity 0.2s" }}>
            <SectionHeader icon={Terminal} title="Installation" />
            <div className="space-y-6 leading-7 text-muted-foreground">
              <p>Install the SDK from npm:</p>
              <CodeBlock lang="bash" title="shell" code={`npm install @atai/sdk`} />
              <CodeBlock lang="bash" title="pnpm" code={`pnpm add @atai/sdk`} />
              <CodeBlock lang="bash" title="yarn" code={`yarn add @atai/sdk`} />

              <h3 className="text-lg font-semibold text-foreground">Requirements</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" /> Node.js 18 or newer (or any runtime with a global <code className="rounded bg-muted px-1 font-mono text-xs">fetch</code>)</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" /> ES modules (the package ships ESM only)</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" /> TypeScript ≥ 5 for first-class types — JavaScript works fine too</li>
              </ul>

              <h3 className="text-lg font-semibold text-foreground">Runtime environments</h3>
              <p>The SDK runs anywhere standard JavaScript runs:</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { name: "Node.js", desc: "Express, Next.js server routes, workers — anywhere ≥ Node 18." },
                  { name: "Serverless & edge", desc: "Vercel functions, Cloudflare Workers, Deno Deploy, Bun." },
                  { name: "Browsers", desc: "Possible but not recommended for keys — see Security Best Practices." },
                  { name: "Generated apps", desc: "Atai provisions the key and dependency automatically at build time." },
                ].map(({ name, desc }) => (
                  <div key={name} className="rounded-lg border border-border bg-card px-4 py-3">
                    <p className="text-sm font-medium text-foreground">{name}</p>
                    <p className="mt-0.5 text-sm">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ─── API KEYS ─── */}
          <section id="api-keys" style={{ opacity: isVisible("api-keys") ? 1 : 0.25, transition: "opacity 0.2s" }}>
            <SectionHeader icon={KeyRound} title="API Keys" />
            <div className="space-y-6 leading-7 text-muted-foreground">
              <p>
                Every Runtime request is authenticated with an <strong className="text-foreground">Atai runtime API key</strong> —
                a project-scoped credential that names exactly one project, one environment, and a set of capability scopes.
              </p>

              <h3 className="text-lg font-semibold text-foreground">Key format</h3>
              <CodeBlock
                lang="text"
                title="format"
                code={`atai_<environment>_<secret>

atai_production_a81fK2x9dQ7vN4mZpLw3sE6rT1yU8iO0   ← production key
atai_development_b2cD4eF6gH8jK1lM3nP5qR7s9tU2vW4x  ← development key`}
              />
              <p>
                The prefix <code className="rounded bg-muted px-1 font-mono text-xs">atai_production_</code> /{" "}
                <code className="rounded bg-muted px-1 font-mono text-xs">atai_development_</code> is part of the key itself and
                is safe to display — dashboards show it as the key&apos;s identity. The remaining secret portion is what
                authenticates requests and is never stored in plaintext by Atai.
              </p>

              <h3 className="text-lg font-semibold text-foreground">Environments</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-card p-5">
                  <p className="text-sm font-semibold text-foreground">development</p>
                  <p className="mt-1 text-sm">For your dev/test build. Isolated usage records and limits. Create freely while building.</p>
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                  <p className="text-sm font-semibold text-foreground">production</p>
                  <p className="mt-1 text-sm">For your live application serving real users. Treat its keys with production-grade care.</p>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-foreground">Creating keys</h3>
              <p>Keys are managed from your project workspace — <strong className="text-foreground">Workspace → Runtime → API keys</strong>:</p>
              <ol className="list-inside list-decimal space-y-2">
                <li>Open your project and go to the Runtime section</li>
                <li>Click <strong className="text-foreground">Create key</strong>, choose the environment</li>
                <li>Optionally restrict <strong className="text-foreground">scopes</strong> (leave empty to grant all capabilities the project is entitled to)</li>
                <li>Optionally set an <strong className="text-foreground">expiry date</strong></li>
                <li>Copy the secret <strong className="text-foreground">immediately</strong> — it is shown exactly once and can never be retrieved again</li>
              </ol>
              <p>
                Generated applications don&apos;t need this step: Atai provisions a scoped key automatically and injects it
                into the app&apos;s secret store (see <a href="#provisioning" className="font-medium text-primary hover:underline">Auto-Provisioning</a>).
              </p>

              <h3 className="text-lg font-semibold text-foreground">Scopes</h3>
              <p>
                A scope equals a capability ID. An empty scope list grants every capability the project&apos;s plan and
                entitlement allow; a non-empty list grants exactly those capabilities. Requests outside a key&apos;s scopes
                are rejected with <code className="rounded bg-muted px-1 font-mono text-xs">403 runtime_capability_not_allowed</code>.
              </p>
              <CodeBlock
                lang="json"
                title="example scopes"
                code={`["ai.text", "email", "payments"]   ← only these three capabilities
[]                                 ← all entitled capabilities`}
              />

              <h3 className="text-lg font-semibold text-foreground">Rotation &amp; revocation</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2"><RefreshCw className="mt-1 size-4 shrink-0 text-primary" /> <span><strong className="text-foreground">Rotate</strong> replaces a key atomically: a new secret is issued (shown once), the old secret stops working immediately. Lineage is preserved on both keys.</span></li>
                <li className="flex items-start gap-2"><Shield className="mt-1 size-4 shrink-0 text-primary" /> <span><strong className="text-foreground">Revoke</strong> permanently disables a key. History is preserved; revoked keys can never authenticate again.</span></li>
                <li className="flex items-start gap-2"><Clock icon={KeyRound} /> <span><strong className="text-foreground">Expiry</strong> — keys may carry a future expiry timestamp; expired keys are rejected like revoked ones (<code className="rounded bg-muted px-1 font-mono text-xs">401 runtime_key_expired</code>).</span></li>
              </ul>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4">
                <p className="mb-1 text-sm font-semibold text-foreground">Treat your key like a password</p>
                <p className="text-sm">
                  Never commit it to Git, never ship it to the browser, never paste it into client-side code. If a key
                  leaks, rotate it from the dashboard — the leaked secret stops working instantly.
                </p>
              </div>
            </div>
          </section>

          {/* ─── QUICKSTART ─── */}
          <section id="quickstart" style={{ opacity: isVisible("quickstart") ? 1 : 0.25, transition: "opacity 0.2s" }}>
            <SectionHeader icon={Rocket} title="Quickstart" />
            <div className="space-y-6 leading-7 text-muted-foreground">
              <p>Initialize the client once per credential and call a capability:</p>

              <CodeBlock
                lang="ts"
                title="initialize"
                code={`import { Atai } from "@atai/sdk"

const atai = new Atai({
  apiKey: process.env.ATAI_API_KEY!,   // atai_<environment>_<secret>
  // baseUrl is optional — defaults to Atai's production runtime origin.
})`}
              />

              <CodeBlock
                lang="ts"
                title="your first AI call"
                code={`const result = await atai.ai.chat({
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Write a haiku about databases." },
  ],
  temperature: 0.7,
  max_tokens: 200,
})

console.log(result.content)             // the assistant's reply
console.log(result.model)               // the model Atai actually used
console.log(result.usage?.totalTokens)  // token usage for this call`}
              />

              <CodeBlock
                lang="ts"
                title="verify connectivity"
                code={`const health = await atai.health.check()

console.log(health.status)               // "operational"
console.log(health.identity.projectId)   // your project, from the key record
console.log(health.identity.environment) // "development" | "production"`}
              />

              <h3 className="text-lg font-semibold text-foreground">One client per credential</h3>
              <p>
                The client is an instance model: create one per key/environment. Configuration is validated at
                construction — requests can never change the credential or the origin afterward. Concurrent calls are
                safe and fully isolated.
              </p>
              <CodeBlock
                lang="ts"
                title="multiple environments"
                code={`const dev = new Atai({ apiKey: process.env.ATAI_DEV_KEY! })
const prod = new Atai({ apiKey: process.env.ATAI_PROD_KEY! })`}
              />

              <h3 className="text-lg font-semibold text-foreground">Cancellation &amp; timeouts</h3>
              <p>
                Pass a standard <code className="rounded bg-muted px-1 font-mono text-xs">AbortSignal</code>. A default
                60-second per-request timeout applies. Cancellations and timeouts are always reported as distinct{" "}
                <code className="rounded bg-muted px-1 font-mono text-xs">atai_aborted</code> /{" "}
                <code className="rounded bg-muted px-1 font-mono text-xs">atai_timeout</code> errors — never masked as
                network or provider failures.
              </p>
              <CodeBlock
                lang="ts"
                title="aborting a request"
                code={`const controller = new AbortController()
setTimeout(() => controller.abort(), 5000)

try {
  await atai.ai.chat({ messages: [{ role: "user", content: "Long task?" }] }, { signal: controller.signal })
} catch (e) {
  // e.code === "atai_aborted" when cancelled by the caller
}`}
              />
            </div>
          </section>

          {/* ─── CAPABILITIES ─── */}
          <section id="capabilities" style={{ opacity: isVisible("capabilities") ? 1 : 0.25, transition: "opacity 0.2s" }}>
            <SectionHeader icon={Boxes} title="Capabilities" />
            <div className="space-y-6 leading-7 text-muted-foreground">
              <p>
                Each capability is a namespace on the client. Under the hood every call is the same Runtime request —{" "}
                <code className="rounded bg-muted px-1 font-mono text-xs">{"{ capability, operation, input }"}</code> — so
                the SDK&apos;s types always mirror the wire contract.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <CapabilityCard icon={Cpu} name="AI" sdk="atai.ai" operations={["chat", "completion", "embed"]} description="Text generation, completion, and embeddings. The workhorse for assistants, content, and understanding." />
                <CapabilityCard icon={Mic} name="Voice" sdk="atai.voice" operations={["synthesize"]} description="Turn text into natural speech audio (returned base64-encoded with its MIME type)." />
                <CapabilityCard icon={Search} name="Search" sdk="atai.search" operations={["web"]} description="Query the open web and get ranked, described results." />
                <CapabilityCard icon={Globe} name="Web" sdk="atai.web" operations={["scrape"]} description="Scrape a public URL into clean markdown, with links and truncation info." />
                <CapabilityCard icon={Send} name="Email" sdk="atai.email" operations={["send"]} description="Transactional email — receipts, resets, digests, notifications." />
                <CapabilityCard icon={MessageSquare} name="SMS & WhatsApp" sdk="atai.sms · atai.whatsapp" operations={["send"]} description="Text messages and WhatsApp messaging to phone numbers." />
                <CapabilityCard icon={Webhook} name="Notifications" sdk="atai.notifications" operations={["send"]} description="Push notifications to a user's device via its platform token." />
                <CapabilityCard icon={MapPin} name="Maps" sdk="atai.maps" operations={["geocode", "reverseGeocode"]} description="Addresses to coordinates and back, with optional country and language hints." />
                <CapabilityCard icon={FileText} name="Calendar" sdk="atai.calendar" operations={["listBookings", "createBooking"]} description="List upcoming bookings and create new ones with attendees." />
                <CapabilityCard icon={Boxes} name="Vectors" sdk="atai.vectors" operations={["upsert", "search", "delete"]} description="Store embeddings and search them — semantic search, recommendations, RAG." />
                <CapabilityCard icon={Database} name="Database" sdk="atai.db" operations={["query", "create", "edit", "delete"]} description="The app's runtime database: filter, sort, paginate, and mutate records." />
                <CapabilityCard icon={CreditCard} name="Payments" sdk="atai.payments" operations={["createCheckout"]} description="Create checkout sessions for one-time purchases and order flows." />
              </div>

              <h3 className="mt-8 text-lg font-semibold text-foreground">ai — text generation</h3>
              <CodeBlock
                lang="ts"
                code={`const result = await atai.ai.chat({
  model: "openai/gpt-5.2",       // optional — Atai's default model otherwise
  messages: [
    { role: "system", content: "You are concise." },
    { role: "user", content: "Summarize this order." },
  ],
  max_tokens: 300,               // 1–1,000,000
  temperature: 0.4,              // 0–2
  stop: ["###"],                 // string or up to 4 strings
  seed: 42,
})

// result: { id, model, content, finishReason, usage? }`}
              />
              <ParamTable
                rows={[
                  { name: "messages", type: "AiMessage[]", required: true, description: "1–128 messages; each content is 1–100,000 characters. Roles: user, assistant, system." },
                  { name: "model", type: "string", description: "Caller-selected model identifier (max 200 chars). Omitted = Atai's configured default." },
                  { name: "temperature", type: "number", description: "0–2. Sampling randomness." },
                  { name: "top_p", type: "number", description: "(0, 1]. Nucleus sampling." },
                  { name: "max_tokens", type: "number", description: "1–1,000,000. Maximum tokens to generate." },
                  { name: "stop", type: "string | string[]", description: "Up to 4 stop sequences, each max 100 chars." },
                  { name: "frequency_penalty", type: "number", description: "-2 to 2." },
                  { name: "presence_penalty", type: "number", description: "-2 to 2." },
                  { name: "seed", type: "number", description: "Integer seed for (best-effort) reproducibility." },
                ]}
              />

              <h3 className="text-lg font-semibold text-foreground">email — send email</h3>
              <CodeBlock
                lang="ts"
                code={`await atai.email.send({
  to: ["customer@example.com"],
  subject: "Your receipt",
  text: "Thanks for your purchase!",
  html: "<p>Thanks for your purchase!</p>",
  replyTo: "support@yourapp.com",
})
// → { id }`}
              />

              <h3 className="text-lg font-semibold text-foreground">sms / whatsapp — send messages</h3>
              <CodeBlock
                lang="ts"
                code={`await atai.sms.send({ to: "+15551234567", body: "Your code is 8291" })
await atai.whatsapp.send({ to: "+15551234567", body: "Order confirmed 🎉" })
// → { messageId, status, segments? }`}
              />

              <h3 className="text-lg font-semibold text-foreground">db — the app database</h3>
              <CodeBlock
                lang="ts"
                code={`const { records, total } = await atai.db.query({
  tableName: "orders",
  filter: { status: "paid" },
  sortBy: "createdAt",
  sortDirection: "desc",
  limit: 20,
  skip: 0,
})

const created = await atai.db.create({ tableName: "orders", data: { item: "Latte", qty: 2 } })
const updated = await atai.db.edit({ tableName: "orders", recordId: created.id!, data: { status: "paid" } })
await atai.db.delete({ tableName: "orders", recordId: created.id! })`}
              />

              <h3 className="text-lg font-semibold text-foreground">payments — checkout</h3>
              <CodeBlock
                lang="ts"
                code={`const checkout = await atai.payments.createCheckout({
  items: [{ name: "Pro plan", quantity: 1, price: 19.99 }],
  customerEmail: "customer@example.com",
  successUrl: "https://yourapp.com/success",
  cancelUrl: "https://yourapp.com/pricing",
  idempotencyKey: "order-8291",   // deduplicates retries
  currency: "USD",
})
// → { checkoutId, checkoutUrl, status } — redirect the customer to checkoutUrl`}
              />

              <h3 className="text-lg font-semibold text-foreground">Everything else</h3>
              <CodeBlock
                lang="ts"
                code={`// Voice — text to speech
const audio = await atai.voice.synthesize({ text: "Hello!", voiceId: "optional" })
// → { audioBase64, mimeType, voiceId, modelId, characters }

// Web search
const found = await atai.search.web({ query: "best coffee in Kampala", limit: 5 })
// → { results: [{ title, url, description? }], creditsUsed? }

// Scrape a public URL
const page = await atai.web.scrape({ url: "https://example.com" })
// → { url, title?, markdown?, links?, truncated?, creditsUsed? }

// Push notification
await atai.notifications.send({ token: deviceToken, title: "New order", body: "Table 4 ordered." })

// Maps
const places = await atai.maps.geocode({ query: "Kampala", limit: 5 })
const rev = await atai.maps.reverseGeocode({ longitude: 32.58, latitude: 0.34 })

// Calendar
const bookings = await atai.calendar.listBookings({ startDate: "2026-10-01", limit: 10 })
await atai.calendar.createBooking({ title: "Consultation", startTime: "2026-10-02T09:00:00Z", endTime: "2026-10-02T10:00:00Z" })

// Vectors — semantic search
await atai.vectors.upsert({ vectors: [{ id: "doc-1", values: embedding, metadata: { page: 1 } }] })
const hits = await atai.vectors.search({ vector: embedding, topK: 5 })
await atai.vectors.delete({ ids: ["doc-1"] })`}
              />
            </div>
          </section>

          {/* ─── REST API ─── */}
          <section id="rest-endpoints" style={{ opacity: isVisible("rest-endpoints") ? 1 : 0.25, transition: "opacity 0.2s" }}>
            <SectionHeader icon={Server} title="REST API Reference" />
            <div className="space-y-6 leading-7 text-muted-foreground">
              <p>
                The SDK wraps the plain HTTP Runtime API. You can use the REST surface directly (from any language) —
                the contract below is identical to what the SDK sends.
              </p>

              <h3 className="text-lg font-semibold text-foreground">Base URL &amp; auth</h3>
              <CodeBlock
                lang="text"
                title="base"
                code={`https://atai.ink/api/runtime/v1`}
              />
              <CodeBlock
                lang="http"
                title="auth header"
                code={`Authorization: Bearer atai_production_xxxxxxxxxxxxxxxx`}
              />

              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-card p-5">
                  <Endpoint method="POST" path="/api/runtime/v1" auth="Bearer key" />
                  <p className="mt-3 text-sm">Invoke any capability. This is the single invocation endpoint.</p>
                  <CodeBlock
                    lang="bash"
                    title="curl"
                    code={`curl -X POST https://atai.ink/api/runtime/v1 \\
  -H "Authorization: Bearer $ATAI_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "capability": "ai.text",
    "operation": "chat",
    "input": {
      "messages": [{ "role": "user", "content": "Hello!" }]
    }
  }'`}
                  />
                </div>

                <div className="rounded-xl border border-border bg-card p-5">
                  <Endpoint method="GET" path="/api/runtime/v1" auth="public" />
                  <p className="mt-3 text-sm">
                    Capability discovery — lists every registered capability and its operations. Registry metadata only;
                    it does not promise provider availability.
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-card p-5">
                  <Endpoint method="GET" path="/api/runtime/v1/health" auth="Bearer key" />
                  <p className="mt-3 text-sm">
                    Authenticated health check — proves the key is active and the runtime context resolves. Shares the
                    invocation path&apos;s authentication. Returns safe metadata only.
                  </p>
                  <CodeBlock
                    lang="json"
                    title="200 OK"
                    code={`{
  "ok": true,
  "data": {
    "status": "operational",
    "requestId": "rtreq_9f2c41e8a7b64d0e9c3f8a2b7d5e1c60",
    "identity": {
      "projectId": "proj_yourproject",
      "environment": "production",
      "apiKeyId": "rkey_01h9x2",
      "scopes": ["ai.text"]
    },
    "key": { "status": "active", "lastUsedAt": 1758451200000 },
    "lifecycle": ["authenticated", "scope_validated", "capability_resolved",
                  "model_resolved", "provider_selected", "provider_request",
                  "response_normalized", "usage_recorded", "charge_recorded"]
  }
}`}
                  />
                </div>

                <div className="rounded-xl border border-border bg-card p-5">
                  <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Key management — session-authenticated dashboard APIs
                  </p>
                  <p className="text-sm">
                    These endpoints belong to the Atai dashboard, not to the SDK. They authenticate with your Atai
                    <em> session</em> (cookie), not a runtime key, and ownership is always derived server-side.
                  </p>
                  <div className="mt-3 space-y-2.5">
                    <Endpoint method="GET" path="/api/runtime/keys?projectId={id}" auth="session" />
                    <Endpoint method="POST" path="/api/runtime/keys?projectId={id}" auth="session" />
                    <Endpoint method="GET" path="/api/runtime/keys/{keyId}" auth="session" />
                    <Endpoint method="DELETE" path="/api/runtime/keys/{keyId}" auth="session" />
                    <Endpoint method="POST" path="/api/runtime/keys/{keyId}/rotate" auth="session" />
                  </div>
                  <CodeBlock
                    lang="json"
                    title="POST /api/runtime/keys body"
                    code={`{
  "name": "My worker",                  // optional, max 100 chars
  "environment": "production",          // "development" | "production"
  "scopes": ["ai.text", "email"],       // [] = all entitled capabilities
  "expiresAt": 1798761600000            // optional absolute epoch-ms
}`}
                  />
                  <p className="mt-2 text-sm">
                    The create and rotate responses carry the plaintext <code className="rounded bg-muted px-1 font-mono text-xs">secret</code>{" "}
                    exactly once. It is never persisted in plaintext and never returned again.
                  </p>
                </div>
              </div>

              <h3 className="mt-8 text-lg font-semibold text-foreground">Request body</h3>
              <ParamTable
                rows={[
                  { name: "capability", type: "string", required: true, description: "High-level capability, e.g. \"ai.text\". See Capabilities." },
                  { name: "operation", type: "string", required: true, description: "Provider-neutral operation within the capability, e.g. \"chat\"." },
                  { name: "input", type: "object", description: "Operation input — validated per capability. Unknown fields are rejected, never forwarded." },
                  { name: "metadata", type: "object", description: "Optional caller metadata. Never treated as identity or authorization." },
                ]}
              />
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4">
                <p className="text-sm">
                  Identity fields (<code className="rounded bg-muted px-1 font-mono text-xs">userId</code>,{" "}
                  <code className="rounded bg-muted px-1 font-mono text-xs">projectId</code>,{" "}
                  <code className="rounded bg-muted px-1 font-mono text-xs">environment</code>,{" "}
                  <code className="rounded bg-muted px-1 font-mono text-xs">apiKeyId</code>) and pricing fields
                  (<code className="rounded bg-muted px-1 font-mono text-xs">credits</code>,{" "}
                  <code className="rounded bg-muted px-1 font-mono text-xs">price</code>,{" "}
                  <code className="rounded bg-muted px-1 font-mono text-xs">providerCost</code>) are structurally{" "}
                  <strong className="text-foreground">forbidden</strong> in the body — sending them is a validation error.
                  Identity comes exclusively from the authenticated key.
                </p>
              </div>

              <h3 className="text-lg font-semibold text-foreground">Response envelope</h3>
              <p>Every response — success or failure — uses one envelope:</p>
              <CodeBlock
                lang="json"
                title="success"
                code={`{
  "ok": true,
  "data": {
    "requestId": "rtreq_…",       // correlation ID — also in x-request-id header
    "capability": "ai.text",
    "operation": "chat",
    "data": {                      // provider-neutral payload
      "id": "gen_…",
      "model": "openai/gpt-5.2",
      "content": "…",
      "finishReason": "stop",
      "usage": { "promptTokens": 14, "completionTokens": 42, "totalTokens": 56 }
    }
  }
}`}
              />
              <CodeBlock
                lang="json"
                title="failure"
                code={`{
  "ok": false,
  "error": {
    "code": "runtime_rate_limited",
    "message": "Too many requests. Please retry later."
  }
}`}
              />
              <p>
                The correlation ID accompanies every request lifecycle (success and failure) in the{" "}
                <code className="rounded bg-muted px-1 font-mono text-xs">x-request-id</code> response header. Include it
                when contacting support — it connects your request to its exact server-side trace.
              </p>
            </div>
          </section>

          {/* ─── ERRORS ─── */}
          <section id="errors" style={{ opacity: isVisible("errors") ? 1 : 0.25, transition: "opacity 0.2s" }}>
            <SectionHeader icon={Shield} title="Errors & Retries" />
            <div className="space-y-6 leading-7 text-muted-foreground">
              <p>
                Every SDK failure is an <code className="rounded bg-muted px-1 font-mono text-xs">AtaiError</code> with a
                normalized code, the HTTP status when one exists, and the server&apos;s{" "}
                <code className="rounded bg-muted px-1 font-mono text-xs">requestId</code> for support correlation.
                Runtime-originated failures keep their canonical{" "}
                <code className="rounded bg-muted px-1 font-mono text-xs">runtime_*</code> codes; the SDK adds its own{" "}
                <code className="rounded bg-muted px-1 font-mono text-xs">atai_*</code> codes for transport and
                configuration problems. The SDK never reveals which provider Atai used.
              </p>

              <CodeBlock
                lang="ts"
                title="error handling"
                code={`import { AtaiError, isAuthenticationError, isRateLimitError } from "@atai/sdk"

try {
  await atai.ai.chat({ messages: [{ role: "user", content: "Hello" }] })
} catch (e) {
  if (e instanceof AtaiError) {
    console.error(e.code)       // runtime_* or atai_*
    console.error(e.status)     // e.g. 401, 403, 429, 502
    console.error(e.requestId)  // correlation ID for support

    if (isAuthenticationError(e)) {
      // 401 — the key is missing, invalid, revoked or expired: rotate it.
    } else if (isAuthorizationError(e)) {
      // 403 — the key works but lacks the scope for this capability.
    } else if (isRateLimitError(e)) {
      const waitMs = e.retry?.afterMs  // safe retry metadata when provided
      // back off and retry
    }
  }
}`}
              />

              <h3 className="text-lg font-semibold text-foreground">Runtime error codes</h3>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-card/60 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Code</th>
                      <th className="px-4 py-2.5 font-medium">HTTP</th>
                      <th className="px-4 py-2.5 font-medium">Meaning &amp; what to do</th>
                    </tr>
                  </thead>
                  <tbody className="align-top">
                    {[
                      ["runtime_authentication_error", "401", "Invalid or missing API key. Check the key is set and well-formed."],
                      ["runtime_key_revoked", "401", "This key was revoked. Rotate to a new key."],
                      ["runtime_key_expired", "401", "This key passed its expiry. Rotate to a new key."],
                      ["runtime_authorization_error", "403", "The key is not allowed to perform this action."],
                      ["runtime_project_access_denied", "403", "The key does not have access to the requested project."],
                      ["runtime_capability_not_allowed", "403", "The key's scopes don't include this capability. Create a key with broader scopes."],
                      ["runtime_rate_limited", "429", "Atai's per-key limit was hit. Back off using retry metadata, then retry."],
                      ["runtime_provider_rate_limited", "429", "The upstream provider is rate limiting. Distinct from Atai's own limit — retry with backoff."],
                      ["runtime_insufficient_entitlement", "402", "The account backing this key is out of credits. Top up to continue."],
                      ["runtime_invalid_request", "422", "The body is invalid for this capability — check the contract tables above."],
                      ["runtime_provider_error", "502", "The upstream provider failed. Safe to retry once; if it persists, contact support with the requestId."],
                      ["runtime_provider_timeout", "504", "The upstream provider timed out. Safe to retry."],
                      ["runtime_model_unavailable", "400", "The requested model isn't available. Drop the model field or pick another."],
                      ["runtime_capability_unavailable", "501", "The capability exists but has no working provider yet."],
                      ["runtime_billing_unavailable", "503", "Billing could not complete the charge (fail-closed). Retry shortly."],
                      ["runtime_pricing_unconfigured", "503", "This capability isn't enabled for billing yet. Contact the platform administrator."],
                    ].map(([code, status, meaning]) => (
                      <tr key={code} className="border-b border-border/60 last:border-0">
                        <td className="whitespace-nowrap px-4 py-3"><code className="font-mono text-[12px] text-foreground">{code}</code></td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{status}</td>
                        <td className="px-4 py-3 leading-6">{meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 className="text-lg font-semibold text-foreground">SDK error codes</h3>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-card/60 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Code</th>
                      <th className="px-4 py-2.5 font-medium">Meaning</th>
                    </tr>
                  </thead>
                  <tbody className="align-top">
                    {[
                      ["atai_missing_api_key", "No API key was passed to new Atai()."],
                      ["atai_invalid_api_key", "The key doesn't match the atai_<environment>_<secret> shape."],
                      ["atai_invalid_config", "Malformed configuration (e.g. bad baseUrl)."],
                      ["atai_invalid_request", "Client-side request validation failed — fix the input before retrying."],
                      ["atai_network_error", "fetch failed / DNS / connection failure. Check connectivity."],
                      ["atai_timeout", "The 60-second per-request timeout elapsed."],
                      ["atai_aborted", "The caller aborted via AbortSignal."],
                      ["atai_invalid_response", "Malformed JSON or runtime envelope — retry, then report with the requestId."],
                    ].map(([code, meaning]) => (
                      <tr key={code} className="border-b border-border/60 last:border-0">
                        <td className="whitespace-nowrap px-4 py-3"><code className="font-mono text-[12px] text-foreground">{code}</code></td>
                        <td className="px-4 py-3 leading-6">{meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-xl border border-primary/30 bg-primary/5 px-5 py-4">
                <p className="text-sm">
                  <strong className="text-foreground">Safe to log.</strong> Error messages,{" "}
                  <code className="rounded bg-muted px-1 font-mono text-xs">String(error)</code> and{" "}
                  <code className="rounded bg-muted px-1 font-mono text-xs">JSON.stringify(error)</code> contain only
                  code/status/requestId/message — never your API key or provider internals.
                </p>
              </div>
            </div>
          </section>

          {/* ─── LIMITS ─── */}
          <section id="limits" style={{ opacity: isVisible("limits") ? 1 : 0.25, transition: "opacity 0.2s" }}>
            <SectionHeader icon={Gauge} title="Limits & Quotas" />
            <div className="space-y-6 leading-7 text-muted-foreground">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Requests per key per minute", value: "300", note: "Platform ceiling — project limits may tighten it, never raise it." },
                  { label: "Request body size", value: "256 KB", note: "Larger bodies are rejected with 413 before parsing." },
                  { name: "", label: "In-flight per process", value: "32", note: "Runtime capacity cap — excess requests get a fail-fast 429, never a queue." },
                  { label: "Per-request timeout", value: "60 s", note: "Client-side default in the SDK; cancellable via AbortSignal." },
                  { label: "Messages per chat call", value: "128", note: "Each message content: 1–100,000 characters." },
                  { label: "Key-management rate", value: "20/day", note: "Key creations and rotations per account, abuse protection." },
                ].map(({ label, value, note }) => (
                  <div key={label} className="rounded-xl border border-border bg-card p-5">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="mt-1 font-mono text-2xl font-semibold text-primary">{value}</p>
                    <p className="mt-1.5 text-xs leading-5">{note}</p>
                  </div>
                ))}
              </div>

              <h3 className="text-lg font-semibold text-foreground">How rate limiting works</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" /> <span>Limits are enforced per <strong className="text-foreground">API key</strong>, per rolling minute. Hit the limit and the runtime answers <code className="rounded bg-muted px-1 font-mono text-xs">429 runtime_rate_limited</code> — invalid keys can never consume provider capacity.</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" /> <span>Provider-side rate limits are normalized separately: <code className="rounded bg-muted px-1 font-mono text-xs">runtime_provider_rate_limited</code> means the upstream provider (not Atai) is throttling — retry with exponential backoff.</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" /> <span>Concurrency is fail-fast by design: the runtime holds a bounded number of provider slots and returns 429 immediately when full, instead of queueing requests in memory.</span></li>
              </ul>

              <h3 className="text-lg font-semibold text-foreground">Best practices</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2"><Zap className="mt-1 size-4 shrink-0 text-primary" /> <span>Retry 429/502/504 with <strong className="text-foreground">exponential backoff and jitter</strong>; honor <code className="rounded bg-muted px-1 font-mono text-xs">retry.afterMs</code> when provided.</span></li>
                <li className="flex items-start gap-2"><Zap className="mt-1 size-4 shrink-0 text-primary" /> <span>Set <code className="rounded bg-muted px-1 font-mono text-xs">max_tokens</code> deliberately — it bounds both latency and credit cost.</span></li>
                <li className="flex items-start gap-2"><Zap className="mt-1 size-4 shrink-0 text-primary" /> <span>Use <strong className="text-foreground">idempotency keys</strong> on checkout creation to make retries safe.</span></li>
              </ul>
            </div>
          </section>

          {/* ─── CREDITS ─── */}
          <section id="credits" style={{ opacity: isVisible("credits") ? 1 : 0.25, transition: "opacity 0.2s" }}>
            <SectionHeader icon={Coins} title="Credits & Billing" />
            <div className="space-y-6 leading-7 text-muted-foreground">
              <p>
                Runtime usage is billed in <strong className="text-foreground">Atai credits</strong>, deducted from the
                account that owns the project — automatically, per request. There is no per-provider billing and no
                provider account to maintain.
              </p>

              <h3 className="text-lg font-semibold text-foreground">How charging works</h3>
              <div className="space-y-3">
                {[
                  { step: 1, title: "Request authenticated", body: "The key resolves to its project and account. Identity and billing context come from the key record — never from the request." },
                  { step: 2, title: "Provider executes", body: "The runtime routes your capability to its provider and normalizes the response." },
                  { step: 3, title: "Usage recorded & charged", body: "Provider-reported usage (tokens, characters, credits — whatever the capability's unit is) is normalized and billed in Atai credits. Only the request lifecycle's charge is recorded; the account sees one clean ledger entry." },
                ].map(({ step, title, body }) => (
                  <div key={step} className="flex gap-4 rounded-lg border border-border bg-card p-4">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-sm font-bold text-primary">{step}</span>
                    <div>
                      <p className="font-medium text-foreground">{title}</p>
                      <p className="mt-1 text-sm">{body}</p>
                    </div>
                  </div>
                ))}
              </div>

              <ul className="space-y-2">
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" /> <span><strong className="text-foreground">Fail-closed billing.</strong> If the billing subsystem cannot complete a charge, the request is denied (<code className="rounded bg-muted px-1 font-mono text-xs">503 runtime_billing_unavailable</code>) rather than served for free.</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" /> <span><strong className="text-foreground">Unpriced = denied.</strong> Operations without an admin-configured price are rejected before any provider spend (<code className="rounded bg-muted px-1 font-mono text-xs">503 runtime_pricing_unconfigured</code>).</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" /> <span><strong className="text-foreground">Out of credits.</strong> Requests fail with <code className="rounded bg-muted px-1 font-mono text-xs">402 runtime_insufficient_entitlement</code> until the account tops up.</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" /> <span><strong className="text-foreground">The SDK doesn't bill.</strong> Credits, metering and ledger writes are Atai&apos;s server responsibility; the SDK only surfaces usage metadata included in a response.</span></li>
              </ul>

              <p>
                Platform-level operations (building, analyzing, collaborating) have their own credit costs — see{" "}
                <Link href="/docs#credits" className="font-medium text-primary underline-offset-2 hover:underline">Credits &amp; Billing in the main docs →</Link>
              </p>
            </div>
          </section>

          {/* ─── SECURITY ─── */}
          <section id="security" style={{ opacity: isVisible("security") ? 1 : 0.25, transition: "opacity 0.2s" }}>
            <SectionHeader icon={ShieldCheck} title="Security Best Practices" />
            <div className="space-y-6 leading-7 text-muted-foreground">
              <h3 className="text-lg font-semibold text-foreground">Keep keys server-side</h3>
              <p>
                Atai runtime keys are <strong className="text-foreground">secret credentials — there is no browser-safe
                public key type</strong>. If a generated application runs entirely in a public browser, the key can be
                seen by end users. Call the SDK from your server (or a serverless function) and proxy results to the
                browser. Never compensate by embedding any provider key in the client — the SDK has no fields for them
                and never will.
              </p>
              <CodeBlock
                lang="ts"
                title="the right shape: thin server proxy"
                code={`// app/api/chat/route.ts (server) — the key never leaves the server
import { Atai } from "@atai/sdk"

const atai = new Atai({ apiKey: process.env.ATAI_API_KEY! })

export async function POST(req: Request) {
  const { message } = await req.json()
  const result = await atai.ai.chat({
    messages: [{ role: "user", content: message }],
    max_tokens: 500,
  })
  return Response.json({ reply: result.content })
}`}
              />

              <h3 className="text-lg font-semibold text-foreground">Environment hygiene</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" /> <span>Store keys in environment variables or your platform&apos;s secret manager — never in source, never in localStorage or cookies (the SDK itself never writes your key anywhere).</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" /> <span>Use a <strong className="text-foreground">development</strong> key while building and a <strong className="text-foreground">production</strong> key in live deployments. Different keys = isolated usage and limits.</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" /> <span>Scope keys narrowly — if a worker only sends email, give it <code className="rounded bg-muted px-1 font-mono text-xs">[&quot;email&quot;]</code>, not every capability.</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" /> <span>Rotate on a schedule and rotate immediately on suspicion of leakage. Rotation is atomic: the old secret dies the moment the new one is issued.</span></li>
              </ul>

              <h3 className="text-lg font-semibold text-foreground">What the runtime guarantees</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2"><Lock className="mt-1 size-4 shrink-0 text-primary" /> <span><strong className="text-foreground">Identity is server-derived.</strong> userId/projectId/environment come exclusively from the key record — client-supplied identity fields are structurally rejected.</span></li>
                <li className="flex items-start gap-2"><Lock className="mt-1 size-4 shrink-0 text-primary" /> <span><strong className="text-foreground">Keys are hashed at rest.</strong> Atai stores only a SHA-256 hash; plaintext is shown once at creation and never retrievable.</span></li>
                <li className="flex items-start gap-2"><Lock className="mt-1 size-4 shrink-0 text-primary" /> <span><strong className="text-foreground">Provider neutrality.</strong> Provider names, wire formats and credentials never cross the Runtime boundary — there is nothing provider-specific to leak or configure.</span></li>
                <li className="flex items-start gap-2"><Lock className="mt-1 size-4 shrink-0 text-primary" /> <span><strong className="text-foreground">One-way traffic.</strong> The SDK sends nothing anywhere except your requests to the Atai origin. No telemetry, no per-request base-URL overrides, no storage.</span></li>
              </ul>
            </div>
          </section>

          {/* ─── PROVISIONING ─── */}
          <section id="provisioning" style={{ opacity: isVisible("provisioning") ? 1 : 0.25, transition: "opacity 0.2s" }}>
            <SectionHeader icon={PlugZap} title="Auto-Provisioning" />
            <div className="space-y-6 leading-7 text-muted-foreground">
              <p>
                If your application was <strong className="text-foreground">generated by Atai</strong>, the runtime
                credential is delivered to you — no dashboard step needed. When the build completes, Atai:
              </p>
              <ol className="list-inside list-decimal space-y-2">
                <li>Creates a project-scoped runtime key with least-privilege scopes</li>
                <li>Injects it into your application&apos;s secret store as <code className="rounded bg-muted px-1 font-mono text-xs">ATAI_API_KEY</code></li>
                <li>Discards the plaintext — it is never persisted in plaintext, logged, or returned again</li>
              </ol>

              <CodeBlock
                lang="ts"
                title="in a generated app — zero configuration"
                code={`import { Atai } from "@atai/sdk"

// The key arrives via the secret store as ATAI_API_KEY —
// provisioned automatically at build completion.
const atai = new Atai({ apiKey: process.env.ATAI_API_KEY! })

// Optionally verify the wiring at startup:
const health = await atai.health.check()
if (health.status !== "operational") throw new Error("Atai Runtime not connected")`}
              />

              <h3 className="text-lg font-semibold text-foreground">Environment mapping</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-card px-4 py-3">
                  <p className="text-sm font-medium text-foreground">Build completion → development</p>
                  <p className="mt-0.5 text-sm">The dev preview gets a development key.</p>
                </div>
                <div className="rounded-lg border border-border bg-card px-4 py-3">
                  <p className="text-sm font-medium text-foreground">Production deploy → production</p>
                  <p className="mt-0.5 text-sm">The live deployment gets its own production key.</p>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-foreground">Idempotent by design</h3>
              <p>
                Provisioning is safe to retry: exactly one active key per (project, environment) exists at any time. If
                secret injection fails, the freshly created key is revoked immediately — no orphaned credentials — and
                the retry provisions a fresh one.
              </p>

              <div className="rounded-xl border border-primary/30 bg-primary/5 px-5 py-4">
                <p className="text-sm">
                  <strong className="text-foreground">Provider credentials never enter your app.</strong> The generated
                  application receives only its own project-scoped runtime credential. Provider keys stay server-side at
                  Atai — permanently.
                </p>
              </div>
            </div>
          </section>

          {/* ─── FAQ ─── */}
          <section id="faq" style={{ opacity: isVisible("faq") ? 1 : 0.25, transition: "opacity 0.2s" }}>
            <SectionHeader icon={LifeBuoy} title="FAQ" />
            <div className="space-y-6 leading-7 text-muted-foreground">
              {[
                {
                  q: "Is @atai/sdk public?",
                  a: "Yes — it is published to the public npm registry so any application (generated or not) can install it with a plain npm install. The package is proprietary to Atai (all rights reserved): you may use it to talk to the Atai Runtime API, but its source is not open-source.",
                },
                {
                  q: "Which provider is behind ai.chat?",
                  a: "That's the point of the abstraction — you never need to know. Atai selects and operates providers server-side, normalizes every response into Atai's shapes, and never exposes provider names or wire formats through the SDK.",
                },
                {
                  q: "Can I call the Runtime API without the SDK?",
                  a: "Yes. The REST surface is documented above — POST /api/runtime/v1 with a Bearer key and a { capability, operation, input } body works from any language. The SDK exists for typed input/output, client-side validation, normalized errors, and cancellation support.",
                },
                {
                  q: "How do I get an API key for my own (non-generated) project?",
                  a: "Create a project in Atai, open Workspace → Runtime → API keys, and create a key. Generated apps get a key automatically at build time.",
                },
                {
                  q: "What happens when my credits run out?",
                  a: "Runtime requests fail with 402 runtime_insufficient_entitlement until the account is topped up. Keys stay valid — nothing is revoked; the next top-up resumes usage immediately.",
                },
                {
                  q: "Does the SDK work in the browser?",
                  a: "Technically yes (pure fetch, zero dependencies) — but runtime keys are secret credentials with no public-key variant, so a browser-embedded key is visible to end users. Route calls through your server instead. See Security Best Practices.",
                },
                {
                  q: "How do I report a problem with a specific request?",
                  a: "Capture the requestId from the thrown AtaiError (or the x-request-id response header) and contact support — it correlates to the exact server-side trace, including which stage of the lifecycle handled your request.",
                },
                {
                  q: "Is there a sandbox or test mode?",
                  a: "Use a development-environment key: identical behavior and contract, isolated usage records and limits — safe experimentation without touching production data or budgets.",
                },
              ].map(({ q, a }) => (
                <div key={q} className="rounded-xl border border-border bg-card p-5">
                  <p className="text-sm font-semibold text-foreground">{q}</p>
                  <p className="mt-2 text-sm leading-6">{a}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Bottom CTA */}
          <section className="not-prose rounded-2xl border border-border bg-card p-8 text-center">
            <Braces className="mx-auto size-8 text-primary" />
            <h2 className="mt-4 text-xl font-semibold text-foreground">Ready to build?</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Install the SDK, verify your key with one health check, and make your first AI call in under a minute.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link href="/sdk#quickstart" className={buttonVariants({ size: "sm" })}>
                Quickstart <ArrowRight className="size-3.5" />
              </Link>
              <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Open dashboard
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}

/** Tiny helper so the rotation bullet can reuse an icon inline. */
function Clock({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon className="mt-1 size-4 shrink-0 text-primary" />
}
