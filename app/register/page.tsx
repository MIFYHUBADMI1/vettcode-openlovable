import type { Metadata } from "next"
import { Suspense } from "react"
import { RegisterForm } from "@/components/auth/register-form"
import { AuthShell } from "@/components/auth/auth-shell"
import { Rocket, Shield, CreditCard, Sparkles, ArrowRight, Code2, Palette, Lightbulb, Users, Zap, CheckCircle2 } from "lucide-react"

export const metadata: Metadata = {
  title: "Create account — MirrorSite",
  description: "Create a MirrorSite AI account.",
  robots: { index: false, follow: false },
}

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Start turning websites into working apps."
      footer={{ prompt: "Already have an account?", linkLabel: "Sign in", href: "/login" }}
      marketing={
        <div className="relative">
          {/* Tagline */}
          <div className="mb-10">
            <div className="auth-marketing-item mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary word-reveal">
              <Rocket className="size-3.5" />
              Free to start
            </div>
            <h2 className="auth-marketing-item text-4xl font-bold leading-tight tracking-tight text-foreground hero-title">
              Your next app
              <br />
              <span className="auth-gradient-text">starts here</span>
            </h2>
            <p className="auth-marketing-item mt-5 text-lg leading-relaxed text-muted-foreground hero-copy">
              Sign up and get <span className="font-semibold text-foreground">500 free credits</span> to build your first application. No credit card required.
            </p>
          </div>

          {/* Who it's for */}
          <div className="auth-marketing-item mb-8 grid grid-cols-3 gap-3" style={{ animationDelay: "0.4s" }}>
            {[
              { icon: <Code2 className="size-4" />, label: "Developers", color: "text-primary" },
              { icon: <Palette className="size-4" />, label: "Designers", color: "text-accent-foreground" },
              { icon: <Lightbulb className="size-4" />, label: "Founders", color: "text-success" },
            ].map((persona) => (
              <div
                key={persona.label}
                className="auth-badge flex flex-col items-center gap-1.5 rounded-xl border border-border/60 bg-card/50 p-3 text-center transition-all duration-300 hover:border-primary/30 hover:bg-card/80"
              >
                <span className={persona.color}>{persona.icon}</span>
                <span className="text-xs font-medium text-foreground">{persona.label}</span>
              </div>
            ))}
          </div>

          {/* Steps */}
          <div className="mb-10 space-y-4">
            {[
              {
                step: "1",
                title: "Sign up in seconds",
                desc: "Google or email — your choice. Instant access, no waiting.",
              },
              {
                step: "2",
                title: "Describe your app",
                desc: "Paste a URL or describe your idea. Our AI does the heavy lifting.",
              },
              {
                step: "3",
                title: "Ship to production",
                desc: "One click and your app is live with HTTPS, CDN, and a custom domain.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="auth-step-item flex items-start gap-4"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-sm font-bold text-primary">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Trust badges */}
          <div className="auth-marketing-item flex flex-wrap gap-3 hero-copy" style={{ animationDelay: "0.7s" }}>
            {[
              { icon: <Shield className="size-4" />, label: "No credit card" },
              { icon: <CreditCard className="size-4" />, label: "500 free credits" },
              { icon: <Zap className="size-4" />, label: "Instant setup" },
            ].map((badge) => (
              <div
                key={badge.label}
                className="auth-badge flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-2 text-xs text-muted-foreground transition-colors duration-300 hover:border-primary/30 hover:bg-card"
              >
                <span className="text-primary">{badge.icon}</span>
                {badge.label}
              </div>
            ))}
          </div>

          {/* Social proof */}
          <div className="auth-marketing-item mt-8 flex items-center gap-4 text-sm text-muted-foreground hero-copy" style={{ animationDelay: "0.85s" }}>
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
            <span>
              Joined by <span className="font-medium text-foreground">2,400+</span> builders
            </span>
          </div>

          {/* CTA teaser */}
          <div className="auth-marketing-item mt-8 hero-copy" style={{ animationDelay: "0.95s" }}>
            <a href="/login" className="group inline-flex items-center gap-2 text-sm font-medium text-primary transition-all hover:gap-3">
              Already have an account? Sign in
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </div>
      }
    >
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  )
}
