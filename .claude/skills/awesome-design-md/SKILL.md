---
name: awesome-design-md
description: Library of 80+ DESIGN.md files describing the visual language of well-known sites (Stripe, Linear, Vercel, Apple, Notion, Spotify, Supabase, Figma and more) — colour tokens, typography scale, spacing, radii, components and layout rules. Use when the user wants a page, dashboard or component to "look like" a named brand or product, asks for a design system / DESIGN.md for the project, or wants a consistent visual direction picked from proven references.
---

# Awesome DESIGN.md

Each file in `designs/` is a DESIGN.md for one site, named after it (`designs/stripe.md`,
`designs/linear.app.md`, `designs/vercel.md`, ...). List the folder to see them all.

## How to use

1. **Pick a reference.** If the user named a brand, open its file. If not, suggest two or three
   that fit the product (e.g. a data dashboard: `linear.app`, `posthog`, `sentry`, `supabase`,
   `vercel`) and let the user choose.
2. **Adopt it as the project's design system.** Copy the chosen file to `DESIGN.md` at the project
   root (adjusting the name and description to this project), so every later task reads the same
   source of truth.
3. **Build from the tokens.** Turn the `colors`, `typography`, spacing and radius entries into CSS
   custom properties or Tailwind `@theme` tokens in one place, and reference only those tokens in
   components. Follow the file's component and layout sections for buttons, cards, nav and grids.
4. **Make it the user's own.** These files describe an inspiration, not a brand to copy: keep the
   structure and rhythm, but do not reuse another company's logo, name, wordmark or proprietary
   fonts — substitute an open font with similar metrics when the file names a proprietary one.

Source: [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) (MIT, see `LICENSE`).
