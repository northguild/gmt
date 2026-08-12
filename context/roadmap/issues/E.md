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
Tests: leap-year/non-leap-year conversion round-trips, all 12/13 month boundaries, epoch-adjacent dates, invalid input sentinel returns. JSDoc with `@example`. New `calendar-system.ts` shared type. `packages/gmt/README.md` update documenting the new calendar-system concept (likely warrants its own README section, not just a function list entry, given this is a new domain concept for the library). Changeset. Lint/test pass per `context/coding-standards.md` / `context/testing-standards.md` / `context/jsdoc-standards.md`.
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
