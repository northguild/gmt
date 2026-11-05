# Slice 7 · Landing carousel

[Index](./index.md) · Builds on [slice 2](./s2-hero-space.md#layout) and [slice 4](./s4-entrance.md).
Binding rules: [built.md § Tier 1](../../built.md), [built.md § Tier 3](../../built.md#tier-3--hud-chrome),
APG [Carousel, tabbed](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/), without autoplay.

## Goal

The landing's copy column beside the Earth holds its pages, one shown at a time. Under them sit
the hero's buttons and a pager: the previous arrow, a dot per page and the next arrow. Only the
text above the buttons changes; the buttons and the pager never move. On a wide landscape screen
the page never scrolls; elsewhere, and without JavaScript, every page reads in order and the
page scrolls.

## When it applies

- **Paged** needs JavaScript. The inline head script in `src/lib/arrival.ts` sets
  `data-home-carousel="wait"` on `<html>` on `/` before the first paint, so the paged layout is
  the first layout. `home-carousel.ts` writes `on` once wired, or removes the mark when the hero
  lacks a part.
- **Locked** is `HOME_LOCKED_QUERY`, `(width >= 64rem) and (orientation: landscape)`: the sky and
  the Earth fill the viewport, nothing scrolls the page, and a page taller than its place scrolls
  inside itself. The wheel steps pages only here.
- **Stacked** (narrower, or portrait): the copy sits over the Earth and the page scrolls. The pager
  still works by click, key and dot; the wheel scrolls the page and never steps.

## Pages

Each page is an element marked `data-page="<name>"` in the copy column. `HeroGlobe.astro` renders
the intro; `index.mdx` passes the rest as children (`GridSection page="…"` for the four sections).

| Page | Holds | Source |
| --- | --- | --- |
| Intro | Eyebrow, title, tagline | `HeroGlobe.astro` (`.gmt-herostage-intro`) |
| About gmt | Current release and the lead paragraph | `index.mdx` (`.gmt-home-lead`) |
| Built on the standards | Standards cards and the more link | `GridSection` |
| Tested and precise | The live test figures and the more link | `GridSection` |
| The bug is the Date object | `WhyDateBug variant="home"` and the more link | `GridSection` |
| The alternatives inherit it | `WhyDateAlternatives variant="home"` and the more link | `GridSection` |

The pages keep their boxes in one grid cell, so the place is as tall as the tallest page, capped
by the space there is. `WhyDateBug` and `WhyDateAlternatives` take `variant: "home" | "full"`;
`/why-gmt/` and `/compare/` render `full`. Facts trimmed from the landing live on each section's
linked guide.

## Kit: `carousel` builder

`src/widgets/builders/carousel.ts` + `.module.css` + test. The page renders the pages, the two
buttons, an empty element for the dots and a polite live region; `wireCarousel(root, options)`
writes the rest and returns `{ readonly index; select(i, by) }`.

Options: `signal`, `pages` (`{ el, label }[]`), `prev`, `next`, `dots`, `live`, `keyArea`,
`wheelArea?`, `wheel?` (when the wheel steps), `label`, `idPrefix`, `start?`, `now?` (clock,
default `performance.now`), `onSelect?(to, from, by)` and `leave?(el, hide)`.

- **Roles.** The root is a `region` with `aria-roledescription="carousel"` and the given `label`.
  The dots are a `tablist`, one `tab` per page, named by the page's label. Each page is a
  `tabpanel` with `aria-roledescription="slide"`, named `<label>, <n> of <total>`, and in the tab
  order, so a page that scrolls can be scrolled from the keyboard.
- **Shown and hidden.** The shown page carries `data-shown`. A page that closes is `inert` at once
  and loses `data-shown` when `leave` calls `hide` (at once without `leave`).
- **Buttons.** Named `Previous: <label>` and `Next: <label>`, with `aria-controls`. One with no
  page to open carries `data-off`, leaves the tab order and keeps its space. If it had focus, focus
  moves to the other button quietly: `data-quiet-focus` shows the ring without the sonar ping until
  it blurs or is pressed.
- **Keys.** On the dots, Left and Right move to the previous and next dot, Home and End to the
  first and last, and the page follows. Elsewhere in `keyArea`, Left and Right change the page,
  except in a text field or something that scrolls sideways. When the page that holds focus
  closes, focus moves to the page that opens.
- **Wheel.** Over `wheelArea`, while `wheel()` is true: a page that scrolls scrolls first; a
  gesture that starts at its end steps forward and one at its top steps back (opening that page at
  its end). One gesture moves one page: the wheel is held until 220 ms of quiet and 650 ms since the
  step, and held events are cancelled so momentum never scrolls the new page. A line counts as
  16 px. A wheel with Ctrl held (a trackpad pinch) is left to the browser's zoom.
- **Live region** says `<label>, <n> of <total>` on every change but the first.
- **Teardown** (the signal aborts) removes every role, id, name, dot, attribute and listener it
  wrote, `data-quiet-focus` included, and a fade still running cannot hide its page afterwards.
  The kit sets no timer.

## Page glue: `src/lib/home-carousel.ts`

Wires the kit with the region label "About gmt", `idPrefix` "home", the column as `keyArea` and
`wheelArea`, and `wheel` true while locked.

- **Hash.** A hash naming an element on a page opens that page on load and puts the target at the
  page's top; `#_top` opens the intro; an unknown id, or a hash that is not valid
  percent-encoding, is ignored. A later `hashchange` is followed. Leaving the page the hash names
  clears it with `history.replaceState`, keeping the query.
- **Escape.** The carousel is not a layer: the APG pattern gives Escape no part, and the cascade
  leaves the page the reader turned to.
- **Motion** is in `gmt-entrance-freeze.css`, keyed by `data-motion` on the page: the incoming
  page plays `ng-freeze-fly-left` (`--ng-panel-in-dur`, 0.7 s); the outgoing one `ng-fade-out`
  (0.2 s), then hides. Under reduced motion the outgoing page hides at once and the incoming one
  fades in. A step other than the wheel opens the page at its top.
- **Linked page on load.** A hash that opens a later page marks it `data-motion="load"`: it is out
  of sight while the entrance waits, freezes in after the first beat, and loses the mark once that
  animation ends or is cancelled.

## Layout

`gmt-home-carousel.css`; every rule sits under `:root[data-home-carousel]`. Without the mark the
pager is not shown and every page reads in order.

- The column is a grid: the page area over the row of buttons and pager. The pages share one cell
  (`grid-area: 1 / 1`), `max-block-size: 100%`, `overflow-y: auto`, thin cyan scrollbar.
- Locked: `.gmt-herostage` is fixed to the viewport under the glass header and `<html>` does not
  scroll; the pages take `overscroll-behavior: contain`. Stacked, they do not, so a wheel over a
  page that cannot scroll further scrolls the landing. Slice 2's framing keeps the Earth clear of
  the column.
- Section panels take `--gmt-bevel-{lg,md,sm}` with `corner-shape: bevel` and full 1px borders
  (no left-border accent).

## Tests

- `carousel.test.ts` (jsdom): roles and names, the off button, quiet focus handover, dots and
  keys, arrow keys outside text fields, the wheel (one step per gesture, 16 px lines, scrolling
  pages, Ctrl left alone, nothing past the last page), the leave hook, full teardown, and the
  two-page minimum.
- `home-carousel.test.ts` (jsdom): the mark, the dots, the arrows, hash on load and later, the
  invalid-encoding hash, clearing the hash, a hero missing a part, and teardown.

## `hero-space` gate: the carousel sections

- **Locked** at 1440×900, 1920×1080, 1280×720 and 1024×768: the mark is `on`; every page is
  present; the page does not scroll; it starts on the intro (or the hash's page); the buttons'
  names and off state; next, previous, keys and dots step; the wheel steps once per gesture and a
  scrolling page scrolls first; the Earth does not move; each page fits or scrolls inside itself;
  the buttons and pager stay still; CLS 0; motion finishes; no console errors; deep links open
  their page with the target in view and leaving clears the hash.
- **Stacked** at 1000×700, 900×1200 and 390×844: the mark, the page scrolls, the wheel scrolls the
  page and does not step, and next still steps.
- **JavaScript off**: no pager, every page reads in order.

## Definition of done

- [ ] Index gates pass, plus `pnpm --filter @gmt/dox gates --only hero-space`.
- [ ] Every fact and link trimmed from the landing is on its section's guide.
- [ ] `built.md` Tier 1 describes the paged landing; Tier 3 lists the `carousel` builder.
