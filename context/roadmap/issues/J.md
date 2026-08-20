# Story Group J — Parity Completion

Surfaced by a fresh audit (2026-08-20) run to answer whether the roadmap as planned actually reaches the stated goal: parity with, and beyond, Luxon, `@internationalized/date`, date-fns, and Moment.js. Method: GMT's actual `packages/gmt/src` tree enumerated by `find`/`grep` (not inferred from the roadmap's own claims), cross-referenced against current library documentation via context7, then every candidate gap re-verified against GMT source before being written up here — the same source-verification discipline Story Group I's notes credit with discarding false positives.

**The audit's headline finding:** `overview.md`'s claim that completing Groups A–D, F–I, and E1–E5 makes GMT a credible "surpasses all four comparison libraries" release **does not hold**. Fourteen real capability gaps survive in this group (a fifteenth, `cycle*` field wrap-around, was re-homed to Group E as E6 on 2026-08-20 — see Decision 6 and the Tier 2 note below), several of them everyday APIs rather than long-tail exotica. The largest: **GMT has no field setters at all, and its existing composition workaround is provably unsafe for multi-field updates** — see J1's Gap section for the correctness argument; `.set()`/`setYear`/`.cycle()`/`.year(n)`-style APIs across Luxon, date-fns, `@internationalized/date`, and Moment corroborate that this is a real, widely-felt gap, not the reason to add it on their own (Decision 6).

Group J is sequenced **after Group I, before Group E**. Group E stays backlog on its own stated reasoning ("narrow demand"); Group J holds gaps users hit on day one.

Group J opens with **Phase 0** (J0a, J0b) — two pre-existing defects found by the same audit, unrelated to Group J's content. J0b must land before J3/J4 because it decides which namespace GMT's value-taking accessors belong in.

---

## Decisions of record

Settled decisions, not open questions. A future audit must be able to tell "deliberately excluded" from "missed", and a future agent must not re-open these. Each is echoed into the JSDoc and skill content of the functions it governs.

### Decision 1 — Token _parsing_ is in scope; token _formatting_ is deliberately excluded

**Excluded:** a general token formatter (Luxon `toFormat`, date-fns `format`, Moment `.format("YYYY-MM-DD")`). This is **not** a gap. Do not add it, and do not re-file it as one.

**Why:** a pattern like `"MM/dd/yyyy"` hard-codes US field order and ships it to every locale. Tokens localize the _lexicon_ — month and weekday names follow the locale — but never the _structure_, so a French user gets `03/15/2024` where they expect `15/03/2024`. Luxon's own documentation directs users to `toLocaleString` and treats `toFormat` as an escape hatch. GMT's existing Intl-options `formatDate`/`formatDateTime` already serve display better, and **J12 (`formatToParts`)** is the i18n-correct answer to "I need exact control over the output": the caller receives locale-ordered parts and restyles them without hard-coding field order.

**In scope:** token parsing (J11). Locale-hostility is not a defect when _decoding_ — you are reading a known fixed producer format (a CSV column, a legacy API response, a form field), not generating output for a human. And no alternative exists at any layer: neither Temporal nor `Intl` can parse a custom pattern, so consumers have no workaround at all.

**Must appear in:** J11's and J12's JSDoc; the `format-date-time` skill's Common Mistakes; `packages/gmt/README.md`.

### Decision 2 — Group J sequences after Group I, before Group E

Recorded in `tracker.md`'s `Order` column. Group E's rows stay `unscheduled`.

### Decision 3 — Group J publishes independently

Per `tracker.md`'s Changeset note, `changeset:version` sweeps up everything sitting in `.changeset/` when it runs. Group J gets its own `minor` release when J15 lands. Do not bundle with I or E.

### Decision 4 — J11 gets a narrow, named exception to the manual-parsing prohibition

`context/coding-standards.md` forbids manual string parsing. J11 cannot satisfy that rule, because Temporal exposes no `fromFormat` equivalent. The exception is scoped to the `parse*WithPattern` family only, and carries three binding constraints: the regex is built _from the pattern_ (never hand-rolled per-format string slicing); extracted fields are always handed to `Temporal.*.from()` for final construction and validation rather than trusted from the match; the try-catch and sentinel-return rules are unchanged. The prohibition stands for every other function in the library.

### Decision 5 — Parameterized functions, not per-variant families

Where a comparison library ships many near-identical functions, GMT ships one parameterized function per namespace: J5 is `areDatesEqualBy(a, b, unit)`, not date-fns's 12 `isSameX` functions; J7 is `nextWeekday(value, dayOfWeek)`/`previousWeekday(...)`, not date-fns's 16 `nextMonday`…`previousSunday` functions. This follows GMT's own precedent (`startOfDate(value, unit)`, `parseUnitFromDate(value, unit)`). Each such story's JSDoc **must** carry a mapping table from the comparison library's function names to the GMT call, so migrating users can find them by the name they already know.

### Decision 6 — "a comparison library has it" is evidence, never the justification

A 2026-08-20 re-review of this group found several stories' "Gap" sections leading with a competitor function count ("Luxon has X, date-fns has Y, Moment has Z") as the primary argument for adding something. That is backwards for a library whose own positioning (`context/project-overview.md`) is a **narrow, opinionated** surface, and whose stated goal (`overview.md`) is to _exceed_ parity, not replicate every method a comparison library ships.

**The binding test, going forward:** every story's "Gap" section must lead with a GMT-specific reason — one of:

