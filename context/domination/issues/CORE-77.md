# CORE-77 — Core: Daylight time read from a zone's clock changes

**Scope:** `isInDaylightSaving` and `hasDaylightSaving` answer from the zone's own clock changes, not from two sample dates in a year. Both state the rule they apply as GMT's own definition, and name what it cannot know.

## Gap

`isInDaylightSaving` takes the smaller of a zone's 15 January and 15 July offsets in the value's year as standard time, and reports daylight time when the offset is larger. `hasDaylightSaving` makes the same comparison for one fixed year. A zone that moved its standard offset during a year is then read as being in daylight time afterwards: `isInDaylightSaving("2016-12-01T12:00:00+03:00[Europe/Istanbul]")` returns `true`, although the zone has been on standard time at `+03:00` since September 2016. A fixed year also goes stale: a zone that stopped changing its clocks after that year is still reported as observing daylight time.

The Dox Zone Planner shows a daylight-time state per zone for the scrubbed instant, so the wrong answer is visible on the site.

An exact answer is not available to this library. The IANA time zone database is the only source of the daylight flag, a JavaScript runtime does not expose it, and it is not a function of offsets: `Europe/Istanbul` sits at `+03:00` from March 2016 and the flag changes in September with no clock change. The database's two forms also give opposite flags for `Europe/Dublin`, `Africa/Casablanca`, `Africa/El_Aaiun` and `Africa/Windhoek`. The measurements and sources are in [daylight-time-definition.md](../research/daylight-time-definition.md).

## Scope

- `packages/gmt/src/internal/daylightTime.ts`:
  - one rule, read from the zone's transitions: daylight time runs from a forward clock change to the backward change of the same size that undoes it, when that comes less than 365 days later.
  - A forward change that is never undone, or is undone a year or more later, is a change of standard time. A backward change with nothing to undo is a change of standard time.
- `packages/gmt/src/zoned/compare/isInDaylightSaving.ts`:
  - `isInDaylightSaving(value: string): boolean` — unchanged signature and sentinel; the body applies the rule above at the value's instant.
- `packages/gmt/src/zoned/validate/hasDaylightSaving.ts`:
  - `hasDaylightSaving(timeZone: string, options?: { at?: string }): boolean` — `true` when the zone is in daylight time at the reference instant, or a daylight period begins within the 365 days after it. `at` is an instant string; without it the reference is the current instant.
- JSDoc on both states the rule, that it is GMT's definition and not the time zone database's flag, and the cases it reads as standard time (see Design notes).
- `docs/dst-disambiguation.md`, the README entries for both functions and the `gmt-timezone` skill describe the rule.
- The changeset carries a **Breaking changes** table: each class of zone whose answer changes, with one example call and its result before and after.

## Docs-site scope

- `apps/dox/src/lib/zone-clock.ts` caches the answer by zone, year and offset. A zone can hold the same offset twice in one year with different answers, so the key also needs the offset period.
- `apps/dox/src/lib/zone-clock.test.ts` and the copy in `mistakes/zoned-date-ops.mdx` and `validation.mdx` follow the new answers.

## Design notes

- **No bundled zone data.** The rule reads offsets and transitions from the runtime's Temporal. GMT does not carry the time zone database's flag, and does not read it from `Intl` display names: a name is missing for 77 zones, the daylight name for `Europe/Dublin` is "Irish Standard Time", and the names disagree with the database for future years in three zones.
- **Where the database's two forms disagree, the rule gives the everyday reading**: clocks advanced relative to standard time. `Europe/Dublin` is in daylight time in summer, and `Africa/Casablanca` is in daylight time at `+01:00`. This matches the database's rearguard form.
- **What the rule cannot know, and reads as standard time:**
  - the last summer before a zone kept its daylight offset for good, where no clock change marks the switch (`Europe/Istanbul`, March to September 2016);
  - a daylight period held for a year or more (`America/Santiago`, 2014 to 2016);
  - a daylight period that ended with a move of standard time and no clock change;
  - a daylight period cut off by Temporal's last instant.
- **The answer for a past instant can change** when the runtime's zone data learns that a zone stopped changing its clocks.
- **Measured against the database's rearguard form**, 417,026 samples from 2000 on across 419 zones: the January and July comparison is wrong in 0.56% of samples across 104 zones, this rule in 0.33% across 64 zones, with a tenth of the false daylight answers.
- **`hasDaylightSaving` is deterministic when `at` is given.** A fixed sample year is the same defect as the two sample dates, and reading the clock with no way to state the instant makes the result untestable for a caller.
- **Cost.** Each transition lookup is a search in the polyfill, so a call is several times slower than the two-sample comparison. The rule returns after two lookups in the ordinary summer case. There is no cache.
- **Rows that depend on recent zone data name the release they assume**, so a runtime with older data fails with a clear reason and not a wrong value.

## What gmt provides (do not re-implement)

- `zonedDateTimeFrom` / `zonedNextTransition` / `zonedPreviousTransition` — the zoned read and the transition walk the rule runs on
- `isValidZonedDateTime` — `isInDaylightSaving`'s gate
- `isValidTimeZone` — `hasDaylightSaving`'s gate
- `isValidInstant` / `parseInstantNanoseconds` from CORE-2 — the `at` option
- `getDstTransitions` — lists every offset change and classifies nothing; unchanged

## Verification

- `isInDaylightSaving` is `false` for `Europe/Istanbul` on 2016-12-01 and in summer 2017, and `true` in summer 2015
- A zone that abolished daylight time and stayed on the lower offset reads `false` after its last backward change
- A zone that moved its standard offset without daylight time (`Asia/Pyongyang` 2015 and 2018, `America/Caracas` 2016) reads `false` on both sides
- New York, Sydney and Lord Howe change answer one nanosecond either side of each transition; Lord Howe's shift is 30 minutes
- `Europe/Dublin` is `true` in summer and `false` in winter; `Africa/Casablanca` is `true` at `+01:00`
- `Pacific/Apia` across the 2011 date-line change and `Europe/London` in 1947 keep their answers
- A zone with no clock changes, a fixed offset and `UTC` read `false`
- `hasDaylightSaving` with `at` returns the same result on any day it runs, and `true` for a zone whose next daylight period begins within 365 days of `at`
- The touched suites pass under `TZ=UTC`, `Pacific/Apia` and `Pacific/Niue`
- `pnpm run validate` stays green
