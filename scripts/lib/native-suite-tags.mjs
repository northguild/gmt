/**
 * What the native-suite runner already knows about: failures of the GMT test suite on a native
 * Temporal engine that have a stated cause. A tag never skips a test. The test still runs on every
 * leg; a tag only sorts its failure for the reporter and goes stale, with a finding, once the test
 * stops failing that way.
 *
 * Node built-ins only and no `Date`: the runner and its tests import this file directly.
 *
 * Two lists, because there are two kinds of known failure (see `classify`):
 *
 * - `KNOWN_NATIVE_FAILURES`: a test fails on the native engine and passes on
 *   `@js-temporal/polyfill` in the same runtime. One row per test, one defect per row.
 * - `KNOWN_HOST_FAILURES`: a test fails on both engines in one runtime, so the runtime's data or
 *   setup is the cause, not Temporal. One group per cause, matched by pattern.
 *
 * `TAGGED_MISMATCHES` in `scripts/temporal-compat.mjs` keys oracle rows and cannot key a test, so
 * these lists are separate. A defect behind both names the same `defect` anchor in both.
 *
 * A test that fails on the control and not natively is control-only, and no list tags it. GMT
 * ships the polyfill, and in each runtime the polyfill and the native engine read the same locale
 * and time zone data, so a control-only failure is a wrong answer GMT gives that runtime's users:
 * fix it in GMT (a temporalCompat workaround for a polyfill defect), never tag it.
 */

/** @typedef {"node" | "chromium" | "firefox" | "webkit" | "webkit-macos"} Leg */

const L_ANCHOR = "l-a-one-character-annotation-key-is-refused";
const M_ANCHOR = "m-u-caislamic-is-accepted-instead-of-refused";
const P_ANCHOR =
  "p-spidermonkey-accepts-a-zoned-string-whose-local-date-is-271821-04-19-firefox-only-engine";
const ICU4X_8620 = "https://github.com/unicode-org/icu4x/issues/8620";
const BOA_529 = "https://github.com/boa-dev/temporal/issues/529";
const BUGZILLA_1998020 = "https://bugzilla.mozilla.org/show_bug.cgi?id=1998020";
const S_ANCHOR =
  "s-webkit-adds-a-year-to-the-30th-of-dhu-al-hijjah-before-the-hijra-as-13-months-webkit-only-engine";
const T_ANCHOR =
  "t-webkit-throws-adding-a-year-to-the-last-day-of-chaitra-in-far-past-indian-years-webkit-only-engine";
const AE_ANCHOR =
  "ae-icu4c-75-counts-every-persian-year-before-year-0-as-a-leap-year-macos-webkit-engine";
const AD_ANCHOR =
  "ad-node-26s-v8-rounds-p7d-to-weeks-as-p1w1d-from-a-zoned-origin-node-only-engine";
const BOA_723 = "https://github.com/boa-dev/temporal/pull/723";

/**
 * One test that fails natively and passes on the polyfill, for a known defect. `file` is
 * package-relative (`src/zoned/calculate/roundZoned.test.ts`); `test` is the Vitest `fullName`
 * exactly; `defect` is the heading anchor of the defect's record in
 * `context/domination/js-temporal-polyfill-bugs.md`; `upstream` is the filed report's URL, or
 * `null` until one is filed.
 *
 * The 13 tests that fail on Node 26 and Chromium 153 (V8 on `temporal_rs`) and pass on the
 * polyfill. Ten are L (`ixdtf` rejects a one-character annotation key, fixed in unicode-org/icu4x#8623,
 * not yet in an `ixdtf` release or a V8 roll); three are M (`temporal_rs` reads `islamic` as a
 * calendar, boa-dev/temporal#529). Two more fail on Node 26 alone and are AD: its V8 does not yet
 * carry boa-dev/temporal#723, so it rounds `P7D` to weeks from a zoned origin as `P1W1D`; Chromium
 * 153 has the fix. The 12 tests that fail on Firefox 155 (SpiderMonkey) and pass on the
 * polyfill are P: SpiderMonkey accepts a zoned string whose local date is -271821-04-19, where the
 * spec refuses it (Bugzilla 1998020). The 7 tests that fail on WebKit 26.6 (JavaScriptCore) and pass on
 * the polyfill are S (six: JavaScriptCore adds a year to Dhu al-Hijjah 30 of a year before the Hijra as
 * 13 months) and T (one: it throws adding a year to the last day of Chaitra in a far-past Indian year);
 * both fail on Playwright's Linux build and on the Mac build, so the rows name both WebKit legs.
 * Two more fail on the Mac build alone and are AE: Apple's libicucore (ICU4C 75 or later) counts every
 * Persian year before year 0 as a leap year, so adding a month to day 30 of Bahman, or subtracting one from
 * day 30 of Farvardin, in a year before year 0 throws. If the Linux runner's ICU moves to 75 or later, the
 * `webkit` leg starts failing
 * these two rows too and they need that leg. None is filed yet. Evidence: the records.
 * Goose Bay day rounding is not here: it was a GMT defect and is fixed (temporalCompat D14).
 *
 * @type {ReadonlyArray<{ file: string, test: string, legs: Leg[], defect: string, upstream: string | null }>}
 */
