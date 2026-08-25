### E1 — Calendar system foundation (`GregorianCalendar` + `HebrewCalendar`)

**GitHub Issue:** #44

**Title:**

```
E1 Add calendar-system foundation: CalendarSystem type, toGmtCalendar conversion, Hebrew calendar
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group E, item E1. Re-scoped from the original one-line "non-Gregorian calendar system support" placeholder — see roadmap Context section for why. Foundation for E2–E5; do not start E2–E4 before this lands, since they depend on the `CalendarSystem` shape this establishes.

## Why this exists now
Originally deferred as "large surface, narrow demand." Re-scoped, not un-deferred for demand reasons: the goal changed from "match react-aria's `toCalendar` because react-aria has it" to "calendar-system arithmetic is a real, UI-independent library-completeness gap versus `@internationalized/date`," which is the calendar library GMT is benchmarked against. Confirmed via context7 (2026-08-12):
- `@internationalized/date`'s calendars (`HebrewCalendar`, `IslamicCalendar`, `JapaneseCalendar`, etc.) are pure arithmetic — leap-year formulas, era offsets, tabular epoch math. No data tables, no ICU dependency, no meaningful bundle weight per calendar. This derisks the whole group: it's math to port, not data to ship.
- Luxon's calendar support (`outputCalendar`) is **display-only** — it reformats via `Intl` but does all internal arithmetic in Gregorian. Not a real competitor on this axis.
- date-fns and Moment.js have no calendar-system support at all (locale month/day *names* only).
- `temporal-kit`'s comparison table claims calendar-system support, but it's a pass-through: native `Temporal.PlainDate` accepts a `calendarId`, and temporal-kit doesn't block that — it hasn't built any calendar-system logic of its own. Not a real competitive threat on this axis either.

This means `@internationalized/date` is the only real bar to clear here, and GMT can clear it without new runtime dependencies.

**Explicitly not a UI story.** Grid generation, range-selection helpers, and other picker-primitive concerns are out of scope for the entire E group — deferred to whenever a `gmt-react`/`gmt-svelte`/etc. UI-primitives package is actually started. E1–E5 are pure calendar-arithmetic additions to the existing string-in/string-out namespaces, nothing UI-shaped.

## Scope
1. **`CalendarSystem` type** — a shared union/string-literal type at `packages/gmt/src/types/calendar-system.ts` (mirroring how `Disambiguation`/`Offset`/`Overflow` were extracted as shared types for prior groups) enumerating supported calendar identifiers. E1 seeds it with `"gregorian"` and `"hebrew"` only; E2–E4 extend the same type as they land — do not pre-declare identifiers for calendars not yet implemented.
2. **Conversion functions** — the `toCalendar` equivalent. `convertDateToCalendar(value: string, calendar: CalendarSystem): string` (plain) at minimum, returning the same date expressed in the target calendar system as an ISO-ish string (exact output string shape — e.g. how a Hebrew year like 5781 round-trips through GMT's string contract — must be decided during spec expansion; this is the single trickiest design decision in the whole group since GMT's contract assumes Gregorian-shaped ISO strings today).
3. **Hebrew calendar arithmetic** — ported from `@internationalized/date`'s `HebrewCalendar.ts`: leap-year determination (7 leap years per 19-year Metonic cycle), variable month count (12 or 13 depending on leap year, extra month inserted at month 6), month-length rules. Chosen as the second calendar (after Gregorian) specifically because it's the most structurally demanding case (leap months, not just a leap *day*) — proving GMT's shape against Hebrew first means E2–E4's simpler calendars are strictly easier follow-ons, not new unknowns.
4. Era support is **not** required for Hebrew (it has none in practice for this purpose) but the type/function shapes established here must accommodate era-based calendars, since E3 (Japanese) needs it immediately after.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Re-verify against `@internationalized/date`'s current `HebrewCalendar.ts` source (not just its docs) via context7/WebFetch before implementing — port the arithmetic, not just the shape. Decide and document the string round-trip format before writing tests, since every other E-group story inherits this decision.

## Definition of done
Tests: leap-year/non-leap-year conversion round-trips, all 12/13 month boundaries, epoch-adjacent dates, invalid input sentinel returns. JSDoc with `@example`. New `calendar-system.ts` shared type. `packages/gmt/README.md` update documenting the new calendar-system concept (likely warrants its own README section, not just a function list entry, given this is a new domain concept for the library). Changeset. Lint/test pass per `context/coding-standards.md` / `context/testing-standards/index.md` / `context/jsdoc-standards.md`.
```

### E2 — Islamic calendar family (Civil, Tabular, Umm al-Qura)

**GitHub Issue:** Issue #75

**Title:**

