---
story: DOX-G2
issue: 447
status: approved
dox: none
---

# DOX-G2 · One entrance from northguild.dev to /gmt

Make the step from `northguild.dev` to `northguild.dev/gmt/` read as one site. The Dox header
takes the NorthGuild header's mark, wordmark, height and glass. The frameless Earth sits in the
true sky of the moment; the "Find a zone" panel comes in on use; the copy freezes in like ice. On a desktop the landing never scrolls: its
condensed sections share one panel beside the Earth. The guides' row tables take the tools' look.
Site work in `apps/dox` only: no new Dox tool or chat pill, no `packages/gmt` change, no changeset.

## Phases

One PR. Each phase is a slice that `dox-builder` lands and `dox-tester` verifies before the next.

| # | Slice | What the reader sees |
| --- | --- | --- |
| 1 | [Header and mark](./s1-header.md) | The northguild.dev mark and "NorthGuild" wordmark in a 3.5rem bar with 4 px blur |
| 2 | [Frameless hero and zone drawer](./s2-hero-space.md) | Copy and a centred Earth with no box; the zone panel slides in on first use; zoomed in, the Earth fills the hero |
| 3 | [Real sky](./s3-sky.md) | The real sky behind the Earth for this moment, turning with the camera; a faint wash, a rare meteor |
| 3b | [Sun and Moon](./s3b-bodies.md) | The true Moon with its phase, and the Sun's glow when it sits behind the Earth |
| 4 | [Ice-freeze entrance](./s4-entrance.md) | The copy freezes from the first paint; from one start the sky fades in and the Earth wakes at dawn; the drawer sweeps in on each open |
| 5 | [Cross-site transition](./s5-transition.md) | northguild.dev → /gmt keeps the mark still and cross-fades the rest |
| 6 | [Guide tables](./s6-tables.md) | Content and reference tables read like the tools' tables |
| 7 | [Landing carousel](./s7-carousel.md) | On a desktop the page never scrolls; the intro and an "About gmt" panel share the column beside the Earth |

Order matters: 2 needs 1's header, 3 and 4 need 2's layers, 3b needs 3, 5 needs 1's names, 7 needs 2 and 4.
**Reference:** [`prototype/*.txt`](./prototype/) holds the verified behaviour and values; port them,
never its stand-ins (runtime class add, placement override, night disc, `header.js` swap, proxy).

## Files

Create:

- `src/assets/northguild-mark.svg`, `src/components/MobileMenu{Toggle,Footer}.astro`, `src/lib/menu-button.ts`
  + tests (1); `src/components/HeroSpace.astro`, `src/styles/gmt-space.css` (2–3)
- Kit additions, each `.ts` + `.module.css` + test: `src/widgets/builders/{drawer,edge-control,carousel}` (2, 7)
- `scripts/prepare-hero-sky.mjs` + test, `src/assets/hero-sky.{bin,json}` (output committed),
  `src/lib/{sky,sky-math,space-fx}.ts` + tests (slices 3, 3b)
- `src/styles/gmt-entrance-freeze.css`, `src/lib/{hero-entrance,arrival}.ts` + tests (slices 4–5)
- `src/lib/home-carousel.ts` + test, `src/styles/gmt-home-carousel.css` (7); `scripts/hero-space-check.mjs`
  (gate `hero-space`), `scripts/fixtures/ng-landing.html`

Modify:

- `src/components/{Header,NorthGuildMark,SiteTitle,HeroGlobe,HeroCopy,Globe,Footer,GridSection,
  SectionHeading,WhyDateBug,WhyDateAlternatives,HomeCard}.astro` (+ `HomeCard.module.css`)
- Slice 7: `src/content/docs/{index,why-gmt,compare}.mdx`, `src/data/date-faults.ts`,
  `src/lib/mdx-jsx.ts` + test, `src/styles/gmt-tokens.css` (wordmark, bevel, ice-bright, frost)
