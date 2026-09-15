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
- **Test the option on a case where it has no effect**, not just where it changes the result. E.g. `overflow: "reject"` on an input that does _not_ overflow must still succeed normally — this proves the option isn't accidentally rejecting everything.
- **Combine the new option with things already covered elsewhere in the file**: negative amounts, array-of-units results, zero-length/no-op inputs, and (for the option's failure mode) invalid values that should route to the function's sentinel return, not throw.
- **Check whether the option has its own validation edge cases directly against `@js-temporal/polyfill`** before assuming "any value is fine" — e.g. `roundingIncrement` must evenly divide 60/24 for minute/second/hour units but is unconstrained for day/week/month/year; discovering this only by running real Temporal code, not by guessing.

## Zoned and Unix Functions Must Use the Battle-Test TimeZone Fixtures

Any test for a function that accepts a `timeZone` (directly, or via a zoned ISO string) must exercise the shared fixtures in `packages/gmt/src/test/timeZoneMatrix.ts` — do not write a new one-off list of timezone strings, and do not test only `UTC`/`America/New_York`. These fixtures exist specifically because GMT has been burned before by option support that "worked" in one representative zone but broke at the extremes:

- `battleTestTimeZones` — the canonical 20-zone list: UTC, GMT, `Etc/GMT`, DST zones (`America/Chicago`, `Europe/Berlin`, `Europe/Helsinki`...), half/quarter-hour-offset zones (`Asia/Kolkata` +5:30, `Asia/Kathmandu` +5:45, `Pacific/Chatham` +13:45), and the two extreme-offset "battle" zones `Pacific/Apia` (+13:00, `TomorrowTimeZone`) and `Pacific/Niue` (-11:00, `YesterdayTimeZone`) — a 24-hour spread that catches date-boundary bugs nothing else will.
- `localNoonBattleCases` — local noon on 2024-02-29 (leap day) in every battle-test zone, ready to iterate with `for (const { timeZone, value } of localNoonBattleCases)`.
- `sameInstantBattleCases` / `unixEpochBattleCases` — the same instant expressed in every battle-test zone, for proving zone-invariance of instant-based calculations.
- `localRangeBattleCases` — a local start/end range per zone, for range-mapping functions.

If an existing fixture's fixed date doesn't fit the case under test (e.g. testing month-end overflow needs a `day: 31` date, not `localNoonBattleCases`'s leap day), build a small sibling constant the same way — `battleTestTimeZones.map((timeZone) => ({ timeZone, value: Temporal.ZonedDateTime.from({ ...fields, timeZone }).toString() }))` — rather than hand-picking two or three zones. New option coverage on a zoned/unix function is not complete until it has run across this matrix, not just the zone the author happened to reach for first.

**No literal zone tables.** Never hand-copy the battle-test zones into an `it.each` table. When each zone needs its own expected value, key an object by `keyof typeof MustTestDstTimeZones` and map `battleTestTimeZones` over it, so a missing zone fails typecheck. A single-zone row that pins one specific transition is fine.

**Required transition rows for boundary functions.** Any function that computes a zoned unit boundary, a day length, or a floor (`startOf*`/`endOf*`, `floorToZone`, `bucketRange`, `intervalCount*`, `areZonedEqualBy`, `getHoursInZonedDay`, `mapZonedHoursInDay`, …) also carries explicit rows for the probe zones in [coding-standards § Calendar & zone semantics](../../coding-standards.md#calendar--zone-semantics): `Pacific/Chatham`, `Antarctica/Casey`, the `America/New_York` fall-back, `Australia/Lord_Howe`, `America/Santiago` (skipped midnight), `America/Goose_Bay` and `Pacific/Apia` (deleted day). Assert the invariant `start ≤ input < next start` as well as the value.

## Know the Correct Value Before Writing the Assertion

**A test states what the function SHOULD return. It never records what some code DOES return.** Before writing an expected value, you must be able to say why it is correct, from a source other than the code under test. Code is written to meet the expectation; the expectation is never adjusted to meet the code.

1. **Derive from the rule first.** Work the value out from the spec, the story's decisions, the [coding standards](../../coding-standards.md) and the authoritative standard (TC39 Temporal, ISO 8601, RFC 9557, the relevant RFC or law). Choose inputs whose arithmetic is obvious (whole hours on one UTC day), so the derivation fits on one line. When the value isn't self-evident, put that derivation in the row name or a comment.
2. **Then check the arithmetic against real Temporal.** This is the independent check below. The polyfill confirms arithmetic and Temporal semantics; it cannot confirm GMT-defined rules (sentinels, half-open boundaries, tie-breaks), because Temporal has no opinion on them.
3. **A disagreement is a finding, not a value to copy.** When your derivation, the polyfill, a spec table and the implementation don't all agree, stop and find out which one is wrong. Never settle it by pasting whichever output makes the test pass. If the rule itself looks wrong, escalate; do not decide silently.
4. **Forbidden sources of an expected value:**
   - output of the function under test, or of a "reference implementation" written for the same task;
   - a spec table's value you have not re-derived yourself;
   - an existing test row or JSDoc example taken on trust;
   - recomputing the value the same way the implementation does (tautological).
5. **Existing behaviour is not automatically correct.** Before pinning an existing function's current output (for example, ahead of a doc fix or refactor), classify it:
   - **Intended:** its documented contract says so. Pin it.
   - **Defect:** it breaks the function's own contract, the coding standards or the governing standard. Do **not** assert the wrong value. Write the correct expectation as a normal `it`. It fails, which is the red step, and you fix the code in the same story. See [Zero known bugs](#zero-known-bugs).
   - **Unsure:** treat it as a defect.
6. **Report what you checked.** Handoffs state how each expected value was established (rule derivation, polyfill check) and list every disagreement found, and how it was resolved.

## Zero Known Bugs

**GMT never ships a known bug.** A defect found during a story, in new or existing code and by any agent or review, is fixed in that story, before the work moves on. It is never deferred to a later issue, pinned, skipped or documented around.

- **The only acceptable failing test is the red step of a TDD slice:** a normal `it` with the correct expectation, turned green by fixing the code in the same slice.
- **Forbidden in any handoff, finished code or PR:** `it.fails`, `it.skip`, `it.todo`, `it.only`, `describe.skip`/`.only`, `xit`/`xdescribe`, `skipIf`/`runIf`, and any "known defect" or "known bug" note. They may appear for a moment while working and must never be left behind.
- **When you find a bug, widen the search.** Fix the whole class (every function with the same cause), not just the instance that surfaced.
- **Enforced:** `node scripts/test-markers.mjs check` runs in `pnpm run validate` and fails on any marker or known-defect note. [AGENTS.md Core Rule 12](../../../AGENTS.md#core-rules-quick-reference) states the rule, and `finalizer` refuses to close a story that carries one.

## Never Pass a Path to `vitest list --json`

`npx vitest list --json <file>` does **not** list that file's tests: Vitest 4 treats the argument as the JSON **output** path and overwrites the file with the entire suite listing. It destroyed two test files during CORE-6.

- **To see test names:** run `npx vitest run <file> --reporter=verbose`.
- **`scripts/stats.mjs` is safe:** it calls `vitest list --json` with no file argument.

## Verify Every Expected Value Against Real Temporal Before Writing It

Never write an `it.each` row's expected value from memory, intuition, or by analogy to a similar case. Once you have derived it from the rule (above), confirm it by actually running the equivalent `@js-temporal/polyfill` call (`node -e "const { Temporal } = require('@js-temporal/polyfill'); ..."` is enough). The polyfill call must be a plain Temporal computation of the answer, never a call into GMT code. Temporal's rounding, overflow, and DST-resolution semantics are full of behavior that is easy to get subtly wrong by reasoning about it in the abstract — e.g. a 2-calendar-day span that spans a spring-forward transition is 47 real hours, not 48; `smallestUnit` on `Duration.prototype.toString()` only accepts sub-second units even though the same option name accepts hour/minute on `until()`/`since()`; a rounding mode that looks like it should round up may round down because the input isn't actually at the halfway point for the increment in use.

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

## Locale Matrix Coverage

Any function that accepts a `locale` argument must test all 17 locales using named constants from `MustTestLocales`:

`en-US`, `en-GB`, `de-DE`, `fr-FR`, `es-ES`, `it-IT`, `pt-PT`, `sv-SE`, `is-IS`, `zh-CN`, `zh-TW`, `ja-JP`, `ko-KR`, `ar-SA`, `he-IL`, `ru-RU`, `tr-TR`

Reference constants by name (e.g. `MustTestLocales.enUS`) — do not iterate a generic array that hides locale names. Explicit rows make coverage visible and auditable.

## ICU/CLDR Wording Variance Across Node Versions

CLDR data embedded in Node's ICU build changes between major ICU versions (which track Node major versions). A handful of locale/option combinations render different wording on ICU 77 (Node 20) vs. ICU 78 (Node 22/24/26) — e.g. pt-PT's day period ("da tarde" → "p.m."), Turkish/Korean long time zone names, Hebrew/Swedish relative-time phrasing. Every Node LTS ships complete locale data; the _wording_ CLDR chose for a given locale/option simply changed between versions.

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

## Test Name Standards

Every `it.each` name must interpolate the distinguishing variables (`$aEnd`, `$bStart`, `$timeZone`, etc.) so a Vitest failure report is self-debugging:

- Good: `"returns merged interval when $aEnd equals $bStart (adjacent)"`
- Bad: `"returns $expected for adjacent intervals"`

For error-path blocks where all inputs produce the same sentinel, the name should list the _type_ of bad input: `"returns null when $input is non-string"`.

## Canonical Date Fixtures

**The one inline-strings rule:** use the canonical values from [test-matrix.md](./test-matrix.md), written inline as string literals. They are **values, not exported constants** — the names in that file are labels only; nothing exports `dateLeapDay2024Feb29`. Do not invent other ad-hoc dates. What *is* exported and must be imported (never re-typed) is the fixture set in `packages/gmt/src/test/localeMatrix.ts` (`MustTestLocales`, …) and `packages/gmt/src/test/timeZoneMatrix.ts` (`battleTestTimeZones`, `MustTestDstTimeZones`, the `*BattleCases`). Zoned variants for non-UTC zones are derived at test time by mapping `1704067200000` (2024-01-01T00:00Z) over `battleTestTimeZones` — see `test-matrix.md` for the pattern.

A local override is allowed only when the scenario requires a different date (DST transition, leap-second, month-end clamp, etc.) — document the override reason in a comment.

## Priority Tiers

Test only what applies to the function under test. `tdd-dev` uses these to decide what to write; `tester` uses them to audit.

- **P0 (always):** Happy path with default options. Invalid input → sentinel (one collapsed row). Zero/identity case if the function takes a numeric or array parameter.
- **P1 (options/params):** Each explicit option value that changes behaviour. Default-vs-explicit-equal case. Option on an input where it has no effect.
- **P2 (timezone-aware):** `battleTestTimeZones` matrix via `battleTestTimeZones.map(...)`, plus the probe-zone transition rows for boundary functions (see above). Extreme-offset zones (`Pacific/Apia`, `Pacific/Niue`).
- **P3 (locale-aware):** All 17 locales from `MustTestLocales` with explicit rows. ICU-variant assertions where CLDR wording differs across Node versions.
- **P4 (calendar/date arithmetic):** Month-end, year-end and leap-day boundaries (clamp per TC39). Negative amounts. Empty/no-op inputs. Repeated steps checked against the anchor (Jan 31 by month → Mar 31, Apr 30).

Rules that keep the permutation count sane:

- **Invalid input = ONE row.** Collapse `null`/`undefined`/`123`/`true`/`[]`/`{}` into a single `"non-string input"` row unless a type has distinct behaviour (say why).
- **No irrelevant edge cases.** A pure string formatter needs no DST rows; duration addition needs no locale rows. Ask whether the case exercises a real code path in *this* function.
- **One `it.each` table per category** (see the taxonomy below).

## Edge-Case Taxonomy

Define the permutation space for every function explicitly:

- **Valid input** — default options and each explicit option value.
- **Invalid input** — sentinel return, not throw — collapse `null`/`undefined`/`123`/`true`/`[]`/`{}` into a single `"non-string input"` row unless a specific type has distinct behavior.
- **Boundary units** — month-end, year-end, leap day.
- **Negative/zero amounts** — zero is the identity case; negative values must round-trip correctly.
- **Empty/no-op inputs** — zero-length intervals, empty arrays, identity transforms.
- **Zoned/unix** — full `battleTestTimeZones` matrix via `battleTestTimeZones.map(...)`, plus probe-zone transition rows for boundary functions.
- **Locale-aware** — all 17 locales from `MustTestLocales` with explicit rows.

When an `it.each` block covers more than one permutation category (valid + invalid + boundary), split into separate named tables so failures are debuggable.
