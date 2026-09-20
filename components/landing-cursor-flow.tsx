"use client"

import { useEffect, useRef } from "react"

/**
 * Pointer trail + spotlight for the marketing landing page.
 * Disabled for touch pointers and prefers-reduced-motion.
 */
export function LandingCursorFlow() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvasElement = canvasRef.current
    if (!canvasElement) return
    // Non-null-typed alias: narrowing does not reach the hoisted `function`
    // declarations below (resize/ink/frame/onMotion), so type the alias as
    // non-nullable instead of relying on control-flow narrowing.
    const canvas: HTMLCanvasElement = canvasElement

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const coarse = window.matchMedia("(pointer: coarse)")
    if (motion.matches || coarse.matches) return

    const context = canvas.getContext("2d")
    if (!context) return
    // Non-null-typed alias: narrowing does not reach the hoisted `function`
    // declarations below (frame/onMotion/cleanup), so type the alias as
    // non-nullable instead of relying on control-flow narrowing.
    const ctx: CanvasRenderingContext2D = context

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let width = 0
    let height = 0
    let mx = window.innerWidth / 2
    let my = window.innerHeight * 0.28
    let ring = 10
    let running = true
    const points: { x: number; y: number; life: number }[] = []

    function resize() {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function ink() {
      canvas.style.color = "var(--primary)"
      return getComputedStyle(canvas).color || "oklch(0.73 0.16 45)"
    }

    function onMove(e: PointerEvent) {
      mx = e.clientX
      my = e.clientY
      points.push({ x: mx, y: my, life: 1 })
      if (points.length > 42) points.shift()

      const root = document.querySelector(".lp-root") as HTMLElement | null
      if (root) {
        root.style.setProperty("--lp-mx", `${mx}px`)
        root.style.setProperty("--lp-my", `${my}px`)
      }

      const el = e.target as HTMLElement | null
      ring = el?.closest("a, button, [role='button']") ? 22 : 10
    }

    function frame() {
      if (!running) return
      ctx.clearRect(0, 0, width, height)
      const color = ink()

      for (const p of points) p.life *= 0.9
      while (points.length && points[0].life < 0.03) points.shift()

      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1]
        const b = points[i]
        ctx.beginPath()
        ctx.strokeStyle = color
        ctx.globalAlpha = b.life * 0.42
        ctx.lineWidth = 1.2 + b.life * 7
        ctx.lineCap = "round"
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }

      ctx.globalAlpha = 0.85
      ctx.beginPath()
      ctx.arc(mx, my, ring, 0, Math.PI * 2)
      ctx.strokeStyle = color
      ctx.lineWidth = 1.4
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(mx, my, 2.2, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.globalAlpha = 1

      requestAnimationFrame(frame)
    }

    resize()
    window.addEventListener("pointermove", onMove, { passive: true })
    window.addEventListener("resize", resize)
    document.documentElement.classList.add("lp-cursor-flow-on")
    requestAnimationFrame(frame)

    const onMotion = () => {
      if (motion.matches) {
        running = false
        ctx.clearRect(0, 0, width, height)
        document.documentElement.classList.remove("lp-cursor-flow-on")
      }
    }
    motion.addEventListener("change", onMotion)

    return () => {
      running = false
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("resize", resize)
      motion.removeEventListener("change", onMotion)
      document.documentElement.classList.remove("lp-cursor-flow-on")
    }
  }, [])

  return (
    <>
      <div className="lp-cursor-spot" aria-hidden />
      <canvas ref={canvasRef} className="lp-cursor-canvas" aria-hidden />
    </>
  )
}
