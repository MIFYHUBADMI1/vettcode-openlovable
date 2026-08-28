// lib/pipeline/blueprint-parser.ts
// Parses, validates, and normalizes SiteBlueprint objects from raw AI JSON responses.

import type {
  SiteBlueprint,
  BlueprintSection,
  ColorEntry,
  TypographyInfo,
  ImageEntry,
} from "./types/blueprint";

/**
 * BlueprintParser provides three static methods for working with SiteBlueprint data:
 *   - parse()     : Raw AI response string → SiteBlueprint | descriptive error string
 *   - validate()  : Type guard for SiteBlueprint shape
 *   - normalize() : Normalizes section names to lowercase-hyphenated form
 *
 * IMPORTANT: parse() never throws. Callers must check the return type:
 *   - typeof result === "string"  → parse error; the string is the human-readable reason
 *   - typeof result === "object"  → successfully parsed SiteBlueprint
 */
export class BlueprintParser {
  /**
   * Parse a raw AI JSON response into a SiteBlueprint.
   *
   * Returns a SiteBlueprint on success, or a descriptive error string on failure.
   * Never throws — callers must handle the string-return case as an error.
   *
   * Error behavior (Req 12.3):
   *   - Missing/malformed required field → "missing required field: <fieldName>"
   *   - Unknown parse failure           → "parsing failed"
   *   - Original AI response is always logged via console.error (Req 12.7)
   */
  static parse(raw: string): SiteBlueprint | string {
    // --- Step 1: JSON parse ----------------------------------------------------
    let parsed: unknown;
    try {
      // Some AI responses wrap JSON in markdown code fences — strip them first.
      const cleaned = BlueprintParser._stripCodeFences(raw);
      parsed = JSON.parse(cleaned);
    } catch {
      console.error(
        "[BlueprintParser] JSON parse failed. Original AI response:\n",
        raw,
      );
      return "parsing failed";
    }

    // --- Step 2: Field-level validation ----------------------------------------
    const validationError = BlueprintParser._validateFields(parsed);
    if (validationError !== null) {
      console.error(
        `[BlueprintParser] Validation error: ${validationError}. Original AI response:\n`,
        raw,
      );
      return validationError;
    }

    // At this point validate() has confirmed shape; cast is safe.
    const blueprint = parsed as SiteBlueprint;

    // --- Step 3: Normalize section names (Req 12.6) ----------------------------
    return BlueprintParser.normalize(blueprint);
  }

  /**
   * Type guard: returns true when `blueprint` satisfies the full SiteBlueprint shape.
   *
   * Checks:
   *   - All four required top-level fields present and non-null (Req 12.2)
   *   - version === "1.0"
   *   - sections is an array of objects with name (string), type (non-empty string), order (number)
   *   - colors is an array of objects with hex (string)
   *   - typography has fontFamilies (string[]), fontWeights (number[]), fontSizes (string[])
   *   - images is an array of objects with url, altText, section (all strings)
   */
  static validate(blueprint: unknown): blueprint is SiteBlueprint {
    return BlueprintParser._validateFields(blueprint) === null;
  }

