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

## New Options Get Exhaustive `it.each` Tables, Not One-Off `it()` Blocks

When a function gains a new parameter (an added option field, a new accepted value, a new optional argument), its tests must land as `it.each` tables covering the parameter's real permutation space — not as two or three quick `it()` blocks proving the happy path exists. A handful of one-off `it()`s look like coverage but consistently miss the edge cases that actually break: alternate enum values, the option's default-vs-explicit distinction, negative amounts, boundary units, and — for anything zoned/timezone-aware — DST and extreme-offset zones.

Concretely, for a new option:

- **Enumerate every meaningfully different value**, not just one representative. If an option is a `RoundingMode`-shaped union (`"ceil" | "floor" | "trunc" | "halfExpand" | "halfCeil" | "halfFloor" | "halfTrunc" | "halfEven" | "expand"`), test enough of them on an input where they actually diverge — don't stop at `"halfExpand"` because it was the first one that worked.
- **Test the option's default AND each explicit value that matches the default**, not just default-vs-one-alternative. If omitting the option and passing `{ overflow: "constrain" }` explicitly are supposed to behave identically, both need a row — an implementation bug that breaks only the explicit path is otherwise invisible.
- **Test the option on a case where it has no effect**, not just where it changes the result. E.g. `overflow: "reject"` on an input that does *not* overflow must still succeed normally — this proves the option isn't accidentally rejecting everything.
- **Combine the new option with things already covered elsewhere in the file**: negative amounts, array-of-units results, zero-length/no-op inputs, and (for the option's failure mode) invalid values that should route to the function's sentinel return, not throw.
- **Check whether the option has its own validation edge cases directly against `@js-temporal/polyfill`** before assuming "any value is fine" — e.g. `roundingIncrement` must evenly divide 60/24 for minute/second/hour units but is unconstrained for day/week/month/year; discovering this only by running real Temporal code, not by guessing.

## Zoned and Unix Functions Must Use the Battle-Test TimeZone Fixtures

Any test for a function that accepts a `timeZone` (directly, or via a zoned ISO string) must exercise the shared fixtures in `packages/gmt/src/test/timeZoneMatrix.ts` — do not write a new one-off list of timezone strings, and do not test only `UTC`/`America/New_York`. These fixtures exist specifically because GMT has been burned before by option support that "worked" in one representative zone but broke at the extremes:

- `battleTestTimeZones` — the canonical 20-zone list: UTC, GMT, `Etc/GMT`, DST zones (`America/New_York`, `Europe/Berlin`, `Europe/Helsinki`...), half/quarter-hour-offset zones (`Asia/Kolkata` +5:30, `Asia/Kathmandu` +5:45, `Pacific/Chatham` +13:45), and the two extreme-offset "battle" zones `Pacific/Apia` (+13:00, `TomorrowTimeZone`) and `Pacific/Niue` (-11:00, `YesterdayTimeZone`) — a 24-hour spread that catches date-boundary bugs nothing else will.
- `localNoonBattleCases` — local noon on 2024-02-29 (leap day) in every battle-test zone, ready to iterate with `for (const { timeZone, value } of localNoonBattleCases)`.
- `sameInstantBattleCases` / `unixEpochBattleCases` — the same instant expressed in every battle-test zone, for proving zone-invariance of instant-based calculations.
- `localRangeBattleCases` — a local start/end range per zone, for range-mapping functions.

If an existing fixture's fixed date doesn't fit the case under test (e.g. testing month-end overflow needs a `day: 31` date, not `localNoonBattleCases`'s leap day), build a small sibling constant the same way — `battleTestTimeZones.map((timeZone) => ({ timeZone, value: Temporal.ZonedDateTime.from({ ...fields, timeZone }).toString() }))` — rather than hand-picking two or three zones. New option coverage on a zoned/unix function is not complete until it has run across this matrix, not just the zone the author happened to reach for first.

## Verify Every Expected Value Against Real Temporal Before Writing It

Never write an `it.each` row's expected value from memory, intuition, or by analogy to a similar case — verify it by actually running the equivalent `@js-temporal/polyfill` call first (`node -e "const { Temporal } = require('@js-temporal/polyfill'); ..."` is enough) and copy the real output into the test. Temporal's rounding, overflow, and DST-resolution semantics are full of behavior that is easy to get subtly wrong by reasoning about it in the abstract — e.g. a 2-calendar-day span that spans a spring-forward transition is 47 real hours, not 48; `smallestUnit` on `Duration.prototype.toString()` only accepts sub-second units even though the same option name accepts hour/minute on `until()`/`since()`; a rounding mode that looks like it should round up may round down because the input isn't actually at the halfway point for the increment in use.

A wrong expected value written this way still makes the test pass today — it just also makes the test worthless, since it will keep passing after the implementation is silently broken. If a test you write this way ever fails unexpectedly, don't assume the production code is wrong before re-deriving the expected value against the real runtime — the test's own expected value is just as likely to be the mistake.

## Never Monkey-Patch Real Functions

Do not directly reassign or mutate runtime globals in tests. Use instead:

- `vi.useFakeTimers()` + `vi.setSystemTime(...)` + `vi.useRealTimers()` for deterministic "now"
- `vi.spyOn(...).mockReturnValue(...)` / `mockReturnValueOnce(...)` / `mockImplementation(...)` for controlled behavior

## Pre-built Mocks for Error Path Testing

Use the mocks in `packages/gmt/src/test/mocks` to test error-handling paths. Do not write custom mocks for these:

| Mock                                     | What it mocks                     |
| ---------------------------------------- | --------------------------------- |
| `mockTemporalNowInstantThrow()`          | `Temporal.Now.instant()`          |
| `mockTemporalNowPlainDateTimeISOThrow()` | `Temporal.Now.plainDateTimeISO()` |
| `mockTemporalNowPlainDateISOThrow()`     | `Temporal.Now.plainDateISO()`     |
| `mockTemporalNowPlainTimeISOThrow()`     | `Temporal.Now.plainTimeISO()`     |
| `mockTemporalNowZonedDateTimeISOThrow()` | `Temporal.Now.zonedDateTimeISO()` |
| `mockTemporalPlainDateFromThrow()`       | `Temporal.PlainDate.from()`       |
| `mockTemporalPlainDateTimeFromThrow()`   | `Temporal.PlainDateTime.from()`   |
| `mockTemporalPlainTimeFromThrow()`       | `Temporal.PlainTime.from()`       |
| `mockTemporalZonedDateTimeFromThrow()`   | `Temporal.ZonedDateTime.from()`   |
| `mockTemporalInstantFromThrow()`         | `Temporal.Instant.from()`         |

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

CLDR data embedded in Node's ICU build changes between major ICU versions (which track Node major versions). A handful of locale/option combinations render different wording on ICU 77 (Node 20) vs. ICU 78 (Node 22/24) — e.g. pt-PT's day period ("da tarde" → "p.m."), Turkish/Korean long time zone names, Hebrew/Swedish relative-time phrasing. Every Node LTS ships complete locale data; the _wording_ CLDR chose for a given locale/option simply changed between versions.

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
  value         | options                  | expected
  ${"14:30:45"} | ${{ timeStyle: "full" }} | ${"오후 2:30:45"}
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
