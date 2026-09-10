"use client"

import { useSearchParams } from "next/navigation"
import { buttonVariants } from "@/components/ui/button"

/** Plain link styled as a button — the Google flow is a full-page redirect
 * (`/api/auth/google`), not a client fetch, so no JS handler is needed. */
export function GoogleButton() {
  const searchParams = useSearchParams()
  const ref = searchParams.get("ref")
  const href = ref ? `/api/auth/google?ref=${encodeURIComponent(ref)}` : "/api/auth/google"
  const className = `${buttonVariants({ variant: "outline", size: "lg" })} w-full`

  return (
    <a href={href} className={className}>
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
          <path
            fill="#4285F4"
            d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v2.97h3.86c2.26-2.09 3.56-5.17 3.56-8.79Z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-2.97c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.07C3.26 21.3 7.31 24 12 24Z"
          />
          <path fill="#FBBC05" d="M5.27 14.31A7.19 7.19 0 0 1 4.9 12c0-.8.14-1.58.37-2.31V6.62H1.28A11.96 11.96 0 0 0 0 12c0 1.93.46 3.76 1.28 5.38l3.99-3.07Z" />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.28 6.62l3.99 3.07C6.22 6.86 8.87 4.75 12 4.75Z"
          />
        </svg>
        Continue with Google
      </a>
  )
}
