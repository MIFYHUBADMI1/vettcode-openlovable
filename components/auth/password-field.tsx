"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export function PasswordField({
  id,
  label = "Password",
  value,
  onChange,
  autoComplete,
  disabled,
  required = true,
  minLength,
  hint,
  className,
}: {
  id: string
  label?: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
  disabled?: boolean
  required?: boolean
  minLength?: number
  hint?: string
  className?: string
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="h-11 pr-11"
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setVisible((open) => !open)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
