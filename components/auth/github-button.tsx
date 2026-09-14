"use client"

import { useSearchParams } from "next/navigation"
import { buttonVariants } from "@/components/ui/button"

/** Full-page redirect to GitHub OAuth — same pattern as GoogleButton. */
export function GitHubButton() {
  const searchParams = useSearchParams()
  const next = searchParams.get("next")
  const ref  = searchParams.get("ref")
  const params = new URLSearchParams()
  if (next) params.set("next", next)
  if (ref)  params.set("ref", ref)
  const qs   = params.toString()
  const href = `/api/auth/github${qs ? `?${qs}` : ""}`

  return (
    <a href={href} className={`${buttonVariants({ variant: "outline", size: "lg" })} w-full gap-2`}>
      {/* GitHub Mark SVG */}
      <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49 1 .11-.78.42-1.3.76-1.6-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.14 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58C20.57 21.8 24 17.3 24 12 24 5.37 18.63 0 12 0Z" />
      </svg>
      Continue with GitHub
    </a>
  )
}
