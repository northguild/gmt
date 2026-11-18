# Slice 3 · Presenter view

[Index](./index.md) · Binding rules: [Tier 0–1 · Site](../../built/tier-0-1-site.md),
[Tier 2 · Platform](../../built/tier-2-platform.md),
[visual-design.md § Layout stability](../../reference/visual-design.md#layout-stability).

## Goal

A second window for the laptop screen while the deck runs on the projector: the current slide and
build, the next slide's title, the speaker notes, the time since the start against the plan, a
pace readout, the local time, whether each network demo is playing live or recorded, and a
pre-talk check that everything the deck needs has loaded.
Either window takes the clicker; the deck window owns the state.

## Route

`src/pages/slides/give-me-temporal/presenter.astro`: a StarlightPage built like the deck page,
`pagefind: false`, `<meta name="robots" content="noindex">`, dropped by the sitemap filter added
in slice 1. It renders the same deck content (`Deck0.astro`) in presenter layout: slides are not
staged, no globe or sky mounts, notes are shown. `T` on the deck opens it with
`window.open(withBase("/slides/give-me-temporal/presenter/"), "gmt-presenter")`; it can also be
opened by URL on its own.

## Sync: `src/lib/slides/sync.ts`

- One `BroadcastChannel` named `gmt-slides:<slug>`. Messages are a closed union:
  `{ type: "state", slide, build, blanked, demo }` from the deck, where `demo` is `null` or
  `{ id, source: "pending" | "live" | "recorded" }` ([slice 4b](./s4b-live-agents.md)), `{ type: "step", action }` from the
  presenter (`action` is one of slice 1's key actions), `{ type: "hello" }` from a presenter that
  just opened, answered by a `state`.
- The deck window is the single source of truth: the presenter never changes its own state, it
  sends `step` and renders the next `state`. A presenter opened with no deck shows "Deck window not
  open" and still works as a notes reader with its own local stepping.
- The channel is closed on the mount's `signal`. Unknown messages are ignored, never thrown on.
- Free-flight keys stay on the deck window; the presenter sends steps only.

## Layout

- A two-column grid at ≥ 64rem, one column below. Left: the current slide's section rendered at
  stage proportions with its builds up to the current one, and under it the next slide's title
  and its first build. Right: notes for the current slide in Ice body type at a reading size, and
  the readout bar.
- Panels: opaque `--gmt-surface-widget`, full bevelled border (`corner-shape: bevel`), accent edge
  on the bottom only. No left-only stripe, no `backdrop-filter`.

## Readouts

Four readouts in one bar, pinned to opposite edges with `justify-content: space-between`:
- **Elapsed** `mm:ss` since the talk started. The clock starts on the first step past the title or
  on the presenter's Start button; Reset is a button with a confirm step.
- **Pace**: planned elapsed at the start of the current slide (the sum of `data-minutes` before it)
  minus actual elapsed, shown as `+1:20 ahead` or `−0:45 behind`, in Spring when ahead or within
  15 s, in Signal-lost only past 60 s behind. The words carry the meaning; colour never alone.
- **Local time** `HH:MM` in the system zone.
- **Demo**: `Live`, `Recorded` or `Waiting` while a network demo runs, blank otherwise; it
  announces when it switches to `Recorded`, so the presenter can say so aloud.

Each is the kit's `readout` element (`src/widgets/primitives/readout`) with `samples` holding
its widest forms (`"59:59"`, `"+59:59 ahead"`, `"−59:59 behind"`, `"23:59"`, `"Recorded"`), so the element's
sizer reserves the width; values use `font-variant-numeric: tabular-nums` and `white-space:
nowrap` ([layout stability](../../reference/visual-design.md#layout-stability)). Ticking seconds and
the ahead/behind switch never move the bar or the notes. Seconds are not announced: the pace
readout announces only when it crosses between ahead and behind, the demo readout only on a
switch to `Recorded`.

## Time: `src/lib/slides/pace.ts`

- Pure functions: `elapsedMs(startMs, nowMs)`, `plannedMsAt(slides, index)`,
  `pace(plannedMs, elapsedMs)` → `{ deltaMs, side: "ahead" | "behind" | "on" }`, and
  `formatClock(ms)` → `mm:ss` with a leading minus where needed (string maths, no `Intl`).
- The clock source is gmt, imported dynamically after first paint: `getUnixNow` from
  `@northguild/gmt/unix/get` for elapsed, `getZonedNow` and `getSystemTimeZone` from
  `@northguild/gmt/zoned/get` for local time, and `formatZonedDateTime` from
  `@northguild/gmt/zoned/format` with `{ hour: "2-digit", minute: "2-digit" }` and the deck's
  locale. Never `Date.now`, `performance.now` or `Intl` directly.
- The tick is one `setTimeout` chained to the next whole second of `getUnixNow()`, cleared on the
  mount's `signal`. It stops while the page is hidden and resyncs on `visibilitychange`.

## Readiness check: `src/lib/slides/readiness.ts`

A checklist in the presenter, run on open and by a "Check again" button:
- every preloaded URL on the deck page (`<link rel="preload">` list read from the deck's own
  page, fetched once with `cache: "force-cache"`), the fonts (`document.fonts.check`), and the gmt
  modules the deck imports (the dynamic imports resolve);
- the deck's renderer as the deck reports it over the channel: WebGPU, canvas-2D, or sky only;
- the deck window's reduced-motion and fullscreen state;
- Dox chat: `GET /gmt/api/brains` answers, `unlimited: true` (the venue laptop holds the
  `dox_dev` cookie, so the visitor cap cannot stop the demos), and at least one brain has
  allowance left. A failure here says the demos will play their recordings; it never blocks;
- every recording file and the wall images, fetched like the preloads.
Each line is a row with a full bevelled border and text that says the result ("Loaded", "Failed:
retry on venue Wi-Fi"); a failure is never shown by colour alone. Run on the laptop before the
talk, this warms the HTTP cache so the deck survives a dropped Wi-Fi.

## Clicker keys

The presenter window installs slice 1's `keys.ts` with a sender that posts `step` messages, so a
clicker paired to the laptop works whichever window has focus. F5 and Shift+F5 are prevented here
too; the help dialog lists the same table.

## Tests

- `pace.test.ts`: pure; planned minutes from a 3-slide fixture; ahead, behind, on, the 15 s and
  60 s thresholds; `formatClock` at 0, 59 s, 9:59, 59:59 and negatives.
- `sync.test.ts`: two `BroadcastChannel` instances in one jsdom file; each test owns an
  `AbortController`, aborts it in `afterEach` and asserts both channels are closed; `hello` gets a
  `state`; unknown messages are ignored; the presenter never mutates state on its own.
- `presenter.test.ts`: render through `src/test/render-widget.ts` with `expectNoAxeViolations`;
  gmt modules are replaced by a fake clock (`vi.mock`, so the `isolated` project), timers are
  fake (`vi.useFakeTimers`) and advanced with `vi.advanceTimersByTimeAsync`, never real sleeps;
  `destroy()` and `abort()` run in `afterEach`, and a test asserts no timer is left
  (`vi.getTimerCount() === 0`) after destroy.
- `readiness.test.ts`: `fetch` stubbed per test with `vi.stubGlobal` and restored with
  `vi.unstubAllGlobals()` in `afterEach`; a failed URL gives a failure row with words; a brains
  payload without `unlimited` gives the "will play recordings" row.
- `slides-check.mjs` gains the presenter route: it sets each readout element's `value` through
  every sample and a range of real values (`00:00`, `09:59`, `59:59`, ahead, on, behind) and
  asserts the four readout boxes and the notes column keep their bounding boxes within 0.5 px.
  It never patches the clock.

## Definition of done

- With the deck on one screen and the presenter on the other, a clicker steps both from either
  window; the presenter shows notes, next slide, elapsed, pace, local time and Live or Recorded.
- The readout bar never shifts while the clock runs or pace flips side (the gate's box test).
- The readiness check passes on a warm load and names each failure when offline before load.
- Own tests, `pnpm dox:lint` and `pnpm dox:check` green; the owner's listening pass.
