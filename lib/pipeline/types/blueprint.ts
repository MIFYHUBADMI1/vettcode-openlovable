// lib/pipeline/types/blueprint.ts
// Data models for the Site Blueprint produced by Phase 1 (Analysis)

export type SectionType =
  | "header"
  | "hero"
  | "features"
  | "pricing"
  | "footer"
  | "testimonials"
  | "team"
  | "gallery"
  | "blog"
  | "services"
  | "products"
  | string; // Extensible — unknown types are preserved

export interface BlueprintSection {
  /** Normalized: lowercase-hyphenated (Req 12.6) e.g. "hero-section" */
  name: string;
  type: SectionType;
  /** Sequential position in the original site (0-based) */
  order: number;
}

export interface ColorEntry {
  /** Hex color value e.g. "#FF5733" */
  hex: string;
  /** Optional usage hint e.g. "primary", "background", "text" */
  usage?: string;
}

export interface TypographyInfo {
  fontFamilies: string[];
  /** Font weights 100–900 (Req 1.4) */
  fontWeights: number[];
  /** Font sizes in px or rem units (Req 1.4) */
  fontSizes: string[];
}

export interface ImageEntry {
  url: string;
  altText: string;
  /** Which section contains this image (Req 1.5) */
  section: string;
}

export interface SiteBlueprint {
  version: "1.0";
  sections: BlueprintSection[];
  colors: ColorEntry[];
  typography: TypographyInfo;
  images: ImageEntry[];
  /**
   * True when the original site used animations or transitions. Optional —
   * absent means "unknown", which the Polish phase treats as "animate"
   * (Req 5.5).
   */
  hasAnimations?: boolean;
}
