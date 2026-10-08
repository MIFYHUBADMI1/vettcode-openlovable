"use client"

import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { Components } from "react-markdown"

const components: Components = {
  h1: ({ children }) => (
    <h2 className="mt-4 mb-2 border-b border-border/80 pb-1.5 text-[15px] font-semibold tracking-tight text-foreground first:mt-0">
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h2 className="mt-4 mb-2 border-b border-border/80 pb-1.5 text-[15px] font-semibold tracking-tight text-foreground first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-3 mb-1 text-sm font-semibold text-foreground first:mt-0">{children}</h4>
  ),
  p: ({ children }) => <p className="my-2 text-sm leading-6 text-foreground/90 first:mt-0 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic text-foreground/85">{children}</em>,
  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-1.5 pl-4 text-sm leading-6 text-foreground/90 marker:text-primary first:mt-0 last:mb-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1.5 pl-5 text-sm leading-6 text-foreground/90 marker:font-medium marker:text-primary first:mt-0 last:mb-0">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  a: ({ href, children }) => (
    <a href={href} className="font-medium text-primary underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-3 rounded-r-lg border-l-2 border-primary/50 bg-primary/5 px-3 py-2 text-sm leading-6 text-foreground/90 first:mt-0 last:mb-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-border" />,
  code: ({ children, className }) => {
    const isBlock = Boolean(className)
    if (isBlock) {
      return <code className={className}>{children}</code>
    }
    return (
      <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-primary">{children}</code>
    )
  },
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 text-[12px] leading-5 text-foreground">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-border first:mt-0 last:mb-0">
      <table className="w-full min-w-[28rem] border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/70">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-border/80">{children}</tbody>,
  tr: ({ children }) => <tr className="align-top">{children}</tr>,
  th: ({ children }) => (
    <th className="whitespace-nowrap px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="px-3 py-2.5 text-sm leading-6 text-foreground/90">{children}</td>,
}

export function CofounderMarkdown({ children }: { children: string }) {
  return (
    <div className="cofounder-md">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </Markdown>
    </div>
  )
}
