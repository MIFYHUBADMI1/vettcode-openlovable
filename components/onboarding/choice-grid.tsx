"use client"

import { cn } from "@/lib/utils"

export function ChoiceGrid({
  label,
  value,
  options,
  onChange,
  layout = "chips",
}: {
  label?: string
  value?: string
  options: readonly { id: string; label: string; hint?: string }[]
  onChange: (id: string) => void
  layout?: "chips" | "cards"
}) {
  const dense = layout === "cards" && options.length > 4

  return (
    <fieldset className="min-h-0">
      {label ? <legend className="mb-2 text-sm font-medium text-muted-foreground">{label}</legend> : null}
      <div
        className={cn(
          layout === "cards"
            ? dense
              ? "grid grid-cols-2 gap-2 sm:grid-cols-3"
              : "grid gap-2"
            : "flex flex-wrap gap-2",
        )}
      >
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            title={option.hint}
            onClick={() => onChange(option.id)}
            className={cn(
              "text-left transition-colors",
              layout === "cards"
                ? dense
                  ? "rounded-xl border px-3 py-2.5"
                  : "rounded-2xl border px-4 py-3"
                : "rounded-full border px-3 py-1.5 text-sm",
              value === option.id
                ? "border-indigo-500/50 bg-indigo-500/10 text-foreground"
                : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground",
            )}
          >
            <span className={layout === "cards" ? "block text-sm font-medium leading-5 text-foreground" : undefined}>
              {option.label}
            </span>
            {layout === "cards" && option.hint && !dense ? (
              <span className="mt-1 block text-sm leading-5 text-muted-foreground">{option.hint}</span>
            ) : null}
            {layout === "cards" && option.hint && dense ? (
              <span className="mt-0.5 block truncate text-xs leading-4 text-muted-foreground">{option.hint}</span>
            ) : null}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
