import { describe, expect, it } from "vitest"
import {
  LEARNING_PATHS,
  RESOURCE_CATEGORIES,
  allResources,
  getResourceById,
  relatedResources,
} from "./index"

describe("resources catalog", () => {
  it("has unique category/slug pairs", () => {
    const ids = allResources().map((resource) => `${resource.category}/${resource.slug}`)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("covers every category with at least one resource", () => {
    for (const category of RESOURCE_CATEGORIES) {
      expect(allResources().some((resource) => resource.category === category)).toBe(true)
    }
  })

  it("points related and learning-path ids at real resources", () => {
    for (const resource of allResources()) {
      expect(relatedResources(resource).length).toBe(resource.related.length)
    }
    for (const path of LEARNING_PATHS) {
      for (const step of path.steps) {
        expect(getResourceById(step), step).toBeTruthy()
      }
    }
  })
})
