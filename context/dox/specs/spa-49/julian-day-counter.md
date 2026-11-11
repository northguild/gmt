# SPA-49 slice 1 — Julian Day Counter

One instant written four ways on the scale the reader picks: a two-part JD, a single JD, an MJD
and seconds since J2000.0. Each value is spelled back to UTC. A two-day ruler shows that a JD
day turns at noon while the MJD and the calendar day turn at midnight. The rules shared with
slice 2 are in [index.md](index.md).

## Decisions

- **D3 — one scale picker** (owner). `UTC · TAI · TT · TCG` chips, starting on UTC, apply to all
  four forms; every call line names its scale. A forms × scales grid is too wide at 300 px.
- **D4 — two-part JD input** (owner). The JD field accepts `jd1 + jd2` as well as one number.
- **D5 — default preset is J2000.0 on TT** (owner): `2451545` read as a JD on TT, which shows
  11:58:55.816 UTC.
- **D6 — the ruler's ends are exact.** Both come from `fromJulianDateParts`; no double is rounded.
  Lanes: JD day (noon), MJD day on the scale (midnight), UTC day when the scale is not UTC.
- **D10 — accepted deviations.** When only one single-double form is `null`, its row reads "no
  result" with the `EDGE_NOTE`, not NO SIGNAL. The ruler is clamped to the library's domain, and a
  mark that cannot be written as an instant is dropped.

## Tasks beyond the tool

