# Testing Standards

## Use `it.each` with Template Literal Syntax

Always use backtick syntax, never array syntax:

```ts
// Correct
it.each`
  input           | expected
  ${"2024-03-10"} | ${10}
  ${"2024-03-15"} | ${15}
`("returns $expected for $input", ({ input, expected }) => {
  expect(getDay(input)).toBe(expected);
});

// Forbidden
it.each([
  ["2024-03-10", 10],
  ["2024-03-15", 15],
])("returns %s for %s", (input, expected) => { ... });
```

## Never Monkey-Patch Real Functions

Do not directly reassign or mutate runtime globals in tests. Use instead:

- `vi.useFakeTimers()` + `vi.setSystemTime(...)` + `vi.useRealTimers()` for deterministic "now"
- `vi.spyOn(...).mockReturnValue(...)` / `mockReturnValueOnce(...)` / `mockImplementation(...)` for controlled behavior

## Pre-built Mocks for Error Path Testing

Use the mocks in `packages/gmt/src/test/mocks` to test error-handling paths. Do not write custom mocks for these:

| Mock | What it mocks |
|---|---|
| `mockTemporalNowInstantThrow()` | `Temporal.Now.instant()` |
| `mockTemporalNowPlainDateTimeISOThrow()` | `Temporal.Now.plainDateTimeISO()` |
| `mockTemporalNowPlainDateISOThrow()` | `Temporal.Now.plainDateISO()` |
| `mockTemporalNowPlainTimeISOThrow()` | `Temporal.Now.plainTimeISO()` |
| `mockTemporalNowZonedDateTimeISOThrow()` | `Temporal.Now.zonedDateTimeISO()` |
| `mockTemporalPlainDateFromThrow()` | `Temporal.PlainDate.from()` |
| `mockTemporalPlainDateTimeFromThrow()` | `Temporal.PlainDateTime.from()` |
| `mockTemporalPlainTimeFromThrow()` | `Temporal.PlainTime.from()` |
| `mockTemporalZonedDateTimeFromThrow()` | `Temporal.ZonedDateTime.from()` |
| `mockTemporalInstantFromThrow()` | `Temporal.Instant.from()` |

```ts
import { mockTemporalPlainDateFromThrow } from "@gmt/test/mocks";

it("returns empty string when Temporal.PlainDate.from throws", () => {
  mockTemporalPlainDateFromThrow();
  expect(addDays("2024-03-10", 1)).toBe("");
});
```

## Locale Matrix Coverage

Any function that accepts a `locale` argument must test all 17 locales using named constants from `MustTestLocales`:

`en-US`, `en-GB`, `de-DE`, `fr-FR`, `es-ES`, `it-IT`, `pt-PT`, `sv-SE`, `is-IS`, `zh-CN`, `zh-TW`, `ja-JP`, `ko-KR`, `ar-SA`, `he-IL`, `ru-RU`, `tr-TR`

Reference constants by name (e.g. `MustTestLocales.enUS`) — do not iterate a generic array that hides locale names. Explicit rows make coverage visible and auditable.

## Full vs. Partial ICU

`Intl` output varies between full-ICU and partial-ICU Node builds. Use `hasFullIcu` (from `src/test/hasFullIcu.ts`) for any locale row where the two differ:

```ts
${"ko-KR"} | ${hasFullIcu ? "오후 2:30" : "PM 2:30"}
```

The ternary keeps both expected values visible in the table so the test doubles as documentation. See `src/test/hasFullIcu.ts` for the probe logic and contributor notes on extending it.