```
E2 Add Islamic calendar family: civil, tabular, and Umm al-Qura variants
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group E, item E2. Depends on E1 (`CalendarSystem` type, conversion function shape).

## Gap
`@internationalized/date` exports three distinct Islamic calendar variants — `IslamicCivilCalendar`, `IslamicTabularCalendar`, `IslamicUmalquraCalendar` — confirmed via its `src/calendars/IslamicCalendar.ts`. These are not interchangeable: they differ in epoch alignment and leap-year rule (civil vs. tabular use different leap-year cycles; Umm al-Qura is a tabulated lookup calendar used for the Saudi civil calendar, based on Umm al-Qura University's own published tables rather than a pure arithmetic rule). GMT has none of them.

## Scope
Extend `CalendarSystem` with `"islamic-civil"`, `"islamic-tabular"`, `"islamic-umalqura"`. Each is a full calendar implementation (12 lunar months, 354/355-day years, era-free) plugged into E1's `convertDateToCalendar` and any other E1-established entry points.

**Umm al-Qura needs a scoping decision before implementation**: `@internationalized/date` embeds a lookup table for it (it is not a pure formula, unlike civil/tabular). Confirm during spec expansion whether GMT ports that table verbatim (bundle-size-cheap — it's still just data, not a new dependency) or whether Umm al-Qura is descoped to a follow-up/dropped if the table proves impractical to port cleanly. Do not silently approximate it with the tabular variant's math — they produce different results and that would be a correctness bug, not a simplification.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Port arithmetic from `@internationalized/date`'s `IslamicCalendar.ts` source directly (via WebFetch/context7), same approach as E1's Hebrew port.

## Definition of done
Tests per variant (leap-year cycles, epoch-adjacent dates, and for Umm al-Qura specifically — table-boundary dates), JSDoc, `CalendarSystem` type extended, README update, changeset, lint/test pass.
```

### E3 — Era-based solar calendars (Japanese, Buddhist, Taiwan, Persian, Indian)

**GitHub Issue:** Issue #76

**Title:**

```
E3 Add era-based solar calendars: Japanese, Buddhist, Taiwan, Persian, Indian
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group E, item E3. Depends on E1.

## Gap
`@internationalized/date` supports five calendars in this family, confirmed via its `src/calendars/` source: `JapaneseCalendar`, `BuddhistCalendar`, `TaiwanCalendar`, `PersianCalendar`, `IndianCalendar`. Grouped into one story because — unlike Hebrew (E1) or Islamic (E2) — these are comparatively thin: each is Gregorian-shaped in month/day structure (or a simple fixed-offset solar calendar, for Persian/Indian) with a different year-numbering/era scheme layered on top, not new leap-year logic. This is the reason E1 deliberately proved the harder Hebrew case first — these should be materially less work per-calendar than E1 was.

## Scope
Extend `CalendarSystem` with `"japanese"`, `"buddhist"`, `"taiwan"`, `"persian"`, `"indian"`.
- **Japanese**: era-based (year resets to 1 at each imperial era change). Confirmed via react-aria docs: eras before 1868 (Gregorian) are **not** supported even by `@internationalized/date` — match that same explicit limitation rather than attempting pre-Meiji eras, and document it as a known/intentional gap, not a bug.
- **Buddhist**: Gregorian day/month structure, year offset (+543).
- **Taiwan**: Gregorian day/month structure, year offset relative to 1912.
- **Persian**: distinct solar calendar (not Gregorian-derived), own leap-year rule — verify exact rule against `@internationalized/date`'s `PersianCalendar.ts` source rather than assuming it's offset-only like Buddhist/Taiwan.
- **Indian**: the Indian National Calendar (Saka era), own leap-year alignment to the Gregorian calendar — verify against source, do not assume simple offset.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Port each from its corresponding `@internationalized/date` source file. Confirm which of the five are genuinely offset-only (cheap) versus which have independent leap-year math (Persian, Indian) before scoping this as "small" — the story may split into two PRs (offset-only trio vs. Persian/Indian) if the latter two turn out non-trivial; use judgment at spec-expansion time per the standard "expand the one-line story into a full spec before writing code" step.

## Definition of done
Tests per calendar (era boundaries for Japanese specifically, leap-year cases for Persian/Indian, offset correctness for Buddhist/Taiwan), JSDoc, `CalendarSystem` type extended, README update, changeset, lint/test pass.
```

### E4 — Ethiopic calendar family (Ethiopic, Ethiopic Amete Alem, Coptic)

**GitHub Issue:** Issue #77

**Title:**

