# Polyfill and engine defects — § R–AB

Part of [js-temporal-polyfill-bugs.md](../js-temporal-polyfill-bugs.md), which explains the
format and indexes every section.

## R. Islamic calendars read dates before the Hijra as positive years in WebKit (polyfill and engine)

**Defect.** WebKit's `Intl.DateTimeFormat` prints an `islamic-civil`, `islamic-tbla` or `islamic-umalqura` date before
the Hijra as a positive year in era `Before Hijra`, where V8 and SpiderMonkey print a negative year. The polyfill's
`IslamicBaseHelper` has no era and takes the year as printed; js `main` and tc39 `main` throw `Era before-hijra … was
not matched by any era`. The Intl era/monthCode proposal gives `bh` era year n as year 1 − n.

```js
Temporal.PlainDate.from("0621-01-01").withCalendar("islamic-civil").year; // WebKit: 2; expected -1
Temporal.PlainDate.from({ year: 1, month: 1, day: 1, calendar: "islamic-civil" }); // WebKit: does not return; expected 0622-07-19
```

**Workaround.** `D18`: `calendarFields.ts` corrects the year when `islamicEra.ts` says the date's era part is not a
modern date's (two outputs of the same formatter, so GMT owns no era data). Before it, the native suite's WebKit pass
hung on `diffDateAsDuration.edges.test.ts` row 82.

