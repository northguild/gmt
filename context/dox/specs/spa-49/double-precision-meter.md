# SPA-49 slice 2 — Double Precision Meter

This tool shows how far a single number drifts from the instant it encodes. It measures that drift
for a single JD, an MJD, and seconds since J2000, and sets each against the two-part JD, which
stays exact. The reader drags a year from 1972 to 9999. Lanes plot the measured drift across the
whole range, and plates give the drift at the reader's own instant. Every drift comes from a
library round trip; none is computed from IEEE 754 formulas on the site. This slice needs
[slice 1](julian-day-counter.md)'s shared pieces and follows the rules in [index.md](index.md).

## Decisions

- **D7 — measured sampling.** 1972, every 50th year from 2000, 9999, and the two years either side
  of JD 2²²; the worst of 4 fixed probes per year; computed synchronously and cached per scale;
  call count capped by a test. The two-part JD is the zero baseline.
- **D8 — a date that does not exist is NO SIGNAL** (owner). 29 February in a common year shows the
  pill and a sentence; the slider is never clamped and the date never moved.
- **D9 — same scale picker as slice 1**, starting on UTC; the lanes use a log axis from 1 ns to 100 µs.

## Files

| File | Change |
| --- | --- |
| `apps/dox/src/lib/double-precision-meter.ts` (+ `.test.ts`) | Pure logic: state, presets, permalink, samples, `readMeter`, lane geometry, sentences |
| `apps/dox/src/lib/double-precision-meter-mount.ts` (+ `.test.tsx`) | `renderDoublePrecisionMeterTemplate(idPrefix, args)` and `mount` |
| `apps/dox/src/components/DoublePrecisionMeter.astro` | Astro shell |
| `apps/dox/src/widgets/tools/double-precision-meter.module.css` | Tool styles |
| `apps/dox/src/content/docs/tools/double-precision-meter.mdx` | Tool page in `ToolLayout` |
| Registration files | [index § Registration](index.md#registration-each-slice-for-its-own-tool), plus a `readout-still.mjs` `TOOLS` entry for `year-slider` |

## Controls

- **Instant** (`textInput`, 64 chars max). The default is `2026-06-15T13:47:12.345678912Z`.
- **Year** (`range`, whole years from 1972 to 9999). Dragging rewrites only the year of the
  instant, through `yearAt(instant, year)`. This is a label edit, like the stack's `yearInstant`.
  If the library refuses the result (29 February in a common year, or second 60 on a day with no
  inserted second), the plates show `NO SIGNAL` with the sentence "this date does not exist in
  YEAR". The slider is never clamped and the date is never moved.
  - The lower bound is `INTEGER_UTC_FROM`'s year (`timescale-widgets.ts`). The upper bound is 9999,
    the same constants the stack uses.
- **Scale** (`chips`, radio, `UTC · TAI · TT · TCG`). The default is UTC, and one scale applies to
  every representation, as in slice 1.
- **Presets**, asserted against the library:

| Id | Instant | Scale | What it teaches |
| --- | --- | --- | --- |
| `mid-2026` (default) | `2026-06-15T13:47:12.345678912Z` | UTC | Single JD off by µs; MJD and J2000 s far closer |
| `lost` | `2026-01-01T12:00:00.00002Z` | UTC | The 20 µs case from the library spec |
| `past-6771` | `7000-06-15T13:47:12.345678912Z` | UTC | Past the JD's power-of-two step, the bound doubles |
| `j2000` | `2000-01-01T11:58:55.816Z` | TT | J2000 s is exactly 0, so no drift at all |
| `far` | `9999-06-15T13:47:12.345678912Z` | TT | J2000 s has grown large and drifts too |

The default writes no permalink keys. Otherwise the keys are `value` and `scale`.

## The measured lanes (`meterSamples(lib, scale)`, pure, computed once per scale)

- **Sample years:** 1972, every 50th year from 2000 to 9950, and 9999. Two more years come from a
  bisection over whole years using `toJulianDate(yearAt(PROBES[0], y), scale)`: the last year whose
  JD is below `2 ** 22` and the first year at or above it. `2 ** 22` is a power of two, not a date.
  The page explains it as "the JD reaches 2²² days, so the spacing between doubles doubles", and the
  test asserts the step year against the library.
- **Probe set:** `PROBES` holds four fixed times of day, each with nine fractional digits, chosen
  so no probe is a short binary fraction of a day. The test asserts that no probe gives a zero
  shift for the single JD at 2026.
- **Per sample year and representation:** the value is the largest `|shiftNs|` over the probes,
  where each shift is `shiftNs(lib, utc, roundTrip(lib, utc, rep, scale))`. These are measured
  values, not a bound, and the page says so.
- **Budget:** about 165 years × 4 probes × 3 lossy representations ≈ 2,000 round trips. That is
  under 8,000 library calls per scale, and a test that counts calls through a wrapper library
  asserts it.
- **Caching:** the result is cached per scale for the life of the mount, so changing the scale
  computes once more, at most four times in all. The work is synchronous, with no idle callbacks
  and no timers.
- **Two-part JD** is drawn as a baseline at 0 ns. The test asserts that every sample's shift is
  `0n`, not just the drawn ones.

## Layout (top to bottom)

1. **Plates** (`plates`, hero, each in `hold`): `Single JD`, `MJD`, `J2000 seconds` and
   `Two-part JD`.
   - Each plate shows the signed drift at the reader's instant (`microsText`), its value
     (`numberText`), and its call line.
   - The ghost is the widest drift text (`−40.233 µs`) and the widest value.
   - Plates are pinned in pairs with `justify-content: space-between`, values use tabular figures,
     and nothing wraps.
   - A `NO SIGNAL` pill sits in its own reserved slot under the plates. It is always laid out and
     only toggled visible, as the Satellite Clock Converter does, so it never covers a value.
2. **Lanes** (`section` "Drift across the years"): one SVG plot in the stack's drift-lane style
   (`laneGeometry` in `families/timescale/scale-stack.ts` is the model; reuse it if its input fits,
   otherwise add a sibling `driftLanes` drawing in `families/timescale/` with its own test).
   - **Axes:** x runs over the years 1972–9999. y is logarithmic, from 1 ns to 100 µs, with fixed
     ticks `1 ns · 1 µs · 10 µs · 100 µs`. A 0 drift sits on a labelled floor band, "exact".
   - **Series:** each representation is a step polyline with its own dash pattern and an end label,
     so no series is told apart by colour alone.
   - **Cursor:** marks the reader's year.
   - **Fixed geometry:** the scale is fixed once, so the plot never rescales while the reader drags
     (the stack's `stackReach` rule).
   - **Accessible name:** the plot is `role="img"`, and its name is the summary sentence. A
     `table` in a `disclosure` ("Show the samples") carries every sample in words.
3. **Note** (`hint`): "Measured: the worst of four fixed times of day in each sampled year. A
   value you type can drift less, never more than the bound in the function's documentation."
   The note links to `/reference/timescale/convert/toJulianDate/`.

## Styles

- Every panel has a full border with bevelled corners. An accent, if used, is a bottom border.
  **A left-border-only accent is never used.**
- The series dash patterns and the floor band get forced-colours rules in `gmt-a11y.css`, using
  the stack's drift lane as the model.
- The slider uses the kit `range` with no tool override of its thumb.

## Page copy (`double-precision-meter.mdx`)

- **`keypoint`:** a JavaScript number holds about 15–16 significant digits. A JD spends seven of
  them on whole days, so a single JD is off by up to about 20 µs, and by up to 40 µs after 6771.
  The two-part JD keeps the day and the fraction apart and is exact.
- **`intro`:**
  - The four forms, and why MJD and J2000 seconds keep more digits near the present.
  - J2000 seconds lose precision as they grow away from 2000.
  - The lanes are measured round trips, not formulas.
- **`after`:** one paragraph each for `toJulianDate`/`fromJulianDate`, `toModifiedJulianDate`,
  `toJ2000Seconds`/`fromJ2000Seconds` and `toJulianDateParts`, each linking its generated
  reference page. The numbers come from the library's JSDoc and the measured samples, never
  written by hand.
- **Prose test:** `double-precision-meter-prose.test.ts` checks every number in the page against
  `meterSamples` or the library.

## Chat

- **Schema:** `showDoublePrecisionMeterInput = { value?: string (≤64), scale?: "UTC" | "TAI" |
  "TT" | "TCG" }`.
- **`args` copy:** "value: exactly as the reader gave it. scale only when the reader named one."
- **`when`:** "the reader asks how precise a Julian Date stored in one number is, why a JD loses
  microseconds, whether to store JD, MJD or seconds since J2000, or why two-part JDs exist".
- **Starter:** "How many microseconds does a single-number Julian Date lose for
  2026-06-15T13:47:12.345678912Z, compared with MJD and seconds since J2000?", `area: "core"`,
  args `{ value: "2026-06-15T13:47:12.345678912Z" }`.

## Tests

- **`double-precision-meter.test.ts`** (real library):
  - Every preset's drift matches `shiftNs` of its round trip.
  - `lost` shows a single-JD drift of `−20.000 µs` and a two-part drift of `0 µs`.
  - `j2000` on TT shows J2000 s = 0 and a drift of 0.
  - The step year is asserted around 6771.
  - The two-part JD is zero everywhere.
  - The call-count budget holds.
  - `yearAt` on 29 February in a common year gives `NO SIGNAL` with its sentence.
  - The permalink drops the default keys.
- **`double-precision-meter-mount.test.tsx`:**
  - Slider keyboard (Home, End, PageUp) moves the cursor and the plates.
  - Chips change the scale and recompute the lanes once (counted).
  - The bounding-box test: every plate's `getBoundingClientRect()` stays the same through every
    preset and slider stop, through the kit's measured `hold`.
  - axe passes.
  - `destroy` leaves no listener, and an already-aborted signal mounts nothing.

## Definition of done

The [index DoD](index.md#definition-of-done-both-slices), plus:

- `readout-still` is green for `year-slider` (keyboard and pointer).
- The page's drift numbers agree with the library's `toJulianDate` JSDoc bound: no measured
  sample exceeds it.
- Cold mount on the owner's machine draws the lanes without a visible stall. If it stalls,
  report it rather than cut the sampling silently.
