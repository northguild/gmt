# Spec: "Correct at the edges" (CORE-6 plan items G and H.2)

Execution spec for `dox-builder`, verified by `dox-tester`. The README brief at the end goes to
`finalizer`. This is not `packages/gmt` work: nothing here edits library source or tests. The
library gaps found while writing it are listed under **Blocked on the library pipeline**.

**Build only after the library slices F1, F2, G1 and G2 finish.** G2 renames test titles in 26+
files, so every test name quoted below must be re-read from the file at build time. If a name
has changed, link the new name. If a row is gone, drop the claim. Never link a name that is not
in the file.

Links to tests use `https://github.com/northguild/gmt/blob/main/packages/gmt/src/<path>`, the
form the generated reference pages already use. They resolve once the branch merges, and merging
deploys. Quote the `it` title verbatim, `$placeholders` included. Never use line anchors,
because they drift.

---

## 0. Binding rules (from `built.md` and the owner)

- Figures come from `apps/dox/src/data/gmt-stats.ts` (`gmtStats`, `formatCount`). No count is
  typed. ISO strings and values inside code examples are data, not figures.
- Justify with specs only: TC39 Temporal, ISO 8601, RFC 9557, RFC 5545, SQL:2011, EWD831 and
  ECMA-262. The new copy names no peer library, and does not call any library buggy.
- Every claim links to at least one named test. Claim nothing beyond what those rows exercise.
  Zones at the maximum instant are limited to the zones that are actually tested: UTC,
  America/New_York and America/Santiago.
- Do not say "every time zone" and do not mention positive-offset zones near the maximum. That is
  the polyfill finding (item F), and it gets the PENDING slot only.
- React stays inside `/dox`. These are Astro/MDX and plain-DOM edits only.
- Widget markup goes through `scripts/html-diff.mjs` and `visual:diff`. Preset descriptions and
  aside text are set at runtime, so the template should diff as unchanged.

---

## 1. `apps/dox/src/content/docs/why-gmt.mdx`: new section

Insert a new `<GridSection>` directly **before** `## What this means`, inside
`<div class="gmt-why-grid">`. The existing `gmtStats` / `formatCount` import covers the one
figure. Heading: `## Correct at the edges`. The anchor must resolve to `#correct-at-the-edges`,
because the index links to it.

Paragraphs are prose. Each one ends with a `Tests:` line of links. The spec citation for each
claim goes inline where the draft shows it.

### Draft copy (MDX, exact)

