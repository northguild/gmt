# Polyfill and engine defects — § H–Q

Part of [js-temporal-polyfill-bugs.md](../js-temporal-polyfill-bugs.md), which explains the
format and indexes every section.

## H. The calendar nudge window is never retried (`total`, `round`, `until`)

**Defect.** `NudgeToCalendarUnit` computes the window once. When the duration's own count of the unit is one short
(a `relativeTo` on the 29th to 31st for months, or 29 February for years) the target falls outside the window; the spec
reruns `ComputeNudgeWindow` with `additionalShift = true`. The polyfill's assertion is compiled out of production
builds, so `progress` silently exceeds 1. Fixed in tc39 by #3168 / #3172 (`17e12be0af42`).

```js
const from = Temporal.PlainDateTime.from("2024-01-31T00:00:00");
const to = Temporal.PlainDateTime.from("2024-02-29T12:00:00");
from.until(to, { largestUnit: "month" }).total({ unit: "month", relativeTo: from });
// 0.5.1: 1.0172413793103448. Spec: 1.0161290322580645 (window Feb 29 to Mar 31)
```

Only `unit: "month"` and the directed modes (`ceil`, `floor`, `trunc`) diverge; half modes and plain `until` agree.
Chromium 153 is the oracle (Node 24's bundled Temporal is not). test262 tc39/test262#4662 covers it.

**Workaround.** `D11`: when the probe fails and the `relativeTo` is past the 28th, `monthTotalBySpec` and
`monthRoundBySpec` (`durationTotal`/`durationRound`), a gate in `zonedUntil` and `plainUntilWithRounding` use GMT's own
spec-current `computeNudgeWindow`. The `progress === 0n` branch in `nudgeToCalendarUnit` (exact boundary rounds to
itself, `P60D` from `2024-01-31` is `P2M`) is GMT's own fix and stays after D11 retires. `PlainDate` differences are
structurally unreachable and are not routed.

**Upstream.** Ported by the maintainer as `50d66d2` in js PR #361 (merged 2026-09-21; on `main` as `5af905fc1fa`); our
comment on #361 supplies the evidence it was missing. **Retires** on a js-temporal release with that commit.

## I. A zoned string's offset written with seconds is matched by minutes

**Defect.** `ToTemporalZonedDateTime` must match an offset written with seconds exactly; 0.5.1 matches by minutes for
every string. Fixed on `main` by `23d1275`.

```js
// test262 intl402/Temporal/ZonedDateTime/from/zoneddatetime-sub-minute-offset.js
Temporal.ZonedDateTime.from("1960-01-01T00:20:00-00:45:00[Africa/Monrovia]"); // 0.5.1 accepts; expected RangeError
```

**Workaround.** `D12`: `matchSecondsOffsetExactly` in `internal/zonedWallClock.ts`, probe
`isSecondsOffsetMatchCompatNeeded`. Every zoned string, `relativeTo` included, goes through `zonedDateTimeFrom`.

**Upstream.** Nothing to file; the release is js #373. **Retires** on a release with `23d1275`.

## J. `ZonedDateTime.prototype.toString` writes a string `ZonedDateTime.from` refuses (tc39 only, spec)

**Defect (by design).** The instant range starts at −271821-04-20T00:00:00Z. In a zone west of Greenwich the first
hours fall on local date −271821-04-19, and `ZonedDateTime.prototype.toString` writes them. Reading the string back runs
`CheckISODaysRange` on the local date, which is one day past the limit, before the offset is matched.

```js
const MIN = -8640000000000000000000n;
const s = new Temporal.ZonedDateTime(MIN, "America/New_York").toString(); // -271821-04-19T19:03:58-04:56[America/New_York]
Temporal.ZonedDateTime.from(s); // RangeError
```

East of Greenwich the local date is −271821-04-20 and the round trip works; at the other end no zone has the problem.

**Decision.** The champions confirmed the check is intended until tc39/ecma262#3464 widens the time value range
(tc39 #3014, comment of 2026-01-23; `MakeDay` differs between engines). The polyfill, Chromium 153 and Node 26 follow the
spec. GMT's zoned reads return the sentinel for such a string: `isValidZonedDateTime`, `transitTime`, `nextDeparture`,
`scheduleDelivery`, `toOffsetInstant` and `interpretISODateTimeOffset` (`internal/zonedWallClock.ts`) keep the same
check. Instant readers take no zone bracket and are unaffected. Stated in
[coding-standards § Calendar & zone semantics](../../coding-standards/calendar-and-zones.md#calendar--zone-semantics) and
pinned in `packages/gmt/src/test/minuteRoundedOffsets.test.ts`.

**Upstream.** tc39 [#3331](https://github.com/tc39/proposal-temporal/issues/3331), closed as answered. SpiderMonkey is
the engine that does not follow the spec (§ P).

**Retires** nothing. If tc39 changes the step, remove the `checkISODaysRange` call in `interpretISODateTimeOffset` and
flip the two "zoned reads refuse" rows in that test file. When an engine stops throwing, the native-suite canary fails
those rows on that leg and opens an issue.

## K. The transition search skips, or never returns from, two offset changes inside one step

**Defect.** 0.5.1 samples the offset every 14 days and bisects a step whose ends differ, so two changes inside one
step are skipped, or `bisect` never returns. The closest pairs in tz 2026c are 8 to 14 days apart (`America/Boa_Vista`,
`Europe/Riga` 1944, `Africa/Tunis` 1943 and others). Fixed in part on `main` by `a79c6a1` (per-zone windows of 6 to 19
days), but the 17-day window for `Africa/El_Aaiun` holds three offsets in April 1976 and still stalls, in both
directions. tc39 `main` throws a bisection assertion instead of hanging.

```js
isInDaylightSaving("1944-04-15T14:00:00+02:00[Europe/Riga]") // never returned on 0.5.1
Temporal.ZonedDateTime.from("1976-03-28T00:30:00Z[Africa/El_Aaiun]").getTimeZoneTransition("next") // stalls on js main a79c6a1
```

**Workaround.** `D13` (`internal/zonedTransitionSearch.ts`, probe `isTransitionSearchCompatNeeded`): while the probe
fails GMT never calls the polyfill's search in a named zone. It samples every 5 days (169,200 s under the closest pair)
and bisects the one change a differing step can hold. The assumption is pinned by an all-zones guard on
`Intl.DateTimeFormat`, and on Node 26 the search is compared with native Temporal for every change 1900 to 2040.

**Upstream.** tc39 [#3332](https://github.com/tc39/proposal-temporal/issues/3332) (proposes a 16-day window for
`Africa/El_Aaiun`). **Retires** only on a release where every `D13` probe passes, `stall.nextElAaiun` included.

## L. A one-character annotation key is refused

**Defect (engine).** The Temporal grammar and RFC 9557 allow a one-character annotation key (`AKeyLeadingChar
AKeyChar*`). V8 reads annotations with `temporal_rs` and `ixdtf`, whose key parser required a second character
(`Temporal error: Invalid annotation key character.`). Fixed by unicode-org/icu4x#8623 (2026-10-20); no `ixdtf` release
or V8 roll carries it yet, so Node 26.10.0 and Chromium 153 refuse. Not a polyfill defect: 0.5.1 accepts the strings.

**GMT.** None. No GMT input kind takes an elective annotation (CORE-113): plain, UTC and instant strings take none, a
zoned string one zone bracket, a calendar-aware string at most one `u-ca` annotation. GMT refuses `[a=bc]` by its own
pattern before Temporal reads it, on every engine, so no GMT test reaches the defect and the runner tags none. Node
26.12.1 still throws on the repro.
Upstream: icu4x#8620 and #8623.

## M. `[u-ca=islamic]` is accepted instead of refused

**Defect (engine).** `islamic` is not a Temporal calendar; the `islamic` to `islamic-tbla` fallback exists only in
`Intl.DateTimeFormat`, and test262 `intl402/Temporal/PlainDate/from/islamic.js` expects `RangeError`. `temporal_rs`
canonicalises it: Node 26.10.0 reports `calendarId` `islamic-civil`. Open upstream as boa-dev/temporal#529. 0.5.1 throws
correctly.

**GMT.** No change. Three tests pin the `RangeError` (`parseCalendarDateValue`, `isValidCalendarDate`,
`isValidCalendarZonedDateTime`) and the native-suite runner tags them to this section.

## N. `ZonedDateTime.prototype.round` to `day` when a date starts twice

**Defect.** A fall-back across midnight can start one calendar date twice (`America/Goose_Bay` 2010-11-06,
`Antarctica/Casey` 2010-03-04). For an instant in the second piece, rounding to `day` needs the date's length;
without the clamp the polyfill measures to the next date's start, so `trunc` and `floor` answer the next midnight.
TC39 agreed on 2026-05-19 to clamp to `endNs − 1` (tc39/proposal-temporal#3312, ECMA-262 PR tc39/ecma262#3966,
test262 `same-date-starts-twice.js`). The reference polyfill fix is tc39 `59a51ea9d4`. Chromium 153 has it; Node 26.10.0
throws.

**Workaround.** `D14` (`internal/zonedWallClockOperations.ts`, `roundZonedDateTime` day branch): GMT applies the
clamp itself; the rows in `roundZoned.test.ts` and `roundUnix.test.ts` hold test262's values.

**Upstream.** Nothing to file: js-temporal pulls tc39 commits in order and `59a51ea9d4` (May 2026) is still ahead.
**Retires** on the first js-temporal release containing the port. No native-suite tags: GMT is right on every runtime.

## O. A `Z` string is read by wall clock under `offset: "ignore"`

**Defect.** The spec takes a `Z` string's own instant under every `offset` value (`InterpretISODateTimeOffset` step 4,
`offsetBehaviour` ~exact~). Polyfill 0.5.1 and V8 in Node 24 apply `ignore` first and read the wall clock in the zone;
js `main` (`c55b211`) and tc39 `main` drop the spec's "`offsetBehaviour` is ~option~" condition and have the same bug.
Near a limit it can throw for an instant the spec accepts. Node 26, Chromium 153 and WebKit 26.6 are right.

```js
Temporal.ZonedDateTime.from("+275760-09-13T00:00:00Z[America/Sao_Paulo]", { offset: "ignore" });
// wall clock 00:00 is instant 03:00Z, past the maximum: throws; the spec value is the written instant
```

**Workaround.** `D15` (`internal/zonedWallClock.ts` `zExactOptions`, probe `isZIgnoreExactCompatNeeded`):
`zonedDateTimeFrom` reads a `Z` string with `offset: "use"` instead of `"ignore"` while the probe fails, covering
`classifyStoredZoned` and `calendarSystemOfZonedValue`. No public function takes a caller-chosen `offset` for such a
string.

**Upstream.** tc39 [#3337](https://github.com/tc39/proposal-temporal/issues/3337). **Retires** on a fix, the catch-up and
a release.

## P. SpiderMonkey accepts a zoned string whose local date is −271821-04-19 (Firefox only, engine)

**Defect.** The spec's `prefer`/`reject` branch runs `CheckISODaysRange` on the local date, which refuses
−271821-04-19 (§ J). SpiderMonkey runs `ISODateTimeWithinLimits` instead and accepts it, so `from` (with `reject` or
`prefer`), `round` and `with` return a value the spec refuses. Mozilla skips eight test262 files for it. Open as
[Bugzilla 1998020](https://bugzilla.mozilla.org/show_bug.cgi?id=1998020). The polyfill, Node 26 and Chromium 153 throw.

**GMT.** No change. Fourteen tests pin the `RangeError` or its sentinel (`zonedDateTimeFrom` ×3, `minuteRoundedOffsets`
×3, `offsetInstantMinuteRounded` ×1, `storedOffsetValues` ×2, `convertZonedToCalendar` ×5); the runner tags them to this section on the Firefox leg and
reports when the tags go stale.

## Q. Firefox `formatRange` prints AM/PM for a day period when a zone name is set (Firefox only, engine)

**Defect.** With `dayPeriod` and `timeZoneName` set and neither `hourCycle` nor `hour12`, SpiderMonkey's `formatRange`
prints each endpoint with AM/PM instead of the flexible day period; the parts come back as `startRange` and `endRange`
only. Not a width rule: UTS #35 treats the day period letters a, b and B as close matches.

```js
new Intl.DateTimeFormat("en-US", { hour: "numeric", dayPeriod: "short", timeZoneName: "shortOffset", timeZone: "America/New_York" })
  .formatRange(new Date("2024-02-29T15:00Z"), new Date("2024-02-29T17:00Z")); // AM/PM in Firefox 155 and 158; "in the morning" elsewhere
```

**Workaround.** `D17`: `formatZonedRange` rebuilds the range from the endpoint parts and writes each endpoint's
single-format day period (`dayPeriod` entry of `repairRangeParts`, `internal/repairRangeParts.ts`; tested in
`repairRangeParts.test.ts`). Output is identical when the probe passes.

**Upstream.** [Bugzilla 2085525](https://bugzilla.mozilla.org/show_bug.cgi?id=2085525). **Retires** on a Firefox
release that prints the flexible day period (the weekly `temporal-compat-firefox` check reports `D17` removable).
