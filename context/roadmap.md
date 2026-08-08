# Roadmap: GMT Parity with Luxon & react-aria `@internationalized/date`

## Context

GMT (`@burglekitt/gmt`) is a pre-alpha Temporal-first date library with strong plain/zoned/unix/utc coverage already. The goal is to reach — and exceed — feature parity with **Luxon** and **react-aria's `@internationalized/date`**, the two most relevant comparison libraries (see `context/project-overview.md`).

Research via context7 against both libraries' current docs, cross-referenced with GMT's existing `src/` surface, surfaced four real functional gaps (not just API-shape differences):

1. **No Duration type or ISO 8601 duration string support.** GMT's `add*`/`diff*` functions take/return plain `{unit: number}` objects. Luxon has a full `Duration` class (`fromObject`, `fromISO`, `fromMillis`, `.plus/.minus/.negate/.shiftTo/.rescale/.normalize/.toISO/.toHuman`). GMT has no way to parse or emit `"P1DT2H30M"` style strings, and no way to humanize a duration standalone (only relative-to-now formatting exists today).
2. **No Interval/range type.** Luxon's `Interval` supports `contains`, `overlaps`, `union`, `intersection`, `splitBy`, `divideEqually`, `length`. GMT only has scalar `isBetween*` checks and `mapDatesInRange`/`mapZonedDatesInRange` — no range-vs-range math.
3. **No DST disambiguation control.** Functions that produce a `ZonedDateTime` from a plain/local value (`convertPlainDateTimeToZoned`, `addZoned`, etc.) silently take Temporal's default `"compatible"` resolution for DST gaps/overlaps, with no way for callers to opt into `"earlier"`, `"later"`, or `"reject"`. This is a known bug-report source in Luxon's tracker — exposing it explicitly is a differentiator.
4. **No locale-aware calendar helpers.** react-aria has `isWeekend(date, locale)`, `startOfWeek(date, locale)`, `endOfWeek(date, locale)`, `getDayOfWeek(date, locale)` — all locale-sensitive (first day of week and weekend days vary by region: en-US week starts Sunday, fr-FR starts Monday, he-IL's weekend is Fri/Sat). GMT's `getDayOfWeek`/`getWeekOfYear` are ISO-8601-only (Monday-start), no locale parameter.

**Explicitly out of scope** (per user decision): non-Gregorian calendar systems (Buddhist, Hebrew, Islamic, Japanese, etc. via react-aria's `toCalendar`) — tracked as a single stretch story at the end, not a priority.

**Organizational note:** New functionality follows the existing folder convention (`src/duration/`, `src/interval/` mirroring `src/plain/`, `src/zoned/`, etc.) purely for internal consistency (tests, JSDoc, barrel exports per `context/coding-standards.md` and `context/testing-standards.md`). Consumers import everything from the package root regardless, so this has no user-facing effect.

Each story below is scoped to be a single, reviewable PR: one coherent slice of functionality, following the existing per-function file pattern (implementation + `.test.ts` + JSDoc `@example` + barrel `index.ts` export), consistent with how `getTimeZones`/`getSystemTimeZone` etc. were added.

## Instructions for the agent picking up a story

This roadmap is intentionally a skeleton, not a spec. Before implementing any story below:

1. **Re-verify the gap is still real.** Library surfaces move. Re-check the target function/behavior still doesn't exist in GMT (`grep`/`find` in `packages/gmt/src`) and still exists in Luxon/react-aria (use the `context7-mcp`/`find-docs` skill — do not rely on this document's research being current).
2. **Read the scoped context files** relevant to the change: `context/coding-standards.md` (always), `context/testing-standards.md` (always), `context/jsdoc-standards.md` (always), `context/code-review-checklist.md` (before opening the PR).
3. **Find the nearest existing analog** in `packages/gmt/src` (e.g. for a new `plain/interval/*` function, look at `plain/compare/isBetweenDate.ts` and `plain/map/mapDatesInRange.ts`) and match its file structure, error-handling shape (try-catch, sentinel returns), and JSDoc format exactly.
4. **Expand the one-line story below into a full spec** before writing code: exact function signature(s), which Temporal API(s) it wraps, the sentinel return value, the locale matrix if locale-aware, and the specific edge cases the tests must cover (invalid input, DST boundaries, leap years/seconds, etc. as applicable).
5. **One story = one PR = one changeset.** Do not bundle multiple stories into one PR even if they touch the same namespace, unless the story list explicitly groups them (e.g. C1-C3 are sequenced together but are still separate, reviewable commits).
6. **Update `packages/gmt/README.md`** (via `/update-readme`) and add a changeset (via `/changelog`) as part of the same PR, not a follow-up.
7. **Update the TanStack Intent agent skills** (via `/tanstack-intent`, or manually following `.agents/skills/tanstack-intent/SKILL.md`) as part of the same PR whenever the story adds/renames/removes an exported function, adds an option to an existing one, or introduces a new domain concept. Skills that fall behind the actual API surface actively mislead agents consuming `@burglekitt/gmt` — this is not optional cleanup. The skill's own step 0 also checks whether the `@tanstack/intent` **tool** itself (the devDependency, not just the skill content) has drifted behind npm — run it periodically even outside of a specific story, since tool drift and content drift are independent failure modes.

---

## Story Group A — Duration (new `src/duration/` namespace)

Mirrors the `plain/calculate` pattern: one function per file, string-in/string-out contract intact (ISO 8601 duration strings like `"P1DT2H30M"`, not Duration objects, per GMT's core rule).

- **A1. `parseDuration` / `isValidDuration`** — ✅ **Done (2026-08-08).** Parse and validate ISO 8601 duration strings via `Temporal.Duration.from`. Foundation for everything else in this group. New `src/duration/` namespace with `validate/isValidDuration.ts` and `parse/parseDuration.ts`; `parseDuration` accepts optional `smallestUnit`/`fractionalSecondDigits`/`roundingMode` (Temporal's `ToStringPrecisionOptions`, the only options `Temporal.Duration.prototype.toString()` exposes — `Temporal.Duration.from` itself takes no options). **Scope expanded per user request** to also add relevant, previously-missing Temporal options to the _existing_ `add*`/`subtract*`/`diff*` functions across `plain`/`zoned`/`unix`/`utc` (18 functions total): `add*`/`subtract*` gained an optional `overflow` (`"constrain"` (default) | `"reject"`) controlling out-of-range arithmetic (e.g. Jan 31 + 1 month), extracted as a shared `Overflow` type at `packages/gmt/src/types/overflow.ts` (mirroring how `Disambiguation`/`Offset` were extracted for C1–C3, since it's reused identically across all 12 functions); `diff*` gained optional `smallestUnit`/`roundingIncrement`/`roundingMode` (Temporal's `DifferenceOptions` rounding controls) to round the computed difference instead of always returning the exact value. All new options are optional and default to prior behavior — non-breaking. Added a new `durations` TanStack Intent skill and extended `calculate-dates` with the new options; added `packages/gmt/src/duration/README.md` and updated root/package READMEs.
- **A2. `addDuration` / `subtractDuration`** — ✅ **Done (2026-08-08).** Combine two ISO duration strings via `Temporal.Duration.prototype.add`/`.subtract`, returning an ISO duration string; `""` on invalid input on either side. New `src/duration/calculate/` module (`addDuration.ts`, `subtractDuration.ts`). No options — `Temporal.Duration.prototype.add`/`.subtract` have no `relativeTo` parameter (unlike `Duration.compare`), so combining any pair where either operand has a nonzero years/months/weeks component throws and results in `""`; documented explicitly in JSDoc, the `duration/README.md`, and a new "Common Mistakes" entry in the `durations` TanStack Intent skill. Updated `packages/gmt/README.md` and `packages/gmt/src/duration/README.md`.
- **A3. `normalizeDuration`** (round-trip through `Temporal.Duration.round`/`balance` semantics) — roll small units into larger ones (Luxon's `shiftTo`/`rescale` equivalent), still string-in/string-out.
- **A4. `formatDuration`** — human-readable rendering of an ISO duration string via `Intl.DurationFormat` (or manual fallback if runtime support is thin) — the "humanize a duration standalone" gap called out above, distinct from the existing `formatRelative*` family which is anchored to "now."
- **A5. `getDurationBetween` bridge functions** — thin wrappers so `diffDate`/`diffDateTime`/`diffZoned`/`diffUnix`/`diffUtc` can optionally return an ISO duration string instead of a single-unit number (additive, non-breaking — new optional return-shape param or new sibling functions, to be decided at implementation time).

## Story Group B — Interval (new `src/interval/` namespace)

Range math over two ISO datetime/zoned strings. Each function takes `{ start, end }` string pairs.

- **B1. `isValidInterval`** — validate a start/end pair (start <= end, both parseable).
- **B2. `intervalContains`** — does interval A contain a point or fully contain interval B.
- **B3. `intervalsOverlap`** — do two intervals overlap at all.
- **B4. `intervalIntersection`** — the overlapping sub-interval of two intervals, or `null`/`""` if none.
- **B5. `intervalUnion`** — combined span of two overlapping/adjacent intervals.
- **B6. `splitIntervalByUnit`** — divide an interval into sub-intervals by a duration unit (parallels `mapDatesInRange` but interval-typed), e.g. weekly billing periods.
- Zoned equivalents (`zonedInterval*`) as a follow-up story once the plain versions establish the pattern — do not build both in parallel.

## Story Group C — DST Disambiguation

Extend existing zoned-producing functions with an **optional** `disambiguation?: 'compatible' | 'earlier' | 'later' | 'reject'` parameter (default `'compatible'`, matching current behavior — non-breaking).

- **C1. `convertPlainDateTimeToZoned`** — ✅ Done. Added the parameter, threaded through to `Temporal.ZonedDateTime.from(..., { disambiguation })`. DST gap/overlap test cases cover spring-forward gap and fall-back overlap for `America/New_York` and `Europe/Berlin`. **Amended 2026-08-08 (C3 follow-up):** also gained an `offset?: 'prefer' | 'use' | 'ignore' | 'reject'` option, default `'ignore'`, for API consistency with the C3 functions below — but it is **permanently inert** here, since `value` is a plain datetime string with no offset embedded for `offset` to act on. See `docs/dst-disambiguation.md`'s "The `offset` parameter" section.
- **C2. `addZoned` / `subtractZoned`** — ✅ **Done, re-scoped from the original ask to a working partial fix.** `Temporal.ZonedDateTime.prototype.add()`/`.subtract()` genuinely have no `disambiguation` field (confirmed via `ArithmeticOptions`'s type declaration and empirically — passing `{ disambiguation: "reject" }` to `.add()` is silently ignored). Checked how Luxon, react-aria (`@internationalized/date`), and date-fns handle this via context7: none of them expose disambiguation control on arithmetic either — Luxon's docs call ambiguous-time behavior during `.plus`/`.minus` explicitly undefined, and react-aria only exposes `disambiguation` on construction (`toZoned`/`parseZonedDateTime`), not on `ZonedDateTime.add`/`.subtract`. Rather than stop at documentation-only (option b) or a detector function (option c), found a working resolution lever none of the three competitors have: `.add()`/`.subtract()`'s result carries an explicit UTC offset, so re-running `.with()` on it doesn't re-trigger disambiguation — but rebuilding via `Temporal.ZonedDateTime.from()` from the result's plain fields + timeZone (dropping the offset) does force genuine re-resolution. `addZoned`/`subtractZoned` now accept the same optional `disambiguation` parameter as C1, implemented via this rebuild technique. **Real but partial**: this only controls the result when arithmetic lands on a **fall-back (DST-end) overlap** — it has **no effect** on a **spring-forward (DST-start) gap**, because Temporal's arithmetic always resolves gap landings unambiguously (by advancing past the gap) before disambiguation is ever evaluated; this is documented explicitly in JSDoc, tested (all four `disambiguation` values produce identical output for a gap-crossing case), and covered at length in `docs/dst-disambiguation.md`'s new "Which function do I actually need?" section. **Amended 2026-08-08 (C3 follow-up):** also gained an `offset` option, same as C1, and equally permanently inert (the rebuild step also reconstructs from a plain datetime string).
- **C3. Audit remaining `zoned/convert/*` and `zoned/calculate/*` functions** — ✅ **Done (2026-08-08).** Original scope confirmed via full-codebase audit (2026-08-07): `disambiguation` is only meaningful for calls that construct/mutate a `ZonedDateTime` from plain fields against a _real_ (non-UTC) IANA timezone via `Temporal.ZonedDateTime.prototype.with()` (confirmed empirically that `.with()`, unlike `.add()`/`.subtract()`, does respect `disambiguation` — `{ disambiguation: "reject" }` correctly throws when `.with()` lands in a gap). The audit found **9 functions** with this exact unhandled pattern — 4 of them outside the directories literally named in the story title (`zoned/convert/*` + `zoned/calculate/*`):
  - `zoned/calculate/startOfZoned.ts`, `endOfZoned.ts`, `startOfQuarterForZoned.ts`, `endOfQuarterForZoned.ts` — jump to unit/quarter boundaries via `.with({ month, day, hour, ... })`.
  - `zoned/map/mapZonedHoursInDay.ts` — its midnight anchor (`.with({ hour: 0, ... })`) has the same gap.
  - `unix/calculate/startOfUnix.ts`, `endOfUnix.ts`, `startOfQuarterForUnix.ts`, `endOfQuarterForUnix.ts` — **not under `zoned/`** — these derive a `ZonedDateTime` via `instant.toZonedDateTimeISO(timeZone)` then apply the identical unhandled `.with()` pattern as their `zoned/calculate` counterparts.
  - Not real gaps (documented for completeness, `disambiguation` not added to these): `utc/calculate/startOfUtc.ts`/`endOfUtc.ts`/`startOfQuarterForUtc.ts`/`endOfQuarterForUtc.ts` use the same `.with()` shape but hardcode timezone `"UTC"`, which has no DST transitions — the option would be a permanent no-op there. `zoned/validate/isValidTimeZone.ts` combines plain fields + timeZone but only to probe a fixed non-DST date (`2020-02-28`) for validity — disambiguation behavior doesn't affect its correctness.

  **Critical implementation finding (2026-08-08), which reshaped this story mid-flight:** `Temporal.ZonedDateTime.prototype.with()` has a _second_, independent option beyond `disambiguation` — `offset` (`'prefer' | 'use' | 'ignore' | 'reject'`), defaulting to `'prefer'`. `'prefer'` keeps the source `ZonedDateTime`'s existing UTC offset whenever it's still valid for the new field values — which, empirically, it almost always is for every boundary-reset call these 9 functions make. That means **passing `disambiguation` alone (mechanically copying C1's `.from()` pattern onto these `.with()` calls, as originally planned) is a silent no-op**: confirmed empirically that all four `disambiguation` values produced byte-identical output on a real, reachable fall-back-overlap case until `offset: 'ignore'` was also passed. This does not affect C1/C2, which construct via `.from()` on a string with no offset embedded — there's nothing for `offset` to act on there, so `disambiguation` alone is correct for those two (see their amended notes above).

  After discussion, the fix was to **expose `offset` as its own optional parameter on all 9 functions, defaulting to `'ignore'`** (so default behavior is correct out of the box and unchanged from a hypothetical `disambiguation`-only implementation) rather than hard-coding `offset: 'ignore'` internally — `offset` is a legitimate, independently meaningful Temporal option, not just a workaround, so advanced callers can still reach `'prefer'`/`'use'`/`'reject'` semantics if they need them. A shared `Offset` type was added at `packages/gmt/src/types/offset.ts`, mirroring how `Disambiguation` was derived. For consistency (and because a caller comparing C1/C2/C3 signatures shouldn't have to know which ones are inert), `offset` was also added to C1's and C2's signatures, documented as permanently inert there. All 9 functions, plus C1/C2, have tests proving the `offset`/`disambiguation` interaction (a `disambiguation: "reject"` + `offset: "prefer"` case that does _not_ throw, alongside the default-`offset` case that does) — this is the regression class that would have caught the no-op bug. Full explanation lives in `docs/dst-disambiguation.md`'s new "The `offset` parameter" section; `packages/gmt/skills/zoned-date-ops/SKILL.md` was updated to match (new Core Pattern + Common Mistakes entry).

## Story Group D — Locale-Aware Calendar Helpers

New locale-sensitive variants alongside the existing ISO-only functions (additive, not replacing).

- **D1. `isWeekend(value, locale)`** (plain) + `isZonedWeekend` — via `Intl.Locale` weekend data (`weekInfo`) where available, falling back sensibly where not.
- **D2. `getLocaleStartOfWeek` / `getLocaleEndOfWeek`** (plain + zoned) — locale-aware week boundaries, distinct from the existing ISO-Monday `startOfDate`/`endOfDate` family.
- **D3. `getLocaleDayOfWeek`** (plain + zoned) — day-of-week index relative to the locale's first day, distinct from the existing ISO `getDayOfWeek`.

## Story Group E — Stretch / Future (not prioritized)

- **E1. Non-Gregorian calendar system support** (Buddhist, Hebrew, Islamic, Japanese, etc., matching react-aria's `toCalendar`). Large surface, narrow demand — single tracking story, not scheduled.

---

## Suggested Sequencing

1. **C1–C3** (DST disambiguation) first — smallest, additive, no new namespace, immediately closes a correctness gap in existing code.
2. **A1–A5** (Duration parse/validate/add/subtract/normalize/format/diff-bridge) — foundational, kept together so Group A publishes as a single clean release with no other group's changesets riding along.
3. **D1–D3** (locale calendar helpers) — independent of A/B; sequenced after Group A finishes so each group's publish stays isolated (see the Publish column note below).
4. **B1–B6** (Interval) — largest group, benefits from Duration existing (B6 splits by duration unit).
5. **E1** — backlog, not scheduled.

## Verification (per story)

- Follow `context/testing-standards.md`: full locale matrix (17 locales) for any locale-aware function (D-group, A4), `hasFullIcu` ternaries where ICU-dependent output differs.
- Follow `context/coding-standards.md`: every new public function wraps Temporal calls in try-catch, returns typed sentinel (`""`/`null`/`false`/`[]`) on invalid input, never throws.
- Every function: `.test.ts` alongside it, JSDoc with `@example` covering valid/invalid/edge cases, exported from the namespace's `index.ts` per `context/jsdoc-standards.md`.
- Run `pnpm test` and `pnpm lint` (gmt-eslint/gmt-oxlint/gmt-biome Date-ban checks) before considering a story done.
- Update `packages/gmt/README.md` API surface section and add a `.changeset/*.md` entry per story, per repo convention (`/update-readme`, `/changelog` skills).

---

## GitHub Issues

Workflow: copy the title + description below into a new GitHub issue for each story, then paste the resulting issue number into the `GitHub Issue:` line for that story **both here and in the story's bullet above** (Story Group A–E). When starting a branch for a story, tell the agent which story ID (e.g. "work on C1") — it will find the matching issue link here and the full context in the Story Group section above.

Issue number tracker (fill in as issues are created). `Order` is the sequence to actually work these in — it follows the "Suggested Sequencing" section above (C-group first as a correctness fix, then A1–A5 straight through, then D-group, then B-group, then E1 last) — **not** ascending issue number. `Publish` marks when to cut a release after that story lands: every story is additive-only (new functions, or new optional parameters defaulting to current behavior), so every bump is `minor`; publish once per Story Group rather than per-story.

**Changeset note:** each story's PR still adds its own `.changeset/*.md` file with a `minor` bump label (that's the correct per-change label, independent of when a release is cut). Changesets accumulate un-versioned in `.changeset/` across multiple merged PRs; only running `pnpm changeset:version` actually consumes them and cuts a release. Do **not** run `changeset:version` / publish until the `Publish` column for that row says so (i.e. wait for the last story in the Story Group, not the first). Story Groups are kept **un-interleaved** in `Order` specifically so this holds: `changeset:version` versions everything sitting in `.changeset/` at the time it's run, not just the "completing" group's own changesets, so interleaving two groups' stories would cause an earlier group's publish to sweep up a later, still-in-progress group's changesets too.

| Order | Story | GitHub Issue | Status      | Publish                                      |
| ----- | ----- | ------------ | ----------- | -------------------------------------------- |
| 1     | C1    | Issue #38    | Done        | v1.5.0                                       |
| 2     | C2    | Issue #39    | Done        | v1.5.0                                       |
| 3     | C3    | Issue #40    | Done        | v1.5.0                                       |
| 4     | A1    | Issue #27    | Done        | not yet                                      |
| 5     | A2    | Issue #28    | Done        | not yet                                      |
| 6     | A3    | Issue #29    | Not started | not yet                                      |
| 7     | A4    | Issue #30    | Not started | not yet                                      |
| 8     | A5    | Issue #31    | Not started | minor, Story Group A complete                |
| 9     | D1    | Issue #41    | Not started | not yet                                      |
| 10    | D2    | Issue #42    | Not started | not yet                                      |
| 11    | D3    | Issue #43    | Not started | minor, Story Group D complete                |
| 12    | B1    | Issue #32    | Not started | not yet                                      |
| 13    | B2    | Issue #33    | Not started | not yet                                      |
| 14    | B3    | Issue #34    | Not started | not yet                                      |
| 15    | B4    | Issue #35    | Not started | not yet                                      |
| 16    | B5    | Issue #36    | Not started | not yet                                      |
| 17    | B6    | Issue #37    | Not started | minor, Story Group B complete                |
| 18    | E1    | Issue #44    | Not started | unscheduled, no publish plan until picked up |

### A1 — `parseDuration` / `isValidDuration`

**GitHub Issue:** #27

**Title:**

```
A1 Add parseDuration, isValidDuration ISO 8601 duration parsing
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap.md`, Story Group A, item A1.

## Gap
GMT has no way to parse or validate ISO 8601 duration strings (e.g. "P1DT2H30M"). Luxon has `Duration.fromISO`/`Duration.fromObject`. This is the foundation story for the rest of Story Group A (A2–A5 depend on it).

## Scope
- `isValidDuration(value: string): boolean` — validate an ISO 8601 duration string via `Temporal.Duration.from`.
- `parseDuration(value: string): string` — parse and re-normalize an ISO 8601 duration string, returning `""` on invalid input (per GMT's sentinel-return contract).
- New `src/duration/` namespace, following the existing `src/plain/validate/` and `src/plain/parse/` file structure.

## Before starting
Read the "Instructions for the agent picking up a story" section in `context/roadmap.md` — re-verify the gap, read `context/coding-standards.md` / `context/testing-standards.md` / `context/jsdoc-standards.md`, find the nearest existing analog (`plain/validate/isValidDate.ts`, `plain/parse/parseYearFromDate.ts`), and expand this into a full spec before writing code.

## Definition of done
- `.test.ts` alongside each function, full edge-case coverage (invalid strings, negative durations, zero duration, fractional units if Temporal supports them).
- JSDoc with `@example` per `context/jsdoc-standards.md`.
- Exported from `src/duration/index.ts` and the package root.
- `packages/gmt/README.md` updated, changeset added.
- `pnpm test` and `pnpm lint` pass.
```

### A2 — `addDuration` / `subtractDuration`

**GitHub Issue:** #28

**Title:**

```
A2 Add addDuration, subtractDuration
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap.md`, Story Group A, item A2. Depends on A1 (`parseDuration`/`isValidDuration`).

## Gap
Luxon's `Duration.plus`/`Duration.minus` let you combine two durations. GMT has no equivalent — combine two ISO 8601 duration strings via `Temporal.Duration.add`/`Temporal.Duration.subtract`, returning an ISO duration string.

## Scope
- `addDuration(a: string, b: string): string`
- `subtractDuration(a: string, b: string): string`
- Both return `""` on invalid input (either operand fails `isValidDuration`).

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap.md`. Match the try-catch/sentinel pattern in `plain/calculate/addDate.ts`.

## Definition of done
Same checklist as A1: tests, JSDoc, exports, README/changeset, lint/test pass.
```

### A3 — `normalizeDuration`

**GitHub Issue:** #29

**Title:**

```
A3 Add normalizeDuration to roll small units into larger ones
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap.md`, Story Group A, item A3. Depends on A1/A2.

## Gap
Luxon's `Duration.shiftTo`/`Duration.rescale` roll small units into larger ones (e.g. 90 minutes → 1 hour 30 minutes). GMT has no equivalent — wrap `Temporal.Duration.round`/balance semantics, string-in/string-out.

## Scope
- `normalizeDuration(value: string): string` — re-balance an ISO duration string into its largest-unit representation.
- Decide and document the specific Temporal rounding options used (see Temporal.Duration.round's `relativeTo`, `largestUnit`, `smallestUnit` — note some rebalancing requires a `relativeTo` reference point for calendar units like months; document this constraint clearly in the JSDoc).

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap.md`.

## Definition of done
Same checklist as A1, plus explicit test cases for the `relativeTo` requirement / calendar-unit edge cases.
```

### A4 — `formatDuration`

**GitHub Issue:** #30

**Title:**

```
A4 Add formatDuration human readable duration formatting
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap.md`, Story Group A, item A4. Depends on A1.

## Gap
Luxon's `Duration.toHuman` humanizes a duration standalone (not relative to "now" — GMT's existing `formatRelative*` family is anchored to now). GMT has no way to render "2 hours, 30 minutes" from a duration value directly.

## Scope
- `formatDuration(value: string, locale: string, options?: ...): string` — render an ISO duration string via `Intl.DurationFormat` where available.
- Investigate `Intl.DurationFormat` runtime support; document a fallback plan if support is thin (per `context/project-overview.md`'s notes on ICU/runtime variance).
- Full locale matrix required per `context/testing-standards.md` (17 locales), with `hasFullIcu` ternaries where output differs.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap.md". Look at `formatRelativeDate.ts` for the locale-handling and `hasFullIcu` pattern to mirror.

## Definition of done
Same checklist as A1, plus full 17-locale test matrix.
```

### A5 — Duration bridge for `diff*` functions

**GitHub Issue:** #31

**Title:**

```
A5 Add optional ISO duration return to diffDate diffDateTime diffZoned diffUnix diffUtc
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap.md`, Story Group A, item A5. Depends on A1–A3.

## Gap
GMT's `diff*` functions return a single-unit number. There's no way to get a full breakdown (e.g. "2 days, 3 hours") as Luxon's `Duration` allows. Add an additive, non-breaking way for these functions to optionally return an ISO 8601 duration string instead of/alongside a single-unit number.

## Scope
- Decide at implementation time (per roadmap note): either an optional return-shape parameter on existing `diff*` functions, or new sibling functions (e.g. `diffDateAsDuration`). Document the decision and rationale in the PR description.
- Cover all five: `diffDate`, `diffDateTime`, `diffZoned`, `diffUnix`, `diffUtc`.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap.md`. This is the largest story in Group A — confirm the API-shape decision doesn't conflict with `context/coding-standards.md`'s string-in/string-out contract before writing code.

## Definition of done
Same checklist as A1, applied across all five touched functions.
```

### B1 — `isValidInterval`

**GitHub Issue:** #32

**Title:**

```
B1 Add isValidInterval
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap.md`, Story Group B, item B1. Foundation for B2–B6.

## Gap
Luxon's `Interval` class validates start/end pairs. GMT has no interval/range type at all — only scalar `isBetween*` checks (`plain/compare/isBetweenDate.ts` etc.).

## Scope
- `isValidInterval(start: string, end: string): boolean` — validate that both are parseable and `start <= end`.
- New `src/interval/` namespace (plain, ISO datetime strings first — zoned intervals are a later story per the roadmap note under Group B).

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap.md`. Nearest analog: `plain/validate/isValidDateRange.ts` — check whether it already covers this before building new.

## Definition of done
Tests, JSDoc, exports, README/changeset, lint/test pass — per `context/coding-standards.md` / `context/testing-standards.md` / `context/jsdoc-standards.md`.
```

### B2 — `intervalContains`

**GitHub Issue:** #33

**Title:**

```
B2 Add intervalContains
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap.md`, Story Group B, item B2. Depends on B1.

## Gap
Luxon's `Interval.contains` checks whether a point or another interval falls fully within an interval. GMT has no equivalent.

## Scope
- `intervalContains(intervalStart: string, intervalEnd: string, pointOrStart: string, pointEnd?: string): boolean` — exact signature to be finalized at implementation time; support both point-in-interval and interval-fully-contains-interval checks (confirm with existing `isBetweenDate` signature conventions for consistency).

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap.md`.

## Definition of done
Tests (boundary-inclusive/exclusive cases explicitly covered), JSDoc, exports, README/changeset, lint/test pass.
```

### B3 — `intervalsOverlap`

**GitHub Issue:** #34

**Title:**

```
B3 Add intervalsOverlap
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap.md`, Story Group B, item B3. Depends on B1.

## Gap
Luxon's `Interval.overlaps` checks whether two intervals share any time. GMT has no equivalent.

## Scope
- `intervalsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean`

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap.md`.

## Definition of done
Tests (adjacent-but-not-overlapping, fully-contained, partial-overlap cases), JSDoc, exports, README/changeset, lint/test pass.
```

### B4 — `intervalIntersection`

**GitHub Issue:** #35

**Title:**

```
B4 Add intervalIntersection
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap.md`, Story Group B, item B4. Depends on B1, B3.

## Gap
Luxon's `Interval.intersection` returns the overlapping sub-interval of two intervals. GMT has no equivalent.

## Scope
- `intervalIntersection(aStart: string, aEnd: string, bStart: string, bEnd: string): { start: string; end: string } | null` — exact return shape to be finalized (note: GMT's sentinel convention doesn't define a standard for object-returning functions — establish and document one here since B5/B6 will follow the same pattern).

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap.md`.

## Definition of done
Tests (no-overlap → null, full-overlap, partial-overlap), JSDoc, exports, README/changeset, lint/test pass.
```

### B5 — `intervalUnion`

**GitHub Issue:** #36

**Title:**

```
B5 Add intervalUnion
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap.md`, Story Group B, item B5. Depends on B1, B4 (reuse the object-return convention established there).

## Gap
Luxon's `Interval.union` returns the combined span of two overlapping/adjacent intervals. GMT has no equivalent.

## Scope
- `intervalUnion(aStart: string, aEnd: string, bStart: string, bEnd: string): { start: string; end: string } | null` — decide and document behavior for non-overlapping, non-adjacent intervals (null, or throw-then-catch-to-sentinel per `context/coding-standards.md`).

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap.md`.

## Definition of done
Tests, JSDoc, exports, README/changeset, lint/test pass.
```

### B6 — `splitIntervalByUnit`

**GitHub Issue:** #37

**Title:**

```
B6 Add splitIntervalByUnit
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap.md`, Story Group B, item B6. Depends on B1, and benefits from Duration (Story Group A) existing first per the suggested sequencing.

## Gap
Luxon's `Interval.splitBy`/`divideEqually` divide an interval into sub-intervals by a duration unit (e.g. weekly billing periods). GMT's `mapDatesInRange` maps over dates in a range but isn't interval-typed and doesn't split by arbitrary duration.

## Scope
- `splitIntervalByUnit(start: string, end: string, unit: DateTimeDurationUnit, amount: number): Array<{ start: string; end: string }>` — return `[]` on invalid input.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap.md`. Nearest analog: `plain/map/mapDatesInRange.ts`.

## Definition of done
Tests (exact division, remainder/partial-final-interval handling), JSDoc, exports, README/changeset, lint/test pass.
```

### C1 — `convertPlainDateTimeToZoned` disambiguation

**GitHub Issue:** #38

**Title:**

```
C1 Add disambiguation parameter to convertPlainDateTimeToZoned
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap.md`, Story Group C, item C1. First story in the recommended sequencing — smallest, no new namespace.

## Gap
`convertPlainDateTimeToZoned` (src/zoned/convert/convertPlainDateTimeToZoned.ts) silently uses Temporal's default `"compatible"` resolution for DST gaps/overlaps, with no way for callers to opt into `"earlier"`, `"later"`, or `"reject"`. This is a known bug-report source in Luxon's tracker; react-aria exposes this explicitly via `toZoned`/`toDate`.

## Scope
- Add optional `disambiguation?: 'compatible' | 'earlier' | 'later' | 'reject'` parameter, defaulting to `'compatible'` (matches current behavior — non-breaking).
- Thread through to `Temporal.ZonedDateTime.from(..., { disambiguation })`.
- Write explicit DST gap/overlap test cases: spring-forward gap and fall-back overlap, for at least 2-3 timezones, per `context/testing-standards.md`'s locale-matrix approach.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap.md`. Read the current implementation at `packages/gmt/src/zoned/convert/convertPlainDateTimeToZoned.ts` first.

## Definition of done
Tests covering all four disambiguation values across DST gap and overlap scenarios, JSDoc updated with `@example` for the new parameter, README/changeset updated, lint/test pass.
```

### C2 — `addZoned` / `subtractZoned` disambiguation

**GitHub Issue:** #39

**Status: Done.** `Temporal.ZonedDateTime.prototype.add()`/`.subtract()` accept only `ArithmeticOptions` (`{ overflow?: 'constrain' | 'reject' }`) — confirmed there is no `disambiguation` field on these methods, in the spec or the `@js-temporal/polyfill` type declarations, and empirically (passing `{ disambiguation: "reject" }` to `.add()` is silently ignored). Checked how Luxon, react-aria, and date-fns handle this (context7, 2026-08-07): none expose disambiguation control on arithmetic — Luxon's docs call ambiguous-time behavior during `.plus`/`.minus` explicitly undefined, react-aria only exposes it on construction. Rather than settle for docs-only or a detector function, implemented a working `disambiguation` parameter on `addZoned`/`subtractZoned` via a rebuild technique: after `.add()`/`.subtract()`, if `disambiguation !== "compatible"`, drop the result's offset and reconstruct via `Temporal.ZonedDateTime.from(plainDateTimeString + "[timeZone]", { disambiguation })`, which genuinely forces re-resolution. This works for **fall-back overlaps** (the arithmetic result lands on an ambiguous local time) but has **no effect on spring-forward gaps** (Temporal's arithmetic already resolves gap landings unambiguously before disambiguation is evaluated) — documented explicitly in JSDoc, tested, and covered in `docs/dst-disambiguation.md`.

**Title:**

```
C2 Add disambiguation parameter to addZoned, subtractZoned
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap.md`, Story Group C, item C2. Depends on C1 establishing the pattern.

## Gap
Originally: same as C1, but for arithmetic that crosses a DST boundary. `addZoned` (src/zoned/calculate/addZoned.ts) and `subtractZoned` currently have no caller-facing DST disambiguation control.

## IMPORTANT — re-verify this first
Before writing any code, re-confirm (via `find-docs`/context7 against `/js-temporal/temporal-polyfill`, and an empirical test against the installed polyfill) whether `Temporal.ZonedDateTime.prototype.add()`/`.subtract()` accept a `disambiguation` option. As of 2026-08-07 they do not — `ArithmeticOptions` only has `overflow`, and arithmetic always resolves ambiguity as `'compatible'` per spec, with no override. If this is still true, **do not implement `disambiguation` on `addZoned`/`subtractZoned` as originally scoped** — there is no Temporal API surface to thread it through to.

## Scope (pending the re-verification above)
If Temporal still has no `disambiguation` option on arithmetic, choose one of:
- (a) Close this story as infeasible upstream, noting the spec limitation, and skip straight to C3.
- (b) Re-scope to a documentation-only fix: add a JSDoc note on `addZoned`/`subtractZoned` explaining that arithmetic across a DST gap/overlap always resolves as `'compatible'` with no override, so callers aren't surprised.
- (c) Re-scope to a new, different function — e.g. a boolean check like `doesZonedArithmeticCrossDstBoundary(value, units)` — that lets callers detect the ambiguity case and react (e.g. reject the operation themselves), since Temporal gives no resolution lever to pull.
Do not force a `disambiguation` parameter onto `addZoned`/`subtractZoned` that silently has no effect — that would be worse than not having the parameter at all (a false promise of control).

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap.md`.

## Definition of done
Depends on which path (a/b/c) is chosen above — document the decision and rationale in the PR description either way.
```

### C3 — Audit remaining zoned functions for disambiguation

**GitHub Issue:** #40

**Status: scope expanded.** A full-codebase audit (2026-08-07) confirmed `disambiguation` is only meaningful for `Temporal.ZonedDateTime.prototype.with()` calls against a real (non-UTC) IANA timezone — confirmed empirically that `.with()`, unlike `.add()`/`.subtract()` (see C2), does respect `disambiguation` (`{ disambiguation: "reject" }` correctly throws when `.with()` would land in a gap). The audit found **9 functions** with this exact pattern and no disambiguation control, **4 of which are outside** the directories the story originally named (`zoned/convert/*`, `zoned/calculate/*`) — see the full list below. Scope this story to all 9, not just the two named directories.

**Title:**

```
C3 Audit zoned calculate, zoned map, and unix calculate for remaining disambiguation gaps
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap.md`, Story Group C, item C3. Depends on C1 establishing the pattern (C2 landed as a partial `disambiguation` story for `addZoned`/`subtractZoned` via a different mechanism — see C2's status note — but this story's `.with()`-based pattern still traces back to C1, not C2).

## Gap
C1 added explicit DST disambiguation control to `convertPlainDateTimeToZoned`. A full-codebase audit found the same implicit-disambiguation gap in every function that calls `Temporal.ZonedDateTime.prototype.with()` to jump to a unit/quarter boundary against a real (non-UTC) IANA timezone:

- `packages/gmt/src/zoned/calculate/startOfZoned.ts`
- `packages/gmt/src/zoned/calculate/endOfZoned.ts`
- `packages/gmt/src/zoned/calculate/startOfQuarterForZoned.ts`
- `packages/gmt/src/zoned/calculate/endOfQuarterForZoned.ts`
- `packages/gmt/src/zoned/map/mapZonedHoursInDay.ts` (the midnight anchor `.with({ hour: 0, ... })`)
- `packages/gmt/src/unix/calculate/startOfUnix.ts` — NOT under `zoned/`, derives a ZonedDateTime via `instant.toZonedDateTimeISO(timeZone)` then applies the same unhandled `.with()` pattern
- `packages/gmt/src/unix/calculate/endOfUnix.ts` — same as above
- `packages/gmt/src/unix/calculate/startOfQuarterForUnix.ts` — same as above
- `packages/gmt/src/unix/calculate/endOfQuarterForUnix.ts` — same as above

Explicitly NOT in scope (verified not real gaps, do not touch):
- `packages/gmt/src/utc/calculate/startOfUtc.ts`/`endOfUtc.ts`/`startOfQuarterForUtc.ts`/`endOfQuarterForUtc.ts` — same `.with()` shape but timezone is hardcoded to `"UTC"`, which has no DST transitions; the option would be a permanent no-op.
- `packages/gmt/src/zoned/validate/isValidTimeZone.ts` — combines plain fields + timeZone but only to probe a fixed non-DST date (`2020-02-28`); disambiguation behavior doesn't affect its correctness.
- `addZoned`/`subtractZoned` — out of scope for this story; C2 already added `disambiguation` to both via a different mechanism (rebuild-through-`.from()`, not a direct `.with()` call), since Temporal's `.add()`/`.subtract()` have no `disambiguation` option at all.

## Scope
- Re-verify the 9-function list above is still accurate (`grep -rn '\.with(' packages/gmt/src/zoned packages/gmt/src/unix` and check each call site's timezone is a real IANA zone, not hardcoded UTC) before starting — library surfaces and this audit's findings could both have moved.
- Extend each of the 9 functions with the same optional `disambiguation` parameter and `'compatible'` default established in C1.
- Note these functions have a `switch (unit)` with multiple `.with()` call sites per function (e.g. `startOfZoned.ts` has 6+ separate `.with()` calls, one per unit case) — the `disambiguation` option must be threaded into all of them, not just the first.
- One PR covering all 9 call sites (still one PR per the roadmap's original intent — it's mechanical repetition of an established pattern once C1's shape is set).

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap.md`. Confirm C1 has landed first — this story's pattern depends on its exact parameter shape and JSDoc format. C2 has landed too (see its status note) but via a different mechanism (`.with()`-rebuild after arithmetic, not a direct `.with()` call) — this story's 9 functions call `.with()` directly, so they follow C1's pattern one-for-one, not C2's.

## Definition of done
Every touched function (all 9) has matching tests to C1's gap/overlap pattern, JSDoc updated, README/changeset updated, lint/test pass.
```

### D1 — `isWeekend` / `isZonedWeekend`

**GitHub Issue:** #41

**Title:**

```
D1 Add isWeekend plain and isZonedWeekend
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap.md`, Story Group D, item D1.

## Gap
react-aria's `isWeekend(date, locale)` checks whether a date falls on a weekend according to locale (e.g. en-US: Sat/Sun, he-IL: Fri/Sat). GMT has no locale-aware weekend check at all.

## Scope
- `isWeekend(value: string, locale: string): boolean` (plain, operates on a plain date string).
- `isZonedWeekend(value: string, locale: string): boolean` (zoned equivalent).
- Use `Intl.Locale` weekend data (`weekInfo`) where available; document and test the fallback behavior where a runtime doesn't expose it (see `context/project-overview.md`'s ICU/runtime variance notes and `hasFullIcu` pattern).

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap.md`. This is additive — do not modify the existing ISO-only `getDayOfWeek`.

## Definition of done
Full 17-locale test matrix per `context/testing-standards.md` (weekend days differ meaningfully across at least en-US, fr-FR, he-IL, ar-SA — make sure the matrix actually exercises the locale-dependent branches, not just default English), JSDoc, exports, README/changeset, lint/test pass.
```

### D2 — `getLocaleStartOfWeek` / `getLocaleEndOfWeek`

**GitHub Issue:** #42

**Title:**

```
D2 Add getLocaleStartOfWeek, getLocaleEndOfWeek plain and zoned
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap.md`, Story Group D, item D2.

## Gap
react-aria's `startOfWeek(date, locale)`/`endOfWeek(date, locale)` compute week boundaries relative to the locale's first day of week (en-US: Sunday, fr-FR: Monday). GMT's existing `startOfDate`/`endOfDate` family is ISO-Monday-only, no locale parameter.

## Scope
- `getLocaleStartOfWeek(value: string, locale: string): string` / `getLocaleEndOfWeek(value: string, locale: string): string` (plain).
- Zoned equivalents.
- Additive alongside the existing ISO-only functions — do not replace them.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap.md`. Nearest analog: `plain/calculate/startOfDate.ts` / `endOfDate.ts`.

## Definition of done
Full 17-locale test matrix (must include locales with non-Monday week starts), JSDoc, exports, README/changeset, lint/test pass.
```

### D3 — `getLocaleDayOfWeek`

**GitHub Issue:** #43

**Title:**

```
D3 Add getLocaleDayOfWeek plain and zoned
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap.md`, Story Group D, item D3.

## Gap
react-aria's `getDayOfWeek(date, locale)` returns a day-of-week index relative to the locale's first day (0 = locale's first day), distinct from GMT's existing ISO-fixed `getDayOfWeek`.

## Scope
- `getLocaleDayOfWeek(value: string, locale: string): number | null` (plain), returning `null` on invalid input per GMT's number-return sentinel convention.
- Zoned equivalent.
- Additive alongside the existing `getDayOfWeek` — do not replace it, and pick a name that avoids confusion with the existing ISO version (confirm naming during spec expansion).

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap.md`. Nearest analog: `plain/get/getDayOfWeek.ts`.

## Definition of done
Full 17-locale test matrix, JSDoc, exports, README/changeset, lint/test pass.
```

### E1 — Non-Gregorian calendar system support (stretch, unscheduled)

**GitHub Issue:** #44

**Title:**

```
E1 Stretch Non-Gregorian calendar system support
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap.md`, Story Group E, item E1. Explicitly unscheduled — do not pick this up without confirming priority first.

## Gap
react-aria's `@internationalized/date` supports multiple calendar systems (Buddhist, Hebrew, Islamic, Japanese, etc.) via `toCalendar`. GMT is Gregorian-only.

## Scope
Not yet specced — large surface, narrow demand per the roadmap's explicit scoping decision. If picked up, start by re-confirming this is still wanted before writing a spec, since it was deliberately deferred.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap.md`.
```