```mdx
<GridSection>

## Correct at the edges

Date bugs hide at the extremes: the last nanosecond of a day, the first and last instant a
clock can name, a daylight-saving change nobody tests because it is hundreds of millennia away. GMT
tests those edges directly, and each paragraph below links the tests that prove it.

**A nanosecond before midnight stays on its day.** A `PlainTime` has no date, so in
[Temporal](https://tc39.es/proposal-temporal/#sec-temporal-plaintime-objects) adding one
nanosecond to `23:59:59.999999999` wraps to `00:00:00`. When `intervalAbutsTime` and
`intervalXorAllTime` need "one nanosecond away", they step the later value down instead of the
earlier one up, so an interval ending on the last nanosecond of the day is never mistaken for
one that starts at midnight.
Tests: [intervalAbutsTime](…/plain/interval/intervalAbutsTime.test.ts) ·
[intervalXorAllTime](…/plain/interval/intervalXorAllTime.test.ts) ·
[closedAbuts](…/internal/closedAbuts.test.ts) ·
[closedXorSweep](…/internal/closedXorSweep.test.ts)

**The first and last instant give exact answers.** Temporal represents instants from
`-271821-04-20T00:00:00Z` to `+275760-09-13T00:00:00Z`, 10<sup>8</sup> days either side of the
epoch ([TC39 Temporal](https://tc39.es/proposal-temporal/#sec-temporal-isvalidepochnanoseconds)).
Nothing can be added to the last one, so `intervalAbuts*` and `intervalXorAll*` for `Date`,
`DateTime`, `Utc` and `Zoned` never step past it. They return the exact answer for intervals
that end there, in UTC and in New York. At the other end, the first month is partial: its start
lies before the range, but its end does not. `endOfDate("-271821-04-19", "month")` returns
`"-271821-04-30"`, and `endOfDateTime`, `endOfUtc`, `endOfZoned` and `endOfUnix` return the
matching day, week, month and year ends.
Tests: [intervalAbutsUtc](…/utc/interval/intervalAbutsUtc.test.ts) ·
[intervalAbutsZoned](…/zoned/interval/intervalAbutsZoned.test.ts) ·
[intervalXorAllUtc](…/utc/interval/intervalXorAllUtc.test.ts) ·
[intervalXorAllZoned](…/zoned/interval/intervalXorAllZoned.test.ts) ·
[intervalAbutsDate](…/plain/interval/intervalAbutsDate.test.ts) ·
[intervalXorAllDateTime](…/plain/interval/intervalXorAllDateTime.test.ts) ·
[endOfDate](…/plain/calculate/endOfDate.test.ts) ·
[endOfUtc](…/utc/calculate/endOfUtc.test.ts) ·
[endOfZoned](…/zoned/calculate/endOfZoned.test.ts) ·
[endOfUnix](…/unix/calculate/endOfUnix.test.ts)

**Daylight-saving rules hold to the end of the range.** The last instant falls on 12 September
+275760 in Santiago, a few days after a daylight-saving change on 7 September. `startOfZoned`
and `floorToZone` start that month at local midnight on the offset then in force, `-04:00`.
`getLocaleZonedStartOfWeek` starts an `en-US` week at `01:00`, because that Sunday's midnight
never happened ([TC39 Temporal `startOfDay`](https://tc39.es/proposal-temporal/#sec-temporal.zoneddatetime.prototype.startofday),
[RFC 9557](https://www.rfc-editor.org/rfc/rfc9557) time-zone annotations).
`startOfQuarterForZoned`, `startOfUnix`, `intervalCountZoned` and `intervalCountUnix` agree at
the same instant.
Tests: [startOfZoned](…/zoned/calculate/startOfZoned.test.ts) ·
[floorToZone](…/calendar/calculate/floorToZone.test.ts) ·
[getLocaleZonedStartOfWeek](…/zoned/calculate/getLocaleZonedStartOfWeek.test.ts) ·
[startOfQuarterForZoned](…/zoned/calculate/startOfQuarterForZoned.test.ts) ·
[startOfUnix](…/unix/calculate/startOfUnix.test.ts) ·
[intervalCountZoned](…/zoned/interval/intervalCountZoned.test.ts) ·
[intervalCountUnix](…/unix/interval/intervalCountUnix.test.ts)

{/* PENDING (plan item F): polyfill max-edge conversion. Leave this comment in place and
render nothing here until the conversion helper ships and its tests exist. Then replace it
with one paragraph of fact: what GMT does, which zones and times its tests cover, a link to
the helper's test file, and the TC39 rule that a ZonedDateTime is valid when its epoch
nanoseconds lie within the Instant range. Name no upstream version or issue in public copy. */}

**Spans and totals are exact across the whole range.** `spanNs` returns the full distance from
the first instant to the last as a `bigint`. `sumIntervals` totals covered time exactly past
2<sup>53</sup> nanoseconds, about 104 days, which is where a JavaScript `number` stops holding
every nanosecond ([ECMA-262 `Number.MAX_SAFE_INTEGER`](https://tc39.es/ecma262/#sec-number.max_safe_integer)).
It stays exact up to the whole range, `PT4800000000H`, with hours as the largest unit, as
`Temporal.Instant.until` allows.
Tests: [spanNs](…/span/calculate/spanNs.test.ts) ·
[sumIntervals](…/interval/calculate/sumIntervals.test.ts)

**Unix epochs are whole units.** The Unix interval functions that compare, cut or combine
intervals reject a fractional epoch, or one past `Number.MAX_SAFE_INTEGER`, with their
documented sentinel. Past that point `2 ** 53 + 1 === 2 ** 53`, so "one unit later" no longer
exists. The functions stay exact on `Number.MAX_SAFE_INTEGER` itself.
Tests: [intervalAbutsUnix](…/unix/interval/intervalAbutsUnix.test.ts) ·
[intervalXorUnix](…/unix/interval/intervalXorUnix.test.ts) ·
[the rest of `unix/interval`](https://github.com/northguild/gmt/tree/main/packages/gmt/src/unix/interval)

**One documented boundary standard.** The `interval/` module is half-open, `[start, end)`: the
start is inside and the end is not. This is the convention of SQL:2011's application-time
`PERIOD`, [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545#section-3.8.2.2)'s non-inclusive
`DTEND`, and [EWD831](https://www.cs.utexas.edu/~EWD/transcriptions/EWD08xx/EWD831.html).
Touching intervals share no instant, so they do not overlap or intersect. Merging joins them,
and subtracting one from the other removes nothing. Take an interval apart with
`subtractIntervals` and put it back with `mergeIntervals` and `intersectIntervals`, and not a
nanosecond is lost. The older positional functions in `plain/`, `utc/`, `zoned/` and `unix/`
are closed, `[start, end]`, and [Interval Basics](/guides/intervals/interval-basics/) sets out
the difference.
Tests: [intervalsOverlap](…/interval/compare/intervalsOverlap.test.ts) ·
[intersectIntervals](…/interval/calculate/intersectIntervals.test.ts) ·
[mergeIntervals](…/interval/calculate/mergeIntervals.test.ts) ·
[subtractIntervals](…/interval/calculate/subtractIntervals.test.ts) ·
[interval algebra round trip](…/interval/calculate/intervalAlgebra.test.ts) ·
[intervalsOverlapZoned (closed)](…/zoned/interval/intervalsOverlapZoned.test.ts)

**Zero known bugs.** A defect GMT finds is fixed in the same change, together with every
function that shares its cause. It is never deferred, skipped or written up as a known issue.
`pnpm run validate` enforces this with
[`scripts/test-markers.mjs`](https://github.com/northguild/gmt/blob/main/scripts/test-markers.mjs),
which fails the build on any skipped, focused, to-do or expected-to-fail test, and on any
known-defect note. None of the {formatCount(gmtStats.tests)} tests is switched off.

</GridSection>
```