  /**
   * Normalize all section names in a blueprint to lowercase-hyphenated form.
   * e.g. "Hero Section" → "hero-section", "FEATURES" → "features"
   *
   * Returns a new SiteBlueprint with normalized section names; does not mutate
   * the input object.
   */
  static normalize(blueprint: SiteBlueprint): SiteBlueprint {
    return {
      ...blueprint,
      sections: blueprint.sections.map((section) => ({
        ...section,
        name: BlueprintParser._normalizeString(section.name),
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Strip markdown code fences if the AI wrapped JSON in ```json ... ``` or ``` ... ```.
   */
  private static _stripCodeFences(raw: string): string {
    const trimmed = raw.trim();
    // Match ```json\n...\n``` or ```\n...\n```
    const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
    if (fenceMatch) {
      return fenceMatch[1].trim();
    }
    return trimmed;
  }

  /**
   * Validate all required fields on a parsed value.
   * Returns null on success, or a descriptive error string on failure.
   * Maps directly to Req 12.3 error behavior.
   */
  private static _validateFields(value: unknown): string | null {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return "parsing failed";
    }

    const obj = value as Record<string, unknown>;

    // --- version ---
    if (obj["version"] !== "1.0") {
      return 'missing required field: version (expected "1.0")';
    }

    // --- sections ---
    if (!("sections" in obj) || obj["sections"] === null || obj["sections"] === undefined) {
      return "missing required field: sections";
    }
    if (!Array.isArray(obj["sections"])) {
      return "missing required field: sections";
    }
    const sectionsError = BlueprintParser._validateSections(obj["sections"]);
    if (sectionsError !== null) return sectionsError;

    // --- colors ---
    if (!("colors" in obj) || obj["colors"] === null || obj["colors"] === undefined) {
      return "missing required field: colors";
    }
    if (!Array.isArray(obj["colors"])) {
      return "missing required field: colors";
    }
    const colorsError = BlueprintParser._validateColors(obj["colors"]);
    if (colorsError !== null) return colorsError;

    // --- typography ---
    if (!("typography" in obj) || obj["typography"] === null || obj["typography"] === undefined) {
      return "missing required field: typography";
    }
    const typographyError = BlueprintParser._validateTypography(obj["typography"]);
    if (typographyError !== null) return typographyError;

    // --- images ---
    if (!("images" in obj) || obj["images"] === null || obj["images"] === undefined) {
      return "missing required field: images";
    }
    if (!Array.isArray(obj["images"])) {
      return "missing required field: images";
    }
    const imagesError = BlueprintParser._validateImages(obj["images"]);
    if (imagesError !== null) return imagesError;

    return null;
  }

  private static _validateSections(sections: unknown[]): string | null {
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      if (s === null || typeof s !== "object" || Array.isArray(s)) {
        return `missing required field: sections[${i}] is not an object`;
      }
      const section = s as Record<string, unknown>;
      if (typeof section["name"] !== "string" || section["name"].length === 0) {
        return `missing required field: sections[${i}].name`;
      }
      if (typeof section["type"] !== "string" || section["type"].length === 0) {
        return `missing required field: sections[${i}].type`;
      }
      if (typeof section["order"] !== "number") {
        return `missing required field: sections[${i}].order`;
      }
    }
    return null;
  }

  private static _validateColors(colors: unknown[]): string | null {
    for (let i = 0; i < colors.length; i++) {
      const c = colors[i];
      if (c === null || typeof c !== "object" || Array.isArray(c)) {
        return `missing required field: colors[${i}] is not an object`;
      }
      const color = c as Record<string, unknown>;
      if (typeof color["hex"] !== "string" || color["hex"].length === 0) {
        return `missing required field: colors[${i}].hex`;
      }
    }
    return null;
  }

  private static _validateTypography(typography: unknown): string | null {
    if (
      typography === null ||
      typeof typography !== "object" ||
      Array.isArray(typography)
    ) {
      return "missing required field: typography";
    }
    const t = typography as Record<string, unknown>;

    if (!Array.isArray(t["fontFamilies"])) {
      return "missing required field: typography.fontFamilies";
    }
    if (!Array.isArray(t["fontWeights"])) {
      return "missing required field: typography.fontWeights";
    }
    if (!Array.isArray(t["fontSizes"])) {
      return "missing required field: typography.fontSizes";
    }

    // Validate each font weight is a number in [100, 900]
    for (let i = 0; i < (t["fontWeights"] as unknown[]).length; i++) {
      const w = (t["fontWeights"] as unknown[])[i];
      if (typeof w !== "number") {
        return `missing required field: typography.fontWeights[${i}] is not a number`;
      }
    }

    // Validate each font family is a string
    for (let i = 0; i < (t["fontFamilies"] as unknown[]).length; i++) {
      if (typeof (t["fontFamilies"] as unknown[])[i] !== "string") {
        return `missing required field: typography.fontFamilies[${i}] is not a string`;
      }
    }

    // Validate each font size is a string
    for (let i = 0; i < (t["fontSizes"] as unknown[]).length; i++) {
      if (typeof (t["fontSizes"] as unknown[])[i] !== "string") {
        return `missing required field: typography.fontSizes[${i}] is not a string`;
      }
    }

    return null;
  }

  private static _validateImages(images: unknown[]): string | null {
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (img === null || typeof img !== "object" || Array.isArray(img)) {
        return `missing required field: images[${i}] is not an object`;
      }
      const image = img as Record<string, unknown>;
      if (typeof image["url"] !== "string" || image["url"].length === 0) {
        return `missing required field: images[${i}].url`;
      }
      if (typeof image["altText"] !== "string") {
        return `missing required field: images[${i}].altText`;
      }
      if (typeof image["section"] !== "string") {
        return `missing required field: images[${i}].section`;
      }
    }
    return null;
  }

  /**
   * Convert a section name string to lowercase-hyphenated form.
   * "Hero Section" → "hero-section"
   * "FEATURES"     → "features"
   * "  Team  "     → "team"
   */
  private static _normalizeString(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-") // replace non-alphanumeric runs with hyphens
      .replace(/^-+|-+$/g, ""); // strip leading/trailing hyphens
  }
}
