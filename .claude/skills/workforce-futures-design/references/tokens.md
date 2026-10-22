# Tokens

Defined at the top of `static/styles.css`. Light values on `:root`; dark values repeated under `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` and `:root[data-theme="dark"] { … }` (the theme button sets `data-theme`). The landing band redefines the dark set locally so it is always dark. When you add a token, add it in all three places.

## Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F4F2EC` (paper) | `#0B0B0C` | page background |
| `--surface` | `#FAF9F5` | `#131315` | cards, panels, inputs |
| `--ink` | `#111111` | `#F4F2EC` | text, outlines, ink shapes |
| `--muted` | `#4F4D48` | `#A8A59D` | secondary text |
| `--faint` | `#6B6862` | `#8C897F` | eyebrows, tertiary text, hover borders |
| `--line` | `#D9D5CB` | `#2A2A2D` | dividers, quiet borders, empty tracks |
| `--rule` | `#111111` | `#F4F2EC` | strong rules (footer, landing numbers) |
| `--chip` | `#EAE7DF` | `#1B1B1E` | chips, hover tint, track backgrounds |
| `--card-border` | `#111111` | `rgba(244,242,236,.42)` | card borders |
| `--accent` | `#1F3BD9` (Klein blue) | `#6B80F4` | the one highlight: primary buttons, fills, links |
| `--accent-hover` / `--accent-deep` | `#1A31B5` | `#8596F6` | primary button hover |
| `--accent-ink` | `#FFFFFF` | `#0B0B0C` | text on accent |
| `--accent-soft` | `#E3E7FA` | `#171C3A` | tinted backgrounds (next step, selected tab) |
| `--tech` | `#0E6A80` | `#67C7DB` | tech tags only |
| `--good` / `--good-soft` | `#1F7A4D` / `#E3F1E8` | `#5CC48A` / `#11241A` | rising demand, done |
| `--warn` / `--warn-soft` / `--warn-line` | `#8A4B0F` / `#F6EBD6` / `#C98A2E` | `#F0C26B` / `#2A2112` / `#8A6420` | cautions, "not checked", flags |
| `--bad` | `#B3261E` | `#F28B82` | falling demand, negative score parts |

`color-mix(in srgb, var(--accent) 35%, transparent)` is acceptable for a soft accent shadow under a primary button; don't use it for glows or backgrounds behind shapes.

## Type

- `--display`: "Newsreader", Georgia, serif — `h1–h3`, page titles (`.intro h2` uses `clamp(1.75rem, 1.2rem + 1.4vw, 2.25rem)`), hero career name (`clamp(2rem, 1.3rem + 2.4vw, 3.1rem)`), big numbers (`.k-value`), italic quotes and taglines.
- `--body` and `--mono`: "Figtree", system UI — body text 15px/1.55, labels, buttons, data. Numbers use `font-variant-numeric: tabular-nums` (`.mono`).
- Eyebrow: `.75rem`, `letter-spacing: .08em`, uppercase, weight 600, `--faint` (accent on intro and hero).
- Sizes in use: `.tiny` ≈ .74rem, `.small` ≈ .86rem; headings in cards ≈ 1–1.3rem.

## Shape, depth, spacing

- Radii: `--r: 6px` (cards), `--r-sm: 4px` (buttons, icon buttons). Constructivist blocks (next step, updates, home tiles, Lambtae label) go squarer: 2–4px. Pills `999px` only for chips/badges/tags.
- Shadows: `--shadow: 4px 4px 0 #111` (light) / `4px 4px 0 #6B80F4` (dark) — a hard offset, used for menus, popovers and pressed segments. `--shadow-sm`/`--shadow-lg` are `none` on purpose.
- Gaps: 6–8px inside rows, 12–16px between cards, 24px between page sections. `.stack` and `.row` utilities exist.
- Phone: ≤640px uses 16px side gutters; ≤1023.98px replaces the sidebar with a bottom tab bar (`--tab-h: 64px`), so fixed elements sit above it.

## Texture

Paper grain: `body::after` is a fixed full-screen SVG `feTurbulence` noise at opacity .5 (black noise in light, white noise in dark), `pointer-events: none`, hidden in print. It is the only texture; don't add gradients or image textures to components.