`…` stands for `https://github.com/northguild/gmt/blob/main/packages/gmt/src`. Write the full
URL in the file.

**Constants, not counts.** `10<sup>8</sup>`, `2<sup>53</sup>`, `PT4800000000H`, the 104-day
figure and the ISO strings are spec constants and test values, not counts that drift. They stay
typed. Nothing else in the section may be.

### Claim → backing test (the builder links these; the tester greps them)

| # | Claim | Test file (under `packages/gmt/src/`) | `it` title, verbatim |
| - | ----- | ------------------------------------- | -------------------- |
| C1 | No midnight wrap | `plain/interval/intervalAbutsTime.test.ts` | `returns $expected when A=[$aStart, $aEnd] and B=[$bStart, $bEnd] at the end of the day (no midnight wrap)` |
| C1 | | `plain/interval/intervalXorAllTime.test.ts` | `returns $expected for $intervals at the end of the day (no midnight wrap)` |
| C1 | | `internal/closedAbuts.test.ts` | `returns $expected for PlainTime A=[$aStart, $aEnd] and B=[$bStart, $bEnd] without wrapping` |
| C1 | | `internal/closedXorSweep.test.ts` | `returns $expected for PlainTime $intervals without wrapping at midnight` |
| C2 | Last instant, Abuts | `plain/interval/intervalAbutsDate.test.ts` | `returns $expected when A=[$aStart, $aEnd] and B=[$bStart, $bEnd] (an end at the maximum PlainDate)` |
| C2 | | `plain/interval/intervalAbutsDateTime.test.ts` | `… (an end at the maximum PlainDateTime)` |
| C2 | | `utc/interval/intervalAbutsUtc.test.ts` | `… (an end at the maximum Instant)` |
| C2 | UTC + New York | `zoned/interval/intervalAbutsZoned.test.ts` | `… (an end at the maximum instant)` |
| C2 | Last instant, XorAll | `plain/interval/intervalXorAllDate.test.ts` | `returns $expected for $intervals (an end at the maximum PlainDate)` |
| C2 | | `plain/interval/intervalXorAllDateTime.test.ts` | `… (an end at the maximum PlainDateTime)` |
| C2 | | `utc/interval/intervalXorAllUtc.test.ts` | `… (an end at the maximum Instant)` |
| C2 | | `zoned/interval/intervalXorAllZoned.test.ts` | `… (an end at the maximum instant)` |
| C2 | No step past max | `internal/closedAbuts.test.ts` | `never steps up, so an end at the maximum PlainDate does not throw` |
| C2 | | `internal/closedXorSweep.test.ts` | `never steps past the maximum PlainDate for an interval ending on +275760-09-13` |
| C2 | Range endpoints | `precision/validate/isValidInstant.test.ts` | `returns true for $value ($reason)`, rows `the latest representable instant` and `the earliest representable instant` |
| C3 | First month end | `plain/calculate/endOfDate.test.ts` | `returns $expected as the $unit end of the first PlainDate $value (weekStartsOn $weekStartsOn)` |
| C3 | | `plain/calculate/endOfDateTime.test.ts` | `returns $expected as the $unit end of the first-day value $value (weekStartsOn $weekStartsOn)` |
| C3 | | `utc/calculate/endOfUtc.test.ts` | `returns $expected as the $unit end of the first-day instant $value (weekStartsOn $weekStartsOn)` |
| C3 | | `zoned/calculate/endOfZoned.test.ts` | `returns $expected as the $unit end of the first-day value $value (weekStartsOn $weekStartsOn)` |
| C3 | | `unix/calculate/endOfUnix.test.ts` | `returns $expected as the $unit end of the first-day value $value in $timeZone (weekStartsOn $weekStartsOn)` |
| C4 | DST at max | `zoned/calculate/startOfZoned.test.ts` | describe `startOfZoned at the maximum instant in a DST zone` → `returns $expected as the $unit start of $value` |
| C4 | | `calendar/calculate/floorToZone.test.ts` | `floors the maximum instant $value to the $unit in $timeZone as $expected` |
| C4 | Skipped midnight | `zoned/calculate/getLocaleZonedStartOfWeek.test.ts` | `returns $expected for $value in $locale ($description)`, rows `the maximum instant; its Sunday's midnight was skipped, so the week starts at the transition` and `the maximum instant; a Monday-first week starts after that transition` |
| C4 | | `zoned/calculate/startOfQuarterForZoned.test.ts` | describe `startOfQuarterForZoned at the maximum instant in a DST zone` → `returns $expected as the quarter start of $value` |
| C4 | | `unix/calculate/startOfUnix.test.ts` | `returns $expected for the maximum instant $value by $unit in $timeZone` |
| C4 | | `zoned/interval/intervalCountZoned.test.ts` | `returns $expected $unit buckets for $start to $end ($description)`, row `August and September, ending at the maximum instant` |
| C4 | | `unix/interval/intervalCountUnix.test.ts` | `returns $expected $unit buckets for $start to $end in system timeZone $timeZone`, row `8639997552000000` → `8640000000000000` Santiago |
| C5 | Full-range span | `span/calculate/spanNs.test.ts` | `returns the full representable-instant range, far beyond an epoch nanosecond value` |
| C5 | Sum past 2^53 | `interval/calculate/sumIntervals.test.ts` | `returns $expected for [$start, $end) ($reason) and agrees with Instant.until`, rows `past 2^53 ns` and `full Instant range`; `returns $expected for $intervals ($reason)`, row `two disjoint, total past 2^53 ns` |
| C6 | Unix whole units | `unix/interval/intervalAbutsUnix.test.ts` | `returns false for A=[$aStart, $aEnd] and B=[$bStart, $bEnd] ($description)`; `returns true when B ends on the largest safe integer, one unit after A` |
| C6 | | `unix/interval/intervalXorUnix.test.ts` | `returns [] for A=[$aStart, $aEnd] xor B=[$bStart, $bEnd] ($description)`; `returns both one-sided pieces when B ends on the largest safe integer` |
| C6 | Rows present (title to confirm at build) | `intervalContainsUnix`, `intervalDifferenceUnix`, `intervalEngulfsUnix`, `intervalIntersectionUnix`, `intervalUnionUnix`, `intervalsOverlapUnix`, `intervalSplitAtUnix`, `intervalDivideEquallyUnix`, `mergeIntervalsUnix`, `intervalXorAllUnix` | rows described `a fractional …` and `an unsafe end` |
| C7 | Half-open touching | `interval/compare/intervalsOverlap.test.ts` | `returns $expected for [$aStart, $aEnd) and [$bStart, $bEnd) ($reason)`, rows `touching` and `touching, reversed` |
| C7 | | `interval/calculate/intersectIntervals.test.ts` | `returns null for [$aStart, $aEnd) and [$bStart, $bEnd) ($reason)`, rows `touching` and `touching, reversed` |
| C7 | | `interval/calculate/mergeIntervals.test.ts` | `merges $input to $expected ($reason)`, row `touching` |
| C7 | | `interval/calculate/subtractIntervals.test.ts` | `subtracts $remove from [09:00Z, 17:00Z) to $expected ($reason)`, rows `touching after removes nothing` and `touching before removes nothing` |
| C7 | Round trip | `interval/calculate/intervalAlgebra.test.ts` | `subtract(i, r) plus i ∩ merge(r) re-covers [$start, $end) exactly for every subset ($reason)` |
| C7 | Positional functions are closed | `zoned/interval/intervalsOverlapZoned.test.ts` | `returns $expected for adjacent or disjoint intervals` (shared-endpoint rows return `true`) |
| C8 | Zero known bugs | `scripts/test-markers.mjs` (repo root), plus the root `package.json` `validate` and `test:markers` scripts | the script has no test. The claim is backed by the gate itself, and `validate` exits 0 |

