---
name: workforce-futures-design
description: The Workforce Futures visual design system and motion rules — paper-and-ink palette with one Klein-blue accent, Newsreader/Figtree type, paper grain, constructivist geometric marks (ink ring, flat accent disc or sector, striped circle, dot, one leading line), cards, buttons, corners, light/dark tokens, GSAP + ScrollTrigger + Lenis motion, and hover lift/press rules that are mouse-only and switch off for reduced motion. Use this skill whenever you add or restyle any page, component, card, chart, icon, empty state, animation or hover effect in this repo (static/styles.css, static/app.js), even if the user only says "make it look nicer", "polish this", "add a hover", "match the style", "构成主义", "add animation" or names a single element. Also use it before writing any new CSS or SVG for the app so new work matches what is already there.
---

# Workforce Futures design

The app looks like a printed sheet: off-white paper and black ink, inverted at night, with a single Klein-blue accent. Shapes come from early-20th-century constructivist posters (circles, half discs, quarter discs, stripes, one diagonal), drawn flat with thin ink lines. Motion is calm and short; nothing glows, pulses forever or uses gradients for decoration.

Everything already exists in `static/styles.css` and `static/app.js`. This skill tells you how to reuse it instead of inventing new styles. When in doubt, open the file and copy the nearest existing pattern.

## The five rules that make it look like this app

1. **Tokens only.** Use the CSS variables (`--bg`, `--surface`, `--ink`, `--muted`, `--faint`, `--line`, `--rule`, `--chip`, `--accent`, `--accent-soft`, `--accent-ink`, status colours). Never hard-code a hex in a component: every token is redefined for dark mode in three places (`@media (prefers-color-scheme: dark)` under `:root:not([data-theme="light"])`, and `:root[data-theme="dark"]`), so a hex breaks one of the themes. Full list in `references/tokens.md`.
2. **One accent, used once.** Each composition has at most one accent-filled shape or block; everything else is ink outline, `--line` or `--chip`. "Repetition with one exception" is the house idea (e.g. four rings, the first filled). Status colours (`--good`, `--warn`, `--bad`) only carry meaning (up/down, warnings), never decoration.
3. **Flat, not glowing.** No radial gradients, blurs, neon shadows or infinite pulses. Depth comes from a 1–1.2px ink line, a hard offset shadow (`--shadow: 4px 4px 0 …`) or a slight lift on hover. A user explicitly rejected a soft radial glow as "weird"; the flat quarter disc replaced it.
4. **Type does the hierarchy.** Display serif Newsreader (`--display`) for page titles, hero words, big numbers and italic asides; Figtree (`--body`) for everything else. Eyebrows are small uppercase with letter-spacing. Don't add new font families.
5. **Constructivist marks come from the shared vocabulary.** Ink ring, flat accent disc/half/quarter or progress sector, a circle filled with horizontal stripes (clipPath), a solid ink dot, one thin diagonal "leading line". See `references/shapes.md` for the exact SVG recipes already in the code (`GEO`, `GEO_HERO`, `HELPER_GEO`, `progressGeo`, `TILE_GEO`, `newsCover`).

## Building something new: the order of work

1. Find the closest existing component in `styles.css` (cards, `.kpi`, `.chapter`, `.track-opt`, `.news-card`, `.zone-card`, `.sheet`) and extend it with a modifier class rather than a new look.
2. Use tokens for colour, `--r`/`--r-sm` or near-square corners (2–6px) for the constructivist parts; pills (`999px`) are only for chips, badges and tags.
3. If the element needs a picture or ornament, compose it from the shape vocabulary in an inline SVG with `aria-hidden="true"`, colours via `var(--ink)`/`var(--accent)` so both themes work.
4. Add hover motion following `references/motion.md` (inside the mouse-only, no-reduced-motion media query).
5. Check it in light, dark and at phone width (≤640px, 16px gutters; the bottom tab bar covers ~64px). Text inside a fixed-width panel must wrap (`min-width: 0`, `overflow-wrap: anywhere` on long eyebrows) or it will spill out of its card.

## Layout and component conventions

- Pages start with `intro(eyebrow, title, text, action)`: geometric mark + eyebrow, serif `h2`, one muted line, optional action on the right.
- Cards: `--surface` background, 1px border (`--card-border` / `--line`), `--r` corners, generous padding (16–24px). Plain cards don't move on hover; clickable cards lift.
- Buttons: `.btn` (outline), `.btn.primary` (accent fill, `--accent-ink` text), `.btn.ghost` (text-like). Icon buttons are 40px squares with `--r-sm`.
- Side panels (`.sheet`) are sticky on desktop and become a bottom sheet on phones with a close ✕.
- Paper grain is a fixed SVG noise overlay on `body::after` (hidden in print); don't add other textures.
- Every visible string goes through `T()`; that is handled elsewhere, but keep copy short and plain.

## Motion in one paragraph

GSAP 3.12.5 + ScrollTrigger + Lenis 1.1.20 are vendored in `static/vendor/` and loaded before `app.js`. `motionOn()` gates everything on reduced motion. `afterRender()` kills old ScrollTriggers and runs `appMotion()` (cards rise 28px and fade in once as they enter) or `landingMotion()` on the sign-in page. Hover effects are CSS only, short (≈0.2–0.45s, `cubic-bezier(.2,.8,.2,1)`), and live inside `@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)`. Details, the existing hover table and the gotchas are in `references/motion.md`.

## Reference files

- `references/tokens.md` — every colour, type, radius and shadow token with light and dark values, and when to use each.
- `references/shapes.md` — the constructivist SVG recipes with code, and how to compose new marks.
- `references/motion.md` — GSAP/Lenis setup, entrance motion, hover patterns per component, and pitfalls found while building them.
