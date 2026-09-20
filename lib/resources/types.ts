export const RESOURCE_CATEGORIES = [
  "start",
  "build",
  "launch",
  "grow",
  "ai",
  "atai",
  "templates",
  "glossary",
] as const

export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number]

export const RESOURCE_TYPES = [
  "guide",
  "playbook",
  "tutorial",
  "checklist",
  "template",
  "glossary",
  "documentation",
] as const

export type ResourceType = (typeof RESOURCE_TYPES)[number]

export type ResourceDifficulty = "beginner" | "intermediate" | "advanced"

export type ResourceBlock =
  | { type: "p"; text: string }
  | { type: "h2"; id: string; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "callout"; kind: "tip" | "important" | "warning" | "example" | "takeaway"; title: string; text: string }
  | { type: "faq"; items: { q: string; a: string }[] }

export type Resource = {
  slug: string
  category: ResourceCategory
  type: ResourceType
  title: string
  description: string
  topics: string[]
  difficulty: ResourceDifficulty
  readingMinutes: number
  publishedAt: string
  updatedAt: string
  featured?: boolean
  related: string[]
  body: ResourceBlock[]
}

export type ResourceSummary = Omit<Resource, "body"> & {
  href: string
  searchText: string
}

export const CATEGORY_META: Record<
  ResourceCategory,
  { label: string; title: string; description: string }
> = {
  start: {
    label: "Start",
    title: "Start from an idea",
    description: "Validate problems, understand customers, and decide whether an idea is worth building.",
  },
  build: {
    label: "Build",
    title: "Build the product",
    description: "Plan, scope, and ship an MVP without turning every idea into extra surface area.",
  },
  launch: {
    label: "Launch",
    title: "Launch into the market",
    description: "Get a first version in front of real people with a clear offer and a simple plan.",
  },
  grow: {
    label: "Grow",
    title: "Grow after launch",
    description: "Find early customers, learn from usage, and improve what already works.",
  },
  ai: {
    label: "AI",
    title: "Use AI with intent",
    description: "Understand AI agents, workflows, and where they help a founder move faster.",
  },
  atai: {
    label: "Atai",
    title: "Learn Atai",
    description: "How Atai works, how to start, and how Idea, Mirror, URL, and GitHub modes differ.",
  },
  templates: {
    label: "Templates",
    title: "Templates and checklists",
    description: "Reusable lists and worksheets you can copy into your own process.",
  },
  glossary: {
    label: "Glossary",
    title: "Glossary",
    description: "Short definitions of product, business, and software terms used across Atai.",
  },
}

export const TYPE_LABEL: Record<ResourceType, string> = {
  guide: "Guide",
  playbook: "Playbook",
  tutorial: "Tutorial",
  checklist: "Checklist",
  template: "Template",
  glossary: "Glossary",
  documentation: "Documentation",
}

export function resourceHref(resource: Pick<Resource, "category" | "slug">) {
  return `/resources/${resource.category}/${resource.slug}`
}

export function resourcePathId(resource: Pick<Resource, "category" | "slug">) {
  return `${resource.category}/${resource.slug}`
}