- Move `asUtc` from `terrestrial-time-stack.ts` to `timescale-widgets.ts` and export it; it is
  private today and both tools need it ([index § Shared pieces](index.md#shared-pieces-slice-1-adds-them-slice-2-reuses-them)).
- In `context/dox/built.md`, write the tool entries under § Tier 2 beside the Terrestrial Time
  Stack's. § Widget tools (Tier 6) is the chat's section, not the place for tool entries.

## Files

| File | Change |
| --- | --- |
| `apps/dox/src/lib/timescale-lib.ts`, `timescale-widgets.ts`, `day-count-widgets.ts` (+ test) | Shared pieces ([index](index.md#shared-pieces-slice-1-adds-them-slice-2-reuses-them)) |
| `apps/dox/src/lib/julian-day-counter.ts` (+ `.test.ts`) | Pure logic: state, presets, permalink, `readCounter`, ruler geometry, sentences |
| `apps/dox/src/lib/julian-day-counter-mount.ts` (+ `.test.tsx`) | `renderJulianDayCounterTemplate(idPrefix, args)` and `mount` |
| `apps/dox/src/components/JulianDayCounter.astro` | Astro shell, after `TerrestrialTimeStack.astro` |
| `apps/dox/src/widgets/tools/julian-day-counter.module.css` | Tool styles (CSS Module) |
| `apps/dox/src/content/docs/tools/julian-day-counter.mdx` | Tool page in `ToolLayout` |
| Registration files | [index § Registration](index.md#registration-each-slice-for-its-own-tool) |

## Controls

- **Value** (`textInput` in a `field` with a `hint`), up to 64 characters.
- **Read as** (`chips`, radio): `Instant` · `JD` · `MJD` · `J2000 s`.
  - `Instant` is any instant that `parseUtcReading` reads, including a listed `…T23:59:60[.f]Z`.
  - `JD` accepts one number (read with `fromJulianDate`) or two numbers joined by `+`
    (`2461041 + 0.5`, read with `fromJulianDateParts`).
  - `MJD` reads with `fromModifiedJulianDate`, and `J2000 s` with `fromJ2000Seconds`.
  - The site parses typed numbers with `Number()` on a trimmed token that matches a plain decimal
    pattern. Anything else is "not a number" and gets a sentence, never a guess.
- **Scale** (`chips`, radio): `UTC` · `TAI` · `TT` · `TCG`. One scale applies to every
  representation, and every call line names it explicitly. The J2000 plate's note says that
  `toJ2000Seconds` defaults to TT, and that the other three default to UTC.
- **Presets** (`preset`). Each preset's values are asserted against the library in the test:

| Id | Value | Read as | Scale | What it teaches |
| --- | --- | --- | --- | --- |
| `j2000` (default) | `2451545` | JD | TT | J2000.0 is noon TT, which is 11:58:55.816 UTC |
| `midnight` | `2000-01-01T00:00:00Z` | Instant | UTC | Midnight is JD `.5` and a whole MJD (51544) |
| `lost` | `2026-01-01T12:00:00.00002Z` | Instant | UTC | The single JD drops 20 µs; the two parts keep them |
| `leap` | `2016-12-31T23:59:60.5Z` | Instant | UTC | Quasi-JD: the inserted second is still inside one day |
| `tt-vs-utc` | `2026-01-01T12:00:00Z` | Instant | TT | The same instant gives a different JD on TT |
| `last` | `9999-12-31T12:00:00Z` | Instant | UTC | The domain ends in 9999 |

`custom` is selected when the state matches no preset. The default preset writes no permalink
keys. Otherwise the keys are `value`, `read` and `scale`.

## Reading (`readCounter(lib, state)`, pure)

1. Find the UTC instant `utc`. For `Instant`, it is the typed value, accepted only when
   `toJulianDateParts(value, scale)` is not `null`. For the other modes, it is the matching
   `from*(number, scale)`, which must not be `""`.
2. From `utc`: `parts = toJulianDateParts(utc, scale)`, `jd = toJulianDate`, `mjd =
   toModifiedJulianDate`, `j2000 = toJ2000Seconds`, each on `scale`.
3. Spell each back with `roundTrip`, and measure each shift with `shiftNs(lib, utc, back)`.
4. If any call returns its sentinel, the plates show `NO SIGNAL` and one sentence says why. The
   sentences are, in this order of checks:
   - "not an instant": `isValidInstant` is false, unless the value only lacks its offset, which
     `lacksOffset` names;
   - "second 60 on a day with no inserted second": `hasSecond60` is true and `toJulianDateParts`
     is `null`;
   - "before 1972 or after 9999: the library counts days only from 1972-01-01 to the end of 9999";
   - "not a number";
   - "outside the range".
   An empty value is not an error; it shows the empty state.

## Layout (top to bottom)

1. **Plates** (`plates`, hero, each in `hold`). Each plate shows its value with `numberText`, its
   call line (`callOutput`), and "back to UTC: …" from `roundTrip`.
   - `Two-part JD`: `jd1 + jd2`, with "shift 0 ns" when `shiftNs` is `0n`.
   - `Single JD`: the double, with its shift from `microsText`. When the shift is non-zero the
     plate reads "this double is N µs from the instant" (N from the library).
   - `MJD` and `J2000 seconds`: the same layout, each with its own shift.
   The ghost for each slot is its widest text, measured across all presets at 9999 on TCG
   (`9999-12-31T23:59:59.999999999Z`, `+20.117 µs`, the longest `numberText`). Pin the plates in
   pairs with `justify-content: space-between`.
2. **Noon seam** (`section` "Where each day begins"). A drawn image built from `lane`, `mark`,
   `tick` and `axis`, plus an `srOnly` sentence that carries every fact the image shows.
   - **Window:** two days on the chosen scale, from `fromJulianDateParts({ jd1: J − 1, jd2: 0.5 },
     scale)` to `fromJulianDateParts({ jd1: J + 1, jd2: 0.5 }, scale)`, where `J` is
     `parts.jd1`. That is midnight to midnight, and it always holds the instant. All the ends are
     exact; no `Math.floor` is applied to a double.
   - **Lane 1, "JD day":** the boundaries at `{ jd1: J, jd2: 0 }` and `{ jd1: J + 1, jd2: 0 }` (noon).
   - **Lane 2, "MJD and calendar day on SCALE":** the scale's midnights, which are the window's
     ends and `{ jd1: J, jd2: 0.5 }`.
   - **Lane 3, "UTC calendar day":** drawn only when the scale is not UTC. Its marks are
     `startOfUtc(windowStartUtc, "day")` plus `addUtc` of one and two days. They show the scale's
     day starting about a minute before UTC midnight.
   - **Cursor:** the instant.
   - **Positions:** a mark's position is `shiftNs` from the window start, divided by the window's
     own `shiftNs`. This is drawing arithmetic on two library spans, so a day that holds an inserted
     second is drawn one second longer.
   - **Leap-second note:** when `leapSecondsBetween(start, end) > 0`, the note reads: "This window
     holds an inserted second. On UTC that day still counts as one JD day (a quasi-JD), so its
     fraction runs slightly slower."
   - **Fixed geometry:** the lanes use fixed pixel heights and a fixed axis of
     `00h · 12h · 00h · 12h · 00h` scale ticks. Changing the preset moves only the marks, never
     the lanes.
3. **Table** (`table`, inside `grow`): one row per representation. The columns are call, value,
   back to UTC and shift. At 300 px it stacks under a `@container` query that is **named**
   ([built.md trap: unnamed `@container` in the field grid](../../built.md#tier-2--widget-platform)),
   with explicit ARIA table roles. Its columns are held by their widest sample, as the
   stack's table is ([built.md § Terrestrial Time Stack](../../built.md#tier-2--widget-platform)).

## Styles

- Plates, the seam panel and the table panel each have a full border with bevelled corners.
  The JD-day lane's accent is a bottom border on the lane.
  **A left-border-only accent is never used.**
- The marks are told apart by shape and label, not by colour alone: a noon mark is a filled
  triangle, a midnight mark a bar, and the cursor a line with a cap.
- In `gmt-a11y.css`, add forced-colours rules for the marks, the lanes and the cursor (the stack's
  block is the model).

## Page copy (`julian-day-counter.mdx`)

- **`keypoint`:** a JD day begins at noon and an MJD day at midnight. A single double holds a JD
  only to about 40 µs.
- **`intro`:**
  - What the four forms are.
  - The scale picks which clock the days are counted on, and J2000.0 is noon on TT.
  - On UTC the count is a quasi-JD: each UTC day counts as one day, however many seconds it holds.
  - The library counts from 1972 to 9999. TDB is not offered.
- **`after`:** one paragraph per function, each linking its generated reference page
  (`/reference/timescale/convert/<fn>/`). The wording comes from the library's JSDoc; it does
  not restate any number that the JSDoc owns.
- **Prose test:** `julian-day-counter-prose.test.ts`, like `terrestrial-time-stack-prose.test.ts`.
  It checks every number in the page against the library, and it checks that the page has no
  `toFixed` claims and none of the banned literals.

## Chat

- **Schema:** `showJulianDayCounterInput = { value?: string (≤64), read?: "instant" | "jd" |
  "mjd" | "j2000", scale?: "UTC" | "TAI" | "TT" | "TCG" }`.
- **`args` copy:** "value: exactly as the reader gave it, never corrected. read and scale only
  when the reader named them; never guess a scale."
- **`when`:** "the reader asks for a Julian Date, Modified Julian Date or seconds since J2000 for a
  time, which scale a JD is on, why a JD day starts at noon, or to convert a JD or MJD back to
  UTC".
- **Starter:** "What is the Julian Date of 2026-01-01T12:00:00Z on TT, and why isn't it a whole
  number?", `area: "core"`, args `{ value: "2026-01-01T12:00:00Z", read: "instant", scale: "TT" }`.

## Tests

- **`julian-day-counter.test.ts`**, against the real library loaded by module path, as the stack's
  tests are:
  - Every preset's plates match the library's expected values in the library slices
    (`julian-date-parts.md`, `julian-date.md`, `modified-julian-date.md`, `j2000-seconds.md`).
  - Each read mode round-trips.
  - `2461041 + 0.5` reads through `fromJulianDateParts`.
  - Every sentence fires on its case, and an empty value gives the empty state.
  - The window always contains the cursor for every preset on every scale, the TCG case near 9999
    included.
  - The permalink drops the default keys.
- **`day-count-widgets.test.ts`:**
  - `microsText` signs and rounding on bigint edge values.
  - `numberText` reads back to the same double.
  - `shiftNs` falls back to `spanNs` plus `leapSecondsBetween` past 9999 on TAI.
  - The banned-literal grep.
- **`julian-day-counter-mount.test.tsx`:**
  - Chips use the APG radio keyboard model.
  - A preset updates the plates and the ruler.
  - The bounding-box test from the index.
  - axe passes.
  - `destroy` leaves no listener, and an already-aborted signal mounts nothing.
- **Registration tests** from the index, step 6.

## Definition of done

The [index DoD](index.md#definition-of-done-both-slices), plus: every preset, on every scale,
shows no `NO SIGNAL` except the cases designed to show it, and the leap preset shows the
quasi-JD note.
