// lib/pipeline/__tests__/arbitraries.ts
// Reusable fast-check arbitraries for property-based tests in the progressive generation pipeline.

import * as fc from "fast-check";
import type {
  SiteBlueprint,
  BlueprintSection,
  ColorEntry,
  TypographyInfo,
  ImageEntry,
} from "../types/blueprint";
import type { PhaseState, SectionStatus, SectionPriority } from "../types/pipeline";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Valid font weights per spec (Req 1.4) */
const FONT_WEIGHT_VALUES = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

/** Known section type values from the blueprint schema */
const KNOWN_SECTION_TYPES = [
  "header",
  "hero",
  "features",
  "pricing",
  "footer",
  "testimonials",
  "team",
  "gallery",
  "blog",
  "services",
  "products",
] as const;

/** All valid pipeline states (Req 6.1) */
const PHASE_STATES: PhaseState[] = [
  "idle",
  "analyzing",
  "instant_preview",
  "progressive_cloning",
  "validating",
  "polishing",
  "complete",
  "error",
];

/** All valid section statuses */
const SECTION_STATUSES: SectionStatus[] = [
  "pending",
  "generating",
  "complete",
  "failed",
];

/** All valid section priorities */
const SECTION_PRIORITIES: SectionPriority[] = [
  "hero",
  "primary",
  "secondary",
  "footer",
];

/** PascalCase component name: first char uppercase, rest lowercase alphanum (6–20 chars) */
const arbitraryPascalCaseName = (): fc.Arbitrary<string> =>
  fc
    .tuple(
      fc.constantFrom(
        "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
        "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
      ),
      fc.stringMatching(/^[a-z0-9]{5,19}$/),
    )
    .map(([first, rest]) => `${first}${rest}`);

// ---------------------------------------------------------------------------
// Exported arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates a valid BlueprintSection with a name matching `^[a-z][a-z0-9-]*$`,
 * a non-empty type string, and a non-negative integer order.
 */
export function arbitraryBlueprintSections(): fc.Arbitrary<BlueprintSection[]> {
  const sectionNameArb = fc.stringMatching(/^[a-z][a-z0-9-]{1,19}$/);

  // Mix known types with arbitrary strings to test extensibility
  const sectionTypeArb = fc.oneof(
    fc.constantFrom(...KNOWN_SECTION_TYPES),
    fc.stringMatching(/^[a-z][a-z0-9-]{1,19}$/),
  );

  const sectionArb: fc.Arbitrary<BlueprintSection> = fc.record({
    name: sectionNameArb,
    type: sectionTypeArb,
    order: fc.integer({ min: 0, max: 100 }),
  });

  return fc.array(sectionArb, { minLength: 1, maxLength: 10 });
}

/**
 * Generates a valid SiteBlueprint with:
 * - version: '1.0' (always)
 * - sections: 0–8 items with normalized names and valid types
 * - colors: 0–10 items with valid hex codes
 * - typography: fontFamilies (0–5), fontWeights (subset of valid values), fontSizes (0–5)
 * - images: 0–5 items with https URLs and non-empty alt text / section strings
 */
