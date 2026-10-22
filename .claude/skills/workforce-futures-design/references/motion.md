# Motion and hover

## Libraries and setup

- `static/vendor/gsap.min.js` (3.12.5), `ScrollTrigger.min.js`, `lenis.min.js` (1.1.20), loaded in `static/index.html` before `app.js`; credited in `NOTICE`. Don't add other animation libraries.
- `motionOn()` = GSAP + ScrollTrigger present and not `prefers-reduced-motion`. Wrap every JS animation in it.
- `initMotion()` creates one Lenis instance (`lerp: 0.11`). Panels that scroll themselves keep native scrolling through Lenis `prevent`: `.pick-list, .chat, .sheet, .menu-body, .tablewrap, [data-lenis-prevent]` — add new scrollable panels there or mark them `data-lenis-prevent`.
- `app.js` is wrapped in an IIFE, so `lenis`/`gsap` state isn't reachable from the console; use `scrollTop()` to reset scroll.

## Entrance motion

- `afterRender()` runs after every `render()`: kills old ScrollTriggers, runs `landingMotion(intro)` on the sign-in page or `appMotion()` once per page.
- `appMotion()`: cards and `.kpi` below 92% of the viewport start at `y:28, opacity:0` and rise in with `ScrollTrigger.batch` (`duration .75`, `power3.out`, stagger `.08`, `once: true`). Skips when the tab is hidden (frames pause and would leave cards invisible).
- Landing: words of the title slide up (`splitWords`), geo shapes scale in with stagger, numbers count up once, the paper section slides over the sticky dark band. Pinning with GSAP broke the full-bleed band, so it uses CSS sticky + an `.is-sheet` class.
- Smooth scroll that starts during `render()` can be cancelled on phones; scroll in a `setTimeout` after render.

## Hover rules

All hover motion is CSS and lives in one block near the end of `styles.css`:

```css
@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) { … }
```

- Mouse/trackpad only, so touch screens don't get stuck hover states; off for reduced motion (a global rule also zeroes transition durations).
- Transition list is declared once outside the media query: `transform .22s cubic-bezier(.2,.8,.2,1), box-shadow .22s, border-color .18s, background-color .18s, color .18s`. Signature moves on Home use .3–.5s with the same curve.
- Distances are small: 1–4px lifts, 2–4px slides, scale ≤1.12 (1.04 for images), rotations ≤8° except marks that turn 90°.

| Component | Hover | Active |
|---|---|---|
| `.btn` | `translateY(-1px)`; primary gets a soft accent shadow; ghost gets `--chip` | `scale(.97)` |
| `.chip`, path tabs | lift 1–2px, accent border | `scale(.97)` |
| `.icon-btn` | `rotate(-6deg)`, `--chip` | `scale(.97)` |
| `.deck-arrow` | accent border and colour (Home arrows nudge ±3px) | `scale(.97)` |
| `.nav button` | `--chip` row, icon `translateX(2px) scale(1.06)` | — |
| plain `.card` | border → `--faint` (no movement) | — |
| clickable rows (`.course`, `.alt-row`) | `translateX(3px)`, accent border | — |
| `.news-card` | lift 4px, accent border, shadow; image `scale(1.04)` inside `overflow:hidden` | — |
| `.zone-card`, `.track-opt` | lift 1–2px, accent border | — |
| `.ch-head` (path chapter) | chevron drops 3px, number `scale(1.08)` with accent border | — |
| `.node` (path step) | `.disc` rises 2px — never transform `.node` itself, it is positioned with `translate(-50%, …)` | — |
| `.q-scale button` | `scale(1.12)` | — |
| map dots | `.dot` `scale(1.25)` with `transform-box: fill-box` | — |
| sign-in `.kpi` | left rule → accent, number slides 4px and turns accent | — |
| sign-in `.flow .n` | `scale(1.15) rotate(-8deg)` | — |
| Home hero | dot/stripes drift a few px, leading line tilts 4°, accent rule under the career widens 72→160px | — |
| Home next step | card slides 4px right, left accent block 8→14px, corner ring drifts in, icon tilts | — |
| Home tiles (`.geo-tile`) | lift 4px, ink border, accent underline draws 0→100%, mark rotates 90° | — |

## Pitfalls already hit

- Selector scope: the sign-in numbers are in `.landing-below`, outside `.landing`; target them with `.is-landing .kpi` (body class). Check the real DOM ancestors before writing a scoped hover.
- Elements already positioned with `transform` (path nodes, centred popovers) must animate a child instead, or the hover overrides their position.
- `overflow: hidden` on a card clips popovers (`details.src`) inside it; signal cards set `overflow: visible`, and horizontally scrolling strips also clip popovers — prefer wrapping grids.
- No infinite animations (a pulsing ring was replaced by a still dot). If something needs attention, use a static accent mark.
- Verify hover with a real pointer: in headless Edge use CDP `Input.dispatchMouseEvent` (`mouseMoved`) after Lenis has finished scrolling (wait ~1.5s after `scrollIntoView`), then screenshot; `matches(':hover')` and `getComputedStyle` confirm the rule applied.
