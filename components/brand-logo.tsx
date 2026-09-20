import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"

export function BrandMark({
  size = 32,
  className,
  priority = false,
}: {
  size?: number
  className?: string
  priority?: boolean
}) {
  return (
    <Image
      src="/favicon.png"
      alt="Atai"
      width={size}
      height={size}
      priority={priority}
      className={cn("shrink-0 object-contain", className)}
    />
  )
}

export function BrandLogo({
  href = "/",
  size = 32,
  withWordmark = true,
  priority = false,
  className,
}: {
  href?: string
  size?: number
  withWordmark?: boolean
  priority?: boolean
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2.5", className)}
    >
      <BrandMark size={size} priority={priority} className={withWordmark ? "" : undefined} />
      {withWordmark && (
        <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
          Atai
        </span>
      )}
    </Link>
  )
}
