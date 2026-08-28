# MirrorSite AI — Hero Section & Landing Page Redesign Implementation

You are working on the existing **MirrorSite AI** application.

Your task is to **redesign and improve the current landing page hero section and the immediate sections below it** so that visitors understand exactly what MirrorSite AI does within the first few seconds.

## Important: Do Not Rebuild the Application

Before making changes:

1. Audit the existing landing page implementation.
2. Identify the current hero component, styles, animations, navigation, authentication state, CTA functionality, and existing routes.
3. Preserve all working functionality.
4. Do not replace the application architecture unnecessarily.
5. Do not create duplicate pages or unused components.
6. Reuse existing design tokens, fonts, animations, components, and styling patterns where appropriate.
7. Keep the existing MirrorSite AI branding and orange-to-pink gradient identity.
8. Ensure the final implementation is responsive and production-ready.

The goal is **not to redesign everything from scratch**.

The goal is to transform the existing landing page from a generic AI startup landing page into a page that immediately communicates:

> **Paste a website URL → MirrorSite AI analyzes it → creates an editable starting point → customize it and make it your own.**

---

# 1. Core Positioning Change

The current hero messaging is too generic.

Do not use a generic primary headline such as:

> Build like you have a dev team. Ship like a solo founder.

This can describe almost any AI coding tool.

MirrorSite AI needs to immediately communicate its unique workflow.

The visitor should understand within approximately 5 seconds:

* They can paste a website URL.
* MirrorSite AI analyzes the website.
* MirrorSite AI recreates the structure as an editable project.
* They can customize and transform the result into their own project.

The new positioning should focus on:

> **Website inspiration → editable starting point → your own project**

Avoid making the product sound like a tool for stealing or copying websites.

Use language around:

* inspiration
* structure
* starting points
* recreation
* customization
* transformation
* making it your own

---

# 2. Hero Section Redesign

Redesign the hero section around the following messaging hierarchy.

## Eyebrow / Announcement Badge

Use a small, elegant pill above the headline.

Suggested text:

> ✨ TURN WEBSITE INSPIRATION INTO A PROJECT

Alternative if needed:

> FROM URL TO EDITABLE WEBSITE WITH AI

The badge should:

* Be subtle.
* Use the existing orange/pink brand identity.
* Have a soft border and light background.
* Avoid looking like a loud promotional banner.
* Include a subtle entrance animation.

---

# 3. Main Headline

Use this as the primary hero message:

## See a website you like?

## Turn it into your starting point.

The second line should receive the visual emphasis.

Use the existing MirrorSite AI orange-to-pink gradient for:

> Turn it into your starting point.

Typography requirements:

* Large and confident.
* Highly readable.
* Strong visual hierarchy.
* Responsive scaling.
* Avoid excessively large text on mobile.
* Keep line lengths visually balanced.

The headline should feel premium and focused.

Do not make it look like a generic AI startup headline.

---

# 4. Supporting Description

Below the headline, use a concise explanation:

> Paste a public website URL. MirrorSite AI analyzes its layout and structure, then recreates it as an editable starting point you can customize and make your own.

The description should:

* Be easy to scan.
* Have a comfortable maximum width.
* Use slightly muted text.
* Avoid long paragraphs.
* Clearly explain the product without technical jargon.

Do not use messaging such as:

> Someone building the same idea as you isn't spending three days rebuilding a header.

Remove that competitive/negative framing.

The hero should focus on what the visitor can accomplish.

---

# 5. Primary and Secondary CTA

The primary CTA should be prominent and action-oriented.

Primary CTA:

> ✨ Try your first site free

Alternative:

> Start with a URL →

The button should:

* Use the existing brand gradient.
* Have a premium hover interaction.
* Include a subtle glow or elevation on hover.
* Not use excessive animation.
* Remain accessible.
* Work with the existing signup/generation flow.

Do not create a fake CTA.

Connect it to the existing product flow.

Secondary CTA:

> ▶ Watch how it works

This CTA should smoothly scroll to the product demonstration section below.

Do not use:

> See it happen ↓

The new wording should clearly communicate that the user can watch a demonstration.

---

# 6. Trust / Friction Reduction Text

Below the CTAs, add small, subtle trust text:

> No credit card required • Start in minutes

Do not exaggerate claims.

