import type { Metadata } from "next"
import { AuthShell } from "@/components/auth/auth-shell"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"
import { Shield, Clock, CheckCircle2, ArrowRight, Lock, Eye, Fingerprint, Users, Zap } from "lucide-react"

export const metadata: Metadata = {
  title: "Forgot password — MirrorSite",
  description: "Reset your MirrorSite AI password.",
}

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Forgot password?"
      subtitle="Enter your email and we&apos;ll send you a secure reset link."
      footer={{ prompt: "Remembered your password?", linkLabel: "Sign in", href: "/login" }}
      marketing={
        <div className="relative">
          {/* Tagline */}
          <div className="mb-10">
            <div className="auth-marketing-item mb-4 inline-flex items-center gap-2 rounded-full border border-success/20 bg-success/10 px-4 py-1.5 text-xs font-medium text-success word-reveal">
              <Shield className="size-3.5" />
              Secure Reset
            </div>
            <h2 className="auth-marketing-item text-4xl font-bold leading-tight tracking-tight text-foreground hero-title">
              Get back to
              <br />
              <span className="auth-gradient-text">building fast</span>
            </h2>
            <p className="auth-marketing-item mt-5 text-lg leading-relaxed text-muted-foreground hero-copy">
              Happens to the best of us. We&apos;ll get you back into your account in under a minute.
            </p>
          </div>

          {/* Security features */}
          <div className="auth-marketing-item mb-8 grid grid-cols-3 gap-3" style={{ animationDelay: "0.4s" }}>
            {[
              { icon: <Lock className="size-4" />, label: "Encrypted", color: "text-primary" },
              { icon: <Eye className="size-4" />, label: "Private", color: "text-accent-foreground" },
              { icon: <Fingerprint className="size-4" />, label: "Verified", color: "text-success" },
            ].map((feature) => (
              <div
                key={feature.label}
                className="auth-badge flex flex-col items-center gap-1.5 rounded-xl border border-border/60 bg-card/50 p-3 text-center transition-all duration-300 hover:border-primary/30 hover:bg-card/80"
              >
                <span className={feature.color}>{feature.icon}</span>
                <span className="text-xs font-medium text-foreground">{feature.label}</span>
              </div>
            ))}
          </div>

          {/* How it works */}
          <div className="space-y-4">
            {[
              {
                icon: <Shield className="size-5" />,
                title: "We verify it's you",
                desc: "A secure, time-limited link is sent to your registered email address.",
                iconBg: "bg-primary/10",
                iconColor: "text-primary",
              },
              {
                icon: <Clock className="size-5" />,
                title: "Link expires in 1 hour",
                desc: "For your security, the reset link automatically invalidates after 60 minutes.",
                iconBg: "bg-accent",
                iconColor: "text-accent-foreground",
              },
              {
                icon: <CheckCircle2 className="size-5" />,
                title: "Set a new password",
                desc: "Choose a strong password and you're back in. All your projects stay intact.",
                iconBg: "bg-success/10",
                iconColor: "text-success",
              },
            ].map((step) => (
              <div
                key={step.title}
                className="auth-feature-card group flex items-start gap-4 rounded-xl border border-border/60 p-4 transition-all duration-300 hover:border-primary/30 hover:bg-card/80"
              >
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${step.iconBg} ${step.iconColor} transition-transform duration-300 group-hover:scale-110`}>
                  {step.icon}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Social proof */}
          <div className="auth-marketing-item mt-8 flex items-center gap-4 text-sm text-muted-foreground hero-copy" style={{ animationDelay: "0.7s" }}>
            <div className="flex">
              {[1, 2, 3, 4, 5].map((i) => (
                <img
                  key={i}
                  src={`/developers images/${i}.jpg`}
                  alt="Builder"
                  className="size-9 rounded-full border-2 border-background object-cover"
                  style={{ marginLeft: i > 1 ? "-8px" : 0, zIndex: 6 - i }}
                />
              ))}
            </div>
            <span>
              Trusted by <span className="font-medium text-foreground">2,400+</span> builders
            </span>
          </div>

          {/* Security note */}
          <div className="auth-marketing-item mt-8 rounded-xl border border-border/60 bg-card/50 p-4 hero-copy shimmer-border" style={{ animationDelay: "0.8s" }}>
            <p className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Your data is safe.</span> Resetting your password won&apos;t affect your projects, credits, or deployments. Everything stays exactly as you left it.
            </p>
          </div>

          {/* CTA teaser */}
          <div className="auth-marketing-item mt-8 hero-copy" style={{ animationDelay: "0.9s" }}>
            <a href="/register" className="group inline-flex items-center gap-2 text-sm font-medium text-primary transition-all hover:gap-3">
              Need a new account? Create one
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </div>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  )
}
