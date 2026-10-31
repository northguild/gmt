# CORE-103 — Core: The core validators take any value and narrow it to `string`

**Scope:** Let the core string validators and the two EPCIS validators (27 functions) take a value
of any type. A value typed `unknown` narrows to `string` when the result is `true`. Types, JSDoc
and tests change. One result changes: `isValidTimeZone` now returns `false` for a
`Temporal.ZonedDateTime` whose `toString` gives a zone id. A `minor` (D3). Phase 2 drops `null` from
the return type of every call that cannot fail. Phase 3 splits the gmt and Dox test suites into an
isolated and a shared Vitest project. A clock workaround (D21) keeps the clock readers from
reading a millisecond early.

## Gap

The validators take `string` in their TypeScript signatures. A caller holding a value of type
`unknown` (a JSON field, a form input, a function argument) cannot pass it without a cast, and a
`true` result does not narrow it to `string`. gmt's own `isValidHolidayRule` already takes
`unknown` and narrows.

The runtime already copes: on `main` at `4ce90269` all 27 return `false` without throwing for
`new Date()`, `42`, `null`, `undefined`, `{}`, `[]`, `true`, a symbol, a bigint and
`new String("2024-01-01")`, except that `isValidTimeZone` accepted a zoned date-time (D10).

```ts
declare const input: unknown;

isValidDate(input); // TS2345: 'unknown' is not assignable to 'string'
if (isValidDate(input as string)) {
  input; // still unknown
}
```

## Scope

1. **Overloads.** Each of the 24 string validators gets three overloads and a hidden
   implementation (D4, D8):

   ```ts
   export function isValidDate(value: string): boolean;
   export function isValidDate(value: {} | null | undefined | void): boolean;
   export function isValidDate(value: unknown): value is string;
   export function isValidDate(value: unknown): boolean { … }
   ```

   The 3 duration-unit predicates take one `(unit: unknown): unit is <Union>` signature instead,
   because their target is a literal union and a `string` argument stays `string` on the false
   branch without an overload. The functions, all under `src/<namespace>/validate/`:

   - **Plain (8):** `isValidDate`, `isValidDateTime`, `isValidTime`, `isValidYearMonth`,
     `isValidMonthDay`, `isValidCalendarDate`, `isValidIsoDateLike`, `isValidSqlDateTime`
   - **Duration-unit predicates (3, `plain`):** `isValidDateDurationUnit`,
     `isValidDateTimeDurationUnit`, `isValidTimeDurationUnit`
   - **Zoned (5):** `isValidZonedDateTime`, `isValidTimeZone`, `isValidCalendarZonedDateTime`,
     `isValidRfc2822DateTime`, `isValidRfc3339DateTime`
   - **Precision (4):** `isValidInstant`, `isValidInt64NanosecondDateTime`,
     `isValidInt64NanosecondInstant`, `isValidNanoPattern`
   - **UTC (3):** `isValidUtc`, `isValidHttpDate`, `isValidUtcTimestamp`
   - **Duration and instant (2):** `duration/validate/isValidDuration.ts`,
     `instant/validate/isValidUtcOffset.ts`
   - **EPCIS (2, `intermodal`):** `isValidEpcisEventTime`, `isValidEpcisTimeZoneOffset`

2. **JSDoc.** `@param` says the function takes any value and returns `false` for a non-string. The
   JSDoc sits on the first overload only.
3. **Dox reference.** Each validator's reference page lists every overload under `## Signature`;
   api-surface runs each new `isValidX(null) // false` example.

Out of scope: the unix validators (they take numbers) and the calendar validators (they already
narrow). `isLeapYear`, `hasSecond60`, `isLeapSecond` and the compare predicates are out because
they test a property of a valid value, not whether a value is valid.

## Design notes

- **Why three overloads (D4).** A single `(value: unknown): value is string` signature narrows a
  `string` variable to `never` in the false branch, which breaks existing callers. A `string` and
  an `unknown` overload alone type an invalid `string | null` as `null` on `false`, though it may
  be an invalid string. The middle overload gives any other typed argument a plain `boolean`;
  `void` is listed because it is not assignable to `{} | null | undefined`. Only an argument typed
  `unknown` reaches the predicate, and its `false` branch stays `unknown`.
  `values.filter(isValidDate)` on an `unknown[]` gives `string[]`.
