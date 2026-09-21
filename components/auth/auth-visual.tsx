"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"

export function AuthVisual({
  eyebrow,
  heading,
  body,
  primary,
  secondary,
}: {
  eyebrow: string
  heading: string
  body: string
  primary: { src: string; alt: string }
  secondary?: { src: string; alt: string }
}) {
  return (
    <div className="relative mx-auto w-full max-w-3xl">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
      <h2 className="mt-3 max-w-lg text-3xl font-semibold tracking-tight text-foreground xl:text-[2.5rem] xl:leading-tight">
        {heading}
      </h2>
      <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground xl:text-base">{body}</p>

      <div className={cn("relative mt-10", secondary && "pb-16")}>
        <div
          className="pointer-events-none absolute -inset-10 rounded-[2.5rem] bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_16%,transparent),transparent_68%)]"
          aria-hidden
        />
        <figure className="relative overflow-hidden rounded-[1.5rem] border border-border/70 bg-background shadow-[0_28px_70px_-36px_rgba(79,70,229,0.5)]">
          <Image
            src={primary.src}
            alt={primary.alt}
            width={1672}
            height={941}
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="h-auto w-full object-cover object-top"
          />
        </figure>
        {secondary ? (
          <figure className="absolute bottom-0 right-0 w-[54%] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl ring-1 ring-black/5">
            <Image
              src={secondary.src}
              alt={secondary.alt}
              width={1671}
              height={941}
              sizes="(min-width: 1024px) 26vw, 40vw"
              className="h-auto w-full object-cover object-top"
            />
          </figure>
        ) : null}
      </div>
    </div>
  )
}
