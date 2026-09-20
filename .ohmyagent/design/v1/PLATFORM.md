# Platform constraints

- Product: Next.js App Router, `app/page.tsx` client landing, Tailwind v4 + CSS in `globals.css`.
- This design round: HTML prototype only at `.ohmyagent/design/v1/prototype.html`. No product file edits until user asks to implement.
- Motion: CSS `@keyframes` + IntersectionObserver-equivalent via CSS animation-timeline where possible; JS typewriter only if reduced-motion allows. `prefers-reduced-motion: reduce` disables loops.
- Responsive: 1440 desktop split hero; 768 stacks; 390 single column, CTA in first screen, no horizontal overflow.
- A11y: real buttons/links, focus rings, `aria-live` polite for typewriter, pause journey on hover/focus.
- Components: header, footer, primary/outline buttons, pipeline cards, step timeline, team cards — not a new component library.
- Do not add emoji as primary iconography in prototype if lucide-style SVG can replace; existing page uses some emoji on pipeline — keep those labels as text.
