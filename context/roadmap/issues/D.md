### D1 — `isWeekend` / `isZonedWeekend`

**GitHub Issue:** #41

**Title:**

```
D1 Add isWeekend plain and isZonedWeekend
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group D, item D1.

## Gap
react-aria's `isWeekend(date, locale)` checks whether a date falls on a weekend according to locale (e.g. en-US: Sat/Sun, he-IL: Fri/Sat). GMT has no locale-aware weekend check at all.

## Scope
- `isWeekend(value: string, locale: string): boolean` (plain, operates on a plain date string).
- `isZonedWeekend(value: string, locale: string): boolean` (zoned equivalent).
- Use `Intl.Locale` weekend data (`weekInfo`) where available; document and test the fallback behavior where a runtime doesn't expose it (see `context/project-overview.md`'s ICU/runtime variance notes and `hasFullIcu` pattern).

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. This is additive — do not modify the existing ISO-only `getDayOfWeek`.

## Definition of done
Full 17-locale test matrix per `context/testing-standards/index.md` (weekend days differ meaningfully across at least en-US, fr-FR, he-IL, ar-SA — make sure the matrix actually exercises the locale-dependent branches, not just default English), JSDoc, exports, README/changeset, lint/test pass.
```

### D2 — `getLocaleStartOfWeek` / `getLocaleEndOfWeek`

**GitHub Issue:** #42

**Title:**

```
D2 Add getLocaleStartOfWeek, getLocaleEndOfWeek plain and zoned
```

**Description:**

```
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group D, item D2.

## Gap
react-aria's `startOfWeek(date, locale)`/`endOfWeek(date, locale)` compute week boundaries relative to the locale's first day of week (en-US: Sunday, fr-FR: Monday). GMT's existing `startOfDate`/`endOfDate` family is ISO-Monday-only, no locale parameter.

## Scope
- `getLocaleStartOfWeek(value: string, locale: string): string` / `getLocaleEndOfWeek(value: string, locale: string): string` (plain).
- Zoned equivalents.
- Additive alongside the existing ISO-only functions — do not replace them.

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analog: `plain/calculate/startOfDate.ts` / `endOfDate.ts`.

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
Part of the parity roadmap — see `context/roadmap/index.md`, Story Group D, item D3.

## Gap
react-aria's `getDayOfWeek(date, locale)` returns a day-of-week index relative to the locale's first day (0 = locale's first day), distinct from GMT's existing ISO-fixed `getDayOfWeek`.

## Scope
- `getLocaleDayOfWeek(value: string, locale: string): number | null` (plain), returning `null` on invalid input per GMT's number-return sentinel convention.
- Zoned equivalent.
- Additive alongside the existing `getDayOfWeek` — do not replace it, and pick a name that avoids confusion with the existing ISO version (confirm naming during spec expansion).

## Before starting
See "Instructions for the agent picking up a story" in `context/roadmap/index.md`. Nearest analog: `plain/get/getDayOfWeek.ts`.

## Misc
Add full unit test coverage for all internal utils.

## Definition of done
Full 17-locale test matrix, JSDoc, exports, README/changeset, lint/test pass.
```