Keep this visually secondary.

---

# 7. Replace Decorative Hero Focus With Product Proof

The current hero relies too heavily on decorative wireframes/background elements.

Keep subtle background visuals, but the primary visual focus should become the actual product.

The hero should visually communicate:

> URL → Analysis → Editable Website

Do not create a fake dashboard screenshot.

Instead, introduce a real product demonstration area immediately below or partially visible from the hero.

The page should encourage the visitor to scroll naturally into the demo.

---

# 8. YouTube Product Demo Section

We will use a real MirrorSite AI product demonstration video hosted on YouTube.

Create a premium product demo section directly after the hero.

The section should have:

### Heading

> See MirrorSite AI in action.

### Supporting text

> Watch how a website goes from a simple URL to an editable starting point in just a few steps.

Embed the configured YouTube product demonstration video.

Implementation requirements:

* Use the existing/configured YouTube video URL or video ID.
* If the video URL is stored in configuration or environment variables, preserve that approach.
* Do not hardcode an unrelated demo video.
* If no video URL has been configured yet, create a clearly isolated configuration constant or prop that can easily be replaced later.
* Do not break the page while waiting for the final video URL.

The video container should:

* Have rounded corners.
* Feel like a premium application preview.
* Have a subtle border.
* Have a soft shadow.
* Respect the page's maximum content width.
* Maintain the correct video aspect ratio.
* Be fully responsive.
* Avoid autoplay with sound.
* Use lazy loading where appropriate.
* Avoid negatively affecting initial page performance.

The video should become the primary proof that MirrorSite AI actually works.

---

# 9. Add a Simple Workflow Section

Immediately after the demo, add a clear visual explanation of how MirrorSite AI works.

Section heading:

# From inspiration to your own project.

Supporting text:

> Start with a website you admire. MirrorSite AI helps you understand, recreate, and transform it into something you can build on.

Create four connected steps.

## Step 1 — Paste a URL

Icon concept: link / globe.

Text:

> Paste the URL of a public website you want to use as inspiration.

## Step 2 — MirrorSite Analyzes

Icon concept: scan / AI / layers.

Text:

> MirrorSite AI analyzes the layout, sections, and overall structure.

## Step 3 — Get an Editable Starting Point

Icon concept: layout / components.

Text:

> Get a recreated project you can explore, edit, and build upon.

## Step 4 — Make It Yours

Icon concept: sparkles / pencil / customization.

Text:

> Change the content, branding, design, and direction to create something uniquely yours.

Desktop layout:

```text
[ Paste URL ] → [ AI Analyzes ] → [ Editable Project ] → [ Make It Yours ]
```

Mobile layout:

```text
[ Paste URL ]
       ↓
[ AI Analyzes ]
       ↓
[ Editable Project ]
       ↓
[ Make It Yours ]
```

Do not create oversized cards.

Use clean, connected visual elements.

The steps should feel like part of one continuous process.

---

# 10. Add Product Proof Instead of Fake Social Proof

Do not invent:

* fake user counts
* fake testimonials
* fake company logos
* fake ratings
* fake statistics

MirrorSite AI is still early, so focus on demonstrating the product.

Create a section titled:

# See what MirrorSite AI can become.

or:

# More than just a website preview.

This section should communicate the types of transformations the user can make after creating their starting point.

Possible examples:

### A SaaS Landing Page

> Start with inspiration and adapt the structure for your product.

### A Portfolio

> Transform a layout into a personal portfolio that reflects your own work.

### A Business Website

> Rework the structure, content, and branding for a completely different business.

Use abstract UI previews or real generated examples only if they already exist.

Do not fabricate product screenshots.

If real examples are not available yet, create elegant conceptual cards that describe the transformation without pretending they are real customer results.

---

# 11. Background and Visual System

Keep the existing clean, minimal aesthetic.

However, make the background more meaningful.

MirrorSite AI is about understanding website structure.

Use subtle website-inspired visual elements such as:

* faint layout grids
* component outlines
* section boundaries
* subtle node connections
* light scanning effects
* abstract wireframes

These elements must remain in the background.

They should never compete with the content.

The background should feel like:

> AI analyzing the structure of a website.

Do not use:

* excessive particles
* distracting animations
* heavy gradients everywhere
* unnecessary glowing objects
* generic floating AI shapes