C6 scope: the functions listed above. The five `unix/interval` files with no fractional rows
(`intervalCountUnix`, `intervalFromDurationUnix`, `intervalLengthUnix`,
`intervalOverlappingDaysUnix`, `splitIntervalByUnitUnix`) and the validators
(`isValidUnixInterval`, `isValidUnixRange`, slice G1, in progress) are **not** claimed. That is
why the copy says "that compare, cut or combine intervals".

---

## 2. `apps/dox/src/content/docs/index.mdx`: highlight

Add one `<Card>` to the existing `<CardGrid>`, directly after the "No borrowed test oracle"
card:

```mdx
<Card title="Correct at the edges" icon="puzzle">
  A nanosecond before midnight stays on its day, the first and last instants Temporal can
  represent give exact answers, and daylight-saving rules hold to the end of the range. Each of
  these is a named test. [See the evidence](/why-gmt/#correct-at-the-edges).
</Card>
```

If `astro check` rejects `puzzle`, use `approve-check`. There are no figures here, so there is
nothing to import.

---

## 3. Widget copy fix (plan item G)

**Verified behaviour.** `loadModules()` in `apps/dox/src/lib/interval-visualizer-mount.ts` calls
`intervalIntersectionZoned`, `intervalUnionZoned`, `intervalDifferenceZoned` and
`intervalXorZoned` (see `INTERVAL_OPERATIONS` in `interval-visualizer.ts`). The "adjacent" preset
is A `2024-01-01..2024-07-01` and B `2024-07-01..2024-12-31`, so the two share the instant
`2024-07-01T00:00:00+00:00[UTC]`. The zoned functions are closed:

