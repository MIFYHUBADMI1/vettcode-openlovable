import type { Metadata } from "next"
import { LoginForm } from "@/components/auth/login-form"
import { AuthShell } from "@/components/auth/auth-shell"
import { Zap, Globe, Code2, ArrowRight, Terminal, Sparkles, Users, TrendingUp } from "lucide-react"

export const metadata: Metadata = {
  title: "Sign in — MirrorSite",
  description: "Sign in to your MirrorSite AI account.",
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Continue building with MirrorSite AI."
      footer={{ prompt: "Don't have an account?", linkLabel: "Create one", href: "/register" }}
      marketing={
        <div className="relative">
          {/* Tagline */}
          <div className="mb-10">
            <div className="auth-marketing-item mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary word-reveal">
              <Zap className="size-3.5" />
              AI-Powered App Builder
            </div>
            <h2 className="auth-marketing-item text-4xl font-bold leading-tight tracking-tight text-foreground hero-title">
              Build apps at the
              <br />
              <span className="auth-gradient-text">speed of a thought</span>
            </h2>
            <p className="auth-marketing-item mt-5 text-lg leading-relaxed text-muted-foreground hero-copy">
              Turn any website or idea into a working full-stack application in minutes. No boilerplate. No setup. Just ship.
            </p>
          </div>

          {/* Code mockup */}
          <div className="auth-marketing-item auth-code-mockup mb-8 p-4" style={{ animationDelay: "0.5s" }}>
            <div className="mb-3 flex items-center gap-1.5">
              <div className="size-2.5 rounded-full bg-destructive/60" />
              <div className="size-2.5 rounded-full bg-yellow-500/60" />
              <div className="size-2.5 rounded-full bg-success/60" />
              <span className="ml-2 font-mono text-[10px] text-muted-foreground">ai-builder.ts</span>
            </div>
            <div className="space-y-1.5 font-mono text-xs">
              <div className="code-line flex gap-2">
                <span className="text-primary/60">01</span>
                <span className="text-muted-foreground">{"const "}</span>
                <span className="text-primary">app</span>
                <span className="text-muted-foreground">{" = "}</span>
                <span className="text-success">await</span>
                <span className="text-primary">build</span>
                <span className="text-muted-foreground">{"("}</span>
              </div>
              <div className="code-line flex gap-2">
                <span className="text-primary/60">02</span>
                <span className="text-muted-foreground">{"  "}</span>
                <span className="text-accent-foreground">"https://stripe.com"</span>
                <span className="text-muted-foreground">{","}</span>
              </div>
              <div className="code-line flex gap-2">
                <span className="text-primary/60">03</span>
                <span className="text-muted-foreground">{"  { "}</span>
                <span className="text-primary">auth</span>
                <span className="text-muted-foreground">{": "}</span>
                <span className="text-success">true</span>
                <span className="text-muted-foreground">{", "}</span>
                <span className="text-primary">db</span>
                <span className="text-muted-foreground">{": "}</span>
                <span className="text-success">true</span>
                <span className="text-muted-foreground">{" }"}</span>
              </div>
              <div className="code-line flex gap-2">
                <span className="text-primary/60">04</span>
                <span className="text-muted-foreground">{")"}</span>
              </div>
              <div className="code-line flex gap-2">
                <span className="text-primary/60">05</span>
                <span className="text-muted-foreground">{"// "}</span>
                <span className="text-success">✓</span>
                <span className="text-muted-foreground">{" Deployed in "}</span>
                <span className="text-primary font-semibold">47s</span>
              </div>
            </div>
          </div>

          {/* Feature cards */}
          <div className="space-y-3">
            {[
              {
                icon: <Zap className="size-5" />,
                title: "Minutes, not months",
                desc: "AI builds your entire app — frontend, backend, database, auth — while you grab coffee.",
                iconBg: "bg-primary/10",
                iconColor: "text-primary",
              },
              {
                icon: <Globe className="size-5" />,
                title: "One-click deploy",
                desc: "Your app goes live instantly with HTTPS, CDN, and a free subdomain. Custom domains too.",
                iconBg: "bg-success/10",
                iconColor: "text-success",
              },
              {
                icon: <Code2 className="size-5" />,
                title: "Full-stack by default",
                desc: "Authentication, databases, APIs, dashboards — everything included, nothing missing.",
                iconBg: "bg-accent",
                iconColor: "text-accent-foreground",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="auth-feature-card group flex items-start gap-4 rounded-xl border border-border/60 p-4 transition-all duration-300 hover:border-primary/30 hover:bg-card/80"
              >
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${feature.iconBg} ${feature.iconColor} transition-transform duration-300 group-hover:scale-110`}>
                  {feature.icon}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{feature.title}</h3>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Builder avatars + stats */}
          <div className="auth-marketing-item mt-8 hero-copy" style={{ animationDelay: "0.8s" }}>
            <div className="flex items-center gap-4">
              <div className="flex">
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <img
                    key={i}
                    src={`/developers images/${i}.jpg`}
                    alt="Builder"
                    className="size-9 rounded-full border-2 border-background object-cover"
                    style={{ marginLeft: i > 1 ? "-8px" : 0, zIndex: 8 - i }}
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                Joined by <span className="font-semibold text-foreground">2,400+</span> builders
              </span>
            </div>
            <div className="mt-4 flex items-center gap-5">
              <div className="auth-stat flex items-center gap-2">
                <TrendingUp className="size-4 text-success" />
                <span className="text-sm font-semibold text-foreground">12K+</span>
                <span className="text-xs text-muted-foreground">apps shipped</span>
              </div>
              <div className="auth-stat flex items-center gap-2">
                <Sparkles className="size-4 text-accent-foreground" />
                <span className="text-sm font-semibold text-foreground">99.9%</span>
                <span className="text-xs text-muted-foreground">uptime</span>
              </div>
            </div>
          </div>

          {/* CTA teaser */}
          <div className="auth-marketing-item mt-8 hero-copy" style={{ animationDelay: "0.9s" }}>
            <a href="/register" className="group inline-flex items-center gap-2 text-sm font-medium text-primary transition-all hover:gap-3">
              Start building for free
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </div>
      }
    >
      <LoginForm searchParams={searchParams} />
    </AuthShell>
  )
}