export function arbitrarySiteBlueprint(): fc.Arbitrary<SiteBlueprint> {
  // Section name: starts with lowercase letter, followed by lowercase letters/digits/hyphens
  const sectionNameArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,18}$/);

  const sectionTypeArb = fc.oneof(
    fc.constantFrom(...KNOWN_SECTION_TYPES),
    fc.stringMatching(/^[a-z][a-z0-9-]{1,19}$/),
  );

  const sectionArb: fc.Arbitrary<BlueprintSection> = fc.record({
    name: sectionNameArb,
    type: sectionTypeArb,
    order: fc.integer({ min: 0, max: 100 }),
  });

  // Hex color: #RRGGBB where each component is 0–9 or A–F (case-insensitive)
  const hexArb = fc
    .tuple(
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
    )
    .map(
      ([r, g, b]) =>
        `#${r.toString(16).padStart(2, "0").toUpperCase()}${g
          .toString(16)
          .padStart(2, "0")
          .toUpperCase()}${b.toString(16).padStart(2, "0").toUpperCase()}`,
    );

  const colorArb: fc.Arbitrary<ColorEntry> = fc.record({
    hex: hexArb,
  });

  // Font sizes: either "Npx" or "N.NNrem"
  const fontSizeArb = fc.oneof(
    fc.integer({ min: 8, max: 72 }).map((n) => `${n}px`),
    fc
      .tuple(
        fc.integer({ min: 0, max: 5 }),
        fc.integer({ min: 0, max: 99 }),
      )
      .map(([whole, frac]) => `${whole}.${frac.toString().padStart(2, "0")}rem`),
  );

  // fontWeights: a non-empty subset of the valid weight values
  const fontWeightsArb: fc.Arbitrary<number[]> = fc
    .subarray(FONT_WEIGHT_VALUES as unknown as number[], {
      minLength: 0,
      maxLength: FONT_WEIGHT_VALUES.length,
    });

  const typographyArb: fc.Arbitrary<TypographyInfo> = fc.record({
    fontFamilies: fc.array(
      fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{1,29}$/),
      { minLength: 0, maxLength: 5 },
    ),
    fontWeights: fontWeightsArb,
    fontSizes: fc.array(fontSizeArb, { minLength: 0, maxLength: 5 }),
  });

  // Image URLs: must start with "https://"
  const imageUrlArb = fc
    .stringMatching(/^[a-z0-9-]{3,20}$/)
    .map((host) => `https://${host}.example.com/image.png`);

  const nonEmptyStringArb = fc.stringMatching(/^[A-Za-z0-9 ]{1,50}$/);

  const imageArb: fc.Arbitrary<ImageEntry> = fc.record({
    url: imageUrlArb,
    altText: nonEmptyStringArb,
    section: nonEmptyStringArb,
  });

  return fc.record({
    version: fc.constant("1.0" as const),
    sections: fc.array(sectionArb, { minLength: 0, maxLength: 8 }),
    colors: fc.array(colorArb, { minLength: 0, maxLength: 10 }),
    typography: typographyArb,
    images: fc.array(imageArb, { minLength: 0, maxLength: 5 }),
  });
}

/**
 * Generates a valid file path in the form `src/components/ComponentName.ext`
 * where ComponentName is PascalCase and ext is one of:
 * `.jsx`, `.js`, `.tsx`, `.ts`, `.css`, `.json`
 */
export function arbitraryFilePath(): fc.Arbitrary<string> {
  const extArb = fc.constantFrom(".jsx", ".js", ".tsx", ".ts", ".css", ".json");

  return fc
    .tuple(arbitraryPascalCaseName(), extArb)
    .map(([name, ext]) => `src/components/${name}${ext}`);
}

/**
 * Generates a non-empty printable ASCII string of 10–500 characters
 * (no null bytes, no control characters outside printable range 0x20–0x7E).
 */
export function arbitraryFileContent(): fc.Arbitrary<string> {
  // printable ASCII: space (0x20) through tilde (0x7E)
  return fc
    .array(fc.integer({ min: 0x20, max: 0x7e }), {
      minLength: 10,
      maxLength: 500,
    })
    .map((codes) => codes.map((c) => String.fromCharCode(c)).join(""));
}

/**
 * Picks one of the 8 valid PhaseState values uniformly at random.
 */
export function arbitraryPhaseState(): fc.Arbitrary<PhaseState> {
  return fc.constantFrom(...PHASE_STATES);
}

/**
 * Picks one of the 4 valid SectionStatus values uniformly at random.
 */
export function arbitrarySectionStatus(): fc.Arbitrary<SectionStatus> {
  return fc.constantFrom(...SECTION_STATUSES);
}

/**
 * Picks one of the 4 valid SectionPriority values uniformly at random.
 */
export function arbitrarySectionPriority(): fc.Arbitrary<SectionPriority> {
  return fc.constantFrom(...SECTION_PRIORITIES);
}