- `intervalsOverlapZoned.test.ts`, `returns $expected for adjacent or disjoint intervals`:
  shared-endpoint rows return `true`.
- `intervalIntersectionZoned.test.ts`, `returns $expected for adjacent intervals`: returns a
  single-instant span.
- `intervalUnionZoned.test.ts`, `returns merged interval when $aEnd equals $bStart (adjacent)`:
  merged.

The current aside is wrong four times over. It says "touch but don't overlap", "difference
returns all of A" and "xor returns both". Read by hand, the implementation returns
`[aStart, aEnd − 1 ns]` for difference, and `[aStart, aEnd − 1 ns]` plus `[bStart + 1 ns, bEnd]`
for xor. **No test pins those two results for a shared endpoint.** The "adjacent" test in
`intervalXorZoned.test.ts` actually has a gap. So the copy below ships **without** a
difference/xor claim, unless rows R1 and R2 (below) exist at build time.

### 3a. `apps/dox/src/lib/interval-visualizer.ts`, `RELATIONSHIP_PRESETS` → `adjacent.description`

```ts
description:
  "A ends the instant B starts. GMT's positional interval functions are closed, so that instant belongs to both and they overlap.",
```

### 3b. `apps/dox/src/lib/interval-visualizer-mount.ts`, `renderRelationshipAside` → `adjacent`