The design should feel precise, technical, and premium.

---

# 12. Navigation Improvements

Audit the existing navigation.

The current branding should not confuse visitors.

If the page prominently displays:

> MirrorSite AI

and then separately displays:

> Mixify Hub

without clear context, this can make visitors question which product they are using.

For the public landing page, prioritize MirrorSite AI branding.

Recommended navigation:

```text
[ MirrorSite AI logo ]

How It Works     Pricing

Sign In     [ Try for Free → ]
```

If the user is already authenticated, replace the sign-in CTA with an appropriate action such as:

> Dashboard →

or the existing authenticated navigation.

Do not remove existing authentication functionality.

Do not break current routes.

The navigation should remain responsive.

On mobile:

* Use a clean mobile menu.
* Keep the primary CTA visible or easily accessible.
* Avoid overcrowding the header.

---

# 13. Remove or Relocate "Powered by Firecrawl"

Do not display:

> Powered by Firecrawl

as a prominent element in the hero section.

The average visitor does not need to know the underlying scraping infrastructure before understanding the value of MirrorSite AI.

If this attribution is required or strategically useful:

* Move it to a subtle footer location, technical details section, or appropriate attribution area.
* Preserve any required attribution requirements.

The hero should focus on the user outcome.

---

# 14. Motion and Interaction Design

Add subtle, intentional motion.

Recommended animations:

### Hero entrance

* Eyebrow fades/slides in.
* Headline appears smoothly.
* Supporting text follows.
* CTA appears last.

Keep the animation quick and professional.

### Background analysis effect

Use a very subtle scanning or tracing effect across the background wireframe.

The effect should suggest:

> MirrorSite AI is analyzing a website.

### Workflow steps

On scroll:

* Each step can gently appear.
* Connection lines can animate subtly.

### Buttons

On hover:

* Slight elevation.
* Slight brightness/gradient movement.
* Smooth transition.

Avoid:

* bouncing buttons
* infinite distracting animations
* aggressive pulsing
* excessive motion

Respect reduced-motion preferences.

---

# 15. Responsive Design Requirements

The entire landing page must work well on:

* Large desktop displays.
* Standard laptops.
* Tablets.
* Mobile devices.

Pay particular attention to:

### Mobile hero

* Headline must remain readable.
* Avoid awkward line breaks.
* CTA buttons should be easy to tap.
* The primary CTA can become full-width if appropriate.
* The video must maintain its aspect ratio.
* Navigation must not overflow.
* Background elements should be reduced if they create clutter.

Do not simply shrink the desktop design.

Create intentional responsive layouts.

---

# 16. Accessibility Requirements

Ensure:

* Sufficient color contrast.
* Keyboard navigation works.
* Buttons have meaningful labels.
* Focus states are visible.
* The embedded video has an appropriate accessible title.
* Decorative background elements are ignored by screen readers where appropriate.
* Reduced-motion preferences are respected.

---

# 17. Performance Requirements

Do not introduce unnecessary dependencies.

Optimize:

* Images.
* Animations.
* YouTube embedding.
* Background effects.

Avoid making the landing page significantly slower.

Prefer existing project dependencies and architecture where possible.

---

# 18. Final Page Structure

The final landing page should approximately follow this order:

```text
────────────────────────────────────
NAVIGATION
────────────────────────────────────

HERO

✨ TURN WEBSITE INSPIRATION INTO A PROJECT

See a website you like?
Turn it into your starting point.

Paste a public website URL. MirrorSite AI analyzes
its layout and structure, then recreates it as an
editable starting point you can customize and make your own.

[ ✨ Try your first site free ]

[ ▶ Watch how it works ]

No credit card required • Start in minutes

Subtle website structure / AI analysis background

────────────────────────────────────
PRODUCT DEMO
────────────────────────────────────

See MirrorSite AI in action.

Watch how a website goes from a simple URL
to an editable starting point.

[ YOUTUBE PRODUCT DEMO ]

────────────────────────────────────
HOW IT WORKS
────────────────────────────────────

From inspiration to your own project.

[ 1 Paste a URL ]
          →
[ 2 MirrorSite Analyzes ]
          →
[ 3 Editable Starting Point ]
          →
[ 4 Make It Yours ]

────────────────────────────────────
USE CASES / PRODUCT POSSIBILITIES
────────────────────────────────────

See what MirrorSite AI can become.

SaaS
Portfolio
Business Website

────────────────────────────────────
FINAL CTA
────────────────────────────────────

Found a website that inspires your next idea?

Turn it into your starting point.

[ Try MirrorSite AI Free → ]

────────────────────────────────────
FOOTER
────────────────────────────────────
```

