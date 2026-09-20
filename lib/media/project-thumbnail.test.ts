import { describe, expect, it } from "vitest"
import {
  isRenderableProjectImage,
  normalizeProjectImageUrl,
  resolveProjectThumbnail,
} from "./project-thumbnail"

describe("isRenderableProjectImage", () => {
  it("accepts https urls", () => {
    expect(isRenderableProjectImage("https://ik.imagekit.io/atai/shot.png")).toBe(true)
  })

  it("rejects empty and non-image data uris", () => {
    expect(isRenderableProjectImage("")).toBe(false)
    expect(isRenderableProjectImage("data:text/html,hi")).toBe(false)
    expect(isRenderableProjectImage("not a url")).toBe(false)
  })

  it("accepts complete data image uris", () => {
    expect(isRenderableProjectImage("data:image/png;base64,iVBORw0KGgoAAAANSUhEUg")).toBe(true)
  })
})

describe("normalizeProjectImageUrl", () => {
  it("upgrades public http to https", () => {
    expect(normalizeProjectImageUrl("http://cdn.example.com/a.png")).toBe("https://cdn.example.com/a.png")
  })
})

describe("resolveProjectThumbnail", () => {
  it("skips junk and returns the first usable screenshot", () => {
    expect(
      resolveProjectThumbnail(["", "not-url", "https://ik.imagekit.io/a.jpg"]),
    ).toBe("https://ik.imagekit.io/a.jpg")
  })
})
