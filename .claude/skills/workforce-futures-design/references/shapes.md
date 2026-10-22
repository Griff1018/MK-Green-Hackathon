# Constructivist shapes

The vocabulary: **ink ring** (1–1.4px stroke, `var(--ink)`, often at 25–55% opacity), **flat accent fill** (disc, half disc, quarter disc or progress sector, solid `var(--accent)`), **striped circle** (horizontal ink or accent lines clipped to a circle), **solid dot** (ink, r≈6), **one leading line** (thin diagonal across the whole composition, ink at ~25–35%). Compose 3–5 of these with one accent shape; leave space around them. All SVGs are inline, `aria-hidden="true"` (or `role="img"` + `aria-label` when they carry data), and coloured through CSS variables so both themes work.

Give each `clipPath` a unique id (e.g. `pgStripe`, `hgStripe`, `tgS`) — several compositions can be on one page.

## Existing recipes (in `static/app.js`)

### `GEO` — page marks in the intro eyebrow (26px)
One per page key (`dashboard`, `mycareer`, `careers`, `news`, `path`, `resume`, `sources`, `team`, `wizard`). Ink outline plus one accent fill, e.g.:
```js
dashboard: o('<circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20z" fill="var(--accent)" stroke="none"/>'),   // ring + accent half
careers:   o('<rect x="2" y="2" width="20" height="20"/><path d="M2 22V2a20 20 0 0 1 20 20z" fill="var(--accent)" stroke="none"/>'), // square + accent quarter
```
Add a new page by adding a key here; reuse ring / square / half / quarter / concentric rings / stripes.

### `GEO_HERO` — landing composition (600×600)
Large ring, second ring, striped circle (clipPath, 10 lines 15px apart, stroke-width 5), small solid dot, one leading line from bottom-left. On the dark band it uses `rgba(244,242,236,.35–.7)` strokes. GSAP drifts each shape upward at different rates on scroll.

### `HELPER_GEO` — Lambtae's corner (220×220, bottom-right, behind the case button)
```html
<circle cx="220" cy="220" r="196" fill="none" stroke="var(--ink)" stroke-opacity=".35" stroke-width="1.2"/>  <!-- ring -->
<circle cx="220" cy="220" r="138" fill="var(--accent)" fill-opacity=".9"/>                                 <!-- flat quarter disc -->
<g clip-path="url(#hgStripe)" stroke="var(--ink)" stroke-opacity=".55" stroke-width="4">…8 lines 7px apart…</g>
<circle cx="150" cy="40" r="6" fill="var(--ink)"/>                                                        <!-- dot -->
<line x1="0" y1="206" x2="220" y2="96" stroke="var(--ink)" stroke-opacity=".3"/>                          <!-- leading line -->
```
Positioned `absolute; right:-20px; bottom:-20px; z-index:-1; pointer-events:none`, smaller on phones, faded to .35 while the chat is open. The label next to it is a square ink block with uppercase text and a 4px accent left border — not a rounded pill.

### `progressGeo(pct)` — progress as composition (Home hero, 200×200 viewBox, 168px)
Outer ink ring r92 at .35, inner `--line` ring r70, **accent sector** from 12 o'clock sweeping `pct` (SVG arc `A R R 0 large 1 x y`, `large = pct > 50`), a short accent tick at the start, striped circle bottom-left, ink dot top-right, leading line. The number sits centred in the display serif (`display:flex` — not grid, or the "%" drops below the number). Prefer this over a CSS conic ring when progress is the hero of the page.

### `TILE_GEO` — 34px marks on Home tiles
`fit` ring + accent half, `stage` ring with accent stripes clipped inside, `resume` square + accent quarter. Placed `absolute; top:14px; right:14px`; rotate 90° on tile hover.

### `newsCover(x)` — fallback picture for a headline
Dark tinted rect by topic hue, one large flat circle, one outline circle, five diagonal translucent stripes; positions derived from a hash of the id so each card differs but stays calm. Use this pattern for any "no image" placeholder.

## Composing a new mark

1. Pick the meaning first (progress → sector; choice → half disc; place/corner → quarter; repetition → stripes or a row of rings with the first filled).
2. Draw the outline layer in ink, then add exactly one accent fill.
3. Add at most one dot and one leading line for tension; keep the rest empty.
4. Size it to the container with `viewBox` and `width:100%`; never rasterise.
5. If it moves on hover, move the small pieces (dot, stripes, line) a few pixels or rotate the whole mark 90° — never scale the accent fill dramatically.