---

# 19. Critical Product Messaging Rule

Throughout the page, do not describe MirrorSite AI simply as:

> A website cloning tool.

Instead, consistently position the product as:

> A tool that turns website inspiration into an editable starting point.

The core user journey should always be understandable as:

```text
WEBSITE YOU LIKE
       ↓
PASTE URL
       ↓
MIRRORSITE AI ANALYZES
       ↓
EDITABLE STARTING POINT
       ↓
CUSTOMIZE IT
       ↓
MAKE IT YOURS
```

---

# 20. Final Implementation Process

Before editing:

1. Audit the existing landing page.
2. Identify all components and functionality affected.
3. Reuse existing styling where appropriate.
4. Implement the redesign incrementally.
5. Verify all CTAs and navigation.
6. Verify authentication states.
7. Test desktop and mobile layouts.
8. Check for visual regressions.
9. Remove unused code introduced during the redesign.
10. Ensure the project builds successfully.

Do not make unrelated changes to:

* Token/payment logic.
* Website generation logic.
* Scraping infrastructure.
* Authentication logic.
* Existing dashboard functionality.
* Backend APIs.

Focus specifically on improving the landing page experience and product positioning.

The final result should feel like a focused, premium AI product that immediately answers:

> **What does MirrorSite AI do?**

The answer should be obvious without requiring the visitor to read a long explanation:

> **Paste a website URL. MirrorSite AI analyzes it and turns it into an editable starting point you can customize and make your own.**

---

# 🎬 Quick Setup Guide

## Step 1: Configure Your YouTube Video

Open `app/page.tsx` and find this line near the top:

```tsx
const YOUTUBE_VIDEO_ID = "YOUR_VIDEO_ID_HERE";
```

Replace `YOUR_VIDEO_ID_HERE` with your actual YouTube video ID.

**How to find your video ID:**
- Go to your YouTube video page
- Look at the URL: `https://www.youtube.com/watch?v=XXXXXXXXXXX`
- The video ID is the part after `v=` (e.g., `XXXXXXXXXXX`)
- Or from a YouTube embed URL: `https://www.youtube.com/embed/XXXXXXXXXXX`

**Example:**
```tsx
// If your video URL is: https://www.youtube.com/watch?v=dQw4w9WgXcQ
const YOUTUBE_VIDEO_ID = "dQw4w9WgXcQ";
```

## Step 2: Add Your Hero Images

1. Create the `public/hero-images/` directory (already created for you)
2. Place your 6 images inside with descriptive filenames:
   ```
   public/hero-images/
   ├── image-1.png
   ├── image-2.png
   ├── image-3.png
   ├── image-4.png
   ├── image-5.png
   └── image-6.png
   ```

3. Update `public/site-config.json` to match your actual filenames:
   ```json
   {
     "heroImages": {
       "images": [
         { "src": "/hero-images/your-actual-filename.png", "alt": "Description" },
         ...
       ]
     }
   }
   ```

## Step 3: Update Site Configuration (Optional)

Edit `public/site-config.json` to customize:
- Site name and tagline
- Links (signup, builder, pricing, about)
- Branding colors (if changed)
- Logo and favicon paths

## Step 4: Build and Test

```bash
npm run build
npm run dev
```

Visit `http://localhost:3000` to preview the landing page.

## Troubleshooting

### Video not showing?
- Verify the YouTube video ID is correct in `app/page.tsx`
- Check that the video is public/unlisted (not private)
- Ensure the embed URL format is correct

### Images not loading?
- Check that images are in `public/hero-images/`
- Verify filenames match what's in `site-config.json`
- Ensure images are web-optimized (PNG/WebP recommended)

### Layout issues?
- The page is fully responsive — test on mobile and desktop
- Check browser console for errors
- Verify all imports are resolving correctly

---

*This implementation was built on top of the existing MirrorSite AI architecture, preserving all working functionality while improving the landing page experience and product positioning.*