- **Lint.** No exception was needed: `typescript/unified-signatures` is not enabled, and when
  forced on it does not fire on a `string` / `unknown` pair whose return types differ.

## Phase 2 — calls that cannot fail return a plain value

`getUnixNow()` was typed `number | null`, even with no arguments, so every call site checked for a
case that never happens:

```ts
const oneYearFromNow = addUnix(getUnixNow(), { years: 1 });
// TS2345: Argument of type 'number | null' is not assignable to parameter of type 'string | number'.
```

**Audit (D14).** 157 of the 715 public functions return `| null`. In 153 some value the types
accept can make the call fail: a string to parse, a number that may be `NaN` or out of range, or a
record of strings. `getDayOfWeek()` and `getWeekOfYear()` keep it (D6). In the other two no typed
call can fail: `getUnixNow` (no argument, `{}`, or one of the 4 `UnixUnit` values) and
`x12TimeCodeZone` (the 25 `X12ZoneTimeCode` values).

**Fix: overloads (D5).** The TypeScript Handbook (More on Functions § Function Overloads) prefers a
union parameter, but a union parameter cannot change the return type, and here the return type
depends on the argument's type. No new export, no runtime change beyond D15.
`classifyX12TimeCode` passes its `string` without a cast, so it reaches the nullable overload.

```ts
export function getUnixNow(options?: { epochUnit?: UnixUnit }): number;
export function getUnixNow(options?: unknown): number | null;

export function x12TimeCodeZone(timeCode: X12ZoneTimeCode): X12NamedZone;
export function x12TimeCodeZone(timeCode: unknown): X12NamedZone | null;
```

## Phase 3 — isolated and shared test projects

Both test suites run as two Vitest projects so files that leave modules alone share one worker and
skip a fresh import of the library (D16–D20). The test agents, the testing standards and the review
checklist say when a file is shared and how to undo global state.

## Decisions

- **D1.** Scope is 27 functions: the 11 validators in the original issue, 11 more core
  single-string validators, the 3 duration-unit predicates and the 2 EPCIS validators.
- **D2.** One Dox page per overload set. `## Signature` lists every overload; the parameter table
  and the playground come from the first (`string`) overload.
- **D3.** One changeset covers every phase and the clock workaround. It is `minor` with a
  **Breaking changes** section, as the changeset rule asks for a changed signature. Two type-level
  uses stop compiling: `Parameters<typeof fn>` reads the last overload's `unknown` (all 29
  functions), and an argument typed `any` now narrows to `string` in the 24 string validators. The
  `isValidTimeZone` change is a bug fix.
- **D4.** Three overloads, not two: only an argument typed `unknown` narrows. A pair with only a
  `string` and an `unknown` overload typed an invalid `string | null` as `null` on a `false`
  result. The middle overload takes `{} | null | undefined | void`, so `string | void` gets a plain
  `boolean` too.
- **D5.** Phase 2 uses overloads: the typed overload first, returning the bare type, and an
  `unknown` overload second that keeps `| null`.
- **D6.** Phase 2 covers `getUnixNow` and `x12TimeCodeZone`. `getDayOfWeek` and `getWeekOfYear`
  keep `null`, because the host may have no usable time zone.
- **D8.** The 24 string validators share one overload shape: `string` first, `{} | null |
  undefined | void` second, the `unknown` predicate last, then a hidden `unknown` implementation.
  The JSDoc sits on the first overload only. The three duration-unit predicates take one
  `(unit: unknown): unit is <Union>` signature.
- **D9.** `typeof value === "string" &&` is added only where the body passes `value` to a helper
  typed `string`. Every other result stays as it was.
- **D10.** `isValidTimeZone` returns `false` for every non-string, `Temporal.ZonedDateTime`
  included. This is the one result that changes.
- **D11.** The Dox reference generator and the type-usage gate read an overload set: every overload
  must reach the same public types, and a later overload may reach a subset of the first overload's
  types. The `unknown` overload reaches none.
