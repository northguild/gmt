# CORE-103 — Core: The core validators take any value and narrow it to `string`

**Scope:** Let the core string validators and the two EPCIS validators (27 functions) take a value
of any type. A value typed `unknown` narrows to `string` when the result is `true`. Types, JSDoc
and tests change. One result changes: `isValidTimeZone` now returns `false` for a
`Temporal.ZonedDateTime` whose `toString` gives a zone id. A `patch`. Phase 2 drops `null` from
the return type of every call that cannot fail; see below.

## Gap

The validators take `string` in their TypeScript signatures. A caller holding a value of type
`unknown` (a JSON field, a form input, a function argument) cannot pass it without a cast, and a
`true` result does not narrow it to `string`. gmt's own `isValidHolidayRule` already takes
`unknown` and narrows.

The runtime already copes. On `main` at `4ce90269`, each of them returns `false` and does not
throw for `new Date()`, `42`, `null`, `undefined`, `{}`, `[]`, `true`, a symbol, a bigint and
`new String("2024-01-01")`. The runtime check covered all 27 functions. One gap: `isValidTimeZone`
returned `true` for a `Temporal.ZonedDateTime` whose `toString` gives a zone id.

```ts
declare const input: unknown;

isValidDate(input); // TS2345: 'unknown' is not assignable to 'string'
if (isValidDate(input as string)) {
  input; // still unknown
}
```

## Scope

1. **Overloads.** Each of the 24 string validators gets three overloads and a hidden
   implementation (decision D4):

   ```ts
   export function isValidDate(value: string): boolean;
   export function isValidDate(value: {} | null | undefined | void): boolean;
   export function isValidDate(value: unknown): value is string;
   export function isValidDate(value: unknown): boolean { … }
   ```

   The 3 duration-unit predicates take one `(unit: unknown): unit is <Union>` signature instead,
   because their target is a literal union and a `string` argument stays `string` on the false
   branch without an overload.

   | Group                         | Functions (all under `src/<namespace>/validate/`)                                                                                                                                                                                                                      |
   | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | Plain (8)                     | `plain/validate/`: `isValidDate`, `isValidDateTime`, `isValidTime`, `isValidYearMonth`, `isValidMonthDay`, `isValidCalendarDate`, `isValidIsoDateLike`, `isValidSqlDateTime`                                                                                           |
   | Duration-unit predicates (3)  | `plain/validate/`: `isValidDateDurationUnit`, `isValidDateTimeDurationUnit`, `isValidTimeDurationUnit`                                                                                                                                                                 |
   | Zoned (5)                     | `zoned/validate/`: `isValidZonedDateTime`, `isValidTimeZone`, `isValidCalendarZonedDateTime`, `isValidRfc2822DateTime`, `isValidRfc3339DateTime`                                                                                                                       |
   | Precision (4)                 | `precision/validate/`: `isValidInstant`, `isValidInt64NanosecondDateTime`, `isValidInt64NanosecondInstant`, `isValidNanoPattern`                                                                                                                                       |
   | UTC (3)                       | `utc/validate/`: `isValidUtc`, `isValidHttpDate`, `isValidUtcTimestamp`                                                                                                                                                                                                |
   | Duration and instant (2)      | `duration/validate/isValidDuration.ts`, `instant/validate/isValidUtcOffset.ts`                                                                                                                                                                                         |
   | EPCIS (2)                     | `intermodal/validate/`: `isValidEpcisEventTime`, `isValidEpcisTimeZoneOffset`                                                                                                                                                                                          |

2. **JSDoc.** `@param` says the function takes any value and returns `false` for a non-string. The
   JSDoc sits on the first overload only.
3. **Dox reference.** Each validator's reference page lists every overload under `## Signature`;
   api-surface runs each new `isValidX(null) // false` example.

Out of scope: the unix validators (they take numbers) and the calendar validators (they already
narrow). `isLeapYear`, `hasSecond60`, `isLeapSecond` and the compare predicates are out because
they test a property of a valid value, not whether a value is valid.

## Design notes

- **Three overloads, in this order (D4).** A single `(value: unknown): value is string` signature
  narrows a `string` variable to `never` in the false branch, which breaks existing callers:

  ```ts
  declare const s: string;
  if (!isValidDate(s)) {
    s.length; // TS2339 with a single type-guard signature: s is never
  }
  ```

  So a `string` argument picks `(value: string): boolean` and keeps `string`. The first approved
  design added only `(value: unknown): value is string` after it. That pair typed an invalid
  `string | null` as `null` when the result was `false`, which is wrong: the value may be an
  invalid string. D4 puts `(value: {} | null | undefined | void): boolean` between them, so any
  other typed argument, such as `string | null` or `string | void`, gets a plain `boolean` with no
  narrowing. `void` is listed because it is not assignable to `{} | null | undefined`. Only an
  argument typed `unknown` reaches the predicate, and there the `false` branch stays `unknown`,
  which is correct. `values.filter(isValidDate)` on an `unknown[]` gives `string[]`.
