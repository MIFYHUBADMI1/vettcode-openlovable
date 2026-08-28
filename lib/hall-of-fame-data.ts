// lib/hall-of-fame-data.ts
// Static data for the Hall of Fame page.
// For v1: manually curated entries. No API or database needed.
//
// To add an entry: push to the array below with real screenshot URLs.
// Screenshots can be placed in /public/hall-of-fame/ or use external URLs.

export interface HallOfFameEntry {
  id: string;
  originalUrl: string;
  originalTitle: string;
  /** Path relative to /public or an external URL. */
  originalScreenshot: string;
  /** Path relative to /public or an external URL. */
  cloneScreenshot: string;
  /** One-liner describing what was cloned or why it's notable. */
  description: string;
  dateAdded: string;
}

export const hallOfFameEntries: HallOfFameEntry[] = [
  {
    id: "stripe-dashboard",
    originalUrl: "https://stripe.com",
    originalTitle: "Stripe",
    originalScreenshot: "/hall-of-fame/stripe-original.png",
    cloneScreenshot: "/hall-of-fame/stripe-clone.png",
    description: "Payment platform landing page — clean gradients, sharp typography, and a conversion-focused layout.",
    dateAdded: "2026-08-20",
  },
  {
    id: "linear-app",
    originalUrl: "https://linear.app",
    originalTitle: "Linear",
    originalScreenshot: "/hall-of-fame/linear-original.png",
    cloneScreenshot: "/hall-of-fame/linear-clone.png",
    description: "Dark-themed SaaS with smooth animations and a dense feature grid.",
    dateAdded: "2026-08-21",
  },
  {
    id: "vercel-home",
    originalUrl: "https://vercel.com",
    originalTitle: "Vercel",
    originalScreenshot: "/hall-of-fame/vercel-original.png",
    cloneScreenshot: "/hall-of-fame/vercel-clone.png",
    description: "Developer platform — minimalist hero, bold typography, and a live demo section.",
    dateAdded: "2026-08-22",
  },
  {
    id: "tailwind-blog",
    originalUrl: "https://tailwindcss.com",
    originalTitle: "Tailwind CSS",
    originalScreenshot: "/hall-of-fame/tailwind-original.png",
    cloneScreenshot: "/hall-of-fame/tailwind-clone.png",
    description: "Documentation-style site with code examples, feature cards, and a utility-first showcase.",
    dateAdded: "2026-08-23",
  },
  {
    id: "github-copilot",
    originalUrl: "https://github.com/features/copilot",
    originalTitle: "GitHub Copilot",
    originalScreenshot: "/hall-of-fame/copilot-original.png",
    cloneScreenshot: "/hall-of-fame/copilot-clone.png",
    description: "Product page with dark mode, code snippets, and a side-by-side comparison layout.",
    dateAdded: "2026-08-24",
  },
  {
    id: "notion-home",
    originalUrl: "https://www.notion.so",
    originalTitle: "Notion",
    originalScreenshot: "/hall-of-fame/notion-original.png",
    cloneScreenshot: "/hall-of-fame/notion-clone.png",
    description: "Workspace tool with a playful tone, illustrated hero, and multi-step onboarding flow.",
    dateAdded: "2026-08-25",
  },
];
