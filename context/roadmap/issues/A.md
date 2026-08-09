### A1 — `parseDuration` / `isValidDuration`

**GitHub Issue:** #27

**Title:**

```
A1 Add parseDuration, isValidDuration ISO 8601 duration parsing
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group A, item A1.

## Gap
GMT has no way to parse or validate ISO 8601 duration strings (e.g. "P1DT2H30M"). Luxon has `Duration.fromISO`/`Duration.fromObject`. This is the foundation story for the rest of Story Group A (A2–A5 depend on it).

## Scope
- `isValidDuration(value: string): boolean` — validate an ISO 8601 duration string via `Temporal.Duration.from`.
- `parseDuration(value: string): string` — parse and re-normalize an ISO 8601 duration string, returning `""` on invalid input (per GMT's sentinel-return contract).
- New `src/duration/` namespace, following the existing `src/plain/validate/` and `src/plain/parse/` file structure.

## Before starting
Read the "Instructions for the agent picking up a story" section in `context/roadmap/index.md` — re-verify the gap, read `context/coding-standards.md` / `context/testing-standards.md` / `context/jsdoc-standards.md`, find the nearest existing analog (`plain/validate/isValidDate.ts`, `plain/parse/parseYearFromDate.ts`), and expand this into a full spec before writing code.

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
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group A, item A2. Depends on A1 (`parseDuration`/`isValidDuration`).

## Gap
Luxon's `Duration.plus`/`Duration.minus` let you combine two durations. GMT has no equivalent — combine two ISO 8601 duration strings via `Temporal.Duration.add`/`Temporal.Duration.subtract`, returning an ISO duration string.

## Scope
- `addDuration(a: string, b: string): string`
- `subtractDuration(a: string, b: string): string`
- Both return `""` on invalid input (either operand fails `isValidDuration`).

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Match the try-catch/sentinel pattern in `plain/calculate/addDate.ts`.

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
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group A, item A3. Depends on A1/A2.

## Gap
Luxon's `Duration.shiftTo`/`Duration.rescale` roll small units into larger ones (e.g. 90 minutes → 1 hour 30 minutes). GMT has no equivalent — wrap `Temporal.Duration.round`/balance semantics, string-in/string-out.

## Scope
- `normalizeDuration(value: string): string` — re-balance an ISO duration string into its largest-unit representation.
- Decide and document the specific Temporal rounding options used (see Temporal.Duration.round's `relativeTo`, `largestUnit`, `smallestUnit` — note some rebalancing requires a `relativeTo` reference point for calendar units like months; document this constraint clearly in the JSDoc).

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`.

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
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group A, item A4. Depends on A1.

## Gap
Luxon's `Duration.toHuman` humanizes a duration standalone (not relative to "now" — GMT's existing `formatRelative*` family is anchored to now). GMT has no way to render "2 hours, 30 minutes" from a duration value directly.

## Scope
- `formatDuration(value: string, locale: string, options?: ...): string` — render an ISO duration string via `Intl.DurationFormat` where available.
- Investigate `Intl.DurationFormat` runtime support; document a fallback plan if support is thin (per `context/project-overview.md`'s notes on ICU/runtime variance).
- Full locale matrix required per `context/testing-standards.md` (17 locales), with `hasFullIcu` ternaries where output differs.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Look at `formatRelativeDate.ts` for the locale-handling and `hasFullIcu` pattern to mirror.

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
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group A, item A5. Depends on A1–A3.

## Gap
GMT's `diff*` functions return a single-unit number. There's no way to get a full breakdown (e.g. "2 days, 3 hours") as Luxon's `Duration` allows. Add an additive, non-breaking way for these functions to optionally return an ISO 8601 duration string instead of/alongside a single-unit number.

## Scope
- Decide at implementation time (per roadmap note): either an optional return-shape parameter on existing `diff*` functions, or new sibling functions (e.g. `diffDateAsDuration`). Document the decision and rationale in the PR description.
- Cover all five: `diffDate`, `diffDateTime`, `diffZoned`, `diffUnix`, `diffUtc`.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. This is the largest story in Group A — confirm the API-shape decision doesn't conflict with `context/coding-standards.md`'s string-in/string-out contract before writing code.

## Definition of done
Same checklist as A1, applied across all five touched functions.
```
