# Slice 7 · Landing carousel

[Index](./index.md) · Builds on [slice 2](./s2-hero-space.md#layout) and [slice 4](./s4-entrance.md).
Binding rules: [built.md § Tier 1](../../built.md), [built.md § Tier 3](../../built.md#tier-3--hud-chrome),
APG [Carousel, basic previous/next](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/). Model for
copy and look: [`prototype/deck.js.txt`](./prototype/deck.js.txt) (two-panel default) and [`proto.css.txt`](./prototype/proto.css.txt); read, don't copy.

## Goal

On a desktop the page never scrolls. The sky and the Earth fill the viewport under the header;
the copy column holds two panels: the intro (hero copy and calls to action) and "About gmt", one
bevelled panel with the four condensed sections. The wheel over the column switches them; a press
outside About closes it. Elsewhere, and without JavaScript, the same content scrolls as a page.

## When it applies

Carousel mode needs JavaScript and `(width >= 80rem) and (height >= 40rem)`.

- The inline head script in `src/lib/arrival.ts` tests the query on `/` before the first paint
  and sets `data-home-carousel="wait"` on `<html>`, so the locked layout is the first layout.
- `home-carousel.ts` sets `"on"` once wired; s4's 2.5 s failsafe removes a leftover `wait`. A
  `matchMedia` `change` enters or leaves live; leaving restores every node, `hidden` and scroll.

## Panels and content

| Panel | Holds | Source | Chevron label | `aria-label` |
| --- | --- | --- | --- | --- |
| Intro | Hero copy, actions, then the lead | `HeroGlobe` + `lead` slot | More (right) | Intro |
| About gmt | Standards, Tested, The `Date` bug, Alternatives | `.gmt-home-grid` | Intro (left) | About gmt |

Content is condensed **at the source**, at every width: one version, nothing hidden or moved
aside. Each section is a heading, a one-line lede, six tiles or up to six rows, and one more link.

| Section | Heading id | More link |
| --- | --- | --- |
| Built on the standards | `built-on-the-standards` | Every standard, in one place → `/guides/concepts/standards/` |
| Tested and precise | `tested-and-precise` | See the evidence → `/guides/concepts/correct-at-the-edges/` |
| The bug is the `Date` object | `the-bug-is-the-date-object` | Why GMT → `/why-gmt/` |
| The alternatives inherit it | `the-alternatives-inherit-it` | Compare the libraries → `/compare/` |

- **Copy** is the prototype's (`deck.js` `slidesHTML`). Standards: six `HomeCard`s; the
  seventh, full-span card becomes the more link. Tested: six, numbers live, never literal:
  `~{executionRatio(combinedCompetitorExecutions())}× more CI runs`;
  `{formatCount(gmtStats.executions)} executions, against {competitorComparisons.length}
  libraries combined`; `None of {formatCount(gmtStats.tests)} tests skipped or expected to fail`.
  "The others stop at milliseconds" needs every competitor's `timeResolution` to be
  `"millisecond"`; a test asserts it.
- **Facts move, never vanish.** Before deleting a sentence or link from `index.mdx`, find it on
  the section's linked guide, or add it there. Links leaving the home: `/upstream/`,
  `/guides/industries/intermodal-edi-timestamps/`, `/reference/precision/convert/toNanoseconds`,
  and the standards cards' RFC links.
- **Variants.** `date-faults.ts` gains `home?: true` on today's entries 0, 1, 2, 4 and 6.
  `WhyDateBug` and `WhyDateAlternatives` take `variant: "home" | "full"`. `home`: fault rows input
  → output without `why`; one row per layer, name → `foundation`, coloured by `kind`. `full`: today's
  markup. `why-gmt.mdx` and `compare.mdx` render the `full` variants (neither holds this text
  today); `src/lib/mdx-jsx.ts` renders each variant as its page does.
- **The lead** ("Current release" and the intro) moves into a `lead` slot of `HeroGlobe`, after
  the actions, at every width; "on the globe above" becomes "on the globe".
- **Ids and markers.** `SectionHeading` takes an optional `id` (the Markdown slug); the two
  components drop their dangling `aria-labelledby` ids. `HeroGlobe` wraps `HeroCopy` and the lead
  in `div[data-panel="intro"]`; `.gmt-home-grid` takes `data-panel="about"`.

## Look

Rules: `gmt-home-carousel.css` (carousel mode) and module CSS (every width); colours are tokens.

- **Ice chunks.** The About panel, tiles, rows and diamonds take `border-radius` from new tokens
  `--gmt-bevel-{lg,md,sm}` (14, 10, 6px) plus `corner-shape: bevel`. Under `@supports not
  (corner-shape: bevel)` they take a same-size `clip-path` octagon: the owner's one exception to
  the "no clip-path" rule, for these four only. Focus outlines never clip; they keep a plain radius.
  First and last cells keep ≥ 10px inline padding (built.md's bevel trap).
- **Borders.** Every box has a full 1px border; a tone may colour all of it. Sections are split
  by a full-width 1px hairline (`border-block-start` after the first). No left-border accent.
- **Type.** Body 13px (`.8125rem`), tile title 13.5px weight 600, tile line and more link
  12.5px, h2 Michroma 1.05rem in `--gmt-cyan`; all ≥ the 12px font floor.
- **Panel.** Void at .74, 4px backdrop blur, 1px ice border at 16 %, padding `1.4rem 1.5rem 0`;
  sections `padding-block: 1.4rem 1.6rem`, gap `.9rem`. Tiles: two columns, gap `.6rem`, padding
  `.75rem .85rem`. Rows: `minmax(0, 1.15fr) auto minmax(0, 1fr)`.
- **Diamond icons (new; `HomeCard` icons were square).** A 1.65rem bevelled tile turned 45°,
  glyph turned back; border `--home-card-edge` at 70 %, fill 14 %, from `data-tone`. Every width.

## Layout in carousel mode

All rules sit under `:root[data-home-carousel]`.

- `<html>`: `overflow: hidden`. `.gmt-herostage`: `position: fixed; inset: 0`, under the glass header (its top padding).
  `--gmt-copy-col: clamp(35rem, 36vw, 42.5rem)`; slice 2's framing keeps the Earth clear of it.
- The deck runs from `1.5rem` under the header to `1.5rem` above the foot; no controls row. Both
  panels share one grid cell (`align-self: start`); the closed one is `hidden="until-found"`.
- **DOM order is reading order.** Entering moves `.gmt-home-grid` into the column after the intro,
  leaving a marker comment; leaving puts it back. During `wait` it is `position: fixed;
  visibility: hidden`. It inherits `gmt-theme-dark`.
- **Intro fits; About scrolls inside itself.** The intro is `overflow: clip` and fits. About has
  `max-block-size: 100%`, `overflow-y: auto`, `overscroll-behavior: contain`, `scrollbar-width:
  thin` (`--gmt-cyan` at 28 %), `tabindex="0"` with a focus ring, and opens at `scrollTop` 0
  every time. Scroll is the fallback, not the excuse. No `content-visibility` on a panel and no
  `[hidden] { display: none }` rule.
- **Footer.** `footer .meta` and pagination are `display: none`. The licence and data-credit line
  is `position: fixed` at the hero's bottom right, one `--sl-text-xs` line clear of the zoom stack.

## Kit addition: `carousel` builder

`src/widgets/builders/carousel.ts` + `.module.css` + test: APG Carousel, basic previous/next, no autoplay.

- `carouselControls({ id })`: two slice 2 `edgeControl`s (direction −1 and 1, `caption` the
  label `span`), the same box as the drawer close; one hidden `aria-live="polite"`.
- `wireCarousel(root, { signal, panels: { el; label; short; scrolls? }[], controls, wheelArea?,
  keyArea })` returns `{ readonly index; select(i, by) }` and owns:
  - **Roles.** Root `role="region"`, `aria-roledescription="carousel"`, `aria-label="About gmt"`;
    panels `role="group"`, `aria-roledescription="slide"`, `aria-label` from `label`. The closed
    one is `hidden="until-found"`; `beforematch` selects it.
  - **Chevrons.** `short` shows on hover and focus-visible; names "More about gmt" and "Back to
    Intro" (each holds its visible word). One without a target is `visibility: hidden`,
    `tabindex="-1"`; if it had focus, focus moves to the other.
  - **Live region** says the panel's `label` on every change but load.
  - **Keys.** Left and Right step while focus is in `keyArea` (column and chevrons), outside text
    fields. Home and End stay native, since they scroll About; the globe keeps its keys.
  - **Wheel** over `wheelArea` (opt-in): see Navigation.
- **Chevron visibility** (the box and hover look are `edgeControl`'s). Opacity 0 at rest; .42
  while the pointer is over the intro copy, the panel or a chevron (`:has(:hover)`); .95 with its
  label on hover or focus-visible. Under `@media (hover: none)` it
  rests at .3 so touch readers can find it. Left in the 24px gutter, right just past the column,
  centred on the open panel via `translate` set from its rect. Label: uppercase mono 12px.

Page glue (DOM move, hash, dismiss, Esc, motion): `src/lib/home-carousel.ts`.

## Navigation

- **Wheel on the intro.** Dominant axis (`deltaY` unless `|deltaX|` is larger), × 16 for
  `deltaMode` 1; 40px down opens About. Then input is locked and every wheel event is
  `preventDefault`ed (momentum never scrolls the new panel) until 220ms of quiet and at least
  650ms since the step. Upward on the intro passes through.
- **Wheel in About** scrolls natively. Only a fresh upward gesture at `scrollTop` 0 returns (40px,
  then the same lock). Fresh: 220ms with no wheel or `scroll` event, so momentum never flips back.
- **Wheel over the globe** zooms (slice 2); it and touch never change panel. Page wheel is untouched.
- **Light dismiss.** While About is open, a `pointerdown` with `button === 0` outside the deck
  (globe, sky, zoom stack) returns to the intro; the chevrons, header, zone drawer, its close, intro copy
  do not. One `window` capture listener that never stops the event, so a globe drag still rotates
  and a globe press still opens the drawer (slice 2).
- **Esc** with About open and the drawer closed returns to the intro; focus in the panel or on a
  chevron moves to "More". With the drawer open the carousel ignores Esc; the drawer's rule runs.
- **Hash.** A target inside About opens it (no animation on load) and scrolls it into view there;
  `#_top` opens the intro; unknown ids are ignored. Returning to the intro clears such a hash with
  `history.replaceState(history.state, "", location.pathname)`; nothing else writes the hash.
  Find: `beforematch` opens the closed panel; without `until-found` it degrades to `hidden`.

## Motion

One animation per element, keyed in `gmt-entrance-freeze.css`. Incoming panel: `ng-freeze-fly-left`,
.7 s (s4's `--mask`, `opacity`, `color` plus `translate: -1.25rem 0 → 0`); outgoing: .2 s `opacity`,
then hidden; a change mid-change cancels both. Chevrons glide by a .45 s `translate` transition.
Reduced motion: outgoing hides at once, incoming fades .2 s, chevrons jump. On load s4's table
gains the lead at .9 s; a deep link into About freezes it in at .15 s. `initHomeCarousel` runs
before `runHeroEntrance`; `scroll-reveal.ts` reveals every group at once in carousel mode.

## Tests

`carousel.test.ts`, `home-carousel.test.ts` (jsdom): `afterEach` aborts the signal, restores
`matchMedia`, `history`, the moved node; fake timers, stubbed `performance.now`, no real waits.

- Roles, labels, chevron names, the hidden chevron's `tabindex=-1`, focus handover, live text.
- Wheel: 30 events of `deltaY: 4`, 16ms apart, open About at `scrollTop` 0, all prevented;
  momentum inside 650ms stays prevented; `deltaMode` 1 and horizontal bursts count; upward with
  `scrollTop` > 0 is not prevented; upward within 220ms of a `scroll` at the top does not flip; a
  fresh one does.
- `pointerdown` on the panel, a chevron, the header, the drawer or its close keeps About; on the
  hit area or sky closes it and still reaches its target; `button` 2 does nothing; Esc with the
  drawer open leaves About open.
- Hash and `beforematch` open About; leaving restores the grid and every `hidden`; abort removes
  every listener and timer. Both variants render; `mdx-jsx.test.ts` matches each page.
  `arrival.test.ts`: `wait` only on `/` in the query; the failsafe clears it.

## `hero-space` gate (this slice's checks)

- **No page scroll** at 1440×900, 1920×1080, 1280×720. The intro's `scrollHeight ≤
  clientHeight` at 1440×900 and 1280×720; nothing scrolls sideways.
- **Wheel.** One downward burst on the intro opens About at `scrollTop` 0; a further burst
  scrolls it; an upward burst from mid-panel stops at the top without flipping; a fresh upward
  burst there returns to the intro. A wheel over the globe changes nothing in the column.
- **Dismiss.** A click inside the panel keeps it; a click on the globe closes it and opens the
  drawer; a click on empty sky closes it; Esc closes it, but with the drawer open closes the
  drawer first. **Chevrons:** computed opacity 0 with the pointer over the globe or sky, .42 over
  the copy, .95 on focus-visible; one without a target is hidden and unfocusable.
- **Fallbacks.** 1280×600, 1024×768, JavaScript off at 1440×900: no chevrons, nothing hidden, the
  page scrolls; with the module blocked it scrolls after 2.5 s.
- **Deep links.** `/#the-bug-is-the-date-object` opens About with the heading in view; a text
  fragment for an Alternatives phrase opens About.
- **Motion.** Five quick changes: ≤ 1 running animation per element; median frame ≤ 17.5 ms,
  none over 34 ms; reduced motion animates only `opacity`. axe passes in both panels and both
  themes; CLS 0.

## Definition of done

- [ ] Index gates pass, plus `hero-space` with the checks above.
- [ ] `html-diff`: `/why-gmt/` and `/compare/` change only by the added full tables.
- [ ] Every fact and link removed from the home is on its section's guide (listed in the report).
- [ ] Manual check at 1440×900: Ctrl-F for an Alternatives phrase opens About.
- [ ] `built.md` Tier 1 describes carousel mode, the condensed home and the variants; Tier 3
      lists the `carousel` builder; "Corners" and `design-system.md`'s bevel rule (line 493) allow
      the clip-path octagon for the panel, tiles, rows and diamonds only, outlines on a plain radius.