```
E4 Add Ethiopic calendar family: Ethiopic, Ethiopic Amete Alem, Coptic
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group E, item E4. Depends on E1.

## Gap
`@internationalized/date` exports `EthiopicCalendar`, `EthiopicAmeteAlemCalendar`, and `CopticCalendar` from a single shared source file (`src/calendars/EthiopicCalendar.ts`), confirmed via its GitHub source — these three share the same 13-month structure (12 months of 30 days + a short 5/6-day 13th month) and are naturally grouped, mirroring how `@internationalized/date` itself groups them.

## Scope
Extend `CalendarSystem` with `"ethiopic"`, `"ethiopic-amete-alem"`, `"coptic"`. Port the shared 13-month arithmetic once, parameterized by each variant's era/epoch difference (Amete Alem uses a different era epoch than standard Ethiopic; Coptic shares the structure but has its own epoch) — matching the source's own single-file/shared-base approach rather than three independent implementations.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Port from `@internationalized/date`'s `EthiopicCalendar.ts` directly.

## Definition of done
Tests per variant (13th-month boundary dates, leap-year-equivalent short/long 13th month, epoch differences between the three), JSDoc, `CalendarSystem` type extended, README update, changeset, lint/test pass.
```

### E5 — Cross-calendar interval and duration math

**GitHub Issue:** Issue #78

**Title:**

```
E5 Extend interval/duration functions to be calendar-system-aware
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group E, item E5. Depends on E1–E4 (needs calendars to test against) **and** Story Groups A (Duration) and B/G (Interval) being complete (needs the namespaces this extends to exist first).

## Gap
Once E1–E4 land, GMT can represent a date in any supported calendar system — but `intervalContains`/`intervalsOverlap`/`addDate`-equivalents/duration arithmetic (Story Groups A, B, G) were all built and tested Gregorian-only. Calendar-aware arithmetic has real edge cases a Gregorian-only test suite won't catch: a Hebrew leap month shifts what "add 1 month" means; an interval spanning a Japanese era boundary needs to compare correctly even though the year numbering resets mid-interval.

## Scope
Not a new namespace — an audit-and-extend pass over existing Group A/B/G functions to confirm (and fix, where wrong) their behavior when given calendar-system-tagged values from E1–E4. Likely outcomes per function, to be confirmed at spec-expansion time rather than assumed now:
- Functions that only ever compare/diff absolute instants (most of `interval/`) may already work correctly with no changes needed, since calendar system is a display/arithmetic-unit concern, not an ordering concern — verify this rather than assuming either way.
- Functions that do calendar-unit arithmetic (`addDate`-equivalents, `splitIntervalByUnit`, anything using "months"/"years" as a unit) need explicit per-calendar-system handling, since "add 1 month" is calendar-dependent (a Hebrew leap month, a Japanese era-crossing year).

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. This story's actual scope depends heavily on what E1–E4 decided for the string round-trip format — re-read those stories' outcomes (not just this spec) before starting.

## Definition of done
Per-function audit findings documented (even the "no change needed, verified why" cases — don't skip documenting negatives), tests for calendar-boundary-crossing cases (leap month, era transition) on whichever functions needed fixes, README update, changeset, lint/test pass.
```

## E5 outcome — decisions of record and per-function audit (landed)

