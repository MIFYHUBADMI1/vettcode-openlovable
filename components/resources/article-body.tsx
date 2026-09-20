import type { ResourceBlock } from "@/lib/resources"
import { cn } from "@/lib/utils"

const CALLOUT: Record<string, string> = {
  tip: "border-indigo-500/25 bg-indigo-500/8",
  important: "border-amber-500/30 bg-amber-500/8",
  warning: "border-destructive/30 bg-destructive/8",
  example: "border-border bg-muted/40",
  takeaway: "border-emerald-500/25 bg-emerald-500/8",
}

export function ArticleBody({ blocks }: { blocks: ResourceBlock[] }) {
  return (
    <div className="flex flex-col gap-5 text-[15px] leading-7 text-foreground">
      {blocks.map((block, index) => {
        if (block.type === "p") return <p key={index}>{block.text}</p>
        if (block.type === "h2") {
          return (
            <h2 key={block.id} id={block.id} className="scroll-mt-24 pt-4 text-xl font-semibold tracking-tight">
              {block.text}
            </h2>
          )
        }
        if (block.type === "ul") {
          return (
            <ul key={index} className="list-disc space-y-2 pl-5">
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )
        }
        if (block.type === "ol") {
          return (
            <ol key={index} className="list-decimal space-y-2 pl-5">
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          )
        }
        if (block.type === "callout") {
          return (
            <aside key={index} className={cn("rounded-2xl border px-4 py-3", CALLOUT[block.kind])}>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{block.title}</p>
              <p className="mt-1.5">{block.text}</p>
            </aside>
          )
        }
        return (
          <section key={index} className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Frequently asked questions</h2>
            <dl className="mt-4 space-y-4">
              {block.items.map((item) => (
                <div key={item.q}>
                  <dt className="font-medium">{item.q}</dt>
                  <dd className="mt-1 text-muted-foreground">{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        )
      })}
    </div>
  )
}
