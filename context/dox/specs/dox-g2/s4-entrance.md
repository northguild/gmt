# Slice 4 · Ice-freeze entrance

[Index](./index.md) · Binding rules: [visual-design.md § Motion](../../reference/visual-design.md#motion),
[design-system.md § Entrance](../../reference/design-system.md#entrance),
[built.md § Tier 4 · Globe](../../built.md#tier-4--globe-and-scrubber).

## Goal

From one start time the sky fades in from black, the copy freezes into place, and the Earth
wakes at dawn. A front of frost sweeps each copy element, which clears and locks with one bright
beat. The zone drawer is not part of the load; it sweeps in on each open (slice 2).

## One element, one animation

Today the hero canvas plays `enter()` (`revealCanvas`, `src/lib/globe.ts`) and the zoom stack a
hover/focus fade armed by `data-ready`. Nothing may layer on top:

- **One animation per element, per property, at any moment.** No hero element gets both the
  freeze and `enter()`. Pseudo-elements count as their own targets.
- **The hero canvas has no CSS animation.** With `entrance: "dawn"`, `revealCanvas` does not run;
  the canvas is visible from `t0` at exposure 0, and the dawn is its only entrance.
  `/tools/zoned-earth/` and the `/dox` rail keep `enter()` unchanged.
- **The zoom stack** has no entrance; `data-ready` comes with `data-dawn="done"` (slice 2 hides it while the drawer is open).
- **HeroCopy elements** get the freeze only; the clock rows keep `holdEntrance` in the closed drawer.

## The sequencer: `src/lib/hero-entrance.ts`

The only thing that starts the entrance; nothing else runs on its own timer.

```ts
export interface HeroEntranceOptions {
  sky: { layers: readonly HTMLElement[]; ready: Promise<void> }; // slice 3's band and stars layers
  globe: { ready: Promise<void>; startDawn(): void };
  signal: AbortSignal;                     // aborting clears its timer and listeners
  deadline?: number;                       // ms after navigation start; default 800
  now?: () => number;                      // performance.now() by default
}
export function runHeroEntrance(options: HeroEntranceOptions): void;
```

- **`t0`** is the moment the sky's first draw is done (`sky.ready`) and `globe.ready` has
  resolved, but no later than `deadline` ms after navigation start (at once if already past).
- At `t0` it sets `data-entrance="run"` on `<html>`, marks `performance.mark("gmt-entrance-t0")`
  and calls `globe.startDawn()`. Every CSS
  entrance animation is keyed on `:root[data-entrance="run"]` with its delay from the table below,
  so the sky, the copy and the header start in the same style recalc. If the globe was not ready
  at `t0`, the engine begins its dawn when it is; nothing else waits.
- **Before `t0`.** The inline head script in `src/lib/arrival.ts` sets `data-entrance="wait"` on
  `<html>` on the landing (path from `import.meta.env.BASE_URL`); freeze targets and sky layers
  hold at opacity 0. It sets `"static"` after 2.5 s if still `wait`, so a module that never loads
  cannot hide the copy; a `<noscript>` style shows everything. `HeroGlobe.astro` calls it after
  the globe mounts, with the globe's signal.

## Freeze (CSS)

`src/styles/gmt-entrance-freeze.css`, imported by `HeroGlobe.astro` only.

| Element | Direction | Delay from `t0` |
| --- | --- | --- |
| Header link and site title (direct load only, below) | left | 0 s |
| Eyebrow and `h1` (one freeze each) | left | .15 s |
| Tagline | left | .45 s |
| Actions (each button +.08 s) | left | .75 s |
| Location card (`.gmt-globe__tooltip`), below | scales out of its pin | 2.0 s |

Each freeze lasts 1.6 s and ends by 2.6 s; the location card, last of all, lands at 2.65 s.

**Cheap by design.** The freeze animates only `opacity`, `mask-position`, `color` (to frost and
back) and, on panes, `border-color`. No `filter`, blur, `text-shadow` or `box-shadow`, so no text
is blurred while the dawn runs. Glint and frost are pseudo-elements animating `opacity`/`transform`.

**Header on arrival.** The header freezes only on a direct load. An arrival through a view
transition (in-site or from northguild.dev) keeps it still. The inline head script listens for
`pagereveal` and, when `event.viewTransition` is set, writes `data-arrival="transition"` on
`<html>`; the CSS guards the header freeze with `:root:not([data-arrival="transition"])`.
`pagereveal` fires before the first render, so the header never flashes. Slice 5 extends it.

**Drawer.** Every open is slice 2's slide and sheen, which the entrance leaves alone; the border
never changes (no flash, no glow). Interactive at once; its close fades in .25 s later.

**Location card, last.** The globe's `#globe-tooltip` enters after the Earth is lit (exposure
passes .95 at ≈ 1.83 s) and the last button has landed. Until `data-entrance` is `run` or
`static` it is `visibility: hidden` (not opacity: the globe writes opacity inline). Its one
animation, `ng-card-pop`: .65 s, `cubic-bezier(.16, 1.22, .3, 1)` (≈ 1 % overshoot at the settle),
`from { opacity: 0; scale: .3 } 55% { opacity: 1 }`, fill `backwards`. It animates the individual
`scale` property with `transform-origin: 0 0`, never `transform`: the globe places the card with
`transform: translate(-50%, …)` and flips it above or below the pin, and `scale` applies outside
that, so the card grows out of its pin on either side.

**Reduced motion:** each freeze is `ng-fade` (opacity, .6 s, same delays); the location card a
.4 s fade at 2.0 s, no scale; each drawer open a .3 s fade, no sheen. **Forced colours:** mask sweep only; no drawer sheen.

## Sky from black

Stars from 0 s, 1.4 s, `cubic-bezier(.3, 0, .2, 1)`; band (Milky Way, wash) from .3 s, 1.8 s; `opacity`
only. Keyed on `[data-entrance="run"]` **and** `[data-sky="ready"]`: if the deadline or `"static"` comes
first, the hero stays plain void and the sky fades in once truly drawn. The meteor starts after the
sky is in. Reduced motion: one .6 s fade for the whole sky.

## Globe dawn

New `GlobeOptions.entrance?: "fade" | "dawn"`, default `"fade"` (today's `enter()`). The hero
passes `"dawn"`. With `"dawn"` the engine draws nothing until `startDawn()`, and exposes
`dawnReady: Promise<void>`, resolved once the imagery texture and the label atlas are uploaded.
`GlobeHost` passes both through. Nothing decodes, uploads or compiles during the ramp.

- At `t0` the canvas draws at `exposure = 0`: lit colours are the night colour, labels and borders
  alpha 0, the rim at .25. The Earth is a dark disc hiding the stars, with a hairline rim.
- `t0 + .35 s` to `t0 + 2.4 s`: `exposure` rises 0 → 1 with `cubic-bezier(.3, 0, .2, 1)`, rim too.
- `t0 + 2.4 s`: exposure is exactly 1, the root gets `data-dawn="done"`, the zoom stack gets
  `data-ready`, and the existing 2 s spin ease-in begins.

In the shader, a new `exposure` uniform (default 1, so other hosts are unchanged):
`lit = mix(nightColour, lit, exposure)`; overlays multiply their alpha by `exposure`.

- **Canvas-2D fallback:** no exposure; at `startDawn()` one .8 s opacity fade, then `data-dawn="done"`.
- **Reduced motion:** exposure 1 and `data-dawn="done"` at `t0`. **Ending state:** exposure exactly
  1 (parity unchanged); `globe-smoke` waits for `data-dawn="done"`.

## Constraints

- No layout property animates (CLS 0). `animation-fill-mode: backwards`; the mask lives only in
  the keyframes, so afterwards an element carries no mask or stacking context.
- `visual-design.md` § Motion allow-lists the freeze, sky fade, dawn and card pop. Clocks are
  injected (the engine's, the sequencer's `now`); nothing reads `Date.now()`.

## Tests

- `hero-entrance.test.ts` (fake timers, injected `now`, stubs): `t0` waits for `sky.ready` and
  `globe.ready`, or the deadline; `startDawn` and the mark happen once, at `t0`; aborting before
  `t0` sets nothing. `afterEach` aborts.
- `engine.test.ts`, fake clock, `"dawn"`: no frame before `startDawn()`; exposure 0 at `t0 + .35`,
  first > .95 between `t0 + 1.8` and `+ 1.85`, 1 at `+ 2.4` (spin starts), increasing between.
  Reduced motion: 1 at `t0`. `destroy()` during the dawn leaves no frame pending.
- `globe.ts`: with `"dawn"` no `.gmt-enter`, `data-ready` with `data-dawn="done"`; `"fade"` as today.
- `arrival.test.ts`: `pagereveal` with a `viewTransition` sets the attribute, without leaves it
  unset; the `static` failsafe fires at 2.5 s only if still `wait`; cleared on the test's signal.

## `hero-space` gate (this slice's checks)

- **One animation each.** At 1440×900, from navigation until `t0 + 2.7 s`, poll
  `document.getAnimations()` every frame. Group running animations by `effect.target` plus
  `pseudoElement`: no group ever holds more than one, and the hero canvas never appears.
- **Smooth.** From `t0` to `t0 + 2.7 s`: median frame ≤ 17.5 ms, none over 34 ms. **No blur:**
  `getComputedStyle(h1).filter` is `none` at every poll.
- **Card last.** Sampled every 100 ms from load (`t0` from the mark): hidden or opacity 0 at every
  sample before the night disc drops below .05 (exposure > .95, `t0 + 1.83 s`); opacity 1 and
  scale 1 first reached within .7 s of that, exactly 1 at `t0 + 2.65 s`; centred on the pin's x
  (±1 px) at mid-animation.
- **Order.** `run` is set before the canvas's first frame; `data-ready` lands with `data-dawn`.
  **Arrival:** a transition arrival leaves the header link unanimated. CLS 0; LCP within budget.

## Definition of done

- [ ] Index gates pass, plus `globe:smoke` and `hero-space`.
- [ ] Recordings (1440×900, 390×844) on the PR; reduced motion shows only fades (`a11y:media`).
- [ ] `visual-design.md` § Motion and `design-system.md` § Entrance describe, in present tense,
      the sequencer, one-animation rule, freeze, sky fade, dawn, card pop and reduced motion.

## Prototype

Excerpt of [`prototype/proto.css.txt`](./prototype/proto.css.txt) (`#03070c` body, Michroma `h1`):

```css
:root {
  --ice: #e6f6ff; --cyan: #22d3ee; --frost: color-mix(in oklab, var(--ice) 70%, var(--cyan));
  --mask: linear-gradient(100deg, #000 40%, rgb(0 0 0 / .55) 50%, transparent 62%);
  --mask-r: linear-gradient(260deg, #000 40%, rgb(0 0 0 / .55) 50%, transparent 62%);
  --mask-b: linear-gradient(to top, #000 40%, rgb(0 0 0 / .55) 50%, transparent 62%);
  --ease-sweep: cubic-bezier(.25, .6, .2, 1); --ease-settle: cubic-bezier(.2, .7, .3, 1);
}
/* Right: --mask-r, mask-position 0% 0 → 100% 0.
   Bottom: --mask-b, mask-size 100% 300%, mask-position 0 0% → 0 100%. */
@keyframes ng-freeze-left {
  0%   { mask-image: var(--mask); mask-size: 300% 100%; mask-repeat: no-repeat;
         mask-clip: no-clip; mask-position: 100% 0; opacity: 0; color: var(--frost);
         animation-timing-function: var(--ease-sweep); }
  18%  { opacity: 1; }
  82%  { mask-position: 0% 0; color: var(--frost); }
  88%  { color: var(--ice); animation-timing-function: var(--ease-settle); } /* the lock */
  100% { mask-image: var(--mask); mask-size: 300% 100%; mask-repeat: no-repeat;
         mask-clip: no-clip; mask-position: 0% 0; }       /* colour: back to its own */
}
:root[data-entrance="run"] .freeze { animation: ng-freeze-left 1.6s backwards; }
```

Panes (buttons) add, on the same clock and delay:

- **Border lock** (in the pane's one animation): `0%, 80%` `border-color: rgb(from var(--frost) r
  g b / .25)`, `88%` `rgb(from var(--ice) r g b / .9)`, `100%` unset.
- **Frost texture** (`::after`, `inset: 0`, `mix-blend-mode: screen`, `pointer-events: none`):
  opacity `0% 0 → 30% .35 → 82% .12 → 100% 0`. Background, tiled at 160 px:
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .85 0 0 0 0 .95 0 0 0 0 1 0 0 0 1.2 -.35'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23f)'/%3E%3C/svg%3E")`.
- **Glint** (`::before`, from delay + 1.4 s for 240 ms, `--ease-settle`): a
  `linear-gradient(115deg, transparent 40%, rgb(255 255 255 / .55) 50%, transparent 60%)` strip,
  `translate: 100% 0 → -100% 0`, opacity 0 outside it.

Judge the beat from 82 % to 88 %: frost snaps to ice once. If it flickers, mix `--ice` 20 % toward
the element's colour before shortening anything.