export const KNOWN_NATIVE_FAILURES = [
  {
    file: "src/internal/calendarDateString.test.ts",
    test: "parseCalendarDateValue parses 2024-10-03[x=y][u-ca=roc] to ISO 2024-10-03 computed in roc, ignoring the other annotations",
    legs: ["node", "chromium"],
    defect: L_ANCHOR,
    upstream: ICU4X_8620,
  },
  {
    file: "src/duration/calculate/totalDuration.test.ts",
    test: "totalDuration totals P1D as 24 hours relativeTo 2024-01-01T00:00:00+00:00[UTC][x=T12346… (an annotation value is not a time of day)",
    legs: ["node", "chromium"],
    defect: L_ANCHOR,
    upstream: ICU4X_8620,
  },
  {
    file: "src/plain/validate/isValidDate.test.ts",
    test: "isValidDate returns true for a PlainDate with annotations Temporal reads and ignores: 2024-03-10[a=bc]",
    legs: ["node", "chromium"],
    defect: L_ANCHOR,
    upstream: ICU4X_8620,
  },
  {
    file: "src/plain/validate/isValidDateTime.test.ts",
    test: "isValidDateTime returns true for a PlainDateTime with annotations Temporal reads and ignores: 2024-03-10T12:30[a=bc]",
    legs: ["node", "chromium"],
    defect: L_ANCHOR,
    upstream: ICU4X_8620,
  },
  {
    file: "src/plain/validate/isValidTime.test.ts",
    test: "isValidTime returns true for a PlainTime with annotations Temporal reads and ignores: 12:30[a=bc]",
    legs: ["node", "chromium"],
    defect: L_ANCHOR,
    upstream: ICU4X_8620,
  },
  {
    file: "src/span/calculate/spanNs.test.ts",
    test: "spanNs returns 1000000000n nanoseconds from 2024-01-01T00:00:00Z[x=T123460Z] to 2024-01-01T00:00:01Z",
    legs: ["node", "chromium"],
    defect: L_ANCHOR,
    upstream: ICU4X_8620,
  },
  {
    file: "src/precision/validate/isValidInstant.test.ts",
    test: "isValidInstant returns true for 2024-01-01T00:00:00Z[x=T123460Z], whose annotation is not checked (elective annotation value shaped like a…)",
    legs: ["node", "chromium"],
    defect: L_ANCHOR,
    upstream: ICU4X_8620,
  },
  {
    file: "src/precision/validate/isValidInstant.test.ts",
    test: "isValidInstant returns true for 2024-01-01T00:00:00Z[x=t000060-y], whose annotation is not checked (elective annotation value shaped like a…)",
    legs: ["node", "chromium"],
    defect: L_ANCHOR,
    upstream: ICU4X_8620,
  },
  {
    file: "src/utc/validate/isValidUtc.test.ts",
    test: "isValidUtc returns true for a UTC instant with annotations Temporal reads and ignores: 2024-03-10T12:30Z[a=bc]",
    legs: ["node", "chromium"],
    defect: L_ANCHOR,
    upstream: ICU4X_8620,
  },
  {
    file: "src/zoned/get/getTimeZoneOffset.test.ts",
    test: "getTimeZoneOffset still reads an instant whose elective annotation value looks like a leap second",
    legs: ["node", "chromium"],
    defect: L_ANCHOR,
    upstream: ICU4X_8620,
  },
  {
    file: "src/zoned/validate/isValidCalendarZonedDateTime.test.ts",
    test: "isValidCalendarZonedDateTime returns false for the unsupported calendar id islamic in 2024-01-10T12:00:00+00:00[UTC][u-ca=isl… (not in the proposal's calendar table)",
    legs: ["node", "chromium"],
    defect: M_ANCHOR,
    upstream: BOA_529,
  },
  {
    file: "src/internal/calendarDateString.test.ts",
    test: "parseCalendarDateValue throws for 2024-10-03[u-ca=islamic] (not in the proposal's calendar table)",
    legs: ["node", "chromium"],
    defect: M_ANCHOR,
    upstream: BOA_529,
  },
  {
    file: "src/plain/validate/isValidCalendarDate.test.ts",
    test: "isValidCalendarDate returns false for the unsupported calendar id in 2024-10-03[u-ca=islamic] (not in the proposal's calendar table)",
    legs: ["node", "chromium"],
    defect: M_ANCHOR,
    upstream: BOA_529,
  },
  {
    file: "src/internal/zonedWallClock.test.ts",
    test: "zonedDateTimeFrom the minimum instant throws for -271821-04-19T20:00:00-04:56:02[America… with offset=reject (CheckISODaysRange rejects -271821-04-19)",
    legs: ["firefox"],
    defect: P_ANCHOR,
    upstream: BUGZILLA_1998020,
  },
  {
    file: "src/internal/zonedWallClock.test.ts",
    test: "zonedDateTimeFrom the minimum instant throws for -271821-04-19T20:00:00-04:56:02[America… with offset=prefer (CheckISODaysRange rejects -271821-04-19)",
    legs: ["firefox"],
    defect: P_ANCHOR,
    upstream: BUGZILLA_1998020,
  },
  {
    file: "src/internal/zonedWallClock.test.ts",
    test: "zonedDateTimeFrom the minimum instant throws for -271821-04-19T19:03:58-04:56[America/Ne… with offset=reject (CheckISODaysRange rejects -271821-04-19)",
    legs: ["firefox"],
    defect: P_ANCHOR,
    upstream: BUGZILLA_1998020,
  },
  {
    file: "src/test/minuteRoundedOffsets.test.ts",
    test: "instant readers read a zoned string written at the range limits zoned reads refuse -271821-04-19T23:59:00-00:01[Europe/Lon…, whose local date is before the ISO date range",
    legs: ["firefox"],
    defect: P_ANCHOR,
    upstream: BUGZILLA_1998020,
  },
  {
    file: "src/test/minuteRoundedOffsets.test.ts",
    test: "instant readers read a zoned string written at the range limits zoned reads refuse -271821-04-19T19:04:13-04:56[America/Ne…, whose local date is before the ISO date range",
    legs: ["firefox"],
    defect: P_ANCHOR,
    upstream: BUGZILLA_1998020,
  },
  {
    file: "src/test/storedOffsetValues.test.ts",
    test: "the limit of arithmetic at a stored offset with seconds roundUnix returns its sentinel at the first instant at -00:44:30 and at -00:45 alike",
    legs: ["firefox"],
    defect: P_ANCHOR,
    upstream: BUGZILLA_1998020,
  },
  {
    file: "src/test/storedOffsetValues.test.ts",
    test: "the limit of arithmetic at a stored offset with seconds setUnix returns its sentinel at the first instant at -00:44:30 and at -00:45 alike",
    legs: ["firefox"],
    defect: P_ANCHOR,
    upstream: BUGZILLA_1998020,
  },
  {
    file: "src/zoned/convert/convertZonedToCalendar.test.ts",
    test: 'convertZonedToCalendar at the minimum instant behind UTC (CORE-6) returns "" converting -271821-04-19T12:00:00-12:00[Etc/GMT+12] to hebrew: its offset makes TC39 check the local date against the day range',
    legs: ["firefox"],
    defect: P_ANCHOR,
    upstream: BUGZILLA_1998020,
  },
  {
    file: "src/zoned/convert/convertZonedToCalendar.test.ts",
    test: 'convertZonedToCalendar at the minimum instant behind UTC (CORE-6) returns "" converting -271821-04-19T12:00:00-12:00[Etc/GMT+12] to iso8601: its offset makes TC39 check the local date against the day range',
    legs: ["firefox"],
    defect: P_ANCHOR,
    upstream: BUGZILLA_1998020,
  },
  {
    // The `[u-ca=hebrew]` input is 53 characters: Vitest cuts it at 40 and ends it with `…`.
    file: "src/zoned/convert/convertZonedToCalendar.test.ts",
    test: 'convertZonedToCalendar at the minimum instant behind UTC (CORE-6) returns "" converting -271821-04-19T12:00:00-12:00[Etc/GMT+12… to iso8601: its offset makes TC39 check the local date against the day range',
    legs: ["firefox"],
    defect: P_ANCHOR,
    upstream: BUGZILLA_1998020,
  },
  {
    file: "src/zoned/convert/convertZonedToCalendar.test.ts",
    test: 'convertZonedToCalendar at the minimum instant behind UTC (CORE-6) returns "" converting -271821-04-19T19:03:58-04:56:02[America… to hebrew: its offset makes TC39 check the local date against the day range',
    legs: ["firefox"],
    defect: P_ANCHOR,
    upstream: BUGZILLA_1998020,
  },
  {
    file: "src/zoned/convert/convertZonedToCalendar.test.ts",
    test: 'convertZonedToCalendar at the minimum instant behind UTC (CORE-6) returns "" converting -271821-04-19T19:03:58-04:56:02[America… to iso8601: its offset makes TC39 check the local date against the day range',
    legs: ["firefox"],
    defect: P_ANCHOR,
    upstream: BUGZILLA_1998020,
  },
  {
    file: "src/plain/calculate/diffDateAsDuration.edges.test.ts",
    test: "diffDateAsDuration next to the range limits (CORE-6 §4.4) returns P1Y5M23D in years from -271820-01-19[u-ca=islamic-civil] to -271819-06-27[u-ca=islamic-civil] (xscan islamic-civil min[275], 800 d ins…)",
    legs: ["webkit", "webkit-macos"],
    defect: S_ANCHOR,
    upstream: null,
  },
  {
    file: "src/plain/calculate/diffDateAsDuration.edges.test.ts",
    test: "diffDateAsDuration next to the range limits (CORE-6 §4.4) returns P1Y5M24D in years from -271820-01-18[u-ca=islamic-tbla] to -271819-06-27[u-ca=islamic-tbla] (xscan islamic-tbla min[274], 800 d insi…)",
    legs: ["webkit", "webkit-macos"],
    defect: S_ANCHOR,
    upstream: null,
  },
  {
    file: "src/plain/calculate/diffDateAsDuration.edges.test.ts",
    test: "diffDateAsDuration next to the range limits (CORE-6 §4.4) returns P1Y5M23D in years from -271820-01-19[u-ca=islamic-umalqura] to -271819-06-27[u-ca=islamic-umalqura] (xscan islamic-umalqura min[275], 800 d …)",
    legs: ["webkit", "webkit-macos"],
    defect: S_ANCHOR,
    upstream: null,
  },
  {
    file: "src/plain/calculate/diffDateAsDuration.edges.test.ts",
    test: "diffDateAsDuration next to the range limits (CORE-6 §4.4) returns P2Y2M7D in years from -271821-04-20[u-ca=indian] to -271819-06-27[u-ca=indian] (xscan indian min[1], 800 d inside)",
    legs: ["webkit", "webkit-macos"],
    defect: T_ANCHOR,
    upstream: null,
  },
  {
    file: "src/plain/calculate/addDate.edges.test.ts",
    test: "addDate next to the range limits (CORE-6 §4.4) adds { years: 1 } to -271820-01-19[u-ca=islamic-civil] as '-271819-01-07[u-ca=islamic-civil]' (xscan islamic-civil min[275])",
    legs: ["webkit", "webkit-macos"],
    defect: S_ANCHOR,
    upstream: null,
  },
  {
    file: "src/plain/calculate/addDate.edges.test.ts",
    test: "addDate next to the range limits (CORE-6 §4.4) adds { years: 1 } to -271820-01-18[u-ca=islamic-tbla] as '-271819-01-06[u-ca=islamic-tbla]' (xscan islamic-tbla min[274])",
    legs: ["webkit", "webkit-macos"],
    defect: S_ANCHOR,
    upstream: null,
  },
  {
    file: "src/plain/calculate/addDate.edges.test.ts",
    test: "addDate next to the range limits (CORE-6 §4.4) adds { years: 1 } to -271820-01-19[u-ca=islamic-umalqura] as '-271819-01-07[u-ca=islamic-umalqura]' (xscan islamic-umalqura min[275])",
    legs: ["webkit", "webkit-macos"],
    defect: S_ANCHOR,
    upstream: null,
  },
  {
    file: "src/plain/calculate/addDate.test.ts",
    test: "addDate returns -271820-04-09[u-ca=persian] for -271820-03-11[u-ca=persian] + { months: 1 } (xscan persian min[327]: into the 29-day…)",
    legs: ["webkit-macos"],
    defect: AE_ANCHOR,
    upstream: null,
  },
  {
    file: "src/plain/calculate/subtractDate.test.ts",
    test: "subtractDate returns '-271820-04-09[u-ca=persian]' for -271820-05-09[u-ca=persian] - { months: 1 } (D1-A persian (xscan min[386]))",
    legs: ["webkit-macos"],
    defect: AE_ANCHOR,
    upstream: null,
  },
  {
    file: "src/test/laterPassOrigin.test.ts",
    test: "normalizeDuration from a repeated hour P7D with { largestUnit: 'week', …(1) } from 2024-11-01T00:00:00+00:00[UTC] is P1W",
    legs: ["node"],
    defect: AD_ANCHOR,
    upstream: BOA_723,
  },
  {
    file: "src/test/laterPassOrigin.test.ts",
    test: "normalizeDuration from a repeated hour P7D with { largestUnit: 'week', …(1) } from 2024-06-01T12:00:00-04:00[America/New_Y… is P1W",
    legs: ["node"],
    defect: AD_ANCHOR,
    upstream: BOA_723,
  },
];
/**
 * A group of tests that fail on both engines in a runtime, for one stated reason. `id` is
 * kebab-case and unique; `reason` is one plain sentence naming the runtime and the data it lacks;
 * at least one of `file` and `test` is given, and both must match when both are. Never a pattern
 * that matches everything.
 *
 * @type {ReadonlyArray<{ id: string, legs: Leg[], reason: string, file?: RegExp, test?: RegExp }>}
 */
