# Slice 1 · Deck shell

[Index](./index.md) · Binding rules: [Tier 0–1 · Site](../../built/tier-0-1-site.md),
[Tier 2 · Platform](../../built/tier-2-platform.md), [Tier 2 · Gates](../../built/tier-2-gates.md),
[visual-design.md](../../reference/visual-design.md).

## Goal

The routes, the registry and the building blocks every deck uses. At the end of this slice a
placeholder deck of three slides with builds steps by keyboard and clicker, deep-links, opens an
overview and help, blanks, goes fullscreen, reads as an article without JS and prints one slide a
page. No globe yet: the stage sits on `--gmt-void`.

## Routes and pages

- `src/pages/slides/index.astro`: a StarlightPage (`template: "splash"`) listing each deck from
  `src/slides/decks.ts` as a card: title, event, date, length, a link. Indexed and searchable.
- `src/pages/slides/give-me-temporal/index.astro`: a StarlightPage built like `src/pages/dox.astro`
  (head script sets `data-deck` on `html`, CSS hides sidebar, TOC and footer; `pagefind: false`).
  The site header stays in browse mode; fullscreen is requested on the deck root, so the header
  is not in it.
- `src/slides/decks.ts`: `{ slug, label, title, event, date, minutes, qa }[]`. The date is a
  `PlainDate` string. A test asserts every slug has a page and every page a registry entry.
- `astro.config.mjs`: the sitemap filter also drops any path ending `/presenter/` (slice 3 adds it).

## Components (`src/components/slides/`)

- `Deck.astro` (props `slug`): renders the `<article data-deck-root>` with a heading, the slide
  list in order, the controls bar and the two dialogs. It reads nothing but its slot.
- `Slide.astro` (props `id`, `title`, `minutes`, `place`, optional `layout`): a
  `<section id={id} aria-labelledby>` with an `h2`, carrying `data-minutes` and `data-place`.
- `Build.astro` (props `n`, optional `place`): wraps content revealed at build `n` (1-based); a
  `place` moves the camera when that build appears (slice 2). Without JS every
  build is visible.
- `Notes.astro`: an `<aside data-notes>` that is hidden on the stage and in print, shown in the
  no-JS article under "Speaker notes" and read by the presenter view (slice 3).
- One source: the runtime reads slides, builds, minutes, places and notes from the DOM. No
  second list of slides exists anywhere.