- **Lint.** No exception was needed: `typescript/unified-signatures` is not enabled, and when
  forced on it does not fire on a `string` / `unknown` pair whose return types differ.
- **One behaviour change.** A non-string returns `false` today, with one exception:
  `isValidTimeZone` passed a non-string to Temporal, which reads a `ZonedDateTime` as its zone,
  and accepted it when the `ZonedDateTime`'s string form matched a zone id. It now returns `false` for every non-string. Elsewhere a `typeof value === "string" &&`
  guard is added only where the type checker needs one; the result stays the same.

## Phase 2 — calls that cannot fail return a plain value

`getUnixNow()` is typed `number | null`, even with no arguments. Reading the clock cannot fail, so
the `null` forces a check at every call site for a case that never happens:

```ts
const oneYearFromNow = addUnix(getUnixNow(), { years: 1 });
// TS2345: Argument of type 'number | null' is not assignable to parameter of type 'string | number'.
```

The rule: a call the types accept that cannot fail returns the bare type. Only an input that can
really be invalid keeps `null` in the return type. Phase 2 ships in the same pull request as the
validators.

**Audit.** 157 of the 715 public functions return `| null`. In 153 of them some value the types
accept can make the call fail: a string to parse, a number that may be `NaN` or out of range, or a
record of strings. `getDayOfWeek()` and `getWeekOfYear()` take no argument but return `null` when
the host has no usable time zone, so they keep it. Two functions remain where no typed call can
fail:

| Function          | Typed calls                                         | Fails only on                                                        |
| ----------------- | --------------------------------------------------- | -------------------------------------------------------------------- |
| `getUnixNow`      | 6: no argument, `{}`, and the 4 `UnixUnit` values   | an unknown `epochUnit` or options that are not an object (a cast or plain JS) |
| `x12TimeCodeZone` | 25: the `X12ZoneTimeCode` values                    | a code outside the type                                              |

**Fix: overloads.** The typed overload comes first and returns the bare type. An `unknown` overload
keeps `| null` for a cast, plain JavaScript or a `string` variable. The TypeScript Handbook (More
on Functions § Function Overloads) prefers a union parameter, but a union parameter cannot change
the return type, and here the return type depends on the argument's type. This is the shape the
validators use. No new export, no runtime change.

```ts
export function getUnixNow(options?: { epochUnit?: UnixUnit }): number;
export function getUnixNow(options?: unknown): number | null;

export function x12TimeCodeZone(timeCode: X12ZoneTimeCode): X12NamedZone;
export function x12TimeCodeZone(timeCode: unknown): X12NamedZone | null;
```

Also in Phase 2:

- `getUnixNow` drops its inner try/catch around `Temporal.Now.instant()`, which cannot throw.
- `classifyX12TimeCode` passes its `string` without a cast, so it reaches the nullable overload.
- The no-throw test reads nullability from every overload, not only the first.
- The Dox type-usage check lets a later overload reach a subset of the first overload's public
  types; the `unknown` overload reaches none.

**Changeset:** `patch`, in the same changeset as the validators. No caller's code has to change.

## Decisions

- **D1.** Scope is the 11 validators in the original issue, 11 more core single-string validators
  with the same gap, and the 3 duration-unit predicates.
- **D1b.** The 2 EPCIS validators are in, the only string-only validators outside the core
  namespaces. The total is 27.
- **D2.** One Dox page per overload set. `## Signature` lists every overload; the parameter table
  and the playground come from the first (`string`) overload.
- **D3.** The changeset is `patch`: the types now say what the JSDoc and the runtime already did,
  and the `isValidTimeZone` change is a bug fix.
- **D4.** Three overloads, not two: only an argument typed `unknown` narrows. A pair with only a
  `string` and an `unknown` overload typed an invalid `string | null` as `null` on a `false`
  result. The middle overload takes `{} | null | undefined | void`, so `string | void` gets a plain
  `boolean` too.
- **D5.** Phase 2 uses overloads: the typed overload first, returning the bare type, and an
  `unknown` overload second that keeps `| null`.
- **D6.** Phase 2 covers `getUnixNow` and `x12TimeCodeZone`. `getDayOfWeek` and `getWeekOfYear`
  keep `null`, because the host may have no usable time zone.
- **D7.** One `patch` changeset covers both phases.

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
