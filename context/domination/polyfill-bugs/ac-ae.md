# Polyfill and engine defects — § AC–AE

Part of [js-temporal-polyfill-bugs.md](../js-temporal-polyfill-bugs.md), which explains the
format and indexes every section.

## AC. A length in days or larger is measured from the wrong pass of a repeated hour (polyfill)

**Defect.** A zoned `relativeTo` or start can name either pass of a repeated hour. Two steps in 0.5.1 lose which:
`NudgeToCalendarUnit` has no origin parameter (tc39 #3148, #3149) and rebuilds the window start from the wall clock with
`"compatible"`, which takes the earlier pass; and `DifferenceZonedDateTime` has no same-date shortcut (#3141). Fixed in
tc39 by `87af06d0aa7f` and on js `main` by `3c403686d39` (unreleased).

```js
// relativeTo = 2024-11-03T01:30:00-05:00[America/New_York] (later pass; the next day is 24 hours away)
Temporal.Duration.from("PT1H").total({ unit: "day", relativeTo }); // 0.5.1: 0.08; expected 0.041666666666666664
Temporal.Duration.from("P1D").total({ unit: "week", relativeTo }); // 0.5.1: 0.14792899408284024; expected 0.14285714285714285
```

Do not port `3c403686d39` alone: it tests _r1_ = 0, which tc39 #3319 (consensus 2026-05-19, ECMA-262 `1f4e6717ef23`)
replaces with "the start duration is empty". Without #3319, `P7D` with `largestUnit: "week"` regresses to `P1W1D`.

**Workaround.** `D22`: `isNudgeOriginCompatNeeded()` runs the probe, and `originNeedsSpecPath` in
`internal/zonedDifference/nudgeOrigin.ts` sends a date unit down GMT's own spec path when the origin or target names two
instants, or the target is earlier and a window end bound falls in a gap. Affects `totalDuration`, `normalizeDuration`,
`diffZoned*`, `intervalLengthZoned`, `diffUnix*`, `intervalLengthUnix` with a `timeZone`, and the internal
`totalLengthFromStart` behind `totalFromNow`.

**No spec value: the sentinel.** Some lengths fail a TC39 Assert, so the specification gives no value. GMT returns its
sentinel (`null` for a number, `""` for a string) and never extrapolates; Chromium 153 throwing is the check, not the
rule. The shapes, each filed upstream:

| Shape | Assert | Example | GMT | Upstream |
| ----- | ------ | ------- | --- | -------- |
| Forward, end bound short of a target in a later pass | `NudgeToCalendarUnit` window | `PT24H30M` from `2024-11-02T01:30:00-04:00[America/New_York]`, `total("day")` | `null` | tc39 #3336 |
| The same, in weeks at a week boundary | same | `PT168H30M` from `2024-10-27T01:30:00-04:00`, `total("week")` | `null` | #3336 comment |
| Backward, end bound in a gap, moved past the target | same | `-PT23H20M` from `2024-03-11T02:30:00-04:00`, `total("day")` | `null` | #3336 comment |
| A repeated hour across midnight, date and time signs disagree | `CombineDateAndTimeDuration` | `PT15M` from `1944-10-01T00:00:59-06:00[America/Phoenix]`, `total` in a date unit | `null` | tc39 #3311 |
| Backward from the later pass, day corrections run out | `DifferenceZonedDateTime` | `-PT15M` from `1944-10-01T00:00:59-07:00[America/Phoenix]`, `until` with `largestUnit: "day"` | `null` / `""` | #3311 comment |
| A skipped day, so the day span is empty | `NudgeToZonedTime` | `-PT43199S` from `1995-01-01T12:00:00+13:00[Pacific/Enderbury]`, `round` to minutes with `largestUnit: "day"` | `""` | #3310 comment |

Only the failing window is a sentinel; weeks and months of the first row stay inside their windows.

**Retires.** The sentinels are held by the throws in `internal/zonedDifference/operations.ts` and by the `D22` gate.
Three repros expect no value (`totalsWithNoValue`, `noDayCorrection`, `emptyDaySpan`) so a release that fixes the
repeated-hour origin but still answers these lengths keeps the gate. On Chromium 153 `noDayCorrection` and
`emptyDaySpan` fail; on the polyfill `totalsWithNoValue` fails. A release can pass all three and still answer some
other shape, so retirement waits for a release whose every `D22` repro passes. If tc39 gives these lengths a value, the
rows, the throws and the repros change together.

**Upstream.** tc39 [#3336](https://github.com/tc39/proposal-temporal/issues/3336),
[#3311](https://github.com/tc39/proposal-temporal/issues/3311) and
[#3310](https://github.com/tc39/proposal-temporal/issues/3310).

## AD. Node 26 adds one `smallestUnit` when it rounds a whole number of years, months or weeks (Node only, engine)

**Defect.** `ComputeNudgeWindow` starts the window at the origin's own exact time when the start duration is empty
(tc39 #3319). Node 26's `temporal_rs` (0.2.3) still tests _r1_ = 0, so for a difference that is a whole number of a
larger unit the smallest unit comes out as 0 and any rounding mode that can round up (`ceil`, `expand`, the five `half`
modes) adds one `smallestUnit`. It shows with `smallestUnit` `months` or `weeks` (and `days` from a zoned origin) in
`until`, `since` and `Duration#round`, in every calendar. Fixed in boa-dev/temporal#723 (`d47580805556`, first in
`temporal_rs` 0.2.4); Node 26.12.1, 26.13.0 and 26.13.1 have the bug, Chromium 153 and WebKit 26.6 do not. The polyfill is
right.

```js
// start = PlainDate 2000-01-01; a difference of exactly one whole year rounds up under ceil to months
// Node 26.12.1 to 26.13.1: adds one month; expected (Chromium 153, WebKit 26.6, polyfill): unchanged
```

**GMT.** No effect on the polyfill. GMT on Node 26's own `Temporal` returns the engine's answer when the origin is not in a
repeated hour. The native-suite runner tags the two `laterPassOrigin.test.ts` rows (UTC and New York noon origins) to
this section on the Node leg; the tags go stale when a Node release carries `temporal_rs` with #723.

**Upstream.** [nodejs/node#67457](https://github.com/nodejs/node/issues/67457) asks v26.x to move to `temporal_rs` 0.2.4 or
later, or to take boa-dev/temporal#723 alone.

## AE. ICU4C 75+ counts every Persian year before year 0 as a leap year (macOS WebKit, engine)

**Defect.** ICU4C commit `d43d216feb` (ICU-22633, in 75-1 and later) rewrote `PersianCalendar::isLeapYear` from
`ClockMath::floorDivide(25*year+11, 33, &remainder); return remainder < 8;` to `int64_t y = year*25LL+11LL; return (y % 33L < 8);`.
C++ `%` rounds toward zero, so for every year −1 and earlier the remainder is zero or negative and the year counts as
leap. macOS WebKit (system ICU) reports 272,441 of 272,441 years from −272441 to −1 as leap; the correct count is 66,046.
Esfand (`M12`) then has 30 days in a common year, so adding a month to the 30th of `M11` throws instead of constraining to
29, and `daysInMonth` disagrees with `from(… day: 30, { overflow: "reject" })`. Linux WebKit, Chromium and Node are right.
No test262 file covers a negative Persian year; the expected values come from the specification.

```js
Temporal.PlainDate.from({ calendar: "persian", year: -722, monthCode: "M11", day: 30 }).add({ months: 1 });
// macOS WebKit 26.6: RangeError; expected: day constrained to the 29th of Esfand
```

**GMT.** Only GMT on macOS WebKit's own `Temporal` sees it: `addDate` and `subtractDate` return the sentinel `''` where the
engine throws (rows `plain/calculate/addDate.test.ts` `xscan persian min[327]` and the `subtractDate` twin, tagged to this
section). The raw polyfill throws on those rows in every engine through `D1`, which GMT's workaround covers. If the Linux
runner's ICU moves to 75 or later, the Playwright `webkit` leg starts failing the same rows and the tags need that leg.

**Upstream.** [ICU-23609](https://unicode-org.atlassian.net/browse/ICU-23609) (filed on the ICU Jira and to the
icu-support list). Fix: go back to `floorDivide`, or use a flooring modulo `((y % 33) + 33) % 33 < 8`.

### POSIX zone ids: WebKit bug 330688

WebKit 26.6 rejects `CST6CDT`, `EST5EDT`, `MST7MDT` and `PST8PDT` (`Intl.DateTimeFormat` and `Temporal.ZonedDateTime`
throw `RangeError`), although the time zone database 2026e defines them as zones and ECMA-402 §6.5 requires them.
Chromium 153, Firefox 155 and Node 26 accept them; `EST`, `MST` and `HST` work. On Linux WebKit 26.6 also rejects
`CET`, `EET`, `MET` and `WET`; macOS accepts them. Filed as [WebKit 330688](https://bugs.webkit.org/show_bug.cgi?id=330688); on GitHub's macOS 26 runner WebKit accepts
all four, so on the Mac the refusal comes with macOS 27.

GMT refuses all nine names on every host (compat D35).

The cause seems to be `isValidTimeZoneNameFromICUTimeZone` in WebKit's `Source/JavaScriptCore/runtime/IntlObject.cpp`,
which drops every name without a `/` except `UTC` and `GMT`, on the assumption that ICU has already resolved such names
through backward links. A name with no slash then works only when the host's time zone data makes it a link to a name
with a slash. That fits what we see: tzdb 2024b made the System V names links, and macOS 26 accepts them; tzdb 2026d made
`EST5EDT`, `CST6CDT`, `MST7MDT` and `PST8PDT` zones again, and macOS 27 refuses them. test262 covers the four names in
`test/intl402/Temporal/ZonedDateTime/iana-legacy-names.js`; `JSTests/test262/expectations.yaml` does not list it.