- `src/components/NorthGuildMark.test.ts`; `src/lib/{data-credits,rehype-table-scroll,scroll-reveal}.ts` + tests
- `src/styles/{gmt-shell,gmt-primitives,gmt-a11y,gmt-view-transitions,gmt-content-tables,dox}.css`
- `src/lib/globe/{engine,camera,controller,types}.ts` + tests, `globe/webgpu/*` (exposure), `src/lib/{globe,globe-mount}.ts`,
  `src/widgets/builders/{index,layout}.ts`, `src/widgets/tools/globe.module.css` (space-mode rules only)
- `src/widgets/primitives/{combobox,listbox}/*.ts` + tests (popup root class; Zone Planner gains it
  too); `scripts/{globe-smoke,data-credits-check}.mjs`, `scripts/gates/registry.mjs`
- `context/dox/built.md`, `reference/visual-design.md` § Motion, `reference/design-system.md` § Entrance,
  § `/dox` and the header, and its bevel rule (7). Delete `src/assets/northguild-logo.svg`.

## Kit pieces

The landing is Astro plus plain-DOM modules; React stays inside `/dox`. The design is our own:
nothing is copied, ported or relicensed from another NorthGuild codebase.

- **Globe:** `renderGlobeTemplate` and `createGlobe` gain opt-in options (`space`, `framing`, `hitArea`,
  `maxDpr`, `pauseWhenHidden`, `entrance`) and `onInteract`; unset, each keeps today's behaviour.
- **Zone drawer:** new kit `drawer` (APG Disclosure, detached panel) holds `.side`; new kit `edgeControl`
  (APG Button) is its close and slice 7's chevrons; `combobox` composes `listboxRootClass`; `field` gains `labelHidden`.
- **Data credits:** one more credit (`NIGHT_SKY`) on `/` only. **Tables:** content tables keep
  `rehype-table-scroll` and `.gmt-ref-table`; widget tables do not.
- **Entrance:** one sequencer (`hero-entrance.ts`) starts the sky, the freeze and the dawn. The
  hero canvas skips `enter()`; other hosts keep it. `holdEntrance()` still releases clock rows.
- **Landing carousel:** kit `carousel` (APG Carousel, previous/next, opt-in wheel stepping); glue
  in `home-carousel.ts`. **Not kit:** the sky is one page's decoration (component and stylesheet).

## Performance budget

- No new dependency (a hand-run script reads the star catalogue). Star list ≤ 24 KB, preloaded on
  `/` only, drawn before the entrance. A sky draw ≤ 2 ms median; `space-fx` ≤ 4 KB, the sky ≤ 5 KB.
- Hero globe DPR ≤ 1.5 (other hosts keep 2); it pauses off screen; spinning median ≤ 17.5 ms. The
  sky draws only when its view moves (camera or sidereal time); the meteor only while one lives.
- The entrance and panel changes are smooth (median ≤ 17.5 ms, no frame over 34 ms), with one
  running animation per element, none on the hero canvas, and no blur on text.
- CLS 0 on the landing. LCP at 390×844, throttled, is no worse than `main` + 300 ms.

## Accessibility budget

- Tab order: copy (carousel mode: open panel, then the chevrons), globe, then the zoom stack (+ − ⊙
  magnifier ⓘ) or, with the drawer open (a non-modal region), its close and the drawer.
- The sky is `aria-hidden="true"` with `pointer-events: none`. Reduced motion: no meteor, fades
  for the freeze and the drawer, full exposure at once, and no cross-site transition.
- `forced-colors: active` hides the sky. `prefers-contrast: more` and reduced transparency keep
  the stars and hide the Milky Way and the wash. The copy's letter halo meets the contrast gate; more contrast adds the void scrim.
- Touch and wheel off the Earth scroll the page; in carousel mode the column's wheel changes panel.

## Gates every slice passes

- `pnpm run validate` (includes `pnpm dox:test`, `pnpm dox:check`, lint, format, typecheck), run
  from the worktree after `eval "$(fnm env)" && fnm use`.
