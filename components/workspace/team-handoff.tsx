"use client"

import { useMemo, useState } from "react"
import { Check, Copy } from "lucide-react"
import { parseTeamHandoff, type HandoffSection } from "@/lib/workspace/build-handoff"
import { cn } from "@/lib/utils"

export function TeamHandoff({ message }: { message: string }) {
  const handoff = useMemo(() => parseTeamHandoff(message), [message])

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-5 py-5 sm:px-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">From your team</p>
        <h2 className="mt-2 max-w-2xl text-xl font-semibold tracking-tight text-balance sm:text-[1.35rem]">
          {handoff.headline}
        </h2>
        {handoff.support ? (
          <p className="mt-2 max-w-2xl text-[15px] leading-7 text-muted-foreground">{handoff.support}</p>
        ) : null}
      </div>

      <div className="divide-y divide-border">
        {handoff.sections.map((section) => (
          <HandoffBlock key={section.id} section={section} />
        ))}
      </div>
    </section>
  )
}

function HandoffBlock({ section }: { section: HandoffSection }) {
  return (
    <div className="px-5 py-5 sm:px-6">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{section.title}</h3>

      {section.items.length > 0 ? (
        <ul className="mt-4 grid gap-3">
          {section.items.map((item) => (
            <li key={item.title} className="flex gap-3">
              <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full border border-border bg-muted/50 text-foreground">
                <Check className="size-3" strokeWidth={2.5} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium tracking-tight text-foreground">{item.title}</p>
                <p className="mt-1 text-[13px] leading-6 text-muted-foreground">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {section.paragraphs.map((paragraph) => (
        <p key={paragraph.slice(0, 40)} className="mt-3 max-w-2xl text-[15px] leading-7 text-muted-foreground">
          {paragraph}
        </p>
      ))}

      {section.table ? <CredentialTable headers={section.table.headers} rows={section.table.rows} /> : null}
    </div>
  )
}

function CredentialTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  const secretIndex = headers.findIndex((header) => /password|secret|key/i.test(header))

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-muted/30">
      <table className="w-full min-w-[28rem] text-left text-sm">
        <thead>
          <tr className="border-b border-border">
            {headers.map((header) => (
              <th key={header} className="px-3 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.join("-")} className={cn(rowIndex > 0 && "border-t border-border/80")}>
              {headers.map((header, index) => (
                <td key={header} className="px-3 py-2.5 align-middle">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={cn("truncate", index === 0 || index === secretIndex ? "font-mono text-[13px]" : "text-sm")}>
                      {row[index] ?? ""}
                    </span>
                    {index === secretIndex && row[index] ? <CopyValue value={row[index]} /> : null}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
      aria-label="Copy"
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1200)
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  )
}
