// lib/commentary.ts
// Opinionated commentary shown once after scraping completes during a clone.
// Analyzes the scraped markdown to pick a contextually relevant line.
//
// Toggle: appConfig.ui.enablePersonalityCommentary (default: true)
// To remove entirely: delete this file and remove the import in generation/page.tsx.

// ---------------------------------------------------------------------------
// Commentary pool — grouped by detection signal
// ---------------------------------------------------------------------------

interface CommentaryEntry {
  /** Return true when the scraped content matches this entry's pattern. */
  detect: (markdown: string) => boolean;
  lines: string[];
}

const POOL: CommentaryEntry[] = [
  // --- Carousel / slider detection ---
  {
    detect: (md) => /carousel|slider|swiper|slideshow/i.test(md),
    lines: [
      "A carousel in 2026? Bold. Cloning it faithfully.",
      "Someone still believes in carousels. Respect.",
      "Found a carousel. We're building it — no judgment.",
    ],
  },

  // --- Testimonials / social proof ---
  {
    detect: (md) => /testimonial|what people say|what our customers|reviews|star.*rating/i.test(md),
    lines: [
      "People love this product. Cloning the proof.",
      "Testimonials detected. Someone's proud of their work.",
      "Ah, a testimonials section. Cloning the social proof.",
    ],
  },

  // --- Pricing tiers ---
  {
    detect: (md) => /pricing|price|per month|per year|\/mo|\/yr|\$[\d,.]+.*plan/i.test(md),
    lines: [
      "Three pricing tiers. The classic.",
      "Someone's got a pricing page. Let's clone the money talk.",
      "Pricing section found. Cloning the business model.",
    ],
  },

  // --- Blog / articles ---
  {
    detect: (md) => /\bblog\b|\barticle\b|\bpost\b|\bpublished\b|\bcategory\b/i.test(md),
    lines: [
      "A blog with taste. Cloning the vibes.",
      "Content-first site. Let's bring the words over.",
      "Blog detected. Cloning the editorial energy.",
    ],
  },

  // --- Portfolio / personal site ---
  {
    detect: (md) => /\bportfolio\b|\bmy work\b|\babout me\b|\bhello,? i'?m\b|\bi'?m a\b.*(?:developer|designer|creator|freelance)/i.test(md),
    lines: [
      "A portfolio site. Let's make it yours.",
      "Someone's personal brand. Cloning the identity.",
      "Portfolio detected. This one should be quick.",
    ],
  },

  // --- Large site (word count) ---
  {
    detect: (md) => md.split(/\s+/).length > 3000,
    lines: [
      "This is a big one. Settling in.",
      "Lots of content here. Let's break it down.",
      "Substantial site. Cloning section by section.",
    ],
  },

  // --- Small / minimal site ---
  {
    detect: (md) => md.split(/\s+/).length < 400,
    lines: [
      "Minimal and clean. Quick clone ahead.",
      "Short and sweet. This won't take long.",
      "Lean site. We'll have this cloned fast.",
    ],
  },

  // --- Dark mode / dark theme ---
  {
    detect: (md) => /dark mode|dark theme|dark background|#1[0-9a-fA-F]{5}|rgb\(1[0-9, ]+\)/i.test(md),
    lines: [
      "Dark theme detected. Cloning the mood.",
      "A dark-mode fan. Building it with the lights off.",
      "Moody aesthetic. Let's keep the energy.",
    ],
  },

  // --- Landing page / SaaS / product ---
  {
    detect: (md) => /\blanding page\b|\bsaas\b|\bproduct\b.*(?:page|site)|\bstart(?:ing)? free\b|\bfree trial\b/i.test(md),
    lines: [
      "Classic SaaS landing page. Cloning the conversion funnel.",
      "Someone's shipping a product. Let's clone the pitch.",
      "Landing page detected. Cloning the sell.",
    ],
  },

  // --- Fallback (always matches) ---
  {
    detect: () => true,
    lines: [
      "Cloning this... someone really committed to 2015.",
      "That's a lot of gradients. Building it anyway.",
      "Clean layout. This one's going to be quick.",
      "Nice site. Let's see what the AI thinks of it.",
      "Solid structure. This clone should be straightforward.",
      "Good taste. Cloning it now.",
    ],
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyse scraped markdown and return one witty commentary line.
 * Returns null when commentary is disabled or content is empty.
 *
 * Deterministic per URL: uses a simple hash of the content to pick from
 * the matching pool so the same site always gets the same line.
 */
export function getCommentary(markdown: string): string | null {
  if (!markdown || markdown.trim().length === 0) return null;

  // Find the first matching entry (pool is ordered from specific → generic)
  const entry = POOL.find((e) => e.detect(markdown));
  if (!entry) return null;

  // Pick a deterministic line from the pool based on content hash
  const idx = simpleHash(markdown) % entry.lines.length;
  return entry.lines[idx];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simple non-crypto hash — good enough for deterministic selection. */
function simpleHash(str: string): number {
  let hash = 5381;
  // Sample at most 2000 chars to keep it fast on huge pages
  const limit = Math.min(str.length, 2000);
  for (let i = 0; i < limit; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
