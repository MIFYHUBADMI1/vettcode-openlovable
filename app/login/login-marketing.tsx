"use client"

import { Brain, Rocket, TrendingUp, ArrowRight, Building2, Users, Lightbulb } from "lucide-react"

export function LoginMarketing() {
  return (
    <div className="relative">

      {/* Eyebrow */}
      <div className="mb-10">
        <div className="auth-marketing-item mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary word-reveal">
          <Building2 className="size-3.5" />
          The AI Business-Building Platform
        </div>
        <h2 className="auth-marketing-item text-4xl font-black leading-tight tracking-tight text-foreground hero-title">
          Your team is
          <br />
          <span className="auth-gradient-text">already here.</span>
        </h2>
        <p className="auth-marketing-item mt-5 text-lg leading-relaxed text-muted-foreground hero-copy">
          Sign back in and pick up where you left off. Your AI co-founder,
          engineering team, and everything you need to build and grow — waiting for you.
        </p>
      </div>

      {/* Journey progress mockup */}
      <div className="auth-marketing-item auth-code-mockup mb-8 p-5" style={{ animationDelay: "0.5s" }}>
        <p className="mb-4 font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Your business journey
        </p>
        <div className="space-y-3">
          {[
            { n: "01", label: "Imagine", done: true, active: false },
            { n: "02", label: "Plan", done: true, active: false },
            { n: "03", label: "Build", done: false, active: true },
            { n: "04", label: "Launch", done: false, active: false },
            { n: "05", label: "Grow", done: false, active: false },
          ].map(({ n, label, done, active }) => (
            <div key={n} className="flex items-center gap-3">
              <span className={`flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold transition-colors
                ${done ? "bg-primary/30 text-primary" :
                  active ? "bg-primary text-primary-foreground animate-pulse" :
                    "bg-border/50 text-muted-foreground/40"}`}>
                {done ? "✓" : n}
              </span>
              <span className={`text-sm font-medium transition-colors
                ${done ? "text-muted-foreground line-through" :
                  active ? "text-foreground font-bold" :
                    "text-muted-foreground/40"}`}>
                {label}
              </span>
              {active && (
                <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-primary">
                  In progress
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* What's waiting for you */}
      <div className="space-y-3">
        {[
          {
            icon: <Brain className="size-5" />,
            title: "Your AI Co-Founder",
            desc: "Your strategic partner is ready to help you think through the next move.",
            iconBg: "bg-violet-500/10",
            iconColor: "text-violet-400",
          },
          {
            icon: <Rocket className="size-5" />,
            title: "Your Engineering Team",
            desc: "Plans, builds, and deploys your product — frontend, backend, database, auth, payments.",
            iconBg: "bg-primary/10",
            iconColor: "text-primary",
          },
          {
            icon: <TrendingUp className="size-5" />,
            title: "Your Growth Team",
            desc: "Launch strategy, SEO, customer acquisition, and analytics — ready when you are.",
            iconBg: "bg-emerald-500/10",
            iconColor: "text-emerald-400",
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

      {/* Social proof */}
      <div className="auth-marketing-item mt-8 hero-copy" style={{ animationDelay: "0.8s" }}>
        <div className="flex items-center gap-4">
          <div className="flex">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <img
                key={i}
                src={`/developers images/${i}.jpg`}
                alt="Founder"
                className="size-9 rounded-full border-2 border-background object-cover"
                style={{ marginLeft: i > 1 ? "-8px" : 0, zIndex: 8 - i }}
              />
            ))}
          </div>
          <span className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">2,400+</span> founders building with Atai
          </span>
        </div>
        <div className="mt-4 flex items-center gap-5">
          <div className="auth-stat flex items-center gap-2">
            <Lightbulb className="size-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">12K+</span>
            <span className="text-xs text-muted-foreground">businesses started</span>
          </div>
          <div className="auth-stat flex items-center gap-2">
            <Users className="size-4 text-emerald-400" />
            <span className="text-sm font-semibold text-foreground">99.9%</span>
            <span className="text-xs text-muted-foreground">platform uptime</span>
          </div>
        </div>
      </div>

      {/* CTA teaser */}
      <div className="auth-marketing-item mt-8 hero-copy" style={{ animationDelay: "0.9s" }}>
        <a href="/register" className="group inline-flex items-center gap-2 text-sm font-medium text-primary transition-all hover:gap-3">
          Don&apos;t have an account? Start free
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </a>
      </div>
    </div>
  )
}
