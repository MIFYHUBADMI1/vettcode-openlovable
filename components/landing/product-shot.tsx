"use client"

import { useCallback, useRef, useState, type MouseEvent } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function usePointerMotion() {
  const frame = useRef<number>(0)
  const [motion, setMotion] = useState({ x: 0, y: 0, px: 50, py: 50, active: false })

  const onMove = useCallback((event: MouseEvent<HTMLElement>) => {
    if (prefersReducedMotion()) return
    const rect = event.currentTarget.getBoundingClientRect()
    const px = ((event.clientX - rect.left) / rect.width) * 100
    const py = ((event.clientY - rect.top) / rect.height) * 100
    const x = (px - 50) / 50
    const y = (py - 50) / 50
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      setMotion({ x, y, px, py, active: true })
    })
  }, [])

  const onLeave = useCallback(() => {
    cancelAnimationFrame(frame.current)
    setMotion({ x: 0, y: 0, px: 50, py: 50, active: false })
  }, [])

  return { motion, onMove, onLeave }
}

function ShotFrame({
  src,
  alt,
  width,
  height,
  priority = false,
  sizes,
  className,
}: {
  src: string
  alt: string
  width: number
  height: number
  priority?: boolean
  sizes: string
  className?: string
}) {
  return (
    <div className={cn("lp-shot overflow-hidden rounded-[1.5rem] border border-border/70 bg-background shadow-[0_20px_50px_-28px_rgba(79,70,229,0.38)]", className)}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        sizes={sizes}
        className="lp-shot-img h-auto w-full object-contain"
      />
    </div>
  )
}

export function ProductShot({
  src,
  alt,
  width,
  height,
  priority = false,
  glow = false,
  label,
  className,
}: {
  src: string
  alt: string
  width: number
  height: number
  priority?: boolean
  glow?: boolean
  label?: string
  className?: string
}) {
  const { motion, onMove, onLeave } = usePointerMotion()

  return (
    <figure
      className={cn("lp-shot-wrap group relative", className)}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{
        transform: `perspective(1200px) rotateX(${motion.y * -4}deg) rotateY(${motion.x * 6}deg) translate3d(${motion.x * 6}px, ${motion.y * 6}px, 0)`,
      }}
    >
      {glow && (
        <div
          className="absolute -inset-8 -z-10 rounded-[2.5rem] bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.22),transparent_70%)] blur-2xl transition-opacity duration-500 group-hover:opacity-100"
          aria-hidden
        />
      )}
      {label && (
        <figcaption className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">
          {label}
        </figcaption>
      )}
      <div className="relative">
        <ShotFrame
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          sizes={priority ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 42vw, 100vw"}
        />
        <span
          className="pointer-events-none absolute inset-0 rounded-[1.5rem] opacity-0 mix-blend-soft-light transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: `radial-gradient(420px circle at ${motion.px}% ${motion.py}%, rgba(165,180,252,0.45), transparent 55%)`,
          }}
          aria-hidden
        />
      </div>
    </figure>
  )
}

export function HeroProductStack({ className }: { className?: string }) {
  const { motion, onMove, onLeave } = usePointerMotion()
  const hover = motion.active

  return (
    <div
      className={cn("lp-shot-wrap relative isolate w-full", className)}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <div
        className="absolute -inset-10 -z-10 rounded-[3rem] bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.24),transparent_68%)] blur-2xl"
        aria-hidden
      />

      <div
        className="relative"
        style={{
          transform: `translate3d(${motion.x * 8}px, ${motion.y * 6}px, 0)`,
        }}
      >
        <div
          className="lp-stack-back w-[94%]"
          style={{
            transform: `translate3d(0, ${hover ? -8 : 0}px, 0) scale(${hover ? 1.02 : 1})`,
          }}
        >
          <ShotFrame
            src="/landing-images/atai-workspace.png"
            alt="Atai founder workspace with overview, team, and AI collaboration"
            width={1672}
            height={941}
            priority
            sizes="(min-width: 1024px) 42vw, 90vw"
            className="shadow-[0_24px_60px_-24px_rgba(79,70,229,0.45)]"
          />
        </div>

        <div
          className="lp-stack-front relative z-10 -mt-8 ml-[6%] w-[94%] sm:-mt-10 lg:-mt-12"
          style={{
            transform: `translate3d(0, ${hover ? 8 : 0}px, 0) scale(${hover ? 1.03 : 1})`,
          }}
        >
          <ShotFrame
            src="/landing-images/atai-project-workspace.png"
            alt="Atai workspace with business overview, AI co-founder, and the live product on desktop and mobile"
            width={1536}
            height={1024}
            priority
            sizes="(min-width: 1024px) 48vw, 92vw"
            className="shadow-[0_28px_70px_-22px_rgba(37,99,235,0.5)]"
          />
          <span
            className="pointer-events-none absolute inset-0 rounded-[1.5rem] opacity-0 mix-blend-soft-light transition-opacity duration-300"
            style={{
              opacity: motion.active ? 1 : 0,
              background: `radial-gradient(380px circle at ${motion.px}% ${motion.py}%, rgba(196,181,253,0.4), transparent 55%)`,
            }}
            aria-hidden
          />
        </div>
      </div>
    </div>
  )
}