**Upstream.** tc39 [#3338](https://github.com/tc39/proposal-temporal/issues/3338) and
[WebKit 331724](https://bugs.webkit.org/show_bug.cgi?id=331724) (JavaScriptCore switches era at a fixed instant in every
zone). **Retires** on a js-temporal release that reads WebKit's Islamic eras.

## S. WebKit adds a year to the 30th of Dhu al-Hijjah before the Hijra as 13 months (WebKit only, engine)

**Defect.** In `islamic-civil`, `islamic-tbla` and `islamic-umalqura`, adding `{ years: 1 }` or `{ months: 12 }` to
`M12` day 30 of a year before the Hijra lands on the 30th of Muharram two years on (13 months), instead of constraining
to day 29. Cause: ICU4C `civilLeapYear` uses a truncating `%`, so every year from −1 back counts as leap (ICU4J has the
same line).

```js
Temporal.PlainDate.from("0600-03-25").withCalendar("islamic-civil").add({ years: 1 });
// WebKit 26.6: 0601-04-13 (M01 day 30). Expected 0601-03-14[u-ca=islamic-civil]
```

**GMT.** Only GMT on WebKit's own `Temporal` sees it (`addDate`, `diffDateAsDuration` and what builds on them); the polyfill
in WebKit is right and the `D18` probe passes. No workaround; the native-suite runner tags the affected rows to this
section.

**Upstream.** [WebKit 331725](https://bugs.webkit.org/show_bug.cgi?id=331725) and
[ICU-23626](https://unicode-org.atlassian.net/browse/ICU-23626). **Retires** the tags when WebKit returns the date.

## T. WebKit throws adding a year to the last day of Chaitra in far-past Indian years (WebKit only, engine)

**Defect.** In the `indian` calendar, `add({ years: n })` and `add({ months: 12 })` from the last day of Chaitra
(`M01` day 30 or 31) throw `RangeError: Result of calendar date addition is outside representable range` for every
probed ISO year from −4800 back to the minimum. Cause: ICU4C `IndianCalendar::handleComputeMonthStart` truncates a
negative Julian day, so a month starting on or before Julian Day 0 starts a day late.

```js
Temporal.PlainDate.from("-004800-04-20[u-ca=indian]").add({ years: 1 }); // WebKit 26.6 throws; expected -004799-04-20[u-ca=indian]
```

**GMT.** Only GMT on WebKit's own `Temporal` sees it: `diffDateAsDuration` returns the sentinel `""` where the engine
throws. The one native-suite row (`diffDateAsDuration.edges.test.ts`, the `xscan indian min` row) is tagged; the tag
goes stale once WebKit returns the date.

**Upstream.** [WebKit 331726](https://bugs.webkit.org/show_bug.cgi?id=331726) and
[ICU-23627](https://unicode-org.atlassian.net/browse/ICU-23627).

## U. `ZonedDateTime#equals` answers false for two identifiers of one zone where `resolvedOptions` keeps the identifier (polyfill; shows in JavaScriptCore)

**Defect.** The polyfill's `TimeZoneEquals` compares `GetAvailableNamedTimeZoneIdentifier(id).primaryIdentifier`, which
for an identifier `supportedValuesOf` does not list falls back to `Intl.DateTimeFormat#resolvedOptions().timeZone`. The
Stage 3 Time Zone Canonicalization proposal makes that return the identifier as written, and JavaScriptCore implements
it, so the polyfill there compares identifiers as written. ECMA-402 §6.5 makes `Etc/UTC`, `Etc/GMT`, `GMT` and their links
resolve to `UTC`, so the spec answer is `true`.

```js
new Temporal.ZonedDateTime(0n, "Etc/UTC").equals(new Temporal.ZonedDateTime(0n, "UTC")); // polyfill in WebKit 26.6: false; expected true
new Temporal.ZonedDateTime(0n, "Asia/Calcutta").equals(new Temporal.ZonedDateTime(0n, "Asia/Kolkata")); // false; expected true
```

**Workaround.** `D19` (`temporalCompat/timeZoneEquals.ts`, probe `isTimeZoneEqualsCompatNeeded`), scoped to WebKit
(`engines: ["webkit"]` in `scripts/lib/workarounds.mjs`; the Node, Chromium and Firefox checks report it out of scope).
Where the probe fails GMT resolves `Etc/UTC`, `Etc/GMT` and `GMT` to `UTC` by name, and for any other pair asks the host's
own `Temporal.ZonedDateTime#equals` when `globalThis.Temporal` exists (WebKit 26.6). On a host without `Temporal`
(Safari 27) the IANA links stay two zones: resolving a link needs the IANA link data, which GMT does not own.
The comparisons `areZonedEqual`, `areZonedEqualBy`, `formatZonedRange`, `mapZonedDatesInRange` and `diffZoned*` all go
through `timeZoneEquals`.

**Upstream.** tc39 [#3301](https://github.com/tc39/proposal-temporal/issues/3301), reported by someone else; our
[comment](https://github.com/tc39/proposal-temporal/issues/3301#issuecomment-6892556793) adds the WebKit cases.
**Retires** on a js-temporal release that finds a non-primary identifier's primary without `resolvedOptions`; the weekly
`temporal-compat-webkit` verdicts decide.

## V. `PlainYearMonth.from` and `PlainMonthDay.from` reject an upper-case `iso8601` calendar annotation (polyfill; fixed on tc39 `main`)

**Defect.** `ParseTemporalYearMonthString` and `ParseTemporalMonthDayString` compare the `u-ca` value with `'iso8601'`
as written; the spec lower-cases first. Fixed on tc39 `main` by `385b479bf8` (2026-02-26); not yet on js `main`.

```js
Temporal.PlainMonthDay.from("--12-25[u-ca=ISO8601]").toString(); // 0.5.1: RangeError; expected 12-25
Temporal.PlainYearMonth.from("2026-10[u-ca=ISO8601]").toString(); // 0.5.1: RangeError; expected 2026-10
```

**GMT.** No effect: `isValidMonthDay`, `parseMonthDay`, `isValidYearMonth` and `parseYearMonth` refuse every annotation
before Temporal is asked. The `D20` workaround and its probe are removed (CORE-113, #528). Nothing to file.

## W. `PlainMonthDay.from` accepts a day no year has (polyfill and tc39 reference polyfill)

**Defect.** The grammar makes `--02-30` a Syntax Error (early error IsValidMonthDay). `ParseTemporalMonthDayString` does
not apply it after `PARSE.monthday` matches. Fixed in tc39 by `659c262021` (tc39/proposal-temporal#3333, 2026-11-11);
js-temporal gets it with the catch-up. Node 26, Chromium 153 and WebKit 26.6 already throw.

```js
Temporal.PlainMonthDay.from("--02-30").toString(); // 0.5.1: 02-30; expected RangeError (also --04-31, 0230)
```

**GMT.** No effect: the `plainMonthDay` regex (`regex/month-day.ts`) encodes IsValidMonthDay and refuses these strings
first. Nothing to file.

## X. `toLocaleString` rebuilds the options from `resolvedOptions()`, so a month width the locale prints numerically is lost (polyfill and tc39 reference polyfill; Chromium shows it too)

**Defect.** `createDateTimeFormat` (`lib/intl.ts`) builds the Temporal formatters from a clone of
`resolvedOptions()`, which reports the widths of the pattern the locale chose, not the caller's. For zh and ja a
`month: "long"` resolves to a numeric month, so it prints `12/25`.

```js
Temporal.PlainMonthDay.from({ calendar: "gregory", monthCode: "M12", day: 25 })
  .toLocaleString("zh-CN", { calendar: "gregory", month: "long", day: "numeric" }); // 0.5.1: 12/25; expected 12月25日
```

**GMT.** No effect: GMT never calls `toLocaleString`; `formatMonthDay`, `formatDate` and the others format epoch
milliseconds through `cachedFormatter("DateTimeFormat", …)`, which passes the caller's widths to Intl.

**Upstream.** tc39 [#3339](https://github.com/tc39/proposal-temporal/issues/3339), a
[comment on Chromium 553245554](https://issues.chromium.org/issues/553245554#comment5), and
[nodejs/node#67484](https://github.com/nodejs/node/issues/67484) (asks Node 26 to take the V8 fix `93603e3f07`).

## Y. `PlainYearMonth#add` and `#subtract` predate tc39 `41faca474a` (polyfill)

**Defect.** `AddDurationToYearMonth` in 0.5.1 does not reject a duration with weeks, days or time, and keeps the old
branch that starts a subtraction from the last day of the month. tc39 `41faca474a` (#3253) fixes both, two commits after
the last tc39 commit js-temporal has ported.

```js
Temporal.PlainYearMonth.from("2026-10").add({ days: 1 }); // 0.5.1: 2026-10; expected RangeError (also weeks, hours)
Temporal.PlainYearMonth.from("+275760-09").subtract({ months: 1 }); // 0.5.1: RangeError; expected +275760-08
```

**GMT.** No effect: `addYearMonth`, `subtractYearMonth` and `diffYearMonth` run the specification's steps on `PlainDate`
(`addYearMonth.test.ts`). Nothing to file; it arrives with the catch-up and release.

## Z. `PlainYearMonth#toLocaleString` with only `era` prints a day (polyfill; Chromium prints no date)

**Defect.** `yearMonthAmend` (`lib/intl.ts`) applies the year-month defaults only when `year`, `month` and `era` are all
absent, so an `era` alone falls back to the full date pattern and prints a day. Fixed on js `main` by `664283f824`
(unreleased) and in V8 by `d785c2ad7a` (Chrome 158); tc39 `main` is correct.

```js
Temporal.PlainYearMonth.from({ calendar: "gregory", year: 2026, month: 10 }).toLocaleString("en-US", { calendar: "gregory", era: "short" });
// Node with the polyfill: 10/1/2026 AD. Spec: 10/2026 AD
```

**GMT.** No effect: `formatYearMonth` formats epoch milliseconds through Intl with `year`, `month` and the caller's `era`.
Upstream: [nodejs/node#67484](https://github.com/nodejs/node/issues/67484) asks Node 26 to take the V8 fix.

## AA. `PlainYearMonth#toLocaleString` and `PlainMonthDay#toLocaleString` accept a `timeStyle` (polyfill)

**Defect.** `yearMonthAmend` and `monthDayAmend` pass `timeStyle: false` to `amend`, which deletes it, so the call formats
as if no time style was given; the spec throws `TypeError`. Fixed on js `main` by `eef35cdd6e` (unreleased); tc39 `main`
throws. In 0.5.1 it also affects `PlainDate` with `dateStyle` plus `timeStyle`.

```js
Temporal.PlainYearMonth.from({ calendar: "gregory", year: 2026, month: 10 })
  .toLocaleString("en-US", { calendar: "gregory", dateStyle: "short", timeStyle: "short" }); // 0.5.1: 10/26; expected TypeError
```

**GMT.** No effect: `formatYearMonth` and `formatMonthDay` return `""` for a `timeStyle` themselves
(`plainYearMonthFormatOptions` and `plainMonthDayFormatOptions` return `null`).

## AB. `Temporal.Now` reads a millisecond early after a clock reading before 1970 (polyfill and tc39 reference polyfill)

**Defect.** `SystemUTCEpochNanoSeconds` carries the previous reading's `ms % 1e6` as the next reading's sub-millisecond
part. For a negative `ms` the remainder is negative, so after a clock reading before 1970 the next reading lands up to
999,999 ns before `Date.now()`; at a boundary that is the previous second, day or year. Vitest, Jest and Sinon
`setSystemTime` with a pre-1970 date trigger it. The spec defines `Date.now()` as the floor of the same clock.

```js
Date.now = () => Date.parse("1960-01-01T00:00:00Z"); Temporal.Now.instant();
Date.now = () => Date.parse("2027-01-01T00:00:00Z");
Temporal.Now.instant().toString(); // 0.5.1: 2026-12-31T23:59:59.9998Z; expected within 2027-01-01T00:00:00.000Z
```

Fix: take the floor modulo, `ns = ((ms % 1e6) + 1e6) % 1e6` (js-temporal: `JSBI.remainder(JSBI.add(JSBI.remainder(ms, MILLION), MILLION), MILLION)`).

**Workaround.** `D21`: every GMT function that reads the clock (`getUnixNow`, `getUtcNow`, `getZonedNow`, the `get*`
field readers, the relative formatters' default reference) is guarded against a reading a millisecond early after such a
reading.

**Upstream.** tc39 [#3335](https://github.com/tc39/proposal-temporal/issues/3335); js-temporal has the same code and gets
the fix with the rebase. **Retires** on a fix, the catch-up and a release, so the `D21` canary repro passes.