- `pnpm --filter @gmt/dox gates --only contrast-measure,readout-still,table-fit`.
- `a11y:axe` and `a11y:tab` on `/`, `/guides/conversion/databases/`, `/tools/zoned-earth/`, `/dox/`, both themes.
- From slice 2: `globe:smoke` (WebGPU and canvas-2D parity) and `hero-space`; from 3: `data-credits-check`.
- `html-diff` and `visual-diff` against a `main` baseline (`visual:before`) taken before slice 1.
- Test lifetimes: tests mounting the globe, drawer, `space-fx`, sequencer, carousel or an observer
  abort or `destroy()` in `afterEach`; fake timers, injected `now`/`random`, no real-time waits.

`hero-space` grows by slice. By the end it checks:

- the drawer is absent on load, opens on a drag or the magnifier, closes on its close and Esc,
  stays closed after that, is a bottom sheet at 390×844, never moves the Earth and keeps the card
  clear of it; combobox popups open downward, opaque and scrolling;
- the frameless disc is centred and clears the copy; at maximum zoom it fills the hero, readable;
- one running animation per entrance element, none on the canvas; no horizontal scroll from 320 to
  2560 px; the frame budget holds, off-screen pauses, CLS is 0;
- no `aurora` or `comet` code path; reduced motion leaves the hero static; the credit is shown; the
  cross-site arrival works against a fixture page;
- at ≥ 80rem × 40rem the page never scrolls, a heading id opens About, one wheel gesture changes
  panel once, and a press outside closes it; below that, or without JavaScript, the page scrolls.

## Decided

- Theme: northguild.dev is dark only. The header is a dark island on every page and the hero is
  dark in both themes; docs follow the theme; slice 1 owns contrast. No aurora, comet or twinkle.
- Zone drawer: off on load; opens on the first globe interaction (no focus move) or the magnifier
  (focus to search); its close and Esc close it, then only the magnifier, or a tap on a zone (focus to
  that zone's row), reopens it; not persisted.
  The location card stays clear of it, or hides if its pin is behind it.
- Earth: grows across the whole hero when zoomed, never boxed; at rest centred on the page where the
  copy allows, else just clear of it; below 80rem a 30rem sky bay under it holds the sheet. The zoom stack sits in the
  hero's corner clear of the disc, hidden and `inert` while the drawer is open. Blue by default; a "Natural Earth" switch in the globe's settings panel shows the photo's own colours.
- Hero copy: the first prototype's words and icons, all in the display font, the `h1` ≤ 2.5rem on
  two lines; first paint is final (CLS 0, no size flash) ([slice 2](./s2-hero-space.md#layout)).
- Entrance: one sequencer, one animation per element; the canvas's only entrance is the dawn; `t0`
  waits for the sky and the globe, at most 800 ms.
- Carousel: ≥ 80rem × 40rem with JavaScript; two panels, intro and About; no autoplay. The intro
  panel fits; About scrolls inside itself. The wheel steps panels only over the column; a press
  outside the panel closes it. Content is condensed at the source, at every width; full fault and
  library tables move to `/why-gmt/` and `/compare/` ([slice 7](./s7-carousel.md)).
- Header: 3.5rem, 4 px blur, mark and wordmark pixel-matched; "NorthGuild / gmt v‹version›"; the search box at the right, before the icons, 22rem ([slice 1](./s1-header.md)).
- Stars: HYG v4.4, CC BY-SA 4.0, a packed star list drawn on canvas; the true sky behind the
  Earth at the current sidereal time, turning with every camera move, spin included ([slice 3](./s3-sky.md)).
- The northguild.dev companion CSS ships as its own PR in that repo, after this deploys.

## Close-out

After slice 7, `dox-builder` brings `built.md` (Tier 3: header, mark, builders; Tiers 1 and 4: hero,
sky, entrance, carousel, tables) up to date; the finalizer moves the decisions into
`issues/DOX-G2.md` and deletes this folder, `prototype/` included.