E5 shipped as one PR (issue #78, no version bump — Group E's release is cut after E6). This section is the permanent record the story's "even the no-change-needed cases" definition of done requires. Settled decisions must not be re-opened; a future audit should read this section before re-filing anything here as a gap.

### Decisions of record

**D1 — Calendar-string input contract: Option 4.** GMT's native-digit calendar-annotated shape (`"5785-01-01[u-ca=hebrew]"`, as `convertDateToCalendar` produces) is the only accepted calendar-tagged input, and it is accepted **only** by `plain/` `PlainDate` functions. Temporal's own ISO-digit `[u-ca=...]` shape (`"2024-10-03[u-ca=hebrew]"`) is not a GMT input contract — the two shapes are not distinguishable by inspection and treating both as valid would make one string mean two different dates depending on which function received it (verified: `convertDateToCalendar("2024-10-03[u-ca=hebrew]", "gregorian")` returned `"-001736-06-02"` pre-E5, while `zoned/`/`duration/` read the identical string as `2024-10-03`). `zoned/`, `utc/`, `unix/` reject all `[u-ca=...]` annotations outright. `duration/`'s `relativeTo` accepts the GMT shape only (via the new `internal/resolveDurationRelativeTo.ts`).

**D2 — `zoned/`'s accidental calendar-awareness: removed.** `isValidZonedDateTime` was not regex-gated before E5, so `Temporal.ZonedDateTime.from` silently accepted a `[u-ca=...]` annotation and every zoned function did genuinely calendar-aware — but undocumented, untested — arithmetic (verified: `addZoned` on a Hebrew-annotated value returned a date one day different from the ISO answer). This is now rejected outright via the new `internal/hasCalendarAnnotation.ts` guard, applied at `isValidZonedDateTime`, `isValidZonedInterval`, and the 9 `zoned/interval/*` functions that rolled their own `isLeapSecond`-based gate rather than delegating to either validator. This knowingly removes working, correct behavior; the justification is contract coherence with D1. **Filed as a follow-up story, E7** (spec at the end of this file) — so the capability is deferred, not lost.

**D10 — Story size: one PR.** Shipped as a single change under issue #78, per `overview.md`'s "one story = one PR." The internal execution order (duration fix → zoned removal → plain gate-opening) is preserved in the diff for reviewability but is not a PR boundary.

**Release: no version bump with this story.** A `.changeset/*.md` entry is included (per `tracker.md`'s rule that the per-PR label is independent of release timing) but `changeset:version` was not run. Group E's release is cut after E6.

**D4 — Mixed-calendar interval endpoints, split by return type.** Boolean/number-returning ordering functions (`intervalContains*`, `intervalsOverlap*`, `intervalAbuts*`, `intervalEngulfs*`, `isValidDateInterval`, `intervalOverlappingDaysDate`) **accept** mixed calendars — ordering and day-counting are calendar-independent (`Temporal.PlainDate.compare` ignores calendar; verified). Value-returning functions (`intervalUnionDate`, `intervalIntersectionDate`, `intervalDifferenceDate`, `intervalXorDate`, `intervalXorAllDate`, `mergeIntervalsDate`, `intervalDivideEquallyDate`, `intervalSplitAtDate`) **reject** a mismatch (return the type's sentinel) — there is no principled way to pick an output calendar for a *value* the caller reads back as a date. Implemented via `internal/calendarValueOfDate.ts`'s `calendarOfAllDateValues`.

**D5 — Calendar-unit measurement: shared calendar, or Gregorian fallback.** `diffDate`, `diffDateAsDuration`, `intervalCountDate`, `intervalLengthDate`, `splitIntervalByUnitDate` measure/step in the endpoints' shared calendar when both carry the same tag (a Hebrew leap year crosses 13 month boundaries and 1 year boundary, not 12/2 — verified), and fall back to Gregorian when the tags mismatch or either endpoint is bare ISO. Implemented via `internal/calendarDatePairPolicy.ts`'s `parseCalendarDatePairForArithmetic`. Distinct from D4's reject policy: ordering/duration math stays well-defined across a mismatch, unlike a value-returning function's output calendar.

**D6 — `splitIntervalByUnit` months on calendar boundaries: yes, already did.** `splitIntervalByUnitDate` steps via `current.add({ [unit]: amount })`, which was already calendar-aware for free once the value carries a calendar (verified: a Hebrew leap year splits into 13 month-slices, not 12). Only the input gate and output formatting needed to change.

**D7 — Calendar tag survives arithmetic: re-derived, never copied.** Every calendar-aware output goes through `internal/formatDateInCalendar.ts`, which re-reads the actual result's fields on each call (this was already how `formatCalendarDate`/`formatEthiopicFamilyDate` worked from E1/E4 — E5 didn't need to change it, only route every new call site through it). Necessary because arithmetic can cross a leap-month or era boundary mid-operation: Japanese Heisei 31-04-30 `+ 1 day` re-derives to Reiwa 1-05-01, not a copied Heisei tag on a date that no longer exists in that era.

**D8 — `overflow` semantics: unchanged, documented asymmetry.** `overflow: "reject"` does not throw uniformly across calendars — verified it throws for `ethioaa 7515-12-30 + 1 month` (`Day 30 does not exist in resulting calendar month`) but does **not** throw for Hebrew `Adar I 15, 5784 + 1 year` (Temporal silently remaps `M05L`/Adar I to `M06`/Adar in the non-leap target year instead of rejecting). Both are Temporal's own behavior; E5 documents the asymmetry in JSDoc rather than papering over it.

**D9 — Business-day functions reject calendar tags.** `addBusinessDays`/`subtractBusinessDays`/`addZonedBusinessDays`/`subtractZonedBusinessDays` reject annotations (the zoned pair via D2's gate; the plain pair was never in scope to open, since `dayOfWeek` is ISO-fixed identically in every supported calendar — verified — so a calendar tag would change nothing about the answer while implying it might).

### Unanticipated findings (discovered during implementation, not in the original architect plan)

1. **Pre-existing bug in `internal/calendarDateString.ts`'s `parseCalendarDateValue` (E1-era code), fixed as part of E5.** The non-annotated fallback branch called `Temporal.PlainDate.from(value)` directly with no shape pre-check. `Temporal.PlainDate.from` silently *truncates* a full datetime/zoned string to its date portion rather than rejecting it (`Temporal.PlainDate.from("2024-03-10T14:30:00")` succeeds, discarding the time) — so `isValidCalendarDate("2024-03-10T14:30:00")` and `convertDateToCalendar("2024-03-10T14:30:00", "hebrew")` both silently accepted datetime input before this fix. Fixed by requiring the strict `plainDate` regex shape before the fallback's `Temporal.PlainDate.from` call. This predates E5 but had to be fixed as part of it, since `parseCalendarDateValue` is E5's own shared parsing gate.
2. **`Temporal.PlainDate.prototype.until` throws across two different calendars even though `.compare` does not.** `hebrewDate.until(isoDate, {...})` throws `RangeError: cannot compute difference between dates of hebrew and iso8601 calendars`. This bit `intervalOverlappingDaysDate` specifically (a D4-"accept mixed calendars" function that determines its span via `.compare` then previously called `.until` on the result) — fixed by normalizing both operands to `iso8601` immediately before the `.until` call. Every other function that needed cross-calendar arithmetic used `parseCalendarDatePairForArithmetic`/`calendarOfAllDateValues`, which already avoid this by construction.
3. **The `.equals()` calendar-sensitivity trap resolved itself once D1 and D4 were enforced — no dedicated `.equals()`→`.compare()` patch was needed.** The original architect plan flagged 13 at-risk `.equals()` call sites (coincident-point dedup in `intervalXorAll*`/`intervalSplitAt*`/`intervalDivideEqually*`/`intervalCount*`). Verified: `.equals()` is calendar-sensitive *across* calendars but correct *within* one (same-calendar `PlainDate`s compare equal correctly, including after round-trip arithmetic). Since D1 confines calendar-awareness to `plain/` `PlainDate`, and D4 rejects mismatched-calendar inputs to every function that later calls `.equals()`, the cross-calendar scenario that made `.equals()` unsafe is structurally unreachable by the time it runs. No source change was needed at these sites beyond the D4 gate already added for other reasons.

### Follow-up story — E7 (Issue #152)

**Extend `zoned/` with a GMT-shape calendar-annotated zoned string.** D2 removed `zoned/`'s accidental calendar-awareness rather than blessing it, on contract-coherence grounds — but the underlying capability (calendar-aware zoned arithmetic) was real and verified-correct before removal. The full spec is now written up as **E7** at the end of this file: a GMT-native calendar-annotated `ZonedDateTime` string grammar (not a re-acceptance of Temporal's own shape, per D1's reasoning), decisions for how `disambiguation`/`offset` interact with a calendar-tagged value, and the D4/D5/D7 policy questions E5 answered for `plain/`, re-derived for the zoned case. It is its own E-group story — do not fold it into E6.

### Per-function audit table

Legend: **(a)** no change needed (verified, not assumed) · **(b)** calendar-unit arithmetic, gate opened · **(b→a)** was accidentally calendar-aware, now rejects (D2) · **(a, pre-existing gate)** already correctly rejected before E5, unaffected by it.

**`duration/`**

| Function | File | Verdict | Note |
|---|---|---|---|
| `isValidDuration`, `parseDuration` | `duration/validate`, `duration/parse` | (a) | Duration strings carry no calendar. |
| `absDuration`, `negateDuration`, `getDurationSign`, `getDurationUnit` | `duration/calculate` | (a) | Sign/field reads; no `relativeTo`. |
| `addDuration`, `subtractDuration` | `duration/calculate` | (a) | Already return `""` for any calendar-unit operand (no `relativeTo` support in Temporal's own `.add`/`.subtract`); no calendar tag can reach them. |
| `formatDuration` | `duration/format` | (a) | Calendar-independent, verified. |
| `durationAs`, `compareDurations`, `normalizeDuration` | `duration/calculate`, `duration/compare`, `duration/normalize` | **(b)** | `relativeTo` now resolved via `internal/resolveDurationRelativeTo.ts` — live bug fixed (previously silently misread GMT's own calendar-annotated string as ISO digits). |

**`plain/calculate`**

| Function | Verdict | Note |
|---|---|---|
| `addDate`, `subtractDate` | **(b)** | Gate opened via `isValidCalendarDate`/`parseCalendarDateValue`/`formatDateInCalendar`. |
| `diffDate`, `diffDateAsDuration` | **(b)** | Via `parseCalendarDatePairForArithmetic` (D5). |
| `addDateTime`, `subtractDateTime`, `diffDateTime`, `diffDateTimeAsDuration` | (a) | No calendar-annotated `PlainDateTime` grammar exists (D1/D3 scope boundary) — a calendar-annotated `PlainDate` string is simply not a valid `PlainDateTime` string. |
| `addTime`, `subtractTime`, `diffTime` | (a) | `PlainTime` has no calendar. |
| `addBusinessDays`, `subtractBusinessDays` | (a) | D9 — `dayOfWeek` is ISO-fixed in every calendar. |
| `addUnix`, `subtractUnix`, `diffUnix`, `diffUnixAsDuration` | (a) | Numeric epoch input, structurally immune. |
| `addUtc`, `subtractUtc`, `diffUtc`, `diffUtcAsDuration` | (a, pre-existing gate) | `utc/` was already regex-gated to a strict `<date>T<time>Z` shape before E5. |
| `addZoned`, `subtractZoned`, `diffZoned`, `diffZonedAsDuration`, `addZonedBusinessDays`, `subtractZonedBusinessDays` | **(b→a)** | D2 — now reject via `isValidZonedDateTime`. |

**`plain/interval` (18 `*Date` functions + `isValidDateInterval`)**

| Function | Class | Verdict | Note |
|---|---|---|---|
| `intervalAbutsDate`, `intervalContainsDate`, `intervalsOverlapDate`, `intervalEngulfsDate`, `isValidDateInterval` | 1 (ordering) | **(b)** | Gate opened; mixed calendars accepted (D4). |
| `intervalOverlappingDaysDate` | 1 (day count) | **(b)** | Gate opened; mixed calendars accepted; normalizes to iso8601 before `.until()` (unanticipated finding #2). |
| `intervalUnionDate`, `intervalIntersectionDate`, `intervalDifferenceDate`, `intervalXorDate`, `intervalXorAllDate`, `mergeIntervalsDate`, `intervalDivideEquallyDate`, `intervalSplitAtDate` | 2 (value-returning set ops) | **(b)** | Gate opened; mismatched calendars rejected (D4); output tag re-derived (D7). |
| `intervalCountDate`, `intervalLengthDate`, `splitIntervalByUnitDate`, `intervalFromDurationDate` | 3 (calendar-unit arithmetic) | **(b)** | Shared-calendar-or-Gregorian-fallback (D5, except `intervalFromDurationDate` which has only one calendar-tagged input and needs no pair policy). |

**`*DateTime`/`*Time` interval variants (all namespaces)** — (a): no calendar-annotated `PlainDateTime` grammar exists; `PlainTime` has no calendar (precedent: `intervalOverlappingDays*` already had no `Time` sibling for this reason pre-E5).

**`unix/interval/*`, `utc/interval/*`** — (a): numeric epoch (unix) or pre-existing strict regex gate (utc), both unaffected by E5, verified.

**`zoned/interval/*` (17 functions)** — **(b→a)**: all now reject `[u-ca=...]` via `hasCalendarAnnotation`, applied at `isValidZonedDateTime`/`isValidZonedInterval` (covers `intervalFromDurationZoned`, `intervalCountZoned`, `splitIntervalByUnitZoned`, `mergeIntervalsZoned`, `intervalDivideEquallyZoned`, `intervalLengthZoned`, `intervalXorAllZoned`, `intervalSplitAtZoned`) or directly in their own `isLeapSecond`-adjacent guard (`intervalAbutsZoned`, `intervalContainsZoned`, `intervalDifferenceZoned`, `intervalEngulfsZoned`, `intervalIntersectionZoned`, `intervalOverlappingDaysZoned`, `intervalUnionZoned`, `intervalXorZoned`, `intervalsOverlapZoned`).

### E6 — `cycle*` wrap-around field adjustment

**GitHub Issue:** Issue #125

**Title:**

```
E6 Add cycleDate, cycleDateTime, cycleTime, cycleZoned
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group E, item E6. Originally scoped as Story Group J's J2, moved here 2026-08-20 (`issues/J.md` Decision 6) — not because the capability isn't real, but because its own motivation is UI-primitive territory this group already owns, not a "gap users hit on day one" the way the rest of Group J is scoped. **Depends on J1** (Group J, field setters) across groups — builds on the same `.with()` foundation; sequence after J1 lands regardless of when this group is picked up.

## Why this belongs in Group E, not Group J
`overview.md`'s Group E paragraph already states the reasoning this story fits: "future `gmt-react`/`gmt-svelte`/`gmt-solid`/`gmt-octane` packages will need calendar-aware date math, the same role `@internationalized/date` plays under react-aria's own Calendar/DatePicker components... E1–E5 are pure calendar-arithmetic library additions, no UI dependency." `cycle*`'s use case — datepicker segment editing, where pressing Up on a month segment should wrap 12 → 1 without touching the year — is exactly that category, and E1's own framing ("Explicitly not a UI story... deferred to whenever a UI-primitives package is actually started") applies here too: this is a pure library addition, not a reason to start a UI package.

## Gap
`@internationalized/date`'s `cycle(field, amount, options)` adjusts a single field and **wraps** at that field's limits: December + 1 month → January of the *same* year, not January of the next. GMT has no equivalent — `addDate(value, { months: 1 })` carries into the next year, which is correct arithmetic but wrong for the use case.

This is not merely inconvenient to compose from what GMT already has — it is categorically impossible. `add()`'s defining behavior is to overflow into the next larger field, which is exactly what wrap-without-carry must not do. No delta composition, at any degree of cleverness, can express "stay in the same year." This is the kind of GMT-specific impossibility argument `issues/J.md`'s Decision 6 requires a story to lead with, independent of how many comparison libraries happen to have the same shape.

The use case is datepicker segment editing: pressing Up on the month segment should cycle 12 → 1 without silently changing the year the user already set. This is why `@internationalized/date` has it and why react-aria's DateField depends on it.

## Scope
- `cycleDate(value, field, amount, options?): string`
- `cycleDateTime(value, field, amount, options?): string`
- `cycleTime(value, field, amount, options?): string`
- `cycleZoned(value, field, amount, options?): string`

`""` on invalid input. `options.round?: boolean` — round to the nearest increment before cycling, matching `@internationalized/date`'s `CycleOptions`. Zoned variant takes `disambiguation` and `offset` for the same reason Group J's J1 does; carry J1's `offset: 'ignore'` default and its reasoning.

Verify at spec-expansion time whether hour cycling in a 12-hour context needs separate handling from 24-hour, as `@internationalized/date` handles this via a `hourCycle` concern.

## Required inline comments
On the wrap-around boundary arithmetic: what happens at each field's minimum and maximum, and how `round` interacts with the wrap. This is the part a reader cannot infer, and the part most likely to be "simplified" into a bug.

## Common Mistakes entry (required)
`cycle` is not `add`. Cycling December by +1 month stays in the same year; adding 1 month does not. Reaching for `cycleDate` when calendar arithmetic is wanted silently produces dates a year off.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analog: Group J's J1 setters (same `.with()` foundation, same option handling) — read that story's spec even though it's in a different group. Re-verify `@internationalized/date`'s `CycleOptions` semantics via context7.

## Definition of done
Tests: each cyclable field at both its minimum and maximum boundary, in both directions; amounts larger than the field's range (cycling month by +13); negative amounts; `round: true` vs. default on a non-aligned value; day-of-month cycling in a 31-, 30-, and 28/29-day month; `battleTestTimeZones` and DST cases for `cycleZoned`; invalid field name → `""`; invalid input → `""`. JSDoc with `@example`. `packages/gmt/README.md` and the owning namespace READMEs updated. Changeset. `zoned-date-ops`/`calculate-dates` TanStack Intent skills updated. Lint/test pass per `context/coding-standards.md` / `context/testing-standards/index.md` / `context/jsdoc-standards.md`.
```

---

### E7 — Calendar-aware zoned datetime strings

**GitHub Issue:** #152

**Title:**

```
E7 Extend zoned/ with a GMT-shape calendar-annotated zoned string
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group E, item E7. Filed out of E5's D2 (see `issues/E.md`, "E5 outcome"), which deliberately removed `zoned/`'s accidental calendar-awareness rather than blessing it. **Depends on E1–E5** — needs the calendar foundation, and needs E5's contract decisions and shared internals to build on.

## Why this exists now
E5 verified that before it landed, `zoned/` was already doing genuinely calendar-correct arithmetic: `addZoned` on a Hebrew-annotated value returned a date one day different from the ISO answer, correctly, and `intervalCountZoned` reported 13 months across a Hebrew leap year where ISO reported 14. None of it was documented, tested, or intentional — `isValidZonedDateTime` simply had no gate, so `Temporal.ZonedDateTime.from` accepted the annotation and every downstream function inherited Temporal's calendar behavior for free.

D2 closed that on contract-coherence grounds: the annotation shape `zoned/` accepted was Temporal's ISO-digit convention, which is *not* GMT's calendar string (D1), and accepting both shapes would make one string mean two different dates. Removing it was the right call for the contract. But the removal took a real capability with it, and this story is where it comes back deliberately — with a grammar, tests, and docs.

## Gap
After E5, calendar-system awareness is confined to `plain/` `PlainDate`. A caller holding a Hebrew, Islamic, Japanese, or Ethiopic date who needs it in a time zone has no path at all.

This is not merely inconvenient to compose from what GMT already has — it is categorically impossible, which is the kind of GMT-specific argument `issues/J.md`'s Decision 6 requires a story to lead with:

- Converting a calendar-annotated `PlainDate` into a zoned value **drops the calendar**, because every `zoned/` entry point now rejects the annotation (D2). The tag cannot survive the conversion.
- Doing the calendar arithmetic in `plain/` first and attaching a time zone afterwards **gives the wrong answer across a DST transition**. Zoned arithmetic exists precisely because it is DST-aware; calendar arithmetic exists precisely because it is leap-month-aware. A caller adding one month to a Hebrew date in `America/New_York` needs both at once, and no ordering of the two existing operations produces it — do the calendar step first and the DST step is applied to an already-resolved wall time; do the zoned step first and there is no calendar left to step in.

There is no composition, at any degree of cleverness, that expresses "add one Hebrew month, in this time zone, honoring DST."

## Scope
Define a GMT-native calendar-annotated `ZonedDateTime` string grammar and open the gate on the functions that can meaningfully use it.

**The grammar is the hard part and the real deliverable.** E1's plain shape is calendar-native digits plus `[u-ca=<id>]`, with an optional `;era=<era>` suffix. A zoned string additionally carries an offset and a `[timeZone]` segment, so this story must settle:
- Segment ordering, and whether the result is unambiguously parseable. Note that GMT's shape deliberately diverges from RFC 9557 already (calendar-native digits, not ISO digits), so matching Temporal's `[tz]`-before-`[u-ca=]` ordering is a choice to make explicitly, not a default to inherit.
- How the era suffix survives. Verified during E5's planning: `;era=` is **not** valid RFC 9557 — `Temporal.PlainDate.from("0006-10-03[u-ca=japanese;era=reiwa]")` throws `RangeError: invalid RFC 9557 string`. Era-bearing values can therefore never be handed to Temporal directly, only field-decomposed, which is what `internal/calendarDateString.ts`'s `parseCalendarDateValue` already does for the plain case.
- How `disambiguation` and `offset` interact with a calendar-tagged value, including the case where the calendar arithmetic itself lands inside a DST gap or fold.

Then re-derive E5's policy decisions for the zoned case rather than assuming they transfer:
- **D4** (mixed-calendar endpoints: ordering functions accept, value-returning functions reject) — the reasoning rests on `Temporal.PlainDate.compare` ignoring calendar; confirm the zoned equivalent via `.toInstant()` holds the same way.
- **D5** (measure in the shared calendar, fall back to Gregorian on mismatch or bare input).
- **D7** (re-derive the calendar tag from the arithmetic result, never copy it from the input) — this matters more in the zoned case, not less, since a value can cross both an era boundary and a DST transition in one operation.

Functions in scope: `zoned/calculate/` (`addZoned`, `subtractZoned`, `diffZoned`, `diffZonedAsDuration`) and the `zoned/interval/*` family, plus `isValidZonedDateTime` and `isValidZonedInterval` as the gates. Reuse E5's internals rather than duplicating them: `internal/hasCalendarAnnotation.ts`, `internal/calendarValueOfDate.ts`, `internal/formatDateInCalendar.ts`, `internal/calendarDatePairPolicy.ts`.

**Explicitly not in scope:**
- Re-accepting Temporal's ISO-digit `[u-ca=...]` shape. D1 settled this and it is not re-openable; the whole point of the story is a GMT-shape grammar.
- Calendar annotations on `PlainDateTime`, `utc/`, or `unix/` values. If a `PlainDateTime` grammar is wanted it is its own story with its own justification — do not fold it in here on the grounds that it looks similar.
- `addZonedBusinessDays`/`subtractZonedBusinessDays`. D9 rejected calendar tags on the business-day family because `dayOfWeek` is ISO-fixed identically in every supported calendar (verified), so a tag would change nothing while implying it might. That reasoning is unaffected by this story.

## Required inline comments
On the grammar's segment ordering: why GMT's shape orders segments the way it does, and why the era suffix cannot round-trip through `Temporal.ZonedDateTime.from` and must be field-decomposed. A reader cannot infer either, and both are the parts most likely to be "simplified" into a bug by someone assuming RFC 9557 applies.

## Common Mistakes entry (required)
Converting a calendar-annotated `PlainDate` to a zoned value drops the calendar unless the zoned grammar is used. Reaching for `convertDateToCalendar` followed by a zoned conversion silently produces a Gregorian value, and the calendar-unit arithmetic that follows is then wrong in exactly the cases the calendar was chosen for.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. **Read `issues/E.md`'s "E5 outcome" section first** — D1–D9 are settled for `plain/` and are this story's starting position, but each is a decision *about the plain case*; re-justify rather than assume it transfers to zoned. Note also E5's unanticipated finding 2 (`Temporal.PlainDate.prototype.until` throws across mismatched calendars even though `.compare` does not) and finding 3 (the `.equals()` calendar-sensitivity trap is structurally unreachable only *because* D1 and D4 confine mixed calendars — reopening the zoned surface reopens that question, so re-verify the `zoned/interval/*` `.equals()` sites rather than trusting E5's "no change needed" verdict). Re-verify polyfill behavior against the version in the lockfile at the time of pickup.

## Definition of done
Tests: the grammar round-tripping through every supported calendar system, including an era-bearing one; calendar-unit arithmetic across a Hebrew leap month, an Ethiopic Pagumen overflow, and a Japanese era transition, each *combined with* a DST transition in the same operation; `battleTestTimeZones` coverage on the calendar-aware paths; mixed-calendar endpoints per the re-derived D4 policy; DST gap/fold interaction with `disambiguation` and `offset` on a calendar-tagged value; bare ISO zoned strings verified unaffected; invalid grammar → sentinel. JSDoc with `@example`. `packages/gmt/README.md` and `zoned/README.md` updated, including the grammar itself. Changeset. `zoned-date-ops` and any other affected TanStack Intent skills updated. The `issues/E.md` "E5 outcome" audit table updated to reflect which `(b→a)` verdicts this story reverses. Lint/test pass per `context/coding-standards.md` / `context/testing-standards/references/index.md` / `context/jsdoc-standards.md`.
```
