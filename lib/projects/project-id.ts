export const PROJECT_ID_MIN_LENGTH = 3
export const PROJECT_ID_MAX_LENGTH = 63

export function projectIdFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, PROJECT_ID_MAX_LENGTH)
    .replace(/-+$/g, "")
}

export function validateProjectId(value: string): string | null {
  if (value.length < PROJECT_ID_MIN_LENGTH) return `Use at least ${PROJECT_ID_MIN_LENGTH} characters.`
  if (value.length > PROJECT_ID_MAX_LENGTH) return `Use no more than ${PROJECT_ID_MAX_LENGTH} characters.`
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(value)) {
    return "Use lowercase letters, numbers, and hyphens. Start and end with a letter or number."
  }
  return null
}
