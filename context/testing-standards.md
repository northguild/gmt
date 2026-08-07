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

## ICU/CLDR Wording Variance Across Node Versions

CLDR data embedded in Node's ICU build changes between major ICU versions (which track Node major versions). A handful of locale/option combinations render different wording on ICU 77 (Node 20) vs. ICU 78 (Node 22/24) — e.g. pt-PT's day period ("da tarde" → "p.m."), Turkish/Korean long time zone names, Hebrew/Swedish relative-time phrasing. Every Node LTS ships complete locale data; the *wording* CLDR chose for a given locale/option simply changed between versions.

Use `oneOfIcu`/`expectOneOfIcu` (from `src/test/icuVariants.ts`) for any golden verified (against real Node 20/22/24 runs) to differ solely by CLDR wording:

```ts
import { expectOneOfIcu, oneOfIcu } from "../../test";

it("formats valid time for pt-PT with 12-hour day period as one of the known ICU variants", () => {
  expectOneOfIcu(
    formatZonedDateTime(value, MustTestLocales.ptPT, options),
    oneOfIcu("03/02/2024, 02:30:45 da tarde", "03/02/2024, 02:30:45 p.m."),
  );
});
```

Only add a variant that has been independently confirmed to come from a real ICU version — this mechanism is for masking known wording revisions, not for tolerating an unexplained mismatch.

## Day-Period Word Variance (ko-KR / ja-JP / zh-CN / zh-TW)

Some CI runners' ICU/CLDR data render the 12-hour day-period marker for Korean, Japanese, and Chinese locales as ASCII `"AM"`/`"PM"` instead of the native-script word (오전/오후, 午前/午後, 上午/下午), even when the same Node version renders the native word locally. This has been observed to vary by host/runner, not just by Node version — it is not reliably reproducible locally, so do not "fix" a failure like this by editing the golden string alone; it will likely still fail on whichever environment renders the other way.

**Do not** work around this by normalizing day-period words inside library source (e.g. `src/internal/normalizeDateTime.ts`) — that function's output feeds real `formatDateTime`/`formatTime`/etc. return values, so canonicalizing there would silently change production behavior for every caller (e.g. `formatTime(..., "ko-KR", ...)` would start returning `"PM"` instead of `"오후"`). This is a test-comparison concern only.

Instead, use `expectDateTimeEqual` (in place of `expect(...).toBe(...)`/`.toEqual(...)`) or `expectOneOfDateTimeIcu` (in place of `expectOneOfIcu`, when a golden also needs `oneOfIcu`'s wording-variant tolerance) from `src/test/icuVariants.ts` for any golden containing a ko-KR/ja-JP/zh-CN/zh-TW day-period word:

```ts
import { expectDateTimeEqual, MustTestLocales } from "../../test";

it.each`
  value            | options                    | expected
  ${"14:30:45"}    | ${{ timeStyle: "full" }}   | ${"오후 2:30:45"}
`(
  "formats valid time $value for ko-KR with options $options to $expected",
  ({ value, options, expected }) => {
    expectDateTimeEqual(
      formatTime(value, MustTestLocales.koKR, options),
      expected,
    );
  },
);
```

Both helpers canonicalize known day-period variants on both sides before comparing, so the assertion still fails on a genuinely different result — only the AM/PM-vs-native-script divergence is tolerated.
