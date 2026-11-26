# CORE-115 — Core: `isValidOperatingSchedule`, a validator for `OperatingSchedule`

**Scope:** Add `isValidOperatingSchedule`, the validator for the `OperatingSchedule` type that
`operatingIntervals` takes. It returns `true` for any schedule `operatingIntervals` accepts and
`false` otherwise, and never throws.

## Gap

gmt exports `operatingIntervals` and the `OperatingSchedule` type, but no validator for it.
Other gmt input types each have one, such as `isValidBusinessCalendar`, `isValidInterval` and
`isValidDutyLog`. Without one, every caller that takes a schedule as input writes its own check.

## Scope

- **`isValidOperatingSchedule(value: unknown): value is OperatingSchedule`** — `true` exactly
  when `operatingIntervals` would accept the schedule, `false` otherwise, never a throw.
- **Same conventions as `isValidBusinessCalendar`:** file place, naming, guard shape, tests.
- **One source of truth:** the validator and `operatingIntervals` share the same checks, so the
  two cannot drift.

## What gmt provides (do not re-implement)

- `operatingIntervals` and `OperatingSchedule` (`CORE-55`)
- `isValidBusinessCalendar` (`CORE-7`)

## Verification

- Every schedule `operatingIntervals` accepts returns `true`; every schedule it rejects returns
  `false`, with no throw for any input, including non-objects.
- `pnpm run validate` stays green.
