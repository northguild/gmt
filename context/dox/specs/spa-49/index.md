---
story: SPA-49
issue: 230
status: approved
---

# SPA-49 — Dox tools for Julian Date, MJD and J2000 seconds

Library spec: [`context/domination/specs/SPA-49/index.md`](../../../domination/specs/SPA-49/index.md)
(eight functions in `timescale/convert/`, the `TimeScale` type and `JulianDateParts`). Painpoint: a
single-double JD loses precision, a JD day starts at noon, and the scale changes the number.

Decisions (settled; each slice states its own under `## Decisions`):

- **Two standalone Core tools**, chosen by the owner. Neither extends the Satellite Clock Converter
  (a GNSS ladder of seconds) or the Terrestrial Time Stack (its table is at its width limit).
- **D1 — own loader.** `loadDayCountLib()` beside `TimescaleLib`; the three existing tools are untouched.
- **D2 — precision is measured, not computed.** A shift is a library round trip measured with
  `spanNs` on TAI labels; the site computes no ulp and holds no epoch constants.

| Slice | Tool | Route | Kind | Chat tool | Order |
| --- | --- | --- | --- | --- | --- |
| [julian-day-counter.md](julian-day-counter.md) | Julian Day Counter | `/tools/julian-day-counter/` | `jdcount` | `showJulianDayCounter` | 1 |
| [double-precision-meter.md](double-precision-meter.md) | Double Precision Meter | `/tools/double-precision-meter/` | `dblmeter` | `showDoublePrecisionMeter` | 2 |

## Before you start

- **The library comes first.** The Dox side starts after the library slices of SPA-49 are green.
  `packages/gmt/dist` must export the eight functions. **The owner's `pnpm dox:dev` reads
  `packages/gmt/dist`, and a rebuild breaks every tool he has open.** Warn him before building, and
  build once, last.
- **The reference pages are generated.** `scripts/build-reference.ts` writes the eight function
  pages, the `TimeScale` and `JulianDateParts` type pages or inline sections (decided by the usage
  graph), the corpus and the playground seeds. Write none of them by hand.
- **Re-verify the export names** in `packages/gmt/src/timescale/convert/index.ts` before wiring the
  loader. If a name differs from the library spec, stop and report it.

## Shared pieces (slice 1 adds them, slice 2 reuses them)

| File | Change |
| --- | --- |
| `apps/dox/src/lib/timescale-lib.ts` | Add `DayCountLib` and `loadDayCountLib()`. They pick `toJulianDateParts`, `fromJulianDateParts`, `toJulianDate`, `fromJulianDate`, `toModifiedJulianDate`, `fromModifiedJulianDate`, `toJ2000Seconds`, `fromJ2000Seconds`, `toTAI` (`timescale/convert`), `spanNs` (`span/calculate`), `startOfUtc`, `addUtc` (`utc/calculate`), `leapSecondsBetween` (`timescale/calculate`), `isValidInstant` (`precision/validate`) and `hasSecond60` (`plain/validate`). Picks are made with `pickFunctions` from `GMT_MODULES` module barrels. `TimescaleLib` and the three tools that use it stay unchanged. |
| `apps/dox/src/lib/day-count-widgets.ts` (+ `.test.ts`, new) | The pure helpers the two tools share. See below. Imports no gmt code: every function takes a `DayCountLib`. |
| `apps/dox/src/lib/timescale-widgets.ts` | Move `asUtc` here from `terrestrial-time-stack.ts` (it is private there today) and export it. The stack imports it back unchanged. |

`day-count-widgets.ts` exports:

- `SCALES = ["UTC", "TAI", "TT", "TCG"] as const` and `type Scale`. The tests assert that the list is
  exactly the library's `TimeScale` union (a type-level test) and that `toJulianDate(x, "TDB")`
  is `null`.
- `type Representation = "parts" | "jd" | "mjd" | "j2000"`.
- `roundTrip(lib, utc, rep, scale): string`. Writes `utc` with that representation's `to*` and
  reads it back with the matching `from*` on the same scale. Returns `""` when either call returns
  its sentinel.
- `shiftNs(lib, utc, back): bigint | null`. Returns the signed nanoseconds from `utc` to `back`.
  The lib type is `Pick<DayCountLib, "toTAI" | "spanNs" | "leapSecondsBetween">`. It is
  `spanNs(asUtc(toTAI(utc)), asUtc(toTAI(back)))` on TAI labels, which have no second 60. Past 9999
  a TAI label is `""`, so it falls back to `spanNs` on UTC labels plus `leapSecondsBetween`.
- `microsText(ns: bigint): string`. Drawing only: a signed value in µs with three decimals and an
  explicit sign (`+18.626 µs`, `−0.001 µs`, `0 µs`). Exact bigint arithmetic, never `Number(ns)/1000`.
- `numberText(n: number): string`. Prints a double with `String(n)`, the shortest text that reads
  back to the same double. **Never `toFixed` or `toPrecision`**, which show digits the double does
  not hold.

Every instant, JD, MJD, J2000 count and shift on screen comes from a library call. The site holds
no 2400000.5, 2451545, 86400 or 32.184; the tests grep both modules for these literals and assert
none is there. The only literal numbers are drawing values (pixels, sample spacing) and preset
texts, which the tests assert against the library.

## Binding rules for both tools