Ship this default:

```ts
adjacent:
  "A ends the instant B starts. The *Zoned interval functions are closed [start, end], so that shared instant belongs to both and the intervals overlap: intersection is that single instant, and union merges them into one. The difference and xor outputs below show what the closed functions return. For touching intervals that do not overlap, use the half-open interval/ module.",
```

Use this instead **only if R1 and R2 exist and pass** at build time:

```ts
adjacent:
  "A ends the instant B starts. The *Zoned interval functions are closed [start, end], so that shared instant belongs to both and the intervals overlap: intersection is that single instant, and union merges them into one. Difference returns A without the shared instant, ending one nanosecond before B starts; xor returns A and B, each without it. For touching intervals that do not overlap, use the half-open interval/ module.",
```

The last sentence is backed by C7 (`intervalsOverlap` touching rows).

### 3c. `apps/dox/src/lib/interval-visualizer.test.ts`

Rename `classifies adjacent (touching, non-overlapping) intervals both ways` to
`classifies adjacent (touching at a shared instant) intervals both ways`. The assertions stay
unchanged. `classifyRelationship` still returns `"adjacent"`, and that label names the relation,
not an overlap verdict.

### 3d. `apps/dox/src/content/docs/tools/interval-visualizer.mdx`, lines 8–11

Replace "or merely touching at an endpoint." with:

```mdx
or touching at a shared endpoint, which the closed functions this widget calls count as overlap.
```

---

## 4. Existing dox copy that contradicts tested behaviour

The staged interval guides (`interval-basics`, `containment-and-overlap`, `set-operations`,
`splitting-and-counting`) and `mistakes/interval-ops.mdx` were re-read against the tests. They
agree with the fixed behaviour: abuts steps one unit, xorAll odd coverage, difference steps in,
half-open counts. No change is needed. What does contradict:

1. **`apps/dox/src/content/docs/guides/core-date-operations/plain-arithmetic.mdx`, lines 85–88.**
   `startOfDate`/`endOfDate` take a `PlainDate` and a required unit. A datetime input returns
   `""` (`startOfDate.test.ts` / `endOfDate.test.ts`,
   `returns empty string for non-string input $nonStringInput`, row `"2024-02-29T00:00:00"`).
   The shown `"…T23:59:59.999999999"` is also wrong, because the default precision is seconds.
   Replace the import line and the first two calls with:

   ```typescript
   import { startOfDate, endOfDate, startOfDateTime, endOfDateTime } from "@northguild/gmt";

   startOfDateTime("2024-02-29T12:34:56", "day"); // "2024-02-29T00:00:00" — start of day
   endOfDateTime("2024-02-29T12:34:56", "day"); // "2024-02-29T23:59:59" — end of day
   ```

   Backing: `startOfDateTime.test.ts` and `endOfDateTime.test.ts`,
   `returns $expected for $value and $unit`, row `day`. Keep the two `month` lines.
