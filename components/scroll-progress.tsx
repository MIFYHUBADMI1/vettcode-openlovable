"use client"

import { useEffect, useState } from "react"

/**
 * Thin progress bar fixed to the top of the viewport. Fills left→right
 * as the user scrolls from the top to the bottom of the page.
 */
export function ScrollProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    function onScroll() {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
      if (scrollHeight <= 0) {
        setProgress(0)
        return
      }
      setProgress(Math.min((window.scrollY / scrollHeight) * 100, 100))
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div className="fixed inset-x-0 top-0 z-50 h-[3px] bg-transparent">
      <div
        className="h-full bg-primary transition-[width] duration-100 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
