export interface HandoffItem {
  title: string
  body: string
}

export interface HandoffTable {
  headers: string[]
  rows: string[][]
}

export interface HandoffSection {
  id: string
  title: string
  paragraphs: string[]
  items: HandoffItem[]
  table: HandoffTable | null
}

export interface TeamHandoffModel {
  headline: string
  support: string | null
  sections: HandoffSection[]
}

const HEADING = /^(?:#{1,3}\s+)?(.+?)\s*$/
const KNOWN = /^(delivered|included demo data|demo data|payments setup|payments|next steps|what'?s included|secrets|environment)$/i
const EMOJI = /^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F\u200D\u20E3✅🎉🔔📦🚀]+\s*/u

function slug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section"
}

function clean(text: string): string {
  return text.replace(/\*\*/g, "").replace(/^[-*•]\s+/, "").replace(EMOJI, "").trim()
}

function isHeading(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed || trimmed.includes("|")) return false
  if (/^#{1,3}\s+\S/.test(trimmed)) return true
  const bare = trimmed.replace(/^#{1,3}\s+/, "")
  if (KNOWN.test(bare)) return true
  if (trimmed.length > 42 || /[.!?]$/.test(trimmed)) return false
  return /^[A-Z][A-Za-z0-9 &/'-]+$/.test(trimmed) && trimmed.split(" ").length <= 5
}

function parseTable(chunk: string): HandoffTable | null {
  const start = chunk.indexOf("|")
  if (start < 0) return null
  const cells = chunk
    .slice(start)
    .split("|")
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0)
  if (cells.length < 4) return null
  const isSep = (cell: string) => /^:?-{3,}:?$/.test(cell)
  const headers: string[] = []
  let i = 0
  while (i < cells.length && !isSep(cells[i])) {
    headers.push(cells[i])
    i += 1
  }
  while (i < cells.length && isSep(cells[i])) i += 1
  if (headers.length < 2 || i >= cells.length) return null
  const rows: string[][] = []
  while (i < cells.length) {
    rows.push(cells.slice(i, i + headers.length))
    i += headers.length
  }
  return rows.length ? { headers, rows: rows.filter((row) => row.some(Boolean)) } : null
}

function parseItems(paragraphs: string[]): { items: HandoffItem[]; rest: string[] } {
  const items: HandoffItem[] = []
  const rest: string[] = []
  for (const paragraph of paragraphs) {
    const match = paragraph.match(/^([^:]{2,72}):\s+(.+)$/s)
    if (match && !match[1].includes("http") && match[1].split(" ").length <= 8) {
      items.push({ title: clean(match[1]), body: clean(match[2]) })
    } else {
      rest.push(paragraph)
    }
  }
  return { items, rest }
}

function splitLead(text: string): { headline: string; support: string | null; rest: string } {
  const normalized = text.replace(/\r\n/g, "\n").trim()
  const parts = normalized.split(/\n{2,}/)
  const first = clean(parts[0] ?? "")
  const sentences = first.split(/(?<=[.!?])\s+/).filter(Boolean)
  const headline = sentences[0] ?? "Your application is ready."
  const support = sentences.slice(1).join(" ") || null
  return { headline, support, rest: parts.slice(1).join("\n\n") }
}

export function parseTeamHandoff(message: string): TeamHandoffModel {
  const { headline, support, rest } = splitLead(message)
  if (!rest.trim()) return { headline, support, sections: [] }

  const lines = rest.split("\n")
  const raw: { title: string; body: string[] }[] = []
  let current = { title: "Overview", body: [] as string[] }

  const push = () => {
    if (current.body.some((line) => line.trim())) raw.push(current)
  }

  for (const line of lines) {
    if (isHeading(line)) {
      push()
      current = { title: clean(line.replace(/^#{1,3}\s+/, "")), body: [] }
      continue
    }
    current.body.push(line)
  }
  push()

  const sections: HandoffSection[] = raw.map((block) => {
    const joined = block.body.join("\n").trim()
    const table = parseTable(joined)
    const withoutTable = table
      ? joined.replace(/(?:\|[^|\n]*)+\|/g, " ").replace(/\|-{3,}\|?/g, " ").replace(/\n{2,}/g, "\n\n").trim()
      : joined
    const paragraphs = withoutTable
      .split(/\n{2,}/)
      .map((p) => clean(p.replace(/\n/g, " ")))
      .filter(Boolean)
    const { items, rest: leftover } = parseItems(paragraphs)
    return {
      id: slug(block.title),
      title: block.title,
      paragraphs: leftover,
      items,
      table,
    }
  }).filter((section) => section.paragraphs.length || section.items.length || section.table)

  return { headline, support, sections }
}