- **Kit pieces only.** The widgets are built from `widget`, `section`, `fieldGrid`, `field`,
  `textInput`, `hint`, `plates`, `hold`, `codeFrame`, `table`, `srOnly`, `lane`, `mark`, `tick`,
  `axis` (builders), `chips` (radio, APG Radio Group), `preset`, `range` and `grow` (primitives),
  and `callOutput` / `callLines` (`families/gnss`, already shared by the stack). Neither tool needs
  anything the kit lacks. If a builder turns out to need a new option, spec it as a kit change
  with its test, not as widget markup.
- **Cards.** Every plate, panel and result card has a full border with bevelled corners
  (`corner-shape: bevel`). An accent edge, if used, is a bottom border.
  **A left-border-only accent is never used.** Mind
  [built.md trap: a bevelled corner hides the text under it](../../built.md#tier-2--widget-platform)
  and [the "card" class-name trap](../../built.md#tier-2--widget-platform) (glass within glass).
- **Readouts hold still.** Every value that changes as the reader types, picks a chip or drags is
  rendered inside `hold` with the widest ghost for its slot, uses `font-variant-numeric:
  tabular-nums`, and does not wrap. Paired plates are pinned with `justify-content:
  space-between`. The definition of done includes a bounding-box test for this.
- **Time comes from gmt.** No `Date`, `Date.now`, `performance.now` or `Intl` stand-in.
  Neither tool has a "Now" preset; every preset is a fixed instant or number.
- **Tense.** No text names a dated change. "Before 2038" and "after 6771" are facts about numbers,
  not about calendar news. The pages say what the tool shows, in the present tense.
- **Naming.** Scales are written `UTC`, `TAI`, `TT`, `TCG`. The pages say that TDB is not offered
  because the library has no TDB. "Ephemeris Time" is not used.
- **Escape every interpolation** (`escapeAttr`). Permalink values are capped at 64 characters, and
  the default preset writes no permalink keys
  ([built.md § Tier 2](../../built.md#tier-2--widget-platform), `seedFromLocation`).
- **Industry `core`.** Frontmatter `industries: [core]`, `ToolLayout useCase="time scales"`, and
  starter `area: "core"`. The `timescale/` namespace is Core.

## Registration (each slice, for its own tool)

Follow [built.md § "A new tool is registered in lists no single test covers"](../../built.md#tier-2--widget-platform)
and [docs-site.md § Purpose-built widgets](../../../domination/docs-site.md#purpose-built-widgets).
The whole list, so that none is missed:

1. `lib/dox-tools.ts`: the zod input schema, the prompt copy (`when`, `args`), the
   `ENABLED_TOOL_NAMES` entry, and the `DOX_TOOL_DOCS` entry **appended at the end, never inserted**.
2. `worker/tools.ts`: the Worker tool with a trivial `execute`.
3. `components/ask/widget-registry.ts`: a `defineWidget` entry with a dynamic `import()` of the mount.
4. `lib/widget-permalink.ts`: the `WidgetKind` and the page path.
5. `lib/chat-constants.ts`: a `CHAT_STARTERS` pill (text, widget, `area: "core"`, args). **Required:
   every new tool ships with its chat button.**
6. Lists that fail silently when missed: `MOUNTS` in `lib/widget-load-error.test.tsx`; the `heavy`
   list in `components/ask/widget-graph.test.ts` (the tool's pure module, `day-count-widgets.ts`,
   and the loader); `PAGES` in `scripts/html-diff.mjs`, `scripts/visual-snapshot.mjs` and
   `scripts/grow-measure.mjs`; `TOOLS` in `scripts/readout-still.mjs` for every drag control;
   forced-colours rules in `styles/gmt-a11y.css`; the component name in `lib/mdx-jsx.ts`'s
   dropped-components list.

## Tests own every asynchronous lifetime

The mounts start no timers, idle callbacks or observers beyond what the kit primitives own. Every
listener is delegated with the mount's `signal`. Each mount test renders through `renderWidget`
and ends with `destroy()` in a `finally` or `afterEach`. Each mount test file includes the
`destroy` and "already aborted" cases that the stack's test has. The meter's samples are computed
synchronously once per mount, so no work outlives the test. No real-time sleeps; await state
changes through Testing Library's `findBy*`.

## Definition of done (both slices)

- [ ] Both tool pages render, and the chat mounts both widgets from their starter pills.
- [ ] `pnpm --filter dox test` is green, including `widget-registry`, `chat-starters`,
      `widget-permalink`, `client-graph`, `widget-graph`, `widget-load-error`, `date-ban`
      and the axe guard.
- [ ] `pnpm --filter dox gates` is green for the two new pages. In particular, `readout-still` is
      green for the meter's year slider at 300, 768 and 1280 px, `grow-measure` is green, and the
      cell-overflow check reports no overflowing cell in either table at 300 px in Chromium and
      WebKit.
- [ ] A bounding-box test per tool (in the mount test, through the kit's measured `hold`) shows
      that no plate moves or resizes across every preset. For the meter, the same holds across
      the slider's whole range.
- [ ] `pnpm dox:docs-check` lists no gap for the eight functions. A gap is fixed in
      `packages/gmt/src` by the library pipeline, never by site copy.
- [ ] The owner's steps work: open each page at his window size, run each preset, type a JD and
      a `…T23:59:60.5Z` value, and drag the meter's slider end to end. The result must look
      right, not only pass Playwright.
- [ ] `pnpm run validate` is green, and `oxfmt --check` plus the affected lint and typecheck pass
      before any push.
- [ ] Close-out: `context/dox/built.md` § Tier 2 gains one tool entry per tool beside the
      Terrestrial Time Stack's, written in the present tense with its binding rules (the shared
      `DayCountLib` and `day-count-widgets.ts` included). Nothing is staged. No changeset (Dox only).
