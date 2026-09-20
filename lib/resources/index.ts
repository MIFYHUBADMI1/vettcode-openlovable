import { RESOURCES } from "@/lib/resources/catalog"
import {
  CATEGORY_META,
  RESOURCE_CATEGORIES,
  resourceHref,
  resourcePathId,
  type Resource,
  type ResourceCategory,
  type ResourceSummary,
} from "@/lib/resources/types"

export {
  CATEGORY_META,
  RESOURCE_CATEGORIES,
  TYPE_LABEL,
  resourceHref,
  resourcePathId,
} from "@/lib/resources/types"
export type {
  Resource,
  ResourceBlock,
  ResourceCategory,
  ResourceSummary,
  ResourceType,
} from "@/lib/resources/types"

function searchBlob(resource: Resource) {
  const body = resource.body
    .map((block) => {
      if (block.type === "p" || block.type === "h2") return block.text
      if (block.type === "ul" || block.type === "ol") return block.items.join(" ")
      if (block.type === "callout") return `${block.title} ${block.text}`
      if (block.type === "faq") return block.items.map((item) => `${item.q} ${item.a}`).join(" ")
      return ""
    })
    .join(" ")
  return [resource.title, resource.description, resource.category, resource.type, resource.topics.join(" "), body]
    .join(" ")
    .toLowerCase()
}

export function summarize(resource: Resource): ResourceSummary {
  return {
    slug: resource.slug,
    category: resource.category,
    type: resource.type,
    title: resource.title,
    description: resource.description,
    topics: resource.topics,
    difficulty: resource.difficulty,
    readingMinutes: resource.readingMinutes,
    publishedAt: resource.publishedAt,
    updatedAt: resource.updatedAt,
    featured: resource.featured,
    related: resource.related,
    href: resourceHref(resource),
    searchText: searchBlob(resource),
  }
}

export function allResources() {
  return RESOURCES
}

export function allSummaries(): ResourceSummary[] {
  return RESOURCES.map(summarize)
}

export function featuredResource() {
  return RESOURCES.find((resource) => resource.featured) ?? RESOURCES[0]
}

export function resourcesByCategory(category: ResourceCategory) {
  return RESOURCES.filter((resource) => resource.category === category)
}

export function getResource(category: string, slug: string) {
  return RESOURCES.find((resource) => resource.category === category && resource.slug === slug) ?? null
}

export function getResourceById(id: string) {
  const [category, slug] = id.split("/")
  if (!category || !slug) return null
  return getResource(category, slug)
}

export function relatedResources(resource: Resource) {
  return resource.related
    .map((id) => getResourceById(id))
    .filter((item): item is Resource => Boolean(item))
}

export function isResourceCategory(value: string): value is ResourceCategory {
  return (RESOURCE_CATEGORIES as readonly string[]).includes(value)
}

export const LEARNING_PATHS = [
  {
    id: "idea-to-launch",
    title: "From idea to launch",
    description: "Validate, scope an MVP, then put it in front of real people.",
    steps: [
      "start/how-to-validate-a-business-idea",
      "start/founder-fundamentals",
      "build/product-requirements",
      "build/how-to-build-an-mvp",
      "launch/how-to-launch-a-product",
      "launch/launch-checklist",
      "grow/find-early-customers",
    ],
  },
  {
    id: "start-with-atai",
    title: "Start with Atai",
    description: "Learn the product, then pick the mode that matches your starting point.",
    steps: [
      "atai/what-is-atai",
      "atai/how-atai-works",
      "atai/getting-started-with-atai",
      "atai/idea-mode",
      "atai/mirror-and-url-mode",
      "atai/github-mode",
    ],
  },
  {
    id: "build-with-ai",
    title: "Build with AI",
    description: "Use agents and Atai without treating AI as a substitute for customer evidence.",
    steps: [
      "ai/what-is-an-ai-agent",
      "atai/what-is-atai",
      "build/how-to-build-an-mvp",
      "templates/mvp-checklist",
    ],
  },
] as const

export function pathResources(stepIds: readonly string[]) {
  return stepIds.map((id) => getResourceById(id)).filter((item): item is Resource => Boolean(item))
}