export const KNOWN_HOST_FAILURES = [
  {
    // Evidence, Chromium 153.0.8010.12 under Playwright: `Intl.DateTimeFormat.supportedLocalesOf(["is-IS"])`
    // is `[]`, and `new Intl.DateTimeFormat("is-IS").resolvedOptions().locale` is "en-US", as is
    // `Intl.RelativeTimeFormat`'s. The other nine locales GMT tests are all supported. Node 26 (ICU 78.3)
    // supports `is-IS`.
    id: "chromium-icelandic-locale-data",
    legs: ["chromium"],
    reason:
      "Chromium ships no Icelandic (is) locale data, so is-IS formats fall back to English.",
    test: /\bis-IS\b/,
  },
  {
    // Evidence, Chromium 153.0.8010.12 under Playwright: for America/New_York with
    // `timeZoneName: "shortGeneric"`, es-ES gives "hora de New York" (expected "hora de Nueva York"),
    // ko-KR "New York 시간", ru-RU "New York", and ja-JP, zh-CN, ar-SA, he-IL, pt-PT the same English
    // city. `timeZoneName: "short"` and `longGeneric` are localised. Only the localised exemplar city
    // name is missing. Firefox 155.0 (Playwright 1.63.0) gives the same strings byte for byte:
    // es-ES "hora de New York", pt-PT "Hora de New York", zh-CN "New York时间", ja-JP "New York時間",
    // ko-KR "New York 시간", ar-SA "توقيت New York", he-IL "שעון New York", ru-RU "New York".
    // Node 26.12.1 (ICU 78.3, CLDR 48.0) and WebKit 26.6 localise the city.
    id: "browser-zone-city-names",
    legs: ["chromium", "firefox"],
    reason:
      "Chromium and Firefox ship no localised exemplar city names for time zones, so a generic zone name shows the English city (New York) in every locale.",
    file: /\/formatTimeZoneName\.test\.ts$/,
    test: /season-independent styles \(shortGeneric\/longGeneric\) returns the same name in January and July for /,
  },
  {
    // Evidence, same browser: `new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeZone: "UTC" })
    // .formatRange(2024-02-03, 2024-02-05)` is "2024년 2월 3일 ~ 5일" (spaces around the tilde);
    // Node 26 gives "2024년 2월 3일~5일". The range pattern differs between the two ICU data builds.
    id: "chromium-korean-range-pattern",
    legs: ["chromium"],
    reason:
      "Chromium's Korean date-range pattern puts spaces around the tilde (3일 ~ 5일) where Node's ICU data has none.",
    file: /\/formatDateRange\.test\.ts$/,
    test: /locale ko-KR with options \{ dateStyle: 'long' \}/,
  },
  {
    // Evidence: at 2026-11-15T17:00Z, Chromium 153.0.8010.12 under Playwright 1.63.0 gives
    // America/Vancouver -08:00 and America/Winnipeg -06:00 (tz data before 2026b), and Chromium
    // 156.0.8078.4 under Playwright 1.64.1 gives Vancouver -07:00 but Winnipeg -06:00 (before
    // 2026e). Firefox 155.0 under Playwright 1.63.0 fails the same 17 rows of this file: at
    // 2026-11-01T08:00Z it gives America/Edmonton -07:00 (Edmonton changed in 2026c, so its data
    // predates 2026c), and at 2026-11-01T07:00Z America/Winnipeg -06:00 (before 2026e). Node 26.12.1 (tz 2026e) gives -07:00 and -05:00.
    // Playwright's Linux WebKit 26.6 (ubuntu-24.04, the runner's libicu74 74.2) fails all 37 rows of this
    // file on both engines; Mac WebKit 26.6 (macOS 27.0.1, Apple's libicucore) gives America/Vancouver
    // -07:00 at 2026-11-15T17:00Z (it has 2026b) but America/Winnipeg -06:00 at 2026-11-01T07:00Z, where
    // tzdb 2026e gives -05:00 (its NEWS: Manitoba's 2026-03-08 spring forward was its last foreseeable
    // clock change, as it moved to permanent -05 thereafter; it temporarily models the change on 2026-11-01
    // at 02:00); it fails seven rows of this file.
    // The group goes stale once a Playwright Chromium, Firefox, Linux WebKit and a Mac WebKit all carry 2026e.
    id: "browser-canada-2026-tz-data",
    legs: ["chromium", "firefox", "webkit", "webkit-macos"],
    reason:
      "Chromium's, Firefox's, Linux WebKit's and Mac WebKit's time zone data predates tzdb 2026e, so some of the Canadian zones that stopped changing their clocks in 2026 still turn back on 2026-11-01.",
    file: /\/oh-canada\.test\.ts$/,
  },
  {
    // Evidence: under Playwright 1.63.0, Chromium 153.0.8010.12 gives Africa/Casablanca and
    // Africa/El_Aaiun +01:00 at 2026-09-20T01:00Z, 2026-11-02T12:00Z and 2027-06-01T12:00Z, and
    // +00:00 at 2027-02-22T12:00Z (tz data before 2026c). Chromium 156.0.8078.4 under Playwright
    // 1.64.1, Mac WebKit 26.6 and Node 26.12.1 (tz 2026e) give +00:00 at all four. Firefox 155.0 under
    // Playwright 1.63.0 fails the same 44 rows of this file: it gives Africa/Casablanca +01:00 at
    // 2026-09-20T01:00Z, where tz data from 2026c gives +00:00. Playwright's Linux WebKit 26.6
    // (ubuntu-24.04, the runner's libicu74 74.2) fails the same 44 rows on both engines. The group
    // goes stale once a Playwright Chromium, Firefox and Linux WebKit all carry 2026c.
    id: "browser-morocco-2026-tz-data",
    legs: ["chromium", "firefox", "webkit"],
    reason:
      "Chromium's, Firefox's and Linux WebKit's time zone data predates tzdb 2026c, so Morocco and Western Sahara still read +01:00 outside the old Ramadan weeks.",
    file: /\/oh-morocco\.test\.ts$/,
  },
  {
    // Evidence, Playwright's Linux WebKit 26.6 on ubuntu-24.04 (the runner's libicu74 74.2), both
    // engines: Asia/Manila local mean time in December 1844 is -15:56:00, where tzdb 2024b corrected
    // the Philippines before 1899 to -15:56:08 and moved the 1899 change from 1899-05-11 to
    // 1899-09-06 (the rows read 1844-12-30T00:00:00-15:56 for 1844-12-30T00:00:08-15:56, count 62
    // days for 61 and list the 1899 change at 1899-05-10T23:56:00+08:00); and Antarctica/Casey has
    // no change on 2021-03-13, which tzdb 2023d added with Casey's other changes since 2020. Mac
    // WebKit 26.6 has the Casey change (2021-03-13T21:00:00+08:00) and the same Manila -15:56:00.
    // Node 26.12.1 (tz 2026e) passes every row. The group goes stale once a Playwright Linux WebKit
    // carries 2024b.
    id: "webkit-linux-tz-data",
    legs: ["webkit"],
    reason:
      "Linux WebKit's time zone data predates tzdb 2023d and 2024b, so Asia/Manila's 1844 local mean time and 1899 change and Antarctica/Casey's 2021 change read as before those releases.",
    test: /\bManila\b|Antarctica\/Casey/,
  },
  {
    // Evidence, WebKit 26.6 on both builds (Playwright's Linux build on ubuntu-24.04, and the Mac build on
    // macOS 27.0.1): `new Intl.DateTimeFormat("en", { timeZone: "EST5EDT" })` throws `RangeError: invalid
    // time zone: EST5EDT`, and `Temporal.ZonedDateTime.from("2024-07-15T12:00:00-04:00[EST5EDT]")` throws
    // `RangeError` too; the same for CST6CDT, MST7MDT and PST8PDT. Node 26.12.1, Chromium 153 and
    // Firefox 155 accept all four. IANA's `backward` file (tzdb 2026e) defines them as zones
    // (`Zone EST5EDT -5:00 USback E%sT`, and the same for CST6CDT, MST7MDT and PST8PDT), and ECMA-402
    // § 6.5 makes each Zone of the IANA Time Zone Database a primary time zone identifier.
    id: "webkit-posix-zone-ids",
    legs: ["webkit", "webkit-macos"],
    reason:
      "WebKit refuses the tzdb legacy zone ids CST6CDT, EST5EDT, MST7MDT and PST8PDT as invalid time zones, so the rows that pass them through fail.",
    file: /\/(isValidTimeZone|toOffsetInstant|fromOffsetInstant|getTimeZoneOffset)\.test\.ts$/,
    test: /\b(CST6CDT|EST5EDT|MST7MDT|PST8PDT)\b/,
  },
  {
    // Evidence, Playwright's Linux WebKit 26.6, both engines: `new Intl.DateTimeFormat("en", { timeZone:
    // "CET" })` and `Temporal.ZonedDateTime.from("...[CET]")` throw `RangeError: invalid time zone: CET`,
    // and the same for EET, MET and WET; tzdb 2024b made these ids links in `backward`. Mac WebKit 26.6
    // accepts CET, EET, MET, WET, EST, MST and HST in Intl and Temporal (its refusals are the four POSIX
    // ids of `webkit-posix-zone-ids`). Node 26.12.1 accepts all of them (CET resolves to Europe/Brussels), as do
    // Chromium 153 and Firefox 155.
    id: "webkit-legacy-zone-ids",
    legs: ["webkit"],
    reason:
      "Linux WebKit refuses the tzdb legacy zone ids CET, EET, MET and WET as invalid time zones, so the rows that pass them through fail.",
    file: /\/(isValidTimeZone|toOffsetInstant|fromOffsetInstant|getTimeZoneOffset)\.test\.ts$/,
    test: /\b(CET|EET|MET|WET)\b/,
  },
  {
    // Evidence, WebKit 26.6 (Mac and Playwright Linux alike), both engines:
    // `new Intl.DateTimeFormat("ar-SA").resolvedOptions().calendar` is "islamic-umalqura" and
    // `{ dateStyle: "long" }` prints 2024-02-03 as "٢٢ رجب، ١٤٤٥ هـ". Node 26.12.1 (CLDR 48), Chromium 153
    // and Firefox 155 resolve "gregory" and print "٣ فبراير ٢٠٢٤", which the expected values carry.
    // The lookahead leaves out the three ar-SA rows that are not about the calendar (relative tomorrow,
    // the date and time connector, the weekday names): `webkit-macos-ar-sa-relative-connector` and
    // `webkit-macos-ar-sa-weekday-names` explain them on the Mac. Those titles name no calendar, so the Hijri
    // reason never applied to them on Linux either.
    id: "webkit-ar-sa-islamic-default-calendar",
    legs: ["webkit", "webkit-macos"],
    reason:
      "WebKit's default calendar for ar-SA is islamic-umalqura where Node, Chromium and Firefox use gregory, so ar-SA rows that name no calendar print Hijri dates.",
    test: /^(?!.*(tomorrow for ar-SA|ar-SA's connector|getLocaleWeekdayNames)).*\bar-SA\b/,
  },
  {
    // Evidence, Playwright's Linux WebKit 26.6 on ubuntu-24.04, which takes its locale data from the
    // runner's libicu74 (74.2), both engines: he-IL prints the day period as "אחה״צ"/"לפנה״צ" and the
    // duration unit first ("יום 1"), where Node 26.12.1 (ICU 78.3, CLDR 48) prints "PM"/"AM" and "1 יום";
    // en-GB's full date has no comma ("Saturday 3 February 2024"); ru-RU's short range is
    // "03.02.2024 - 05.02.2024" for "03.02.2024-05.02.2024"; ko-KR prints "오후 2:30:45" for
    // "오후 2시 30분 45초" and zh-TW "清晨5時" for "清晨5"; and pt-PT, is-IS and en-US print the zone as
    // "GMT" where Node prints "GMT+0" or "GMT+00:00". Mac WebKit 26.6 agrees with Node on the en-GB
    // comma and prints the ru-RU range with an em dash, so these are the runner's ICU, not WebKit.
    id: "webkit-linux-icu74-locale-data",
    legs: ["webkit"],
    reason:
      "Linux WebKit formats with the runner's ICU 74 locale data, which differs from Node's ICU 78 in Hebrew day periods and unit order, the en-GB full date, the ru-RU range dash, the ko-KR and zh-TW time patterns and the GMT name without an offset for pt-PT, is-IS and en-US.",
    file: /\/(formatDuration|formatDate|formatDateRange|formatDateTime|formatTime|getLocaleMeridiems|formatZonedDateTime|formatZonedRange)\.test\.ts$/,
    test: /\b(he-IL|en-GB|ru-RU|pt-PT|is-IS|ko-KR|zh-TW)\b|keeps the requested timeZoneName style/,
  },
  {
    // Evidence, Mac WebKit 26.6 (macOS 27.0.1, Apple's libicucore), the same call in Node 26.12.1 (ICU 78.3,
    // CLDR 48.0) in brackets: `{ dateStyle: "medium", timeStyle: "medium", timeZone: "UTC" }` for
    // 2024-02-03T14:30:45Z prints "Feb 3, 2024 at 2:30:45 PM" (en-US; "Feb 3, 2024, 2:30:45 PM"), "3 Feb 2024
    // at 14:30:45" (en-GB) and "3 févr. 2024 à 14:30:45" (fr-FR; "3 févr. 2024, 14:30:45"). CLDR 48 en.xml
    // (gregorian dateTimeFormats) gives medium and short `{1}, {0}` in all three variants and the "at" form
    // `{1} 'at' {0}` only for full and long; fr.xml's medium standard pattern is `{1}, {0}` and en_GB.xml
    // inherits en_001, which inherits en. The two formatUnix rows name no locale because they pass
    // MustTestLocales.enUS with `{ dateStyle: "medium", timeStyle: "short" }` and fail on "Feb 29, 2024 at 12:00 AM".
    id: "webkit-macos-medium-date-time-connector",
    legs: ["webkit-macos"],
    reason:
      "Mac WebKit joins a medium date and a time with the word at (à in French) where CLDR 48 uses a comma, in en-US, en-GB and fr-FR.",
    file: /\/(formatDateTime|formatZonedDateTime|formatUtc|formatUnix|formatDateTimeToParts|formatZonedToParts)\.test\.ts$/,
    test: /\b(en-US|en-GB|fr-FR)\b.*(dateStyle: 'medium'| to (Feb 3, 2024, 2:30 PM|3 Feb 2024, 14:30|3 févr\. 2024, 14:30)$)|medium\/short \(UTC\) formats for (en-US|en-GB|fr-FR)|style variants \(UTC\) formats \{ dateStyle: 'medium'|formatUnix (epochUnit: seconds formats a unix-seconds value identically to the ms equivalent|numeric string input accepts a numeric ms string)$|dateStyle\/timeStyle returns exact parts for (en-US|en-GB|fr-FR)|returns '3 févr\. 2024, 14:30' \(parts joined\)/,
  },
  {
    // Evidence, Mac WebKit 26.6: `{ dateStyle: "long", timeStyle: "long" }` in sv-SE prints "3 februari 2024
    // 14:30:45" where Node 26.12.1 (CLDR 48.0) prints "3 februari 2024 kl. 14:30:45"; `Intl.RelativeTimeFormat
    // ("sv-SE", { numeric: "auto" }).format(1, "day")` is "imorgon" where Node prints "i morgon". CLDR 48
    // sv.xml has the atTime pattern `{1} 'kl'. {0}` for full and long dates and `<relative type="1">i morgon`.
    id: "webkit-macos-sv-se-connector-and-tomorrow",
    legs: ["webkit-macos"],
    reason:
      "Mac WebKit leaves out kl. between a long Swedish date and the time, and spells tomorrow imorgon where CLDR 48 has i morgon.",
    file: /\/(formatDateTime|formatZonedDateTime|formatCalendar|formatCalendarUnix|formatCalendarZoned|formatCalendarUtc)\.test\.ts$/,
    test: /tomorrow for sv-SE|sv-SE's connector|for sv-SE with options \{ (dateStyle: '(full|long)'|year: 'numeric', month: 'long')/,
  },
  {
    // Evidence, Mac WebKit 26.6: `new Intl.DateTimeFormat("ar-SA", { dateStyle: "long", timeStyle: "short",
    // timeZone: "UTC" })` keeps the Hijri calendar (`webkit-ar-sa-islamic-default-calendar`), and
    // `Intl.RelativeTimeFormat` with `numeric: "auto"` plus a time prints tomorrow at 14:30 as "غدًا، ٢:٣٠ م"
    // where Node 26.12.1 (CLDR 48.0) prints "غدًا في ٢:٣٠ م". CLDR 48 ar.xml has the atTime pattern
    // `{1} في {0}` for full and long dates and `<relative type="1">غدًا`.
    id: "webkit-macos-ar-sa-relative-connector",
    legs: ["webkit-macos"],
    reason:
      "Mac WebKit joins tomorrow and the time in Arabic with a comma where CLDR 48 has the word في.",
    test: /tomorrow for ar-SA|ar-SA's connector/,
  },
  {
    // Evidence, Mac WebKit 26.6 and Node 26.12.1 (CLDR 48.0): `new Intl.Locale("zh-CN").getWeekInfo()` is
    // `{ firstDay: 7, weekend: [6, 7] }` on Mac WebKit and `{ firstDay: 1, weekend: [6, 7] }` in Node.
    // CLDR 48 supplementalData.xml lists CN in `<firstDay day="mon" territories="001 AD AE ... CH CL CM CN CR ...">`,
    // so weeks in zh-CN start on Monday.
    id: "webkit-macos-zh-cn-week-start",
    legs: ["webkit-macos"],
    reason:
      "Mac WebKit starts the week on Sunday for zh-CN where CLDR 48 starts it on Monday.",
    file: /\/(getLocaleFirstDayOfWeek|getLocaleStartOfWeek|getLocaleEndOfWeek|getLocaleZonedStartOfWeek|getLocaleZonedEndOfWeek|getLocaleWeekdayNames|isThisUnit|isZonedThisUnit|getWeekOfMonth|getWeeksInMonth)\.test\.ts$/,
    test: /(\bin zh-CN( \(locale matrix\)| -> false)?|for locale zh-CN|for zh-CN in locale-first-day order)$/,
  },
  {
    // Evidence, Mac WebKit 26.6 against Node 26.12.1 (CLDR 48.0): ru-RU abbreviated weekdays print "Пн"
    // (CLDR 48 ru.xml gregorian abbreviated format days: пн, вт, ср, чт, пт, сб, вс), en-GB's September
    // abbreviation prints "Sep" (en_001.xml: `<month type="9">Sept</month>`, en_GB inherits it), and the
    // ru-RU narrow relative day prints "-3 дн" (ru.xml day-narrow few: `-{0} дн.`).
    id: "webkit-macos-ru-gb-short-names",
    legs: ["webkit-macos"],
    reason:
      "Mac WebKit capitalises the Russian short weekday names, drops the full stop of the Russian narrow day unit and spells September Sep in en-GB, where CLDR 48 has lower case, дн. and Sept.",
    test: /getLocaleWeekdayNames returns 7 weekday names \(long\/short\/narrow\) for ru-RU|getLocaleMonthNames returns 12 Gregorian month names \(long\/short\/narrow\) for en-GB|formatRelativeDate formats 2024-03-\d\d for ru-RU with style narrow/,
  },
  {
    // Evidence, Mac WebKit 26.6: the short ar-SA weekday names come back as "أحد", "اثنين", "ثلاثاء", ...
    // where Node 26.12.1 returns "الأحد", "الاثنين", "الثلاثاء", ...; the long width passes (the failing
    // assertion is the short one). CLDR 48 ar.xml gregorian abbreviated format weekdays inherit the wide ones
    // (`<day type="sun">↑↑↑</day>`; wide `<day type="sun">الأحد</day>`, mon `الاثنين`, tue `الثلاثاء`).
    id: "webkit-macos-ar-sa-weekday-names",
    legs: ["webkit-macos"],
    reason:
      "Mac WebKit's short Arabic weekday names drop the article (أحد where CLDR 48 ar.xml has الأحد), so the short list differs from Node's.",
    test: /getLocaleWeekdayNames returns 7 weekday names \(long\/short\/narrow\) for ar-SA/,
  },
  {
    // Evidence, Mac WebKit 26.6 against Node 26.12.1 (CLDR 48.0), 12-hour day periods: zh-CN and zh-TW at
    // 03:30 and 00:30 print "凌晨" where Node prints "上午" (zh.xml gregorian abbreviated am "上午", pm "下午");
    // he-IL prints "אח׳" for PM where Node prints "PM" (he.xml inherits root's `PM`); pt-PT prints "PM" where
    // Node prints "p.m." (pt_PT.xml am "a.m.", pm "p.m.").
    id: "webkit-macos-day-period-words",
    legs: ["webkit-macos"],
    reason:
      "Mac WebKit prints other day period words than CLDR 48 for zh-CN, zh-TW, he-IL and pt-PT: 凌晨 for the early morning, אח׳ for PM in Hebrew and PM for Portuguese.",
    file: /\/(getLocaleMeridiems|formatDateTime|formatZonedDateTime|formatTime)\.test\.ts$/,
    test: /getLocaleMeridiems (returns \[(上午, 下午|AM, PM|AM-label, PM-label)\] for (zh-CN|zh-TW|he-IL|pt-PT)|varies by locale)|for he-IL with options \{ (year: 'numeric'|hour: '2-digit'), .* to (03\.02\.2024, )?02:30:45 PM$|for (he-IL|pt-PT) with 12-hour day period|pt-PT with 12-hour day period/,
  },
  {
    // Evidence, Mac WebKit 26.6: `{ year: "numeric", month: "numeric", day: "numeric" }` in tr-TR prints
    // "3.02.2024" where Node 26.12.1 (CLDR 48.0) prints "03.02.2024". CLDR 48 tr.xml `<dateFormatItem
    // id="yMd">dd.MM.y</dateFormatItem>`.
    id: "webkit-macos-tr-day-padding",
    legs: ["webkit-macos"],
    reason:
      "Mac WebKit leaves the day of a numeric Turkish date without its leading zero where CLDR 48 has dd.MM.y.",
    file: /\/(formatDate|formatDateTime|formatZonedDateTime|formatDateToParts)\.test\.ts$/,
    test: /for tr-TR with options (\{ year: 'numeric'|year (numeric|2-digit), month numeric)|returns exact parts for tr-TR$/,
  },
  {
    // Evidence, Mac WebKit 26.6 against Node 26.12.1 (CLDR 48.0): `{ dateStyle: "full" }` for 2024-02-03 in
    // zh-CN prints "2024年2月3日 星期六" (a space before the weekday) and in ja-JP "2024年2月3日 土曜日"; Node
    // prints "2024年2月3日星期六" and "2024年2月3日土曜日". CLDR 48 zh.xml and ja.xml: full date pattern
    // `y年M月d日EEEE`, no space. The zh-CN zoned full/full row in formatZonedDateTime shows this cause and the
    // one of `webkit-macos-zh-time-zone-name-position`: Mac prints "2024年2月3日 星期六 中国标准时间14:30:45"
    // where Node prints "2024年2月3日星期六 中国标准时间 14:30:45".
    id: "webkit-macos-zh-ja-full-date-weekday-space",
    legs: ["webkit-macos"],
    reason:
      "Mac WebKit puts a space before the weekday of a full zh-CN or ja-JP date where CLDR 48 has none.",
    file: /\/(formatDate|formatDateTime|formatZonedDateTime)\.test\.ts$/,
    test: /for (zh-CN|ja-JP) with options (\{ dateStyle: 'full'|dateStyle full)/,
  },
  {
    // Evidence, Mac WebKit 26.6 against Node 26.12.1 (CLDR 48.0): zh-CN `{ dateStyle: "long", timeStyle:
    // "long", timeZone: "Asia/Shanghai" }` prints "2024年2月3日 GMT+814:30:45" (no space between the zone and
    // the time) where Node prints "2024年2月3日 GMT+8 14:30:45" (zh.xml time long `z HH:mm:ss`); zh-TW prints the
    // zone first ("GMT+8 下午2:30:45") where Node prints "下午2:30:45 [GMT+8]" (zh_Hant.xml time long
    // `Bh:mm:ss [z]`, full `Bh:mm:ss [zzzz]`). The zh-CN zoned full/full row in formatZonedDateTime also
    // shows the weekday space of `webkit-macos-zh-ja-full-date-weekday-space`: both causes are in its text.
    id: "webkit-macos-zh-time-zone-name-position",
    legs: ["webkit-macos"],
    reason:
      "Mac WebKit puts the time zone name of a Chinese long or full time in another place or with another spacing than CLDR 48.",
    file: /\/(formatZonedDateTime|formatZonedRange)\.test\.ts$/,
    test: /for zh-(CN|TW) with options \{ dateStyle: '(full|long)', timeStyle|for zh-TW with \{ (dateStyle: 'long'|hour: 'numeric')/,
  },
  {
    // Evidence, Mac WebKit 26.6 against Node 26.12.1 (CLDR 48.0), zh-TW date-time ranges: with
    // `{ dateStyle: "long", timeStyle: "long" }` Mac prints "2024/2/3 下午2:30:45至下午4:46:15" where Node prints
    // "2024/2/3 下午2:30:45 - 下午4:46:15"; with `{ hour: "numeric", minute: "numeric" }` Mac prints
    // "下午2:30-4:46" where Node prints "下午2:30至4:46". CLDR 48 settles both: zh_Hant.xml gregorian `hm`
    // interval is `Bh:mm至h:mm` (the 至 of the hour-minute range), and its gregorian `intervalFormatFallback`
    // is `↑↑↑`, which inherits zh.xml's `{0} – {1}` (the dash between two full date-times). Mac has the two
    // swapped; formatZonedRange with `{ hour: "numeric", dayPeriod, timeZoneName: "shortOffset" }` prints
    // "清晨5 GMT-5至下午3 GMT-5" where Node prints "清晨5 GMT-5 – 下午3 GMT-5".
    id: "webkit-macos-zh-tw-datetime-range-separator",
    legs: ["webkit-macos"],
    reason:
      "Mac WebKit joins the two ends of a zh-TW range with 至 where CLDR 48 has a dash (long date-time, and hour ranges with a zone name) and with a dash where CLDR 48 has 至 (hour and minute).",
    file: /\/(formatDateTimeRange|formatZonedRange)\.test\.ts$/,
    test: /for locale zh-TW with options \{ (dateStyle: 'long', timeStyle: 'long'|hour: 'numeric', minute: 'numeric') \}|formats zh-TW with \{ hour: 'numeric'/,
  },
  {
    // Evidence, Mac WebKit 26.6 against Node 26.12.1 (CLDR 48.0): `{ dateStyle: "short" }` for 2024-02-03 in
    // ko-KR prints "2024. 2. 3." where Node prints "24. 2. 3.". CLDR 48 ko.xml short date `yy. M. d.`.
    id: "webkit-macos-ko-short-date-year",
    legs: ["webkit-macos"],
    reason:
      "Mac WebKit prints the year of a short ko-KR date in four digits where CLDR 48 has two.",
    file: /\/(formatDate|formatDateTime|formatZonedDateTime|formatDateRange|formatDateTimeRange|formatZonedRange)\.test\.ts$/,
    test: /\bko-KR\b.*(dateStyle: 'short'|dateStyle short)|ko-KR with \{ dateStyle: 'short'/,
  },
  {
    // Evidence, Mac WebKit 26.6 against Node 26.12.1 (ICU 78.3, CLDR 48.0): `{ year: "numeric", month: "long" }`
    // in ko-KR-u-ca-hebrew prints "AM 5784년 스밧월" where Node and Chromium print "AM 5784년 5월". CLDR 48 ko.xml
    // has no hebrew availableFormats; root.xml aliases them to the generic calendar, whose `yyyyMMMM` is
    // `G y년 M월` (a numeric month). Apple's ICU data for ko has generic `yyyyMMMM` `G y년 MMMM` and hebrew format
    // wide month 5 `스밧월` where CLDR has `스밧`.
    id: "webkit-macos-ko-hebrew-year-month",
    legs: ["webkit-macos"],
    reason:
      "Mac WebKit uses Apple's own ICU data for ko, which writes a Hebrew year and month with the month name where CLDR 48 has the month number (G y년 M월).",
    test: /in ko-KR-u-ca-hebrew with \{ year: 'numeric', month: 'long' \}/,
  },
  {
    // Evidence, Mac WebKit 26.6 against Node 26.12.1 (CLDR 48.0): `{ year: "numeric", month: "numeric" }` in
    // ja-JP-u-ca-japanese prints "R6/02" where Node prints "R6/2". CLDR 48 ja.xml japanese calendar
    // `<dateFormatItem id="GyM">GGGGGy/M` has a one-digit month.
    id: "webkit-macos-ja-japanese-year-month",
    legs: ["webkit-macos"],
    reason:
      "Mac WebKit pads the month of a Japanese-calendar year and month to two digits where CLDR 48 has one (GGGGGy/M).",
    test: /in ja-JP-u-ca-japanese with \{ year: 'numeric', month: 'numeric' \}/,
  },
  {
    // Evidence, Mac WebKit 26.6 against Node 26.12.1 (CLDR 48.0), `formatRange` with `{ hour: "numeric",
    // minute: "numeric", timeZone: "UTC" }`: en-GB, es-ES, zh-CN and pt-PT print "14:30 – 16:46" (an en dash
    // with a space on each side) and Node prints "14:30–16:46". CLDR 48 en_001.xml and root.xml `HH:mm–HH:mm`,
    // es.xml `H:mm–H:mm`, es.xml `d–d MMM y`, and for `dateStyle: "long"` es.xml `yMMMMd` `d–d 'de' MMMM 'de' y` and pt_PT.xml `yMMMd` `d–d 'de' MMM 'de' y` (pt_PT.xml has no `yMMMMd` of its own): no spaces.
    id: "webkit-macos-range-dash-spacing",
    legs: ["webkit-macos"],
    reason:
      "Mac WebKit puts spaces around the dash of an en-GB, es-ES, zh-CN or pt-PT range where CLDR 48 has none.",
    file: /\/(formatDateRange|formatDateTimeRange|formatZonedRange)\.test\.ts$/,
    test: /for locale (en-GB|es-ES|zh-CN) with options|locale (es-ES|pt-PT) with options \{ dateStyle: 'long' \}|for (en-GB|es-ES|zh-CN) with \{|en-GB shortOffset London|in zh-CN with \{ timeZoneName/,
  },
  {
    // Evidence, Mac WebKit 26.6 against Node 26.12.1 (CLDR 48.0): de-DE `formatRange` with `{ hour: "numeric",
    // minute: "numeric" }` prints "14:30–16:46" where Node prints "14:30–16:46 Uhr" (de.xml `<intervalFormatItem
    // id="Hm">` `HH:mm–HH:mm 'Uhr'`); it-IT `{ dateStyle: "long" }` prints "3–5 febbraio 2024" where Node prints
    // "03–05 febbraio 2024" (it.xml yMMMd `dd–dd MMM y`).
    id: "webkit-macos-de-it-range-patterns",
    legs: ["webkit-macos"],
    reason:
      "Mac WebKit drops the word Uhr from a German time range and the leading zeros from an Italian date range, which CLDR 48 keeps.",
    file: /\/(formatDateRange|formatDateTimeRange|formatZonedRange)\.test\.ts$/,
    test: /for locale de-DE with options|for de-DE with \{|locale it-IT with options|in de with \{ timeZoneName/,
  },
  {
    // Evidence, Mac WebKit 26.6 against Node 26.12.1 (CLDR 48.0): en-IN `formatRange` with `{ hour: "numeric",
    // minute: "numeric", timeZoneName: "long" }` prints "10:30 AM - 12:30 PM India Standard Time" where Node
    // prints "10:30 am - 12:30 pm India Standard Time" (the dash is the same on both sides; only the case
    // differs; en_IN inherits en_001.xml: am `am`, pm `pm`).
    id: "webkit-macos-en-in-day-period-case",
    legs: ["webkit-macos"],
    reason:
      "Mac WebKit prints the en-IN day periods in capitals (AM, PM) where CLDR 48 en_IN, through en_001, has am and pm.",
    file: /\/formatZonedRange\.test\.ts$/,
    test: /in en-IN with \{ timeZoneName/,
  },
  {
    // Evidence, Mac WebKit 26.6 against Node 26.12.1 (CLDR 48.0): zh-TW relative times print "30分鐘前"
    // where Node prints "30 分鐘前" (zh_Hant.xml minute relativeTimePattern past `{0} 分鐘前`, with a space);
    // zh-TW and ja-JP durations print "1天、2小時和30分鐘" and "1日、2時間、30分" where Node prints "1 天、2 小時和30 分鐘"
    // and "1 日、2 時間、30 分"; he-IL prints "יום אחד" where Node prints "1 יום" (he.xml duration-day one
    // `{0} יום`); tr-TR prints a narrow no-break space "1 gün" (U+202F) where Node prints "1 gün".
    id: "webkit-macos-unit-spacing-and-words",
    legs: ["webkit-macos"],
    reason:
      "Mac WebKit spaces relative times and durations differently from CLDR 48 in zh-TW, ja-JP and tr-TR, and writes one day in Hebrew as יום אחד where CLDR 48 has 1 יום.",
    file: /\/(formatDuration|formatRelativeDate|formatRelativeDateTime|formatRelativeTime|formatRelativeUtc|formatRelativeUnix|formatRelativeZoned)\.test\.ts$/,
    test: /for zh-TW|for locale (zh-TW|ja-JP|he-IL|tr-TR)/,
  },
];

/** The pseudo test name a file that failed to load counts as. */
const FILE_DID_NOT_LOAD = "(file did not load)";

/**
 * The pseudo test name a file counts as when Vitest marks the file failed but no test in it failed:
 * a `beforeAll` or `afterAll` hook threw, or a test left an error behind.
 */
const FILE_FAILED = "(file failed)";

/** The pseudo file and test an error no test caught counts as. */
const VITEST_FILE = "(vitest)";
const UNHANDLED_ERROR = "(unhandled error)";

const HOOK_SKIPPED = "did not run natively (skipped by a failed hook)";

const FILE_FAILED_MESSAGE =
  "The file failed without a failed test: a hook threw or an error was left unhandled. See the Vitest report.";

/**
 * @typedef {{ file: string, test: string, message: string }} Failure
 * @typedef {{ file: string, test: string, defect: string }} TaggedFailure
 * @typedef {{ kind: "divergence", file: string, test: string, defect: string }
 *   | { kind: "host", group: string, reason: string }} StaleTag
 * @typedef {{
 *   counts: { files: number, tests: number, passed: number, skipped: number, tagged: number, untagged: number,
 *             hostTagged: number, hostUntagged: number, controlOnly: number, staleTags: number },
 *   tagged: TaggedFailure[], untagged: Failure[],
 *   hostTagged: { group: string, count: number, reason: string }[], hostUntagged: Failure[],
 *   controlOnly: Failure[], staleTags: StaleTag[],
 * }} Classification
 */

/**
 * A failure message up to its stack, so an issue shows the assertion and not the paths of the
 * machine that ran it. A frame is `    at ...` (V8) or `name@url:line:column` (Firefox, Safari);
 * a Firefox stack carries no message line, so its first frame can start the text.
 * @param {string} message
 */
function withoutStack(message) {
  return message.split(/\n\s+at |(?:^|\n)[^\s@]*@\S+:\d+:\d+/)[0].trim();
}

/**
 * A Vitest JSON report with the captured messages put back where a failed test's stack has none.
 * Firefox's `failureMessages[0]` is the stack alone; the reporter's `{ file, fullName, message }`
 * records (`native-suite-reporter.mjs`) carry the `Name: message` line. A record that already
 * starts with its message is left as it was.
 * @param {any} report
 * @param {ReadonlyArray<{ file: string, fullName: string, message: string }>} messages
 * @returns {any}
 */
export function withFailureMessages(report, messages) {
  const byTest = new Map(
    messages.map((m) => [`${m.file}\0${m.fullName}`, m.message]),
  );
  return {
    ...report,
    testResults: (report?.testResults ?? []).map(
      (/** @type {any} */ suite) => ({
        ...suite,
        assertionResults: (suite.assertionResults ?? []).map(
          (/** @type {any} */ r) => {
            const message = byTest.get(`${suite.name}\0${r.fullName}`);
            const first = String((r.failureMessages ?? [])[0] ?? "");
            if (
              r.status !== "failed" ||
              message === undefined ||
              first.startsWith(message)
            )
              return r;
            return {
              ...r,
              failureMessages: [
                `${message}\n${first}`,
                ...(r.failureMessages ?? []).slice(1),
              ],
            };
          },
        ),
      }),
    ),
  };
}

/** What a failed test shows when its report holds a stack and no message. */
const STACK_ONLY_MESSAGE = "(the report holds a stack and no message)";

/**
 * @typedef {{ file: string, test: string, n: number, passed: number, skipped: number,
 *             failed: boolean, message: string }} Entry
 */

/**
 * @typedef {(file: string, test: string, status: "passed" | "failed" | "skipped", message: string,
 *   key?: string, hookSkipped?: boolean) => void} AddTest
 */

/**
 * An `add` that merges the tests sharing a key into `out`.
 * @param {Map<string, Entry>} out
 * @returns {AddTest}
 */
function tallyInto(out) {
  return (file, test, status, message, key = "", hookSkipped = false) => {
    const id = `${file} > ${test}${key}`;
    const e = out.get(id) ?? {
      file,
      test,
      n: 0,
      passed: 0,
      skipped: 0,
      failed: false,
      message: "",
    };
    e.n += 1;
    if (status === "passed") e.passed += 1;
    else if (status === "skipped") e.skipped += 1;
    if ((status === "failed" || hookSkipped) && !e.failed) {
      e.failed = true;
      e.message = message;
    }
    out.set(id, e);
  };
}

/** @param {string} name  a suite's path, absolute or not */
function packageRelative(name) {
  const at = name.lastIndexOf("packages/gmt/");
  return at === -1 ? name : name.slice(at + "packages/gmt/".length);
}

/** @param {string} status  a Vitest assertion status */
function testStatus(status) {
  return status === "passed" || status === "failed" ? status : "skipped";
}

/**
 * The message of a failed test: Vitest's first failure message without its stack. A stack-only
 * entry (Firefox) leaves nothing, which reads as the stated placeholder; a passing test has none.
 * @param {any} r  the assertion result
 */
function failureText(r) {
  const text = withoutStack(String((r.failureMessages ?? [])[0] ?? ""));
  return text === "" && r.status === "failed" ? STACK_ONLY_MESSAGE : text;
}

/**
 * Adds one test of a suite. Vitest skips the tests a failed hook leaves unrun: a failure, not a
 * skip.
 * @param {AddTest} add
 * @param {string} file
 * @param {boolean} fileFailed
 * @param {string} message  the suite's message
 * @param {any} r  the assertion result
 */
function addAssertion(add, file, fileFailed, message, r) {
  const test = String(r.fullName ?? r.title ?? "");
  if (r.status === "skipped" && fileFailed) {
    const detail = message === "" ? "" : `: ${message}`;
    add(file, test, "skipped", `${HOOK_SKIPPED}${detail}`, "", true);
    return;
  }
  add(file, test, testStatus(r.status), failureText(r));
}

/**
 * A failed file gets its own row when it carries a message (a hook threw, even beside failing
 * tests; an ordinary test failure leaves the file's message empty), or when no test of it failed
 * or was left unrun, so nothing else says why the file failed.
 * @param {AddTest} add
 * @param {string} file
 * @param {string} message
 * @param {any[]} results
 */
function addFileRow(add, file, message, results) {
  const explained = results.some((r) =>
    ["failed", "skipped"].includes(r.status),
  );
  if (message === "" && explained) return;
  add(
    file,
    results.length === 0 ? FILE_DID_NOT_LOAD : FILE_FAILED,
    "failed",
    message === "" && results.length > 0 ? FILE_FAILED_MESSAGE : message,
  );
}

/**
 * Every test of a parsed Vitest JSON report, keyed `<file> > <fullName>`, with the tests that share
 * a key merged: the key failed when any test under it failed (keeping that test's message), and
 * counts the tests under it. The file is made package-relative (everything up to `packages/gmt/`
 * is dropped).
 *
 * A file Vitest marks failed with no failed test in it is one failed test, `(file did not load)`
 * when it has no test results at all and `(file failed)` otherwise, carrying the file's message.
 *
 * @param {any} report
 * @param {ReadonlyArray<{ message: string }>} [errors]  the run's unhandled errors, each one a
 *   failed `(unhandled error)` told apart by its message
 * @returns {Map<string, Entry>}
 */
function testsOf(report, errors = []) {
  /** @type {Map<string, Entry>} */
  const out = new Map();
  const add = tallyInto(out);
  for (const suite of report?.testResults ?? []) addSuite(add, suite);
  for (const e of errors) {
    const message = withoutStack(String(e.message ?? ""));
    add(VITEST_FILE, UNHANDLED_ERROR, "failed", message, `: ${message}`);
  }
  return out;
}

/**
 * @param {AddTest} add
 * @param {any} suite  one file of a Vitest JSON report
 */
function addSuite(add, suite) {
  const file = packageRelative(String(suite.name ?? ""));
  const results = suite.assertionResults ?? [];
  const fileFailed = suite.status === "failed";
  const message = withoutStack(String(suite.message ?? ""));
  for (const r of results) addAssertion(add, file, fileFailed, message, r);
  if (fileFailed) addFileRow(add, file, message, results);
}

/** @param {RegExp | undefined} pattern @param {string} text */
function matches(pattern, text) {
  if (!pattern) return true;
  pattern.lastIndex = 0;
  return pattern.test(text);
}

/**
 * The tags that matched nothing.
 * @param {ReadonlyArray<typeof KNOWN_NATIVE_FAILURES[number]>} rows
 * @param {Set<unknown>} usedRows
 * @param {ReadonlyArray<typeof KNOWN_HOST_FAILURES[number]>} groups
 * @param {Map<string, number>} hostCounts
 * @returns {StaleTag[]}
 */
function staleTagsOf(rows, usedRows, groups, hostCounts) {
  return [
    ...rows
      .filter((r) => !usedRows.has(r))
      .map((r) => ({
        kind: /** @type {const} */ ("divergence"),
        file: r.file,
        test: r.test,
        defect: r.defect,
      })),
    ...groups
      .filter((g) => !hostCounts.has(g.id))
      .map((g) => ({
        kind: /** @type {const} */ ("host"),
        group: g.id,
        reason: g.reason,
      })),
  ];
}

/**
 * Sorts every failing test of the native pass by the control pass (the polyfill, same runtime),
 * then lists the tests that failed on the control alone. Pure: parsed Vitest JSON reports in,
 * lists out. A test absent from the control counts as passing there, and one absent from the
 * native pass as passing natively, so a control failure is never lost. A divergence is never
 * matched against host groups, and a host failure never against divergence rows.
 *
 * @param {any} nativeResults  Vitest JSON report of the native pass
 * @param {any} controlResults  Vitest JSON report of the control (polyfill) pass
 * @param {Leg} leg
 * @param {ReadonlyArray<typeof KNOWN_NATIVE_FAILURES[number]>} divergenceRows
 * @param {ReadonlyArray<typeof KNOWN_HOST_FAILURES[number]>} hostGroups
 * @param {ReadonlyArray<{ message: string }>} [nativeErrors]  unhandled errors of the native pass
 * @param {ReadonlyArray<{ message: string }>} [controlErrors]  unhandled errors of the control pass
 * @returns {Classification}
 */
export function classify(
  nativeResults,
  controlResults,
  leg,
  divergenceRows,
  hostGroups,
  nativeErrors = [],
  controlErrors = [],
) {
  const native = testsOf(nativeResults, nativeErrors);
  const control = testsOf(controlResults, controlErrors);
  const rows = divergenceRows.filter((r) => r.legs.includes(leg));
  const groups = hostGroups.filter((g) => g.legs.includes(leg));

  /** @type {TaggedFailure[]} */
  const tagged = [];
  /** @type {Failure[]} */
  const untagged = [];
  /** @type {Failure[]} */
  const hostUntagged = [];
  /** @type {Map<string, number>} */
  const hostCounts = new Map();
  const usedRows = new Set();
  let hostTaggedTests = 0;
  let passed = 0;
  let skipped = 0;
  let tests = 0;

  /** @param {Entry} t  a test that failed natively and not on the control */
  const sortDivergence = ({ file, test, message }) => {
    const row = rows.find((r) => r.file === file && r.test === test);
    if (row) {
      usedRows.add(row);
      tagged.push({ file, test, defect: row.defect });
    } else {
      untagged.push({ file, test, message });
    }
  };
  /** @param {Entry} t  a test that failed natively and on the control */
  const sortHostFailure = ({ file, test, message }) => {
    const hit = groups.filter(
      (g) => matches(g.file, file) && matches(g.test, test),
    );
    if (hit.length === 0) {
      hostUntagged.push({ file, test, message });
      return;
    }
    hostTaggedTests += 1;
    for (const g of hit) hostCounts.set(g.id, (hostCounts.get(g.id) ?? 0) + 1);
  };

  for (const [id, t] of native) {
    tests += t.n;
    passed += t.passed;
    skipped += t.skipped;
    if (!t.failed) continue;
    if (control.get(id)?.failed === true) sortHostFailure(t);
    else sortDivergence(t);
  }
  /** @type {Failure[]} */
  const controlOnly = [...control]
    .filter(([id, t]) => t.failed && native.get(id)?.failed !== true)
    .map(([, { file, test, message }]) => ({ file, test, message }));

  const staleTags = staleTagsOf(rows, usedRows, groups, hostCounts);
  const hostTagged = groups
    .filter((g) => hostCounts.has(g.id))
    .map((g) => ({
      group: g.id,
      count: hostCounts.get(g.id) ?? 0,
      reason: g.reason,
    }));

  return {
    counts: {
      files: new Set([...native.values()].map((t) => t.file)).size,
      tests,
      passed,
      skipped,
      tagged: tagged.length,
      untagged: untagged.length,
      hostTagged: hostTaggedTests,
      hostUntagged: hostUntagged.length,
      controlOnly: controlOnly.length,
      staleTags: staleTags.length,
    },
    tagged,
    untagged,
    hostTagged,
    hostUntagged,
    controlOnly,
    staleTags,
  };
}
