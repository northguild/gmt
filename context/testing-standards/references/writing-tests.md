# Testing Standards: Writing Tests

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
- **Test the option on a case where it has no effect**, not just where it changes the result. E.g. `overflow: "reject"` on an input that does _not_ overflow must still succeed normally — this proves the option isn't accidentally rejecting everything.
- **Combine the new option with things already covered elsewhere in the file**: negative amounts, array-of-units results, zero-length/no-op inputs, and (for the option's failure mode) invalid values that should route to the function's sentinel return, not throw.
- **Check whether the option has its own validation edge cases directly against `temporal-polyfill`** before assuming "any value is fine" — e.g. `roundingIncrement` must evenly divide 60/24 for minute/second/hour units but is unconstrained for day/week/month/year; discovering this only by running real Temporal code, not by guessing.

## Zoned and Unix Functions Must Use the Battle-Test TimeZone Fixtures

Any test for a function that accepts a `timeZone` (directly, or via a zoned ISO string) must exercise the shared fixtures in `packages/gmt/src/test/timeZoneMatrix.ts` — do not write a new one-off list of timezone strings, and do not test only `UTC`/`America/New_York`. These fixtures exist specifically because GMT has been burned before by option support that "worked" in one representative zone but broke at the extremes:

- `battleTestTimeZones` — the canonical 20-zone list: UTC, GMT, `Etc/GMT`, DST zones (`America/Chicago`, `Europe/Berlin`, `Europe/Helsinki`...), half/quarter-hour-offset zones (`Asia/Kolkata` +5:30, `Asia/Kathmandu` +5:45, `Pacific/Chatham` +13:45), and the two extreme-offset "battle" zones `Pacific/Apia` (+13:00, `TomorrowTimeZone`) and `Pacific/Niue` (-11:00, `YesterdayTimeZone`) — a 24-hour spread that catches date-boundary bugs nothing else will.
- `localNoonBattleCases` — local noon on 2024-02-29 (leap day) in every battle-test zone, ready to iterate with `for (const { timeZone, value } of localNoonBattleCases)`.
- `sameInstantBattleCases` / `unixEpochBattleCases` — the same instant expressed in every battle-test zone, for proving zone-invariance of instant-based calculations.
- `localRangeBattleCases` — a local start/end range per zone, for range-mapping functions.

If an existing fixture's fixed date doesn't fit the case under test (e.g. testing month-end overflow needs a `day: 31` date, not `localNoonBattleCases`'s leap day), build a small sibling constant the same way — `battleTestTimeZones.map((timeZone) => ({ timeZone, value: Temporal.ZonedDateTime.from({ ...fields, timeZone }).toString() }))` — rather than hand-picking two or three zones. New option coverage on a zoned/unix function is not complete until it has run across this matrix, not just the zone the author happened to reach for first.

**No literal zone tables.** Never hand-copy the battle-test zones into an `it.each` table. When each zone needs its own expected value, key an object by `keyof typeof MustTestDstTimeZones` and map `battleTestTimeZones` over it, so a missing zone fails typecheck. A single-zone row that pins one specific transition is fine.

**Required transition rows for boundary functions.** Any function that computes a zoned unit boundary, a day length, or a floor (`startOf*`/`endOf*`, `floorToZone`, `bucketRange`, `intervalCount*`, `areZonedEqualBy`, `getHoursInZonedDay`, `mapZonedHoursInDay`, …) also carries explicit rows for the probe zones in [coding-standards § Calendar & zone semantics](../../coding-standards/calendar-and-zones.md#calendar--zone-semantics): `Pacific/Chatham`, `Antarctica/Casey`, the `America/New_York` fall-back, `Australia/Lord_Howe`, `America/Santiago` (skipped midnight), `America/Goose_Bay` and `Pacific/Apia` (deleted day). Assert the invariant `start ≤ input < next start` as well as the value.

## Verify Every Expected Value Against Real Temporal Before Writing It

Never write an `it.each` row's expected value from memory, intuition, or by analogy to a similar case. Once you have derived it from the rule (above), confirm it by actually running the equivalent `temporal-polyfill` call (`node -e "import('temporal-polyfill/full/implementation').then(({ Temporal }) => { ... })"` from `packages/gmt` is enough). The polyfill call must be a plain Temporal computation of the answer, never a call into GMT code. Temporal's rounding, overflow, and DST-resolution semantics are full of behavior that is easy to get subtly wrong by reasoning about it in the abstract — e.g. a 2-calendar-day span that spans a spring-forward transition is 47 real hours, not 48; `smallestUnit` on `Duration.prototype.toString()` only accepts sub-second units even though the same option name accepts hour/minute on `until()`/`since()`; a rounding mode that looks like it should round up may round down because the input isn't actually at the halfway point for the increment in use.

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
| `mockTemporalInstantFromEpochNanosecondsThrow()` | `Temporal.Instant.fromEpochNanoseconds()` |

There is no `@gmt/test` path alias — import relatively from the test file:

```ts
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";

it("returns empty string when Temporal.PlainDate.from throws", () => {
  mockTemporalPlainDateFromThrow();
  expect(addDays("2024-03-10", 1)).toBe("");
});
```

## Canonical Date Fixtures

**The one inline-strings rule:** use the canonical values from [test-matrix.md](./test-matrix.md), written inline as string literals. They are **values, not exported constants** — the names in that file are labels only; nothing exports `dateLeapDay2024Feb29`. Do not invent other ad-hoc dates. What *is* exported and must be imported (never re-typed) is the fixture set in `packages/gmt/src/test/localeMatrix.ts` (`MustTestLocales`, …) and `packages/gmt/src/test/timeZoneMatrix.ts` (`battleTestTimeZones`, `MustTestDstTimeZones`, the `*BattleCases`). Zoned variants for non-UTC zones are derived at test time by mapping `1704067200000` (2024-01-01T00:00Z) over `battleTestTimeZones` — see `test-matrix.md` for the pattern.

A local override is allowed only when the scenario requires a different date (DST transition, leap-second, month-end clamp, etc.) — document the override reason in a comment.
