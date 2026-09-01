import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Ensure a URL string always has a protocol prefix.
 * Totalum returns bare hostnames like "mirror-xxx.totalum-project.com"
 * which browsers treat as relative paths when used in href/src attributes. */
export function ensureProtocol(url: string | undefined | null): string {
  if (!url) return ""
  if (url.startsWith("http://") || url.startsWith("https://")) return url
  return `https://${url}`
}