- **A correctness hole in GMT's own composability.** J1 is the worked example: the only existing workaround (`parse*FromDate` + `addDate({unit: delta})`) is not just clumsy, it is _provably unsafe_ for multi-field updates — sequential `.add()` calls each resolve overflow independently, so setting month-then-day vs. day-then-month on the same target can silently diverge, where `.with({month, day})` resolves all fields in one atomic overflow pass. That is a real bug waiting to happen in GMT's own surface, not a feature-count gap.
- **A capability that is categorically impossible to compose from what GMT already has**, not merely inconvenient. E6 (`cycle*`, formerly J2 — see below) is the worked example: `add()`'s defining behavior is to overflow into the next larger field, which is exactly what wrap-without-carry must not do. No delta composition can express it, at any degree of cleverness.
- **An internal-consistency gap** — GMT already has the pairwise/zoned/plain sibling of this capability and is missing the other member of the same family (e.g. J9's list-form `mergeIntervals` generalizing B5's pairwise `intervalUnion*`; J14's plain range formatting alongside the existing zoned one).

Comparison-library evidence stays in every story — it establishes that other consumers of this shape of library have wanted the capability, which is useful corroboration — but it moves to a secondary "prior art" role, after the GMT-specific reason, not in place of it. Decision 1 is this group's existing precedent for the inverse case: a competitor method (`toFormat`) was **excluded** despite every comparison library having it, because the shape itself was wrong for GMT (locale-hostile hardcoded field order). Decision 6 generalizes that same discipline to the inclusion side: presence in Luxon/date-fns/Moment/`@internationalized/date` is never sufficient on its own, in either direction.

This decision prompted two concrete revisions on 2026-08-20: J1's "Gap" section was rewritten to lead with the correctness argument above (competitor bullet list demoted to prior art); and J2 (`cycle*`) was moved out of Group J into Group E as **E6** — not because the capability isn't real (Decision 6's impossibility test confirms it is), but because its own motivation is UI-segment-editing, which `overview.md`'s Group E paragraph already designates as that group's territory, not "gaps users hit on day one" (this group's own framing, above). J6 and J10 were also re-scoped the same day for a related reason: both proposed a per-variant function family (`isToday`/`isYesterday`/`isTomorrow`/…, `getZonedOffset`/`getZonedOffsetMinutes`/`getZonedOffsetNanoseconds`) that Decision 5 already forbids — see their entries below for the consolidated shape.

---

## Definition of done — binding for every Group J story

The existing `issues/*.md` files leave docs, skills, and test rigor implicit, deferring to `overview.md`'s numbered instructions. Group J states it here so it cannot be skipped. Every story's own "Definition of done" section is **in addition** to everything below.

### Documentation — same PR, never a follow-up

- `packages/gmt/README.md` — API surface section (via `/update-readme`).
- The owning namespace README — `packages/gmt/src/plain/README.md`, `zoned/README.md`, `unix/README.md`, `utc/README.md`, `duration/README.md`, or `regex/README.md`. Stories spanning several namespaces (J1, J5, J6) update **each one they touch**.
- `docs/dst-disambiguation.md` — required for **J1** and **J10**. J1 must extend that file's "Which function do I actually need?" section: a `set*` function taking both `disambiguation` and `offset` is exactly the confusion that section exists to resolve.
- A `.changeset/*.md` entry with a `minor` label (via `/changelog`).

### TanStack Intent skills — same PR, non-optional

`overview.md` step 7 already states that skills falling behind the API surface actively mislead agents consuming `@burglekitt/gmt`. Update via `/tanstack-intent`, or manually per `.agents/skills/tanstack-intent/SKILL.md`:

| Story         | Skill(s) to update                                                                        |
| ------------- | ----------------------------------------------------------------------------------------- |
| J0b           | `get-current`, `compare-dates`                                                            |
| J1            | `calculate-dates`, `zoned-date-ops` (for the `disambiguation`/`offset` pair)              |
| J3, J4        | `get-current`, `parse-date-time`                                                          |
| J5, J6, J7    | `compare-dates`                                                                           |
| J8            | `durations`                                                                               |
| J9            | `interval-ops`                                                                            |
| J10           | `zoned-date-ops`                                                                          |
| J11           | `parse-date-time`, plus a `format-date-time` Common Mistakes entry pointing at Decision 1 |
| J12, J14, J15 | `format-date-time`                                                                        |
| J13           | `format-date-time`, `parse-date-time`                                                     |

Every story introducing a trap adds a **Common Mistakes** entry, not just a Core Pattern. The traps are known in advance and named in each story below.

### Code comments

Beyond the JSDoc `context/jsdoc-standards.md` already requires (description, `@param`, `@returns`, `@example` covering valid/invalid/edge input), Group J functions carry inline `//` comments explaining _why_ wherever the reason is not evident from the code — following the precedent in `plain/calculate/startOfDate.ts`, whose week-start branch explains Temporal's 1–7 day numbering before doing the arithmetic. Per-story requirements are listed in each story below.

### Tests

Every function gets a `.test.ts` alongside it meeting `context/testing-standards/references/index.md`'s bar. This is stricter than "tests exist" — A3 had to go back and expand A2's tests to reach it. Binding:

- **`it.each` with backtick template-literal syntax.** Array syntax is forbidden.
- **Exhaustive option tables, not a few `it()` blocks.** Every meaningfully different enum value, on an input where they actually diverge. The default _and_ the explicit value matching the default, as separate rows — a bug that breaks only the explicit path is otherwise invisible. A case where the option has _no_ effect, proving it isn't over-applying. Combinations with negative amounts, zero-length inputs, and invalid values routing to the sentinel.
- **Every zoned/unix function uses `packages/gmt/src/test/timeZoneMatrix.ts`'s `battleTestTimeZones`** — the canonical 20-zone list including `Pacific/Apia` (+13:00) and `Pacific/Niue` (-11:00). No one-off zone lists; no UTC-and-New-York-only. Applies to J1, J5, J6, J9, J10.
- **Every locale-aware function runs the full 17-locale matrix** from `packages/gmt/src/test/localeMatrix.ts`, with `hasFullIcu` ternaries where ICU-dependent output differs. Applies to J3, J4, J10, J11, J12, J14, J15.
- **DST edge cases** for J1, J10: spring-forward gap and fall-back overlap, in both `America/Chicago` and `Europe/Berlin`.
- **Clock-dependent functions (J6)** mock `Temporal.Now` via the existing mocks in `packages/gmt/src/test/mocks/`. No reliance on real wall-clock time.
- **Invalid-input rows** proving the typed sentinel (`""` / `null` / `false` / `[]`) and proving the function never throws.

---

## Phase 0 — pre-existing defects, fixed before the rest of Group J

### J0a — Reconcile the duplicate release-checkpoint paragraphs in `overview.md`

**GitHub Issue:** #96

**Title:**

```
J0a Reconcile duplicate release-checkpoint paragraphs in roadmap overview
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group J, item J0a. Documentation-only defect found by the 2026-08-20 parity audit. Not a code change.

## Gap
`context/roadmap/overview.md` declares the "GMT surpasses all comparison libraries" release checkpoint **twice**, with different group lists:

- The "Ground-truth parity audit (2026-08-12)" paragraph: "Once Groups A–D, F–I, and E1–E5 are all complete..."
- The "Release checkpoint" paragraph immediately below it: "once Groups A–D, F–H, and E1–E5 are all complete..." — **omits Group I entirely**.

The second is stale text, left behind when Group I was added on 2026-08-12 and the first paragraph was written. Two contradictory definitions of the same milestone is exactly the kind of drift that makes the roadmap untrustworthy as a source of truth.

## Scope
- Delete the stale "Release checkpoint" paragraph.
- Keep the "Ground-truth parity audit" paragraph and extend its group list to `A–D, F–J, and E1–E5`.
- Fold in the deleted paragraph's only non-duplicated content — the instruction to re-verify against the comparison libraries before cutting that release — which the surviving paragraph already states more precisely (a full `.d.ts` audit, not a context7 sample). No content is lost; the weaker phrasing is.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Read both paragraphs in full before deleting either — confirm the group-list discrepancy is still present and that no third checkpoint statement has been added since 2026-08-20.

## Definition of done
`grep -c "surpasses" context/roadmap/overview.md` returns 1, not 2. The surviving paragraph reads `A–D, F–J, and E1–E5`. Documentation-only: no changeset, no source files touched, no skills affected.
```

### J0b — Move `getLocaleDayOfWeek` / `getLocaleZonedDayOfWeek` out of the `get/` namespace

**GitHub Issue:** #97

**Title:**

```
J0b Move getLocaleDayOfWeek and getLocaleZonedDayOfWeek from get/ to calculate/
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group J, item J0b. Pre-existing defect found by the 2026-08-20 parity audit, in Story Group D3's output. **Blocks J3 and J4** — do not start those until this lands.

## Gap
`plain/get/` and `zoned/get/` are, without exception, **current-moment accessors**: every function reports a value for *now*, taking either no argument (`getDay()`, `getYear()`, `getMonth()`, `getWeekOfYear()`) or only a timezone (`getZonedDay(tz)`, `getZonedWeekOfYear(tz)`). Verified 2026-08-20 by reading every signature in both directories.

D3's two functions are the only members of either namespace that take a date value:

- `packages/gmt/src/plain/get/getLocaleDayOfWeek.ts` — `getLocaleDayOfWeek(value: string, locale: string)`
- `packages/gmt/src/zoned/get/getLocaleZonedDayOfWeek.ts` — same shape

This is actively misleading. `getLocaleDayOfWeek` reads as the locale variant of its immediate neighbour `getDayOfWeek()` — but `getDayOfWeek()` reports *today's* weekday, while `getLocaleDayOfWeek(value, locale)` reports the weekday of an arbitrary date. Two functions, adjacent in the same directory, near-identical names, completely different contracts.

Their own D2 siblings got this right: `getLocaleStartOfWeek`/`getLocaleEndOfWeek` live in `plain/calculate/`, and `getLocaleZonedStartOfWeek`/`getLocaleZonedEndOfWeek` live in `zoned/calculate/`. D3 simply landed in the wrong directory.

## Scope
- Move `getLocaleDayOfWeek.ts` (+ its `.test.ts`) to `packages/gmt/src/plain/calculate/`, alongside `getLocaleStartOfWeek.ts`.
- Move `getLocaleZonedDayOfWeek.ts` (+ its `.test.ts`) to `packages/gmt/src/zoned/calculate/`, alongside `getLocaleZonedStartOfWeek.ts`.
- Update the four barrel `index.ts` files (`plain/get/`, `plain/calculate/`, `zoned/get/`, `zoned/calculate/`).
- Function names, signatures, and behavior are **unchanged**. This is a file move plus barrel rewiring, nothing else.
- Record the resulting rule in `context/coding-standards.md`'s API Contract section: **`get/` namespaces hold current-moment accessors only** — no argument, or timezone only, reporting a value for *now*. Any function taking a date value belongs in `calculate/` (or `parse/`, `compare/`, `format/` as its verb dictates).

## Release impact — decide before implementing
Root imports (`from "@burglekitt/gmt"`) are unaffected: `src/index.ts` re-exports whole namespaces. But `package.json`'s `exports` map publishes `./plain/*` and `./zoned/*` as real public subpaths, so anyone importing from `@burglekitt/gmt/plain/get` loses the symbol. At v1.10.0 this is defensible as a `minor` with a prominent changeset note, but it is **technically breaking for deep-subpath consumers** — the changeset must say so explicitly and name both old and new subpaths, not bury it under "moved some files".

## Why this blocks J3/J4
J3 and J4 add four more value-taking accessors (`getDaysInMonth`, `getDayOfYear`, `getWeekYear`, `getWeeksInMonth`). While D3 sits in `get/`, there is no unambiguous rule for where they go, and the ambiguity will simply reproduce itself. Once this lands, the rule is clean and J3/J4's specs cite it.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Re-verify the namespace claim before moving anything: `grep -h "export function" packages/gmt/src/plain/get/*.ts packages/gmt/src/zoned/get/*.ts` should show every remaining signature is now-based. If a third value-taking function has appeared since 2026-08-20, move it too.

## Definition of done
`pnpm test` and `pnpm lint` pass. `grep -rn "get/getLocaleDayOfWeek\|get/getLocaleZonedDayOfWeek" packages/gmt/src` returns nothing. Every remaining signature in both `get/` directories is now-based. `packages/gmt/README.md`, `plain/README.md`, `zoned/README.md` updated; `get-current` and `compare-dates` skills updated; `context/coding-standards.md` carries the new namespace rule; changeset explicitly names the subpath change.
```

---

## Tier 1 — highest real-world usage

### J1 — Field setters

**GitHub Issue:** #98

**Title:**

```
J1 Add setDate, setDateTime, setTime, setZoned, setUnix, setUtc
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group J, item J1. Surfaced by the 2026-08-20 parity audit. **Foundational for Group J — sequence first.** Group E's E6 (`cycle*`) builds directly on it too, across groups — see `issues/E.md`.

## Gap
**GMT has no field setters at all, and the only available workaround is provably unsafe for the multi-field case.** `grep -rn "export function set\|export function with" packages/gmt/src` returns nothing (verified 2026-08-20); `grep -rn "\.with("` shows GMT already uses `Temporal.*.with()` internally throughout `startOf*`/`endOf*`, but always with hardcoded reset values (`{month: 1, day: 1, ...}`) — never a caller-supplied field. There is no way to say "same date, but with the year changed to 2025" as a single call. A caller must compose it from existing primitives: `parse*FromDate` to read the current field, then `addDate({unit: target - current})` to shift it.

That composition is not just clumsy, it is **unsafe** for anything beyond a single field. Each sequential `.add()` call resolves Temporal's `overflow` independently against its own intermediate value — so setting month-then-day vs. day-then-month on the same target date can silently diverge, because each step constrains against a different intermediate month's day-count. A single `.with({month, day})` call resolves all fields together in one atomic overflow pass and has no such order-dependence. For zoned values the gap is worse: `Temporal.ZonedDateTime.prototype.add()` has no `offset`/`disambiguation` control equivalent to `.with()`'s, so delta composition cannot reproduce the disambiguation-plus-offset handling `zoned/calculate/startOfZoned.ts` already depends on to avoid the C3 silent-no-op trap (see below). This is a real correctness gap in GMT's own composability — the kind Decision 6 requires a story to lead with — not merely a feature GMT happens to be missing.

**Prior art** (secondary evidence, per Decision 6 — every comparison library has this and it is one of their most-used APIs):
- Luxon: `dt.set({ year, month, day, hour })`
- date-fns: `setYear`, `setMonth`, `setDate`, `setHours`, `setMinutes`, `setSeconds`, `setMilliseconds`, `setQuarter`, `setWeek`, `setDayOfYear`
- `@internationalized/date`: `date.set({ day, month, year })`, with out-of-range values constrained
- Moment: `.year(n)`, `.month(n)`, `.date(n)`, `.hour(n)`

Given both the correctness argument and the prior-art count, this is the single largest omission in the library.

## Scope
One parameterized setter per namespace (Decision 5), taking a partial field object and wrapping `Temporal.*.prototype.with()`:

- `setDate(value, fields, options?)` — plain date
- `setDateTime(value, fields, options?)` — plain datetime
- `setTime(value, fields, options?)` — plain time
- `setZoned(value, fields, options?)` — zoned
- `setUnix(value, fields, options?)` — unix
- `setUtc(value, fields, options?)` — utc

`""` on invalid input per the string-return sentinel convention.

**Options:**
- All six take `overflow` — reuse the existing shared `Overflow` type at `packages/gmt/src/types/overflow.ts` (extracted during A1). Default `"constrain"`, matching Temporal.
- **`setZoned`, `setUnix`, and `setUtc` must take `disambiguation` AND `offset`** — reuse `packages/gmt/src/types/disambiguation.ts` and `types/offset.ts`. Default `offset: 'ignore'`.

## Critical: the C3 silent-no-op trap
C3 established empirically that `Temporal.ZonedDateTime.prototype.with()` has a second, independent option beyond `disambiguation` — `offset`, defaulting to `'prefer'`. `'prefer'` keeps the source value's existing UTC offset whenever it is still valid for the new fields, which for field-setting calls it almost always is. **Passing `disambiguation` alone to `.with()` is therefore a silent no-op**: C3 confirmed all four `disambiguation` values produced byte-identical output on a real, reachable fall-back-overlap case until `offset: 'ignore'` was also passed.

This story is `.with()`-based and hits that trap head-on. Default `offset: 'ignore'` exactly as the nine C3 functions do — see `zoned/calculate/startOfZoned.ts` as the reference implementation, and `docs/dst-disambiguation.md`'s "The `offset` parameter" section for the full explanation. Expose `offset` as a real optional parameter rather than hard-coding `'ignore'` internally, matching C3's decision: it is a legitimate Temporal option, not just a workaround.

Note that `setUtc` hardcodes timezone `"UTC"`, which has no DST transitions — `disambiguation`/`offset` are permanently inert there, exactly as C3 documented for `startOfUtc`/`endOfUtc`. Take the options for signature consistency and document them as inert, following the precedent C1/C2 set.

## Required inline comments
- At the `offset` default: state that `'ignore'` is deliberate, and that leaving Temporal's `'prefer'` default in place makes `disambiguation` a silent no-op. Cite C3.
- On `setUtc`'s inert options, so a reader doesn't "fix" them.

## Common Mistakes entry (required)
The `disambiguation`-without-`offset` silent no-op, phrased as the caller-facing symptom: "I passed `disambiguation: 'reject'` and it didn't throw."

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analogs: `zoned/calculate/startOfZoned.ts` (the `.with()` + `disambiguation` + `offset` pattern), `plain/calculate/addDate.ts` (the `overflow` option pattern from A1). Read `docs/dst-disambiguation.md` in full first.

## Definition of done
Everything in Group J's shared Definition of Done, plus: tests across `battleTestTimeZones`; spring-forward and fall-back cases in `America/Chicago` and `Europe/Berlin`; **the C3 regression pairing — `disambiguation: "reject"` with `offset: "prefer"` that does NOT throw, alongside the default-`offset` case that does** (this is the specific regression class that caught C3's bug and it must be present); overflow-constrain vs overflow-reject on Jan 31 → month 2; partial field objects; empty field object as a no-op; invalid input → `""`. `docs/dst-disambiguation.md` extended.
```

### J3 — Calendar quantity getters

**GitHub Issue:** #99

**Title:**

```
J3 Add getDaysInMonth, getDaysInYear, getDayOfYear, getWeeksInMonth, getWeekOfMonth, getWeeksInYear
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group J, item J3. Surfaced by the 2026-08-20 parity audit. **Depends on J0b** — that story establishes which namespace these belong in.

## Gap
GMT has no calendar quantity getters. Verified 2026-08-20: `grep -ril "daysInMonth\|DayOfYear\|WeeksInMonth" packages/gmt/src` finds only `mapDaysInMonth` (which returns an array of date strings — `.length` approximates `getDaysInMonth` but allocates an array to do it) and an internal reference inside `getWeekNumber.ts`.

Comparison libraries:
- Luxon: `.daysInMonth`, `.daysInYear`, `.ordinal` (day of year), `.weeksInWeekYear`
- date-fns: `getDaysInMonth`, `getDaysInYear`, `getDayOfYear`, `getWeeksInMonth`, `getWeekOfMonth`, `getISOWeeksInYear`
- `@internationalized/date`: `getWeeksInMonth(date, locale)` — used by every calendar-grid implementation to size the grid

## Scope
Per Decision 5 and J0b's rule, these take a date value and therefore live in `plain/calculate/` (and `zoned/calculate/` for zoned variants), **not** `get/`.

- `getDaysInMonth(value): number | null`
- `getDaysInYear(value): number | null`
- `getDayOfYear(value): number | null`
- `getWeeksInYear(value): number | null` — ISO week-numbering (52 or 53)
- `getWeeksInMonth(value, locale): number | null` — locale-aware, since the count depends on which day the week starts
- `getWeekOfMonth(value, locale): number | null` — same

`null` on invalid input per the number-return sentinel convention.

Locale-aware members reuse the existing `internal/getLocaleFirstDayOfWeek.ts` helper (added for D2) — do not re-derive `weekInfo` handling, and do not add a second TypeScript augmentation for `Intl.Locale.weekInfo` (D1 already added one there).

Zoned variants as a follow-up once the plain versions establish the pattern, consistent with how Groups B and F sequence plain-then-zoned.

## Required inline comments
On any week-numbering branch: state which convention is in play (ISO Monday-start vs. locale first-day) and why, following the precedent in `plain/calculate/startOfDate.ts`.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analogs: `plain/calculate/getLocaleStartOfWeek.ts` (locale-aware, uses `getLocaleFirstDayOfWeek`), `plain/calculate/weekOfYear.ts` (ISO week numbering, `null` sentinel). Re-verify date-fns's `getWeekOfMonth` semantics via context7 before finalizing — whether the first partial week counts as week 1 is a real semantic choice, not an implementation detail.

## Definition of done
Everything in Group J's shared Definition of Done, plus: leap-year February (29) and common-year February (28); 30- vs 31-day months; day-of-year at Jan 1, Dec 31, and across a leap day; a 53-ISO-week year; the full 17-locale matrix for `getWeeksInMonth`/`getWeekOfMonth`, covering both the Sat/Sun and Fri/Sat weekend groups D1 identified; a month that spans 4, 5, and 6 week-rows depending on locale; invalid input → `null`.
```

### J5 — Same-unit comparison

**GitHub Issue:** #100

**Title:**

```
J5 Add areDatesEqualBy and namespace variants
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group J, item J5. Surfaced by the 2026-08-20 parity audit.

## Gap
GMT compares only for exact equality — `plain/compare/areDatesEqual.ts`, `areDateTimesEqual.ts`, `areTimesEqual.ts`, plus `areZonedEqual`/`areUnixEqual`/`areUtcEqual`. There is no way to ask "are these two dates in the same month?" Verified 2026-08-20: `grep -ril "SameMonth\|SameYear" packages/gmt/src` returns nothing.

Comparison libraries:
- date-fns: `isSameDay`, `isSameWeek`, `isSameMonth`, `isSameQuarter`, `isSameYear`, `isSameHour`, `isSameMinute`, `isSameSecond`, plus the `isSameISOWeek`/`isSameISOWeekYear` variants — 12 functions
- `@internationalized/date`: `isSameDay`, `isSameMonth`, `isSameYear`
- Luxon: `dt.hasSame(other, unit)`
- Moment: `.isSame(other, unit)`

Luxon's and Moment's parameterized shape is the right precedent, and it matches GMT's own (`startOfDate(value, unit)`).

## Scope
Per Decision 5, one parameterized function per namespace:

- `areDatesEqualBy(a, b, unit): boolean`
- `areDateTimesEqualBy(a, b, unit): boolean`
- `areZonedEqualBy(a, b, unit): boolean`
- `areUnixEqualBy(a, b, unit): boolean`
- `areUtcEqualBy(a, b, unit): boolean`

`false` on invalid input per the boolean-return sentinel convention. Supported units per namespace follow the existing unit types in `packages/gmt/src/types/` (`date-unit.ts`, `date-time-unit.ts`) — reuse them, do not define new unions.

**JSDoc must carry the Decision 5 mapping table**: `isSameDay` → `areDatesEqualBy(a, b, "day")`, `isSameMonth` → `areDatesEqualBy(a, b, "month")`, and so on for all 12 date-fns names, so migrating users can find this by the name they already know.

## Common Mistakes entry (required)
`areDatesEqualBy(a, b, "month")` returns `true` for March 2023 vs. March 2024 — "same month" means the same month *field*, not the same month *of the same year*. This is the trap date-fns users carry over, since date-fns's `isSameMonth` compares year-and-month together. **Decide and document explicitly which semantic GMT implements** at spec-expansion time, verifying date-fns's actual behavior via context7 first; whichever is chosen, the divergence or the match must be stated in the JSDoc, not left for the caller to discover.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analog: `plain/compare/areDatesEqual.ts` for structure and sentinel, `plain/calculate/startOfDate.ts` for the unit-parameter validation pattern.

## Definition of done
Everything in Group J's shared Definition of Done, plus: every supported unit, each on a pair that is equal at that unit and unequal at the next-finer one; the year-boundary case from the Common Mistakes entry above; `battleTestTimeZones` for the zoned/unix variants, including a pair that is the same day in one zone and different days in another; an unsupported unit → `false`; invalid input on either side → `false`.
```

### J6 — Now-relative predicates

**GitHub Issue:** #101

**Title:**

```
J6 Add isRelativeDay, isThisUnit, isPast, isFuture
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group J, item J6. Surfaced by the 2026-08-20 parity audit. **Re-scoped 2026-08-20 (Decision 6)** — the original spec proposed eight near-duplicate functions (`isToday`/`isYesterday`/`isTomorrow`/`isThisWeek`/`isThisMonth`/`isThisYear` plus `isPast`/`isFuture`), which is exactly the per-variant-family shape Decision 5 already forbids when a comparison library does it (date-fns ships the same eight, plus three more for hour/minute/second). Consolidated below to four functions.

## Gap
GMT has zero now-relative predicates. Verified 2026-08-20: `grep -ril "isToday\|isPast\|isFuture" packages/gmt/src` returns nothing. A caller must fetch `getToday()` and hand-compare — and once J5's `areDatesEqualBy(a, b, unit)` exists, that hand-comparison is exactly what these predicates wrap, which is also why they should ship as parameterized functions rather than a name-per-offset family. These are high-frequency in application code — "is this due today", "has this expired" — which is the GMT-specific reason to add them, independent of how many comparably-named functions date-fns or Moment ship (Decision 6).

## Scope
- `isRelativeDay(value, offsetDays): boolean` — subsumes `isToday`/`isYesterday`/`isTomorrow`: `offsetDays: 0` is "today", `-1` is "yesterday", `1` is "tomorrow", and any other integer offset works the same way (Decision 5's parameterization applied to the day axis). JSDoc mapping table: `isToday(value)` → `isRelativeDay(value, 0)`, `isYesterday(value)` → `isRelativeDay(value, -1)`, `isTomorrow(value)` → `isRelativeDay(value, 1)`.
- `isThisUnit(value, unit, locale?): boolean` — subsumes `isThisWeek`/`isThisMonth`/`isThisYear`, `unit` drawn from the same `DateUnit` type J5 uses. `locale` only affects the `"week"` case, for the same reason J3's `getWeeksInMonth` needs it — which day the week starts on varies. JSDoc mapping table: `isThisWeek(value, locale?)` → `isThisUnit(value, "week", locale)`, `isThisMonth(value)` → `isThisUnit(value, "month")`, `isThisYear(value)` → `isThisUnit(value, "year")`.
- `isPast(value): boolean` / `isFuture(value): boolean` — kept separate, not folded into either function above: these are genuinely distinct predicates (before/after *now*, not "the same unit as now"), not one more value on an enumerable axis.
- Zoned variants taking the zoned value (which carries its own timezone) — `isZonedRelativeDay`, `isZonedThisUnit`, `isZonedPast`, `isZonedFuture` — following the naming of the existing `isZonedWeekend`/`isZonedBusinessDay`.

`false` on invalid input per the boolean-return sentinel convention.

Where J5 lands first, `isRelativeDay` and `isThisUnit` should be built on `areDatesEqualBy` against `getToday()` (offset by `addDate(getToday(), { days: offsetDays })` for `isRelativeDay`) rather than reimplementing the comparison — check whether J5 has merged and reuse it if so.

## Common Mistakes entry (required)
These depend on the **system clock and system timezone**. `isRelativeDay("2024-03-15", 0)` compares against the host's current date, so the same call returns different answers in `Pacific/Apia` and `Pacific/Niue` at the same instant — a 24-hour spread. Callers needing determinism (server-side rendering, tests, scheduled jobs) should use the zoned variants with an explicit timezone, or compare against an explicit reference with J5's `areDatesEqualBy`. Name this trap directly; it is the classic source of "works on my machine" date bugs.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analogs: `plain/compare/isWeekend.ts` (boolean sentinel, locale handling), `plain/get/getToday.ts` and `zoned/get/getZonedToday.ts` (the now-accessors these compare against), J5's `areDatesEqualBy` for the parameterized-unit pattern this story reuses. Note these are *predicates taking a value*, so per J0b's rule they belong in `compare/`, not `get/`.

## Definition of done
Everything in Group J's shared Definition of Done, plus: **`Temporal.Now` mocked via the existing `packages/gmt/src/test/mocks/` — no reliance on real wall-clock time**, since a test asserting "today" is a guaranteed future flake otherwise; boundary cases at midnight either side; every `offsetDays` value date-fns's three named functions cover (0, -1, 1), plus at least one further-out offset proving the parameterization isn't hardcoded to those three; every `unit` value for `isThisUnit`; `isPast`/`isFuture` on the current instant exactly; the full 17-locale matrix for `isThisUnit(value, "week", locale)`, covering a date that falls in this week under one locale's week start and last week under another's; `battleTestTimeZones` for the zoned variants, including the `Pacific/Apia`/`Pacific/Niue` pair from the Common Mistakes entry; invalid input → `false`.
```

### J11 — Token-based parsing

**GitHub Issue:** Issue #102

**Title:**

```
J11 Add parseDateWithPattern, parseDateTimeWithPattern, parseTimeWithPattern
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group J, item J11. Surfaced by the 2026-08-20 parity audit. **Read Decision 1 and Decision 4 at the top of this file before starting** — this story's scope boundary and its standards exception are both non-obvious and both deliberate.

## Gap
GMT cannot parse a custom pattern. There is no way to consume `"03/15/2024"` from a CSV column, `"15-Mar-2024"` from a legacy API, or a partially-typed value from a form field. Verified 2026-08-20: no `fromFormat`/`parse`-with-pattern equivalent anywhere in `packages/gmt/src`.

Every comparison library has this: Luxon `DateTime.fromFormat(str, "dd/MM/yyyy")`, date-fns `parse(str, "MM/dd/yyyy", ref)`, Moment `moment(str, "DD/MM/YYYY")`.

**This gap has no consumer-side workaround at any layer.** Neither Temporal nor `Intl` can parse a custom pattern — `Temporal.PlainDate.from()` accepts ISO 8601 only. Unlike most Group J stories, where a caller could hand-roll the behavior awkwardly, here they cannot.

## Scope
- `parseDateWithPattern(value, pattern, locale?): string` → ISO date string, `""` on no-match or invalid input
- `parseDateTimeWithPattern(value, pattern, locale?): string`
- `parseTimeWithPattern(value, pattern, locale?): string`

Token vocabulary: settle on one at spec-expansion time and document it in full. Luxon's is the closest fit for a Temporal-first library and is the recommended starting point; whichever is chosen, the JSDoc must contain the complete token table, since a partially-documented token language is worse than none.

`locale` drives month, weekday, meridiem, and era name matching — depends on H1/H2 (`plain/locale/getLocaleMonthNames.ts`, `getLocaleWeekdayNames.ts`, `getLocaleMeridiems.ts`, `getLocaleEraNames.ts`). Reuse those; do not build a second name table.

Implementation lives in / extends `packages/gmt/src/regex/`.

## Scope boundary — read Decision 1
This story adds pattern *parsing* only. **A token formatter is deliberately excluded and is not a gap** — see Decision 1 for the full i18n reasoning. J12 (`formatToParts`) is the sanctioned answer for callers wanting output control. The JSDoc must state the intended use — decoding known fixed producer formats — and point at `formatDate` and `formatDateToParts` for display, so this function is not adopted as a general-purpose formatting round-trip.

## Standards exception — read Decision 4
`context/coding-standards.md` lists "Manual string parsing" as Forbidden. This story is the one named exception, and it is bound by three constraints:
1. The regex is built **from the pattern**, never hand-rolled per-format string slicing.
2. Extracted fields are **always handed to `Temporal.*.from()`** for final construction and validation — the regex proves shape, Temporal proves validity. A regex match is not sufficient to accept a date; `"02/31/2024"` matches `MM/dd/yyyy` and is not a real date.
3. The try-catch and sentinel-return rules are unchanged.

The `coding-standards.md` amendment recording this exception is part of this story's PR.

## Required inline comments
- On each regex construction step.
- An explicit note that field extraction is validated by handing off to `Temporal.*.from()` rather than trusted from the match, with the `"02/31/2024"` example.

## Common Mistakes entry (required)
In `format-date-time`: pattern parsing exists, pattern *formatting* deliberately does not, and why (Decision 1's one-line summary plus the pointer to J12). Without this, the asymmetry reads as an oversight and someone will file it as a bug.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analogs: `packages/gmt/src/regex/` for existing pattern infrastructure, `plain/locale/getLocaleMonthNames.ts` for the locale name tables. Re-verify Luxon's current token table via context7 rather than working from memory.

## Definition of done
Everything in Group J's shared Definition of Done, plus: every documented token, individually; literal/escaped text within a pattern; the full 17-locale matrix for month/weekday/meridiem/era tokens, with `hasFullIcu` ternaries; **a shape-valid but date-invalid input (`"02/31/2024"` against `MM/dd/yyyy`) returning `""`, proving the Temporal handoff is doing the validating**; two-digit year handling; ambiguous patterns; value not matching pattern → `""`; malformed pattern → `""`; invalid input → `""`. `context/coding-standards.md` carries the scoped exception.
```

---

## Tier 2

> **`cycle*` wrap-around field adjustment moved to Group E as E6** (2026-08-20, Decision 6). The capability is real and categorically distinct from arithmetic — see `issues/E.md` for the full spec, unchanged in content. It moved groups, not out of scope: its own motivation (datepicker segment editing) is UI-primitive-ambition territory, which `overview.md`'s Group E paragraph already owns, not a "gap users hit on day one" the way the rest of this group is scoped. It still depends on J1's `.with()` foundation — see E6's own dependency note for the cross-group pointer.

### J8 — Duration introspection

**GitHub Issue:** Issue #103

**Title:**

```
J8 Add getDurationUnit, durationAs, negateDuration, absDuration, compareDurations, getDurationSign
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group J, item J8. Surfaced by the 2026-08-20 parity audit.

## Gap
GMT's `src/duration/` namespace has six functions (`parseDuration`, `isValidDuration`, `addDuration`, `subtractDuration`, `normalizeDuration`, `formatDuration`) against Luxon's ~25 `Duration` members. Missing: reading a single component out of a duration, expressing a duration as a total in one unit, negation, absolute value, and comparison. Verified 2026-08-20 against the file listing of `packages/gmt/src/duration/`.

Comparison libraries:
- Luxon: `.get(unit)`, `.hours`/`.minutes`/etc., `.as(unit)`, `.negate()`, `Duration.fromMillis`, comparison via `.valueOf()`
- date-fns: `milliseconds()`, plus the `daysToWeeks`/`hoursToMinutes`/`minutesToSeconds`/`secondsToMilliseconds` conversion family — all of which `durationAs` subsumes in one function
- Moment: `.as(unit)`, `.get(unit)`, `.asHours()` etc.

## Scope
- `getDurationUnit(value, unit): number | null` — read one component (Luxon `.get()`)
- `durationAs(value, unit, options?): number | null` — total expressed in one unit (Luxon `.as()`); `options.relativeTo` for calendar units
- `negateDuration(value): string` — Luxon `.negate()`
- `absDuration(value): string` — absolute value
- `compareDurations(a, b, options?): number | null` — `-1`/`0`/`1`; wraps `Temporal.Duration.compare`, which does take `relativeTo`
- `getDurationSign(value): number | null` — `-1`/`0`/`1`, from Temporal's `.sign`

Sentinels per the convention: `null` for numbers, `""` for strings.

## The relativeTo constraint
`durationAs` and `compareDurations` follow the documented A2/A3 pattern: any calendar unit (years/months/weeks) on either side requires `relativeTo`, and returns the sentinel without it. A2 and A3 both hit this and both documented it as a known gap rather than working around it — do the same, and cross-reference their JSDoc so the three explanations stay consistent.

Note the asymmetry worth documenting: `Temporal.Duration.compare` **does** accept `relativeTo`, while `.add()`/`.subtract()` (A2) do not. `compareDurations` is therefore usable on calendar-unit durations in cases where `addDuration` is not.

## Common Mistakes entry (required)
Calendar units without `relativeTo` return the sentinel, not a best-effort answer — "P1M" has no fixed length, so `durationAs("P1M", "day")` cannot be answered without knowing which month. Extend the existing `durations` skill entry from A2/A3 rather than adding a competing one.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analogs: `duration/normalize/normalizeDuration.ts` (the `relativeTo` option shape, from A3), `duration/calculate/addDuration.ts` (the `relativeTo`-absent documented gap, from A2). Read A2's and A3's roadmap entries in `story-groups.md` before starting — both contain findings that reshaped their implementations mid-flight.

## Definition of done
Everything in Group J's shared Definition of Done, plus: every unit for `getDurationUnit` and `durationAs`; calendar units with and without `relativeTo` (the latter → sentinel); negative durations, where Temporal stores every field as negative; zero-length duration; `compareDurations` at all three results plus an equal-but-differently-expressed pair (`"PT60M"` vs `"PT1H"`); fractional seconds; invalid duration string → sentinel.
```

### J9 — Interval length and partitioning

**GitHub Issue:** Issue #104

**Title:**

```
J9 Add intervalLength, intervalDivideEqually, intervalSplitAt, mergeIntervals, intervalXorAll
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group J, item J9. Surfaced by the 2026-08-20 parity audit. Depends on Groups B and G (interval namespace and its conventions).

## Gap
Groups B, B7, and G established the interval namespace across `plain/interval/`, `zoned/interval/`, `unix/interval/`, `utc/interval/`. Five Luxon `Interval` capabilities remain uncovered — verified 2026-08-20 against the file listing:

- **`intervalLength(interval, unit)`** — Luxon `.length(unit)`. **Distinct from G1's `intervalCount`**: `intervalCount` counts calendar-unit *boundaries crossed* (11:59pm→12:01am crosses one day boundary, `count("days") === 2`), while `length` is the *exact duration* in that unit (the same interval is `0.0014` days). G1's own spec calls out the distinction from the other direction; this is the missing half.
- **`intervalDivideEqually(interval, n)`** — Luxon `.divideEqually(n)`; split into n equal sub-intervals.
- **`intervalSplitAt(interval, points)`** — Luxon `.splitAt(...dates)`; split at arbitrary points.
- **`mergeIntervals(intervals)`** — Luxon static `Interval.merge`; collapse a list into the minimum set of non-overlapping intervals. B5's `intervalUnion*` is **pairwise only** and does not cover the list form.
- **`intervalXorAll(intervals)`** — Luxon static `Interval.xor` over a list. B7's `intervalXor*` is likewise pairwise only.

## Scope
Follow the existing per-type naming already established across the four interval directories (`intervalLengthDate`, `intervalLengthDateTime`, `intervalLengthTime`, `intervalLengthZoned`, `intervalLengthUnix`, `intervalLengthUtc`, and so on) — do not introduce a new naming scheme. Match B4's object-return convention for functions returning intervals, and the array sentinel (`[]`) for the list-returning ones.

Given the size, this may split into two PRs at spec-expansion time — the two measurement functions (`intervalLength`, `intervalDivideEqually`) and the three set/partition functions (`intervalSplitAt`, `mergeIntervals`, `intervalXorAll`). Decide before starting rather than mid-flight.

## Required inline comments
At `intervalLength`'s definition site: distinguish it from `intervalCount` with the 11:59pm→12:01am example. The two read as synonyms and a reader arriving at either one needs to know the other exists.

## Common Mistakes entry (required)
`intervalLength` vs `intervalCount` — the same interval returns `0.0014` from one and `2` from the other, and both are correct. Name which question each answers.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analogs: `plain/interval/intervalCountDate.ts` (G1 — read this first, since J9's headline function is defined by contrast with it), `plain/interval/intervalUnionDate.ts` (B5, the pairwise form `mergeIntervals` generalizes), `plain/interval/intervalXorDate.ts` (B7, same for `intervalXorAll`).

## Definition of done
Everything in Group J's shared Definition of Done, plus: **an explicit test asserting `intervalLength` and `intervalCount` diverge on the 11:59pm→12:01am case** — this is the regression that keeps the two from being "simplified" into each other; `divideEqually` with n not dividing evenly; n = 1 and n = 0; `splitAt` with points outside the interval, on the boundaries, and unsorted; `mergeIntervals` on already-disjoint, fully-overlapping, adjacent, and empty lists; `battleTestTimeZones` for zoned variants including an interval spanning a DST transition; invalid input → `[]` or `null` per return type.
```

### J10 — Offset and DST-instant accessors

**GitHub Issue:** Issue #105

**Title:**

```
J10 Add getZonedOffset, getTimeZoneOffset, formatTimeZoneName, isInDaylightSaving
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group J, item J10. Surfaced by the 2026-08-20 parity audit. Sequence after H3 and I3. **Re-scoped 2026-08-20 (Decision 6)** — the original spec proposed three near-duplicate offset-representation functions (`getZonedOffset`/`getZonedOffsetMinutes`/`getZonedOffsetNanoseconds`), the same per-unit-variant shape J8 already solved correctly with `getDurationUnit(value, unit)`. Consolidated below to one string getter plus one parameterized numeric getter.

## Gap
GMT can construct and manipulate zoned values but cannot report their offset. Verified 2026-08-20: `grep -rn "offsetNanoseconds\|offsetName" packages/gmt/src` finds `offsetNanoseconds` used only *inside* `zoned/validate/hasDaylightSaving.ts` (H3), never exposed; `parseTimeZoneFromZoned` returns the IANA identifier only. This is a real internal-consistency gap — H3 already proves GMT computes this value, it just never surfaces it (Decision 6).

Comparison libraries (prior art, secondary per Decision 6): Luxon `.offset`, `.offsetNameShort`, `.offsetNameLong`, `.isInDST`; `@date-fns/tz` `tzOffset`; Moment `.utcOffset()`, `.zoneAbbr()`.

## Scope
- `getZonedOffset(value): string` — `"-04:00"`; `""` on invalid. Kept as its own function rather than folded into the numeric getter below, since its return type (a formatted string) differs in kind, not just in unit.
- `getZonedOffsetAs(value, unit): number | null` — subsumes `getZonedOffsetMinutes`/`getZonedOffsetNanoseconds`; `unit: "minutes" | "nanoseconds"`, following J8's `getDurationUnit(value, unit)` precedent for reading one differently-scaled representation of the same underlying quantity through a single parameterized call.
- `getTimeZoneOffset(timeZone, instant): string` — offset for a zone at a given instant, without needing a zoned value in hand
- `formatTimeZoneName(timeZone, locale, options?): string` — localized zone name; `options.style` covering the `Intl.DateTimeFormat` `timeZoneName` values (`"short"`, `"long"`, `"shortOffset"`, `"longOffset"`, `"shortGeneric"`, `"longGeneric"`)
- `isInDaylightSaving(value): boolean` — **whether a specific instant is in DST**

## Three DST functions, three different questions
This is the third DST-related function in the roadmap and the distinction must be stated in all three JSDoc blocks, since the names are close enough to be misread:

- **H3 `hasDaylightSaving(timeZone)`** — does this zone observe DST *at all*? Zone-level, no instant.
- **I3 `listDstTransitions(timeZone, year)`** — *where* do this zone's transitions fall? Enumerates instants.
- **J10 `isInDaylightSaving(value)`** — is *this particular instant* currently in DST? Luxon's `.isInDST`.

Group C's `disambiguation`/`offset` options are a fourth, orthogonal concern: what to do when a construction *lands* on an ambiguous or nonexistent instant.

Implementation note: `isInDaylightSaving` likely compares the value's offset against the zone's standard (non-DST) offset. H3's `hasDaylightSaving` already establishes an offset-comparison primitive — reuse or extend it rather than writing a second one, and confirm the approach holds for zones whose standard offset itself changed historically.

## Required inline comments
On `isInDaylightSaving`'s offset-comparison logic: what "standard offset" means for a zone with historical rule changes, and why the chosen reference points are correct. This is the subtle part.

## Common Mistakes entry (required)
The H3 / I3 / J10 / Group-C four-way distinction, stated as four questions with the function that answers each. Add to `zoned-date-ops`.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analogs: `zoned/validate/hasDaylightSaving.ts` (H3 — the offset-comparison primitive), `zoned/parse/parseTimeZoneFromZoned.ts` (zoned accessor structure). Read `docs/dst-disambiguation.md` for existing terminology and stay consistent with it.

## Definition of done
Everything in Group J's shared Definition of Done, plus: `battleTestTimeZones`, including the half- and quarter-hour zones (`Asia/Kolkata` +5:30, `Asia/Kathmandu` +5:45, `Pacific/Chatham` +13:45) — an offset formatter that assumes whole hours passes a UTC-only test and fails in production; both sides of a spring-forward and a fall-back transition in `America/Chicago` and `Europe/Berlin`; a southern-hemisphere zone, where DST spans the new year; a zone with no DST → `isInDaylightSaving` always `false`; the full 17-locale matrix for `formatTimeZoneName` with `hasFullIcu` ternaries; every `style` value; invalid input → sentinel. `docs/dst-disambiguation.md` updated with the four-way distinction.
```

### J12 — `formatToParts` family

**GitHub Issue:** Issue #106

**Title:**

```
J12 Add formatDateToParts, formatDateTimeToParts, formatZonedToParts
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group J, item J12. Surfaced by the 2026-08-20 parity audit. **This story is the sanctioned answer to the token-formatter request — read Decision 1 at the top of this file first.**

## Gap
GMT's format functions return finished strings. There is no way to get the *components* of a localized date back — verified 2026-08-20: `grep -rn "formatToParts" packages/gmt/src` finds it used internally by H1/H2's locale-name lookups (`plain/locale/getLocaleMeridiems.ts`, `getLocaleEraNames.ts`) but never exposed.

`@internationalized/date`'s `DateFormatter.formatToParts` exists precisely because every datepicker needs this: to render editable segments, you need to know that this locale puts day before month, and where the literals fall.

## Scope
- `formatDateToParts(value, locale?, options?): Array<{ type: string; value: string }>`
- `formatDateTimeToParts(value, locale?, options?): Array<{ type: string; value: string }>`
- `formatZonedToParts(value, locale?, options?): Array<{ type: string; value: string }>`

`[]` on invalid input per the array-return sentinel convention. Options mirror the existing `formatDate`/`formatDateTime`/`formatZonedDateTime` `Intl.DateTimeFormatOptions` parameter exactly — these are the same functions with a different return shape, and their signatures should be recognizably parallel.

## Why this exists — read Decision 1
This is GMT's substitute for a token formatter (Luxon `toFormat`, date-fns `format`, Moment `.format()`), which is **deliberately excluded** and is not a gap. A token pattern hard-codes field order and ships US ordering to every locale; `formatToParts` gives the caller full control over presentation while the *locale* keeps control of order. A caller wanting "Mar 15" styled a particular way reorders or restyles parts; a caller wanting `"MM/dd/yyyy"` output is asking for something GMT declines to provide, and the JSDoc should route them here.

## Required inline comments
A comment recording that this function exists as the substitute for a token formatter, with a one-line pointer to Decision 1 in `context/roadmap/issues/J.md`. Without it, a future contributor reads this as an incidental Intl passthrough and misses that it carries a design decision.

## Common Mistakes entry (required)
In `format-date-time`: do not reassemble parts in a fixed order — that reintroduces exactly the bug `formatToParts` exists to avoid. Iterate the array as returned; the locale already ordered it.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analogs: `plain/format/formatDate.ts` (the option shape to mirror), `plain/locale/getLocaleMeridiems.ts` (existing internal `formatToParts` usage).

## Definition of done
Everything in Group J's shared Definition of Done, plus: the full 17-locale matrix with `hasFullIcu` ternaries; **an assertion that part *order* differs between at least two locales** (en-US month-first vs. fr-FR day-first) — this is the property the function exists for and it must be pinned by a test; RTL locales (ar-SA, he-IL); `literal` parts present and correct; every `type` value the chosen options produce; `timeZoneName` parts for the zoned variant; invalid input → `[]`.
```

---

## Tier 3

### J4 — Week-numbering year

**GitHub Issue:** Issue #107

**Title:**

```
J4 Add getWeekYear, getLocaleWeekYear, getWeeksInLocaleWeekYear
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group J, item J4. Surfaced by the 2026-08-20 parity audit. **Depends on J0b** for namespace placement; pairs with J3.

## Gap
GMT reports the ISO week *number* (`plain/calculate/weekOfYear.ts`'s `weekOfYearForDate`, `getWeekNumber.ts`) but not the week-numbering *year* it belongs to. Verified 2026-08-20: `grep -ril "weekYear" packages/gmt/src` returns nothing.

These differ, and the difference is the whole point: 2024-12-30 is a Monday in ISO week 1 — of **2025**, not 2024. Reporting week 1 without the year it belongs to is actively misleading for anything that buckets by week.

Comparison libraries: Luxon `.weekYear`, `.localWeekYear`, `.weeksInWeekYear`, `.weeksInLocalWeekYear` (3.4+); date-fns `getISOWeekYear`, `getWeekYear`, `setISOWeekYear`.

## Scope
- `getWeekYear(value): number | null` — ISO 8601 week-numbering year
- `getLocaleWeekYear(value, locale): number | null` — locale-relative equivalent
- `getWeeksInLocaleWeekYear(value, locale): number | null` — 52 or 53, locale-relative

Per J0b's rule these take a value and live in `plain/calculate/`. `null` on invalid input. Locale variants reuse `internal/getLocaleFirstDayOfWeek.ts`.

J3's `getWeeksInYear` is the ISO counterpart of the third function here — coordinate the two stories at spec-expansion time so the ISO and locale versions land with consistent naming and do not duplicate logic.

## Required inline comments
On any week-numbering branch: which convention is in play (ISO Monday-start vs. locale first-day) and why. Same requirement as J3, for the same reason.

## Common Mistakes entry (required)
Week number without week-year is a bug in waiting. Pair `weekOfYearForDate` with `getWeekYear` when bucketing by week, or December dates land in the wrong bucket.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analogs: `plain/calculate/weekOfYear.ts`, `plain/calculate/getLocaleStartOfWeek.ts`.

## Definition of done
Everything in Group J's shared Definition of Done, plus: **2024-12-30 → week-year 2025** and the symmetric early-January case where a date falls in the previous week-year; a 53-week year; the full 17-locale matrix, including at least one locale where the locale week-year and the ISO week-year disagree for the same date; invalid input → `null`.
```

### J7 — Weekday navigation

**GitHub Issue:** Issue #108

**Title:**

```
J7 Add nextWeekday and previousWeekday
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group J, item J7. Surfaced by the 2026-08-20 parity audit.

## Gap
GMT cannot answer "the next Tuesday on or after this date". Verified 2026-08-20: `grep -ril "nextMonday\|nextDay" packages/gmt/src` finds only an unrelated internal variable in `zoned/map/mapZonedHoursInDay.ts`.

date-fns ships sixteen functions for this — `nextDay`, `nextMonday` through `nextSunday`, `previousDay`, `previousMonday` through `previousSunday`. Luxon has no direct equivalent; Moment requires manual `.day()` arithmetic.

## Scope
Per Decision 5, two parameterized functions rather than sixteen:

- `nextWeekday(value, dayOfWeek, options?): string`
- `previousWeekday(value, dayOfWeek, options?): string`

`dayOfWeek` uses Temporal's ISO numbering (1 = Monday … 7 = Sunday), consistent with the existing `getDayOfWeek`/`parseDayOfWeekFromDate`. `""` on invalid input.

`options.inclusive?: boolean` — whether a `value` already falling on `dayOfWeek` returns itself or advances a full week. Default `false` (advance), matching date-fns. This mirrors the `inclusive` option B3 added to `intervalsOverlap` for the same class of edge-adjacency question — follow B3's precedent for naming and defaulting.

**JSDoc must carry the Decision 5 mapping table**: `nextMonday` → `nextWeekday(value, 1)`, `previousFriday` → `previousWeekday(value, 5)`, and so on for all sixteen date-fns names.

Zoned equivalents as a follow-up, consistent with how Groups B and F sequence plain-then-zoned.

## Not a gap — do not add
date-fns's `lastDayOfMonth` is **already covered** by `endOfDate(value, "month")`. Verified 2026-08-20. Record this in the spec so it is not re-filed by a later audit.

## Common Mistakes entry (required)
The `inclusive` default: `nextWeekday("2024-03-15", 5)` on a date that *is* already a Friday returns the following Friday, not the input. This is date-fns-compatible but surprises people.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analogs: `plain/calculate/addBusinessDays.ts` and `internal/advanceBusinessDays.ts` (F1 — weekday-stepping arithmetic), `plain/interval/intervalsOverlapDate.ts` (B3 — the `inclusive` option precedent).

## Definition of done
Everything in Group J's shared Definition of Done, plus: all seven `dayOfWeek` values from a fixed start date; `inclusive` true and false on a value already falling on the target day, plus the explicit-default row; month and year boundary crossings; a leap-day start; `dayOfWeek` out of range (0, 8) → `""`; invalid input → `""`.
```

### J13 — Named machine formats

**GitHub Issue:** Issue #109

**Title:**

```
J13 Add RFC 2822, HTTP, SQL, and RFC 3339 format and parse functions
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group J, item J13. Surfaced by the 2026-08-20 parity audit. **Sequence after J11** — the parse side shares its regex infrastructure.

## Gap
GMT emits ISO 8601 and localized `Intl` output. It cannot produce or consume the fixed-grammar interchange formats that HTTP, email, and SQL require. Verified 2026-08-20: no RFC- or HTTP-named function anywhere in `packages/gmt/src`.

Comparison libraries: Luxon `toRFC2822`/`fromRFC2822`, `toHTTP`/`fromHTTP`, `toSQL`/`fromSQL`; date-fns `formatRFC3339`, `formatRFC7231`; Moment has all of these.

Concretely: setting an HTTP `Last-Modified` header, or parsing an email `Date:` header, is currently impossible with GMT alone.

## Scope
- `formatRfc2822(value): string` / `parseRfc2822(value): string` — email headers
- `formatHttp(value): string` / `parseHttp(value): string` — RFC 7231 / IMF-fixdate, for HTTP headers
- `formatSql(value): string` / `parseSql(value): string` — SQL datetime literals
- `formatRfc3339(value): string` / `parseRfc3339(value): string` — RFC 3339, a strict ISO 8601 profile

`""` on invalid input. Determine at spec-expansion time which namespaces each belongs in — HTTP and RFC 2822 are inherently absolute-time formats and likely belong under `zoned`/`utc` rather than `plain`.

**Required go/no-go decision, recorded in this story before implementation starts:** verify whether `formatRfc3339` is genuinely distinct from GMT's existing ISO output — RFC 3339 is a *profile* of ISO 8601 and Temporal's `toString()` may already satisfy it. This is not an implementation nicety to check in passing; per Decision 6, "a comparison library has this" is not sufficient justification on its own, and a passthrough with a new name would be exactly the kind of gap Decision 6 exists to catch before it's built. If `toString()` already satisfies the RFC, record `formatRfc3339`/`parseRfc3339` as a non-gap here and drop them from scope, following the discipline that discarded Group I's false positives — do not ship a passthrough just because Luxon names one.

## Why this survives Decision 1
These are **fixed, non-locale-adaptive grammars** — RFC 2822 mandates English weekday and month abbreviations regardless of locale, by specification. The i18n objection that excluded a token formatter does not apply: there is no locale-appropriate alternative ordering to lose, because the format is defined as a constant. Note this in the JSDoc so the two decisions do not read as contradictory.

## Required inline comments
Where a format mandates English names regardless of locale, say so at the point where the hardcoded table appears — a hardcoded English month table in an i18n-conscious library looks like a bug and will be "fixed" otherwise.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analogs: J11's regex infrastructure for the parse side, `plain/format/formatDate.ts` for the format side. Fetch each RFC's exact grammar rather than working from memory; these are specifications with precise required forms, including whether a leading zero or a specific separator is mandatory.

## Definition of done
Everything in Group J's shared Definition of Done, plus: a real-world header value round-tripping for each format; the obsolete RFC 2822 forms an email parser must still accept, if in scope; single-digit days, which the grammars pad differently; a non-UTC offset for the formats that permit one; **an assertion that output is identical across all 17 locales** — these formats must not vary by locale, and that is exactly the regression to pin; malformed input → `""`.
```

### J14 — Plain range formatting

**GitHub Issue:** Issue #110

**Title:**

```
J14 Add formatDateRange and formatDateTimeRange
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group J, item J14. Surfaced by the 2026-08-20 parity audit.

## Gap
GMT has `zoned/format/formatZonedRange.ts` and no plain equivalent. Verified 2026-08-20 against the file listing. A caller formatting a plain date range must format both ends and join them by hand — producing `"March 15, 2024 - March 17, 2024"` where `Intl` would produce the correct `"March 15 – 17, 2024"`, with the right dash and the right elision for the locale.

`Intl.DateTimeFormat.prototype.formatRange` handles this and GMT already uses it on the zoned side.

## Scope
- `formatDateRange(start, end, locale?, options?): string`
- `formatDateTimeRange(start, end, locale?, options?): string`

`""` on invalid input on either side. **Match `formatZonedRange`'s existing option shape and parameter order exactly** — this is its plain counterpart and any divergence is gratuitous.

Consider `formatTimeRange` at spec-expansion time; verify `Intl` handles a bare time range sensibly before committing to it.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analog: `zoned/format/formatZonedRange.ts` — read it first and mirror it; this story is close to a mechanical port.

## Definition of done
Everything in Group J's shared Definition of Done, plus: the full 17-locale matrix with `hasFullIcu` ternaries; same-day, same-month, same-year, and cross-year ranges, each of which `Intl` elides differently; a reversed range (end before start); an identical start and end, which `Intl` collapses to a single formatted value rather than a range; RTL locales; invalid input on either side → `""`.
```

### J15 — `formatCalendar`

**GitHub Issue:** Issue #111

**Title:**

```
J15 Add formatCalendar
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group J, item J15. Surfaced by the 2026-08-20 parity audit.

## Gap
Moment's `.calendar()` renders "Tomorrow at 2:30 PM", "Last Monday at 2:30 PM", "Today at 9:00 AM" — a relative day-name combined with a time. GMT has no equivalent.

**This corrects a claim in Group I's notes.** `overview.md` and `issues/I.md` record that GMT's existing `formatRelative*` family already covers Moment's `toRelative`/`toRelativeCalendar`. Verified 2026-08-20 by source read of `plain/format/formatRelativeDate.ts`: that family computes a difference and renders it through `Intl.RelativeTimeFormat`, producing "in 1 day" / "yesterday". The claim holds for **Luxon's** `toRelativeCalendar`, which produces the same shape. It does **not** extend to **Moment's** `calendar()`, whose output combines a relative day name with an absolute time — a different rendering that `Intl.RelativeTimeFormat` does not produce. Group I's note was accurate about Luxon and over-generalized to Moment.

## Scope
- `formatCalendar(value, locale?, options?): string` — plain datetime
- Zoned/unix/utc variants following the existing `formatRelative*` family's spread

`""` on invalid input. Options should include a `reference` (defaulting to now), mirroring `FormatRelativeDateOptions`'s existing `reference` field.

Implementation: `Intl.RelativeTimeFormat` with `numeric: "auto"` produces the day-name half ("tomorrow", "yesterday"); `Intl.DateTimeFormat` produces the time half; the two need a connector joining them per locale.

**Required go/no-go decision, recorded in this story before implementation starts, not deferred to spec-expansion time.** The connector-word problem is structurally the same i18n objection Decision 1 used to exclude token formatting: hardcoding "at" bakes in an English-specific construction the same way a `"MM/dd/yyyy"` token pattern bakes in US field order. Resolve one of two ways and record which:
1. **A verified `Intl` route with no hardcoded English** — investigate whether `Intl.ListFormat` or a `dateTimeFormat` pattern can supply the connector across locales; confirm via context7/source before committing, not from memory.
2. **An explicit documented-limitation decision**, per A4's precedent when native `Intl.DurationFormat` proved unavailable — ship with the connector word stated plainly as an English-only limitation in the JSDoc, and a test pinning the known-limited output so it can't silently regress or be mistaken for full i18n support.
Do not ship a hidden English assumption under either path — that is the outcome this decision exists to prevent.

Beyond ±1 week Moment falls back to an absolute date format; decide and document GMT's threshold.

## Common Mistakes entry (required)
`formatCalendar` vs `formatRelativeDateTime`: "Tomorrow at 2:30 PM" vs "in 1 day". Name which is wanted for what — the first for user-facing schedules, the second for elapsed-time displays.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analog: `plain/format/formatRelativeDate.ts` — read it in full first, both for structure and to confirm the gap analysis above still holds. Read A4's entry in `story-groups.md` for the precedent on handling an `Intl` API that does not cover the need. Re-verify Moment's `calendar()` thresholds via context7.

## Definition of done
Everything in Group J's shared Definition of Done, plus: today, tomorrow, yesterday, within-the-last-week, within-the-next-week, and beyond-threshold in both directions; the full 17-locale matrix with `hasFullIcu` ternaries, **including an assertion that the connector word is not the English "at" in non-English locales** — or, if the documented-limitation route is taken, a test pinning the known-limited output plus a JSDoc statement of the limitation; `Temporal.Now` mocked via `packages/gmt/src/test/mocks/`; an explicit `reference` overriding now; invalid input → `""`.
```
