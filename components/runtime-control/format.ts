export function formatCredits(n: number): string {
  return `${Math.round(n).toLocaleString()} credits`
}

export function formatUsd(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "Unavailable"
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(amount)
}

export function formatWhen(ts: number | null | undefined): string {
  if (!ts) return "—"
  return new Date(ts).toLocaleString()
}

export function formatPct(rate: number | null | undefined): string {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) return "—"
  return `${Math.round(rate * 1000) / 10}%`
}
