// lib/pipeline/pretty-printer.ts
// Human-readable formatting for SiteBlueprint objects.
// The output of PrettyPrinter.format() is always valid JSON (Req 14.5).
// Formatting annotations (bulleted lists, tables) are embedded as metadata
// fields within the JSON structure so the output remains parseable.

import type {
  SiteBlueprint,
  BlueprintSection,
  ColorEntry,
  TypographyInfo,
} from "./types/blueprint";

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a bulleted-list annotation for the sections array (Req 14.2).
 * Example: "• hero-section (hero)\n• features-section (features)"
 */
function buildSectionBulletList(sections: BlueprintSection[]): string {
  if (sections.length === 0) return "(no sections)";
  return sections
    .map((s) => `• ${s.name} (${s.type})`)
    .join("\n");
}

/**
 * Builds a hex-code listing for the color palette (Req 14.3).
 * Example: "#FF5733 [primary]\n#FFFFFF [background]"
 */
function buildColorPaletteAnnotation(colors: ColorEntry[]): string {
  if (colors.length === 0) return "(no colors)";
  return colors
    .map((c) => (c.usage ? `${c.hex} [${c.usage}]` : c.hex))
    .join("\n");
}

/**
 * Builds a readable table annotation for typography (Req 14.4).
 * Uses plain text with pipe separators so it reads like a table in any
 * monospaced viewer while remaining a valid JSON string.
 *
 * Example:
 * Families | Inter, Roboto
 * Weights  | 400, 700, 900
 * Sizes    | 12px, 16px, 24rem
 */
function buildTypographyTableAnnotation(typography: TypographyInfo): string {
  const families =
    typography.fontFamilies.length > 0
      ? typography.fontFamilies.join(", ")
      : "(none)";
  const weights =
    typography.fontWeights.length > 0
      ? typography.fontWeights.join(", ")
      : "(none)";
  const sizes =
    typography.fontSizes.length > 0
      ? typography.fontSizes.join(", ")
      : "(none)";

  return [
    `Families | ${families}`,
    `Weights  | ${weights}`,
    `Sizes    | ${sizes}`,
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// PrettyPrinter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formats a SiteBlueprint as 2-space indented JSON with embedded human-
 * readable annotations (Req 14.1–14.6).
 *
 * The returned string is always valid JSON that can be re-parsed into an
 * object structurally equivalent to the original blueprint (Req 14.5).
 * The annotations are stored as extra `_display` fields inside the JSON
 * structure; they do NOT appear on the canonical SiteBlueprint fields and
 * are transparently ignored by BlueprintParser.
 *
 * Special characters (quotes, backslashes, angle brackets, newlines) never
 * break parsing: JSON.stringify performs the standard JSON escaping, and
 * JSON.parse of the output recovers the exact original values (Req 14.6).
 */
export class PrettyPrinter {
  static format(blueprint: SiteBlueprint): string {
    // Build the annotated object.  All annotation strings are themselves plain
    // strings — JSON.stringify will escape them correctly.
    const annotated = {
      version: blueprint.version,

      // ── Sections ────────────────────────────────────────────────────────
      _sectionsDisplay: buildSectionBulletList(blueprint.sections),
      sections: blueprint.sections,

      // ── Colors ──────────────────────────────────────────────────────────
      _colorsDisplay: buildColorPaletteAnnotation(blueprint.colors),
      colors: blueprint.colors,

      // ── Typography ──────────────────────────────────────────────────────
      _typographyDisplay: buildTypographyTableAnnotation(blueprint.typography),
      typography: blueprint.typography,

      // ── Images ──────────────────────────────────────────────────────────
      images: blueprint.images,
    };

    return JSON.stringify(annotated, null, 2);
  }
}