2. **Generated `reference/plain/calculate/endOfDateTime.mdx:53`** shows
   `"2024-02-29T23:59:59.999999999"`. The source JSDoc (`endOfDateTime.ts:34`) already says
   `"2024-02-29T23:59:59"`, so the page is stale. **Do not hand-edit.** Regenerate it through
   `apps/dox/scripts/build-reference.ts` (the finalizer's corpus step). The tester confirms the
   regenerated line.

---

## 5. Definition of done (`dox-tester`, run each line literally)

1. Every GitHub link in the new why-gmt section, the index card and both README additions points
   at a path that exists: `test -f packages/gmt/src/<path>` for each.
2. Every quoted `it`/`describe` title in the claim table is still in its file:
   `grep -F '<title>' <file>`. Every named row (`touching`, `past 2^53 ns`, …) is present.
   Any miss fails, and the claim is removed, not relinked by guess.
3. Every linked test passes. The main session's `pnpm run validate` exits 0, including
   `node scripts/test-markers.mjs check`.
4. The new copy has no typed count. `formatCount(gmtStats.tests)` is the only figure, and it
   renders the value in `gmt-stats.json`. No drifting numbers appear in the new section (such as
   "273,000", or test or function counts).
5. `grep -niE 'luxon|date-fns|moment|joda|day\.js|spacetime|internationalized'` over the new
   section, the index card, the widget strings and the README additions returns nothing.
6. The polyfill PENDING slot is an MDX comment. It renders nothing: view source on `/why-gmt/`
   and find no "PENDING". No positive-offset-zone or "every zone" claim appears anywhere.
7. `/#` → "See the evidence" lands on `/why-gmt/#correct-at-the-edges` with the heading in view.
8. On `/tools/interval-visualizer/` and in the `/dox` rail, choosing **Adjacent (touching)** by
   keyboard only shows the new preset description and the new aside. The four outputs render.
   The aside wording matches 3b's default, or the R1/R2 variant only if both rows exist.
9. Keyboard-only pass over `/why-gmt/` (every link reachable, focus visible inside the
   `gmt-brackets` panel) and over the visualizer.
10. Contrast on the rendered new section: body text and links ≥ 7:1, in both themes.
11. `scripts/html-diff.mjs` reports ✓ or ~ for the interval visualizer (the template is
    unchanged). `visual:diff` shows no unexpected change outside the new section.
12. From `apps/dox`: `pnpm test`, `pnpm check` and `pnpm lint` are green, including the renamed
    `interval-visualizer.test.ts` case.
13. `plain-arithmetic.mdx` shows the corrected calls. The regenerated `endOfDateTime` reference
    page shows `"2024-02-29T23:59:59"`.

## 6. Close-out (`dox-architect`, after the tester passes)

- `built.md` → Tiers 0–1: add one line: "`/why-gmt` 'Correct at the edges': every claim links
  a named `packages/gmt` test; its only figure comes from `gmtStats`; the polyfill paragraph
  stays an MDX comment until item F ships." Tier 2, under "Interval visualizer": "The
  adjacent preset's copy follows the closed `*Zoned` functions: a shared instant overlaps."
- Not tracked in `context/dox/tracker.md` (no `DOX-*` story), so `pnpm deps:sync` is not needed.

---

## Blocked on the library pipeline (report, do not build around)

- **R1, missing test.** `zoned/interval/intervalDifferenceZoned.test.ts` needs a shared-endpoint
  row. A `2024-01-01T00:00:00+00:00[UTC]..2024-07-01T00:00:00+00:00[UTC]` minus B
  `2024-07-01T00:00:00+00:00[UTC]..2024-12-31T00:00:00+00:00[UTC]`, derived as
  `[{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-06-30T23:59:59.999999999+00:00[UTC]" }]`
  (the tester verifies it against the polyfill).
- **R2, missing test.** `zoned/interval/intervalXorZoned.test.ts`, same A and B, derived as
  `[{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-06-30T23:59:59.999999999+00:00[UTC]" }, { start: "2024-07-01T00:00:00.000000001+00:00[UTC]", end: "2024-12-31T00:00:00+00:00[UTC]" }]`.
  The existing `proves zone-invariance … for adjacent intervals (xor is both)` test has a
  25-hour gap, so it is not an adjacency test. Its title misdescribes it and belongs in the G2
  title fixes.
- The same shared-endpoint gap likely exists in `utc/`, `plain/` and `unix/`
  `intervalDifference*`/`intervalXor*`. A scan of Utc found no row. That is the tester's audit to
  widen.

---

## 7. README brief (`finalizer`)

There are no figures in either addition, so `scripts/stats.mjs` rules are untouched. If the
finalizer adds a figure, it must match an existing `stats.mjs` rule, or it does not go in.

### `packages/gmt/README.md`: new `## Correct at the edges`

Place it between `### Testing strategy` and `## How GMT is tested, vs. the libraries it targets`.
Use absolute `https://github.com/northguild/gmt/blob/main/…` links, which this README already
uses and which npm renders. Condensed copy:

```markdown
## Correct at the edges

Each claim links the tests that prove it.

- **A nanosecond before midnight stays on its day.** `intervalAbutsTime` and `intervalXorAllTime` never compute `23:59:59.999999999 + 1 ns`, which wraps to `00:00:00` for a `PlainTime`. ([tests](…/plain/interval/intervalAbutsTime.test.ts), [tests](…/plain/interval/intervalXorAllTime.test.ts))
- **The first and last instant give exact answers.** Temporal's range is `-271821-04-20T00:00:00Z` to `+275760-09-13T00:00:00Z`. `intervalAbuts*` and `intervalXorAll*` (`Date`, `DateTime`, `Utc`, `Zoned`) never step past the end, and `endOf*` returns the end of the partial first month: `endOfDate("-271821-04-19", "month")` is `"-271821-04-30"`. ([Utc](…/utc/interval/intervalAbutsUtc.test.ts), [Zoned](…/zoned/interval/intervalXorAllZoned.test.ts), [endOfDate](…/plain/calculate/endOfDate.test.ts), [endOfUnix](…/unix/calculate/endOfUnix.test.ts))
- **Daylight-saving rules hold to the end of the range.** At the last instant in America/Santiago, `startOfZoned`, `floorToZone`, `startOfQuarterForZoned`, `startOfUnix`, `intervalCountZoned`, `intervalCountUnix` and `getLocaleZonedStartOfWeek` use the offset then in force, and start a week whose midnight was skipped at the transition. ([startOfZoned](…/zoned/calculate/startOfZoned.test.ts), [getLocaleZonedStartOfWeek](…/zoned/calculate/getLocaleZonedStartOfWeek.test.ts))
- **Exact spans and totals.** `spanNs` covers the full instant range as a `bigint`. `sumIntervals` is exact past 2^53 ns and up to `PT4800000000H`. ([spanNs](…/span/calculate/spanNs.test.ts), [sumIntervals](…/interval/calculate/sumIntervals.test.ts))
- **Unix epochs are whole units.** The Unix interval functions that compare, cut or combine intervals reject fractional or unsafe epochs and stay exact at `Number.MAX_SAFE_INTEGER`. ([abuts](…/unix/interval/intervalAbutsUnix.test.ts), [xor](…/unix/interval/intervalXorUnix.test.ts))
- **One documented boundary standard.** `interval/` is half-open `[start, end)` (SQL:2011 `PERIOD`, RFC 5545 `DTEND`, EWD831). Touching intervals do not overlap, and subtract-then-merge re-covers an interval exactly. ([intervalsOverlap](…/interval/compare/intervalsOverlap.test.ts), [round trip](…/interval/calculate/intervalAlgebra.test.ts))
- **Zero known bugs.** Defects are fixed in the change that finds them. `pnpm run validate` runs [`scripts/test-markers.mjs`](https://github.com/northguild/gmt/blob/main/scripts/test-markers.mjs), which fails on any skipped, focused, to-do or expected-to-fail test and on any known-defect note.
```

The finalizer keeps a slot comment for the polyfill line, `<!-- PENDING (plan item F) … -->`,
filled under the same rule as the dox slot.

### Root `README.md`: one line

Add it to the **Why GMT** bullet list, after the DST disambiguation bullet. Relative links, as
the root README already uses:

```markdown
- **Correct at the edges.** A nanosecond before midnight stays on its day, the first and last instants Temporal can represent give exact answers, and no skipped or expected-to-fail test ships — each claim backed by named tests ([details](./packages/gmt/README.md#correct-at-the-edges)).
```