- **D12.** `noThrow` reads nullability from every overload, not only the first.
- **D13.** `NON_STRINGS` lives in `src/test/nonStrings.ts` and carries a `Date` row. Every
  validator has a runtime row per non-string and a type test per overload.
- **D14.** A call the types accept that cannot fail returns the bare type. Only an input that can be
  invalid keeps `null`. The audit found two such functions, `getUnixNow` and `x12TimeCodeZone`.
- **D15.** `getUnixNow` has no inner try/catch around `Temporal.Now.instant()`, which cannot throw.
- **D16.** The gmt suite runs as two Vitest projects. A file that calls `vi.mock`, `vi.doMock`,
  `vi.stubGlobal` or `vi.stubEnv` joins the isolated project, found from its source by
  `isolationGroups.ts`. Every other file shares modules with its neighbours. The isolation test asks
  Vitest which project holds each file and compares the answer with the source scan.
- **D17.** `sharedState.ts` records `Intl`, `Temporal`, `Temporal.Now`, `Date`, the `globalThis`
  keys and the `process.env` names. `setupTests.ts` fails a shared file that leaves any of them
  changed, and takes one real clock reading after each test.
- **D18.** The browser config keeps one project and takes its include list from the base config.
- **D19.** The Dox suite follows the same split: `isolation.ts` sorts the files, `setup-dom.ts`
  resets the shared DOM state after every test, and `leak-guard.ts` fails a file that ends with a
  changed global, `Intl` member, environment variable or window or document listener. The rules are
  in `context/dox/built.md` (Test isolation). `react-cleanup.ts` runs Testing Library's React
  `cleanup` in every file that loaded the package, which registers it only for the first file each
  worker loads; it does not load the package itself, whose async wrapper hangs under fake timers.
- **D20.** Tests that depended on another test's state are fixed, not skipped: `element-identity`
  disconnects its observer and drops its window state, and `dev-worker-proxy` waits on the proxied
  path with each probe bounded.
- **D21.** The clock readers in `internal/temporalCompat/clock.ts` (`nowInstant`,
  `nowZonedDateTimeISO`, `nowPlainDateTimeISO`, `nowPlainDateISO`, `nowPlainTimeISO`) work around
  [tc39/proposal-temporal#3335](https://github.com/tc39/proposal-temporal/issues/3335). After a
  clock reading before 1970, the polyfill's next `Temporal.Now` reading carries a negative
  sub-millisecond tail and can land 1 ms before `Date.now()`. A reader takes `Date.now()` first,
  then `Temporal.Now`, and adds 1 ms only when the reading falls exactly 1 ms short. It stays
  dormant on a fixed polyfill or a native `Temporal`. Every clock-reading function goes through
  these readers, and a guard test fails on a direct `Temporal.Now` call in library source.
  `api-surface` treats the readers as clock reads. The removal steps are in the temporalCompat
  README and the workaround registry.
- **D22.** The `pnpm audit` run ignores GHSA-g3hv-75wg-m249 (minimatch below 11.0.1). Only ESLint 9
  and typescript-eslint reach it, no published package depends on it, and an override to
  minimatch 11 removes functions those tools call. The entry is deleted once `pnpm why minimatch`
  shows nothing below 11.0.1. Every other advisory still fails the audit.

## What gmt provides (do not re-implement)

- The 27 validators and their existing runtime tests
- `calendar/validate/isValidHolidayRule.ts` — the `unknown` type-guard pattern already in the
  library
- Vitest `expectTypeOf`, as the existing type tests use it
- `scripts/api-surface.mjs`

## Verification

- A type test per function covers the overloads: an `unknown` input narrows to `string` and stays
  `unknown` when false; a `string` input stays `string` in the false branch; a `string | null`
  or `string | void` input gets a plain `boolean`; `filter` on an `unknown[]` gives `string[]`.
- A runtime row per function for each non-string input listed under Gap: returns `false`, does not
  throw.
- `pnpm run validate` stays green, and `node scripts/api-surface.mjs check` runs each new
  `isValidX(null) // false` example.
