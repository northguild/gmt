### F1 — `addBusinessDays` / `subtractBusinessDays`

**GitHub Issue:** #54

**Title:**

```
F1 Add addBusinessDays, subtractBusinessDays
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group F, item F1. Motivated by a competitive gap found against `temporal-kit`, an emerging Temporal-first utility library (see roadmap Context section) — it has `addBusinessDays`, GMT has no equivalent.

## Gap
GMT's `addDate`/`subtractDate` count calendar days only. There is no way to add/subtract N business days (Mon–Fri), skipping weekends. Holiday calendars are explicitly out of scope — this is Mon–Fri only, matching `temporal-kit`'s scope.

## Scope
- `addBusinessDays(value: string, amount: number): string` / `subtractBusinessDays(value: string, amount: number): string` (plain, ISO date string in/out).
- Zoned equivalents as a follow-up story once the plain versions establish the pattern (do not build both in parallel, consistent with how Story Group B sequences plain-then-zoned).
- Decide during spec expansion whether a negative `amount` on `addBusinessDays` should behave like `subtractBusinessDays` or be rejected — document the choice.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analog: `plain/calculate/addDate.ts`. F2 (`isBusinessDay`) is a natural prerequisite/pairing since the weekend-skip logic is shared — consider whether to land F2 first or inline the check here and extract later.

## Definition of done
Tests (crossing weekend boundaries in both directions, multi-week spans, zero-amount, negative-amount), JSDoc, exports, README/changeset, lint/test pass.
```

### F2 — `isBusinessDay`

**GitHub Issue:** #55

**Title:**

```
F2 Add isBusinessDay
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group F, item F2. Pairs with F1.

## Gap
GMT has no locale-agnostic Mon–Fri business-day check. This is distinct from Story Group D's locale-aware `isWeekend`/`isZonedWeekend` (D1), which vary by region (e.g. he-IL's weekend is Fri/Sat) — `isBusinessDay` is a fixed ISO Mon–Fri check, matching `temporal-kit`'s scope and needed internally by F1's boundary-skipping logic.

## Scope
- `isBusinessDay(value: string): boolean` (plain), `false` on invalid input per GMT's boolean-return sentinel convention.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analog: `plain/compare/` boolean-returning functions. Do not confuse with D1's locale-aware `isWeekend` — this is intentionally ISO-fixed.

## Definition of done
Tests (each day of the week, invalid input), JSDoc, exports, README/changeset, lint/test pass.
```

### F3 — `clampDate` / `closestDateTo`

**GitHub Issue:** #56

**Title:**

```
F3 Add clampDate, closestDateTo
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group F, item F3. Found during a full function-by-function audit of `temporal-kit`'s API (2026-08-08) — it has `clamp`/`closestTo`, GMT has no equivalent.

## Gap
GMT's `minDate`/`maxDate` reduce an array to its extremum. Neither covers: (a) restricting a single value to a `[min, max]` bound (clamp), or (b) finding the candidate in a collection nearest to a target point (closest-to), which is a different operation from either extremum.

## Scope
- `clampDate(value: string, min: string, max: string): string` (plain) — returns `value` if within bounds, otherwise the nearest bound. Returns `""` on invalid input (including `min > max`).
- `closestDateTo(target: string, candidates: string[]): string | null` (plain) — returns the candidate nearest `target`; `null` on invalid input or empty/all-invalid `candidates`. Decide and document tie-breaking behavior (two equidistant candidates) during spec expansion.
- Zoned equivalents as a follow-up story once the plain versions establish the pattern, consistent with how Story Group B and F1 sequence plain-then-zoned.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analogs: `plain/calculate/minDate.ts`/`maxDate.ts` for the validation/reduce pattern, `plain/compare/isBetweenDate.ts` for the bounds-checking shape `clampDate` needs internally.

## Definition of done
Tests (`clampDate`: value within/below/above bounds, invalid `min > max`; `closestDateTo`: target before/after/between candidates, tie-breaking case, empty array, all-invalid array), JSDoc, exports, README/changeset, lint/test pass.
```

### F4 — `roundTime` (and `roundDateTime`)

**GitHub Issue:** #57

**Title:**

```
F4 Add roundTime, roundDateTime
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group F, item F4. Found during a full function-by-function audit of `temporal-kit`'s API (2026-08-08) — it has `floor`/`ceil`/`round` on arbitrary units; this was judged the clearest real product gap in the audit (matches UI patterns like time-picker snapping to 15-minute increments).

## Gap
GMT's `startOfDate`/`endOfDate` floor/ceil to calendar-unit boundaries (start of month, end of quarter, etc.) but there is no way to round a time-of-day value to an arbitrary granularity (e.g. round `14:37:00` to the nearest 15 minutes). The `RoundingOptions` type at `packages/gmt/src/types/rounding-options.ts` currently only rounds the *difference* between two values (`diff*` functions), not a standalone value.

## Scope
- `roundTime(value: string, options: { smallestUnit: Temporal.SmallestUnit<"hour">; roundingIncrement?: number; roundingMode?: Temporal.RoundingMode }): string` (plain) via `Temporal.PlainTime.prototype.round`. Returns `""` on invalid input.
- `roundDateTime(value: string, options: ...): string` (plain) via `Temporal.PlainDateTime.prototype.round`.
- Confirm during spec expansion whether to reuse the existing `RoundingOptions` type (currently typed against `Temporal.DateTimeUnit` for diff rounding) or introduce a narrower type scoped to time-granular units (minutes/seconds/etc. — rounding a calendar unit like "month" on a bare time doesn't apply).
- Zoned/unix/utc equivalents as follow-up stories once the plain version establishes the pattern.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analog: `plain/calculate/startOfDate.ts` for the file/JSDoc shape, `packages/gmt/src/types/rounding-options.ts` and its usage in `plain/calculate/diffDate.ts` for the existing rounding-option conventions to reuse or extend.

## Definition of done
Tests (round up/down/nearest across the increment boundary, each `roundingMode`, invalid input, an increment that doesn't evenly divide the unit), JSDoc, exports, README/changeset, lint/test pass.
```
