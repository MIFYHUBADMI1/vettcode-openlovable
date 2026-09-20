# Visual foundations — Atai landing motion refinement

Authority: existing product tokens in `app/globals.css` + `app/page.tsx`. Catalog `DESIGN.md` was not persisted (template 404). Direction: **pipeline motion** — sequential 01→02→03 hero choreography, journey timeline progress, purposeful scroll reveals. Preserve copy, IA, CTAs, SiteHeader/Footer.

## Character
Premium founder SaaS. Dark-first, amber-gold primary, glass cards, mono eyebrows. Motion explains *build sequence*, not decoration.

## Tokens (reuse, do not invent a new brand)
- Type: Plus Jakarta Sans (sans), Geist Mono (labels/eyebrows)
- Radius: `--radius: 0.65rem` (cards `rounded-2xl`)
- Primary dark: `oklch(0.73 0.16 45)` on `background oklch(0.145 0 0)`
- Surfaces: `card` + `border/40–50` + `backdrop-blur`
- Semantic: violet = input/idea, primary = build, emerald = launch
- Type scale: h1 ~clamp 3rem–4.5rem / black / tracking -0.04em; body 1rem / leading 8; mono 10–11px uppercase tracking 0.18em
- Spacing: 8-pt; sections `py-28`; content `max-w-7xl px-6 lg:px-10`

## Hierarchy
1. Hero headline + primary CTA
2. Hero right-rail pipeline (the motion story)
3. Journey 8-step
4. Team / comparison / proof
5. Closing CTA

## Motion foundations
- Staged, interruptible, `prefers-reduced-motion: reduce` → static final state, no typewriter/float/infinite ambient
- Hero: cascade in (badge → h1 → copy → CTA → pipeline cards 01 then 02 then 03 with connector draw)
- Journey: progress line + active step, pause on hover/focus
- Scroll: short fade/translate (12–16px, 400–500ms, ease-out), once
- Hover: 1px lift + border, no purple glow slop
- No extra floating icon field; keep ambient grid very quiet or freeze under reduced motion

## Interaction
- Primary CTA: hover glow already exists; keep
- Focus: `--ring` visible
- Touch: no hover-only essential content
- Prototype viewport: 1440 / 768 / 390