- Trap: Astro's `compressHTML: "jsx"` eats spaces next to elements on a line break
  ([Tier 2 · Component kit](../../built/tier-2-platform.md#component-kit)).

## The pure controller: `src/lib/slides/deck.ts`

No DOM. `createDeck(slides: { id; builds }[])` returns state `{ slide, build }` and
`next()`, `prev()`, `nextSlide()`, `prevSlide()`, `first()`, `last()`, `goTo(n)`, `goToId(id)`.
- `next()` reveals the next build, then moves to the next slide at build 0. `prev()` mirrors it
  and lands on the previous slide with all its builds shown.
- `parseHash("#manila/2")` and `formatHash(state)`; an unknown id or build clamps to the nearest
  valid state, never throws.
- Tests: table-driven over a 3-slide deck with 0, 2 and 1 builds: every transition, both ends,
  every hash form (`#`, `#id`, `#id/0`, `#id/9`, `#nope`).

## Kit addition: carousel steps

`wireCarousel` (APG Carousel, tabbed) gains an opt-in `steps` option:
`{ count(index): number; current(): number; step(delta: 1 | -1, by): boolean }`. When given, the
prev and next buttons call `step` first and only `select` when it returns `false`. The handle
gains `step(delta, by)`. Without the option nothing changes; the landing carousel's tests stay as
they are. New tests in `carousel.test.ts`: steps consumed before pages, both directions, the live
region announces the slide once per slide change and never per build.

The deck mounts `wireCarousel` with `pages` = the slide sections, `live` = "Slide n of m: title",
`keyArea` unset (the deck owns keys), `wheelArea` unset (the wheel never changes slides).

## Keys: `src/lib/slides/keys.ts`

One `keydown` listener on `document`, added with the mount's `signal`. It ignores events with
`defaultPrevented`, a modifier other than Shift, a target that is editable, Space or Enter on a focused button or link, or a target inside an open
`<dialog>`. Escape is never handled here: dialogs close through
[the Escape order](../../built/tier-2-platform.md#escape-one-order-for-the-whole-site), and the
browser leaves fullscreen.

| Key | Action |
| --- | --- |
| → ↓ PageDown Space Enter N | Next step |
| ← ↑ PageUp Shift+Space Backspace P | Previous step |
| Shift+→ / Shift+← | Next / previous slide |
| Home / End | First / last slide |
| digits then Enter | Slide n (a 1.5 s digit buffer on the injected clock) |
| O | Overview dialog |
| ? | Help dialog |
| B or . | Blank the stage (clicker blank button); any step key unblanks |
| F | Fullscreen on the deck root |
| F5, Shift+F5 | Start presenting: fullscreen; `preventDefault` so the page does not reload |
| T | Open the presenter window (slice 3) |
| W A S D, Q E, R | Reserved for slice 2's free flight; no-ops here |

Clickers send PageUp/PageDown, F5 or Shift+F5, Escape and `.` or B; the table covers all of them.
`keys.ts` exports the table as data; the help dialog renders from it, so the two never drift.

## Dialogs

- **Overview** (`O`): a native modal `<dialog>` (APG Dialog Modal) holding an `<ol>` of links to
  `#<id>`, one per slide, with its minutes. Choosing one closes the dialog and goes there; focus
  returns to the opener. Slice 2 adds the globe's pull-back behind it.
- **Help** (`?`): a modal `<dialog>` with the key table as a real `<table>`.
- Both open from buttons in the controls bar too, built with the `button` builder.

## Stage

- `slides.css`: the stage is `aspect-ratio: 16 / 9`, `inline-size: min(100vw, 100dvh * 16 / 9)`,
  centred and letterboxed on `--gmt-void`, `container-type: size`. Type sizes use `cqi`, so the
  slide scales with the stage and never with the window. One slide shows at a time; the rest are
  `hidden` by the carousel. The stage carries `gmt-theme-dark` in both site themes, as the hero
  does; the `/slides/` index follows the site theme.
- A build not yet reached is `visibility: hidden` plus `inert`, so layout does not move when it
  appears ([layout stability](../../reference/visual-design.md#layout-stability)).
- Panels: opaque `--gmt-surface-widget`, full bevelled border (`corner-shape: bevel`), accent
  edge on the bottom only. No left-only stripe, no `backdrop-filter`.
- Blank: a void layer over the stage with `aria-hidden`, plus the live region saying "Screen blanked".
- Fullscreen uses `element.requestFullscreen()` and reflects `document.fullscreenElement` on a
  `data-fullscreen` attribute; no vendor prefixes (Baseline 2024 target).
- Hash: on each change the deck writes `history.replaceState` with `formatHash`; on `hashchange`
  it reads the hash back. Back and forward stay inside the site, not slide by slide.
- Reduced motion: the slide change is a cut plus a 200 ms opacity fade; otherwise 240 ms on the
  spring curve.

## Without JS, and print

- The stage CSS applies only under `html[data-deck="stage"]`, which the mount sets. Without it
  the page is a stacked article: every slide, every build, every note, in reading order.
- `slides-print.css` (media `print`): `@page { size: 297mm 167mm; margin: 0 }`, one slide a page
  (`break-after: page`), builds and panels shown, canvases and controls hidden, notes hidden,
  `print-color-adjust: exact` on the void background. Printing the article gives the handout.

## Gate: `scripts/slides-check.mjs`

A page gate on the [page contract](../../built/tier-2-gates.md#gates) (`--list-pages` returns
every deck route, `--pages`, `--base`; `recordFinding` with element identity keys). Pages run with
`?globe=canvas2d` so CI needs no GPU. Checks, at 1280×720, 1920×1080 and 1024×768:
- every slide reachable from the first by next steps alone, and back by previous steps;
- `#<id>/<n>` lands on that slide and build;
- no slide's content box leaves the stage box; no horizontal page scroll;
- the stage box does not move or resize while stepping through every build;
- with JS off, every slide `h2` is present in order; with `emulateMedia({ media: "print" })`,
  every section has `break-after: page` and no canvas is displayed.
Register it in `scripts/gates/registry.mjs` at tier `pr`; it runs in the CI leg "other".

## Tests

- `deck.test.ts` (pure, no DOM).
- `keys.test.ts`: jsdom, a fresh `AbortController` per test and `abort()` in `afterEach`, so the
  `document` listener is gone before the next file; the digit buffer runs on fake timers
  (`vi.useFakeTimers`), restored by `setup-dom.ts`. Each key in the table maps to its action;
  editable targets, open dialogs and Ctrl/Meta/Alt chords are ignored; F5 is prevented.
- `carousel.test.ts` additions above.
- `deck-mount.test.ts`: `mountDeck(root, { signal })` (`src/lib/slides/deck-mount.ts`, the DOM
  side) over a fixture of three sections built with the `html` builder and rendered through
  `src/test/render-widget.ts` (the repo renders no `.astro` in Vitest), with
  `expectNoAxeViolations`; `destroy()` and `abort()` run in `afterEach`. `requestFullscreen` is stubbed with `vi.stubGlobal`,
  which moves that file to the `isolated` project
  ([Test isolation](../../built/tier-2-platform.md#test-isolation)).
- `decks.test.ts`: every registry slug has a page file under `src/pages/slides/` and back.
- `slides-check.test.ts`: the gate's pure helpers.

## Definition of done

- The placeholder deck steps, deep-links, blanks, opens both dialogs and goes fullscreen with
  every key in the table and with a clicker (the owner's listening pass).
- No JS: a readable article. Print preview: one slide a page.
- Own tests, `pnpm dox:lint` and `pnpm dox:check` green.
