# CORE-112 slice 2 — single-date repair: `format` and `formatToParts`

Read with [index.md](./index.md) and [guard.md](./guard.md). Code in `weekYearGuard.ts` (the
guarded formatter, text repair) and `weekYearSynth.ts` (parts synthesis, kept apart so its size is
measured on its own). Prototype: `<scratchpad>/woy/repair.mjs` (`analyse`, `repairText`,
`synthParts`).

## The analysis (once per verdict, stored with it)

Built from `format` calls only, on the formatter itself (its zone, its time fields):

- `J`, the year run indexes, as in guard step 4, at `m0` = month 1 day 15 of `y0`, 10:20:30.456
  in `ro.timeZone`.
- `count`, the digit-run count at `m0`.
- `style[n]` per year run, read at mid-year (month 6 day 1) against the reference year `em`:
  - run text `=== em` → `full`;
  - two code points equal to `em`'s last two → `two`;
  - longer than `em` and starts with / ends with `em` → `full`, glued at the end / start, with the
    other number's length;
  - otherwise (the run is wrong all year: buddhist, japanese, roc) → `two` if two code points,
    else `full`.
- `labels[j]` for every other run, by moving one field at a time from `m0` (+1 day, month, hour,
  minute, second, millisecond): the one field that changes it; none → `literal`; several →
  `text` (digits inside a name, haw "P3").

## Year text — the ECMA-402 value

`yearText(ms, style)`: the reference formatter (guard step 2, but in `ro.timeZone`) at `ms`, its
single digit run `c`:

- `full` → `c` (ECMA-402 FormatDateTimePattern `numeric`: `useGrouping: false`, no minimum
  digits; so roc 115 is `115`, never `0115`);
- `two` → the last two code points of `c`; a one-digit `c` gets the numbering system's zero in
  front (`2-digit`: `minimumIntegerDigits: 2`, then the last two characters).

The reference is the right source, not Temporal: it is the same ICU calendar that prints the month
and day beside the year, so the three fields can never come from different calendar arithmetic.
Tests derive their expected years independently from Temporal `eraYear ?? year` ([tests.md](./tests.md)).

## `format(ms)` on a guarded formatter

1. `text = native.format(ms)`; `runs = digitRuns(text)`.
2. `runs.length !== count` → return `text` unchanged. Not seen in the validation; the data canary
   (slice 5) fails on any such date, so a CLDR change that causes one is caught, not shipped.
3. For each year run in order, replace its span (narrowed by the glue length) with `yearText`.
   Keep the year spans' new offsets for synthesis.

Expected (Node 26.12.1, native → GMT): gd `{ year: "numeric", month: "short" }` 2024-12-30
`Dùbh 2025` → `Dùbh 2024`; de-CH `{ era: "short", year, month, day: "numeric", weekday: "short" }`
2024-12-30 `Mo., 12.30.2025 n. Chr.` → `Mo., 12.30.2024 n. Chr.` (month and day stay swapped:
CLDR's choice, not GMT's).

## `formatToParts(ms)` on a guarded formatter

Two paths. Owner question 3 picks whether path A exists.

**A — native parts, year patched.** Taken only when the crash signal is off *and* the options are
component-based (no `dateStyle`). Then the pattern has no `Y` on an unfixed V8, or the engine is
fixed. Call native `formatToParts`, map each year run to the part covering it (walk part offsets
against the native text), set that part's `type` to `"year"` (WebKit types it `unknown`) and its
value to `yearText`. A part that covers more than the run (glue) has the run's slice replaced.

**B — synthesis** (`weekYearSynth.ts`), every other flagged formatter:

```ts
export function synthesizeParts(
  formatter: Intl.DateTimeFormat,
  analysis: WeekYearAnalysis,
  ms: number,
): Intl.DateTimeFormatPart[] | null;
```

1. **Twins** (built through `cachedFormatter`, cached per guarded formatter): year-free formatters
   in the same locale, calendar, numbering system and zone whose parts name the text fields:
   - `{ weekday }` and `{ weekday, month: "long", day: "numeric" }` per weekday width used
     (both `long` and `short` under `dateStyle`);
   - `{ month }` and `{ month, day: "numeric" }` per text month width used;
   - `{ era, month: "numeric", day: "numeric" }` per era width used (all three under `dateStyle`);
   - `{ month: "numeric", day: "numeric" }`, `{ month: "2-digit", day: "2-digit" }`;
   - the time fields with `hourCycle` from `ro` (a `timeStyle` becomes `hour`, `minute`, and
     `timeZoneName` `short` for `long`, `long` for `full`).
   A twin that prints a year is skipped. Twins pass guard step 0 as year-free; the crash canary
   runs every twin shape in child processes (slice 5).
2. **Candidates at `ms`**: every non-literal, non-blank twin part except numeric fields
   (`day`, `month` from numeric twins are kept as numeric candidates), longest value first.
3. **Spans**: the repaired text cut at the numeric runs (`J` runs take their new spans; other
   runs typed by `labels`, widened to a numeric candidate that contains them, e.g. `09`).
4. **Template** (once per formatter): for five dates in `y0` (01-15 10:20, 01-15 22:20,
   03-09 22:20, 05-20 03:20, 08-03 15:20), segment each text span greedily by candidates.
   `fits`: a candidate of 1–2 characters may not start or end inside a run of letters. **GMT rule
   (tie-break):** if two field types claim the same longest text at one position, that date's
   template is rejected and the next date is tried; the first unambiguous date wins. Reason: a
   type chosen on a tie would be a guess; a later date where the names differ decides it from data.
5. **Parts at `ms`**: walk each span by the template's field list, taking for each field the
   earliest fitting candidate value of that field's keys; text between fields is `literal`; then
   the span's numeric part. Adjacent literals merge.
6. Any step without an answer → `null`.

`null` makes the public `…ToParts` function return its sentinel `[]` (the parts cannot be known
without risking the abort). The data canary runs synthesis over every flagged formatter of the
population and fails on any `null` or any mismatch with the WebKit oracle, so none ships.

## Measured

- Synthesis on all 105 flagged formatters × 24 dates vs WebKit 26.6 `formatToParts` (with
  `unknown` → `year` and the ECMA-402 year value): 2,520/2,520 identical; vs Chromium 158 where its
  trimmed locale data matches: 312/312.
- Synthesis forced on 7,014 unflagged points: 6,976 identical. The 38 misses are tie cases on
  formatters that never take path B (ko `12월`, kgp `12-Kysã`); they bound how general the
  segmentation is, not a shipped result.

## Edge cases (values in [tests.md](./tests.md))

- Year-end and year-start dates on both sides, and a mid-year control that is unchanged.
- `2-digit` (ksh `{ year: "2-digit", month: "2-digit" }` → `24-12`).
- Non-Latin digits (my: `၂၀၂၆` → `၂၅၆၉`; japanese era year 8 as `၈`, 2-digit `၀၈`).
- `dateStyle: "full"` (gl-u-ca-hebrew, Tishri dates; gl-u-ca-roc `115`).
- A time field next to the date (the twin path): gd `{ year, month: "short", hour, minute }`.
- Part types: the year part is `"year"`, never `"unknown"` or `"relatedYear"`.
- Parts concatenate to the repaired `format` text exactly.
