import { MustTestDstTimeZones, battleTestTimeZones } from "../../test";
import { mockTemporalNowZonedDateTimeISOThrow } from "../../test/mocks";
import { hasDaylightSaving } from ".";

// Expected values per battle-test timeZone at 2019-06-15T12:00:00Z, read off each zone's
// offset changes in a plain @js-temporal/polyfill script: true when the zone is in a daylight
// period then, or one begins within 365 days. Pacific/Apia's daylight period of 2019-09-29 to
// 2020-04-05 makes it true; its last one ended 2021-04-04.
const hasDaylightSavingByZone = {
  UTC: false,
  GMT: false,
  "Etc/GMT": false,
  "America/Nome": true,
  "Asia/Anadyr": false,
  "Europe/Lisbon": true,
  "Europe/Dublin": true,
  "Europe/Berlin": true,
  "Europe/Helsinki": true,
  "Europe/Istanbul": false,
  "Asia/Kolkata": false,
  "Asia/Kathmandu": false,
  "Asia/Shanghai": false,
  "Australia/Lord_Howe": true,
  "Pacific/Chatham": true,
  "Pacific/Apia": true,
  "Pacific/Niue": false,
  "America/New_York": true,
  "America/Chicago": true,
  "America/Phoenix": false,
} satisfies Record<keyof typeof MustTestDstTimeZones, boolean>;

const BATTLE_AT = "2019-06-15T12:00:00Z";

describe("hasDaylightSaving", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each`
    timeZone              | expected
    ${"America/Chicago"}  | ${true}
    ${"America/New_York"} | ${true}
    ${"Europe/Berlin"}    | ${true}
    ${"Australia/Sydney"} | ${true}
    ${"Asia/Tokyo"}       | ${false}
    ${"UTC"}              | ${false}
    ${"+05:00"}           | ${false}
    ${"Asia/Calcutta"}    | ${false}
  `(
    "returns $expected for $timeZone at 2019-06-15T12:00:00Z",
    ({ timeZone, expected }) => {
      expect(hasDaylightSaving(timeZone, { at: BATTLE_AT })).toBe(expected);
    },
  );

  it.each`
    timeZone
    ${"Not/AZone"}
    ${""}
    ${null}
    ${undefined}
    ${123}
    ${true}
  `("returns false for invalid timeZone $timeZone", ({ timeZone }) => {
    expect(hasDaylightSaving(timeZone as never)).toBe(false);
    expect(hasDaylightSaving(timeZone as never, { at: BATTLE_AT })).toBe(false);
  });

  it.each(
    battleTestTimeZones.map((timeZone) => ({
      timeZone,
      expected: hasDaylightSavingByZone[timeZone],
    })),
  )(
    "returns $expected for battle-test timeZone $timeZone at 2019-06-15T12:00:00Z",
    ({ timeZone, expected }) => {
      expect(hasDaylightSaving(timeZone, { at: BATTLE_AT })).toBe(expected);
    },
  );

  // Each zone's own offset changes, from a plain @js-temporal/polyfill script.
  // Europe/Istanbul: daylight 2015-03-29 to 2015-11-08; the advance of 2016-03-27 was never undone.
  // America/Sao_Paulo: last daylight period 2018-11-04 to 2019-02-17.
  // Europe/Moscow: daylight 2010-03-28 to 2010-10-31; the advance of 2011-03-27 held until 2014-10-26.
  // Asia/Tehran: last daylight period 2022-03-22 to 2022-09-21 (tz 2022b or later, which records
  //   that Iran stopped; older data continues the rule).
  // Asia/Pyongyang: +09:00 to +08:30 on 2015-08-15, back to +09:00 on 2018-05-05.
  // America/Caracas: -04:00 to -04:30 on 2007-12-09, back to -04:00 on 2016-05-01.
  // Africa/Casablanca: 2013 daylight periods 04-28 to 07-07 and 08-10 to 10-27; at +01:00 from
  //   2019-06-09 until put back 2020-04-19.
  // Australia/Sydney: daylight 2019-10-06 to 2020-04-05.
  // Asia/Tokyo: last daylight period 1951-05-05T15:00:00Z to 1951-09-08T15:00:00Z.
  it.each`
    at                                  | timeZone               | expected | why
    ${"2015-06-15T12:00:00Z"}           | ${"Europe/Istanbul"}   | ${true}  | ${"in daylight time, undone 2015-11-08"}
    ${"2016-01-15T12:00:00Z"}           | ${"Europe/Istanbul"}   | ${false} | ${"the advance ahead is never undone"}
    ${"2016-06-15T12:00:00Z"}           | ${"Europe/Istanbul"}   | ${false} | ${"no change ahead"}
    ${"2018-06-15T12:00:00Z"}           | ${"America/Sao_Paulo"} | ${true}  | ${"daylight period begins 2018-11-04"}
    ${"2019-06-15T12:00:00Z"}           | ${"America/Sao_Paulo"} | ${false} | ${"no change ahead"}
    ${"2010-01-15T12:00:00Z"}           | ${"Europe/Moscow"}     | ${true}  | ${"daylight period begins 2010-03-28"}
    ${"2011-01-15T12:00:00Z"}           | ${"Europe/Moscow"}     | ${false} | ${"the advance ahead is held 3.6 years"}
    ${"2014-06-15T12:00:00Z"}           | ${"Europe/Moscow"}     | ${false} | ${"the change ahead undoes nothing"}
    ${"2022-01-15T12:00:00Z"}           | ${"Asia/Tehran"}       | ${true}  | ${"daylight period begins 2022-03-22"}
    ${"2023-01-15T12:00:00Z"}           | ${"Asia/Tehran"}       | ${false} | ${"no change ahead"}
    ${"2015-06-15T12:00:00Z"}           | ${"Asia/Pyongyang"}    | ${false} | ${"the change ahead puts clocks back for years"}
    ${"2018-01-15T12:00:00Z"}           | ${"Asia/Pyongyang"}    | ${false} | ${"the advance ahead is never undone"}
    ${"2016-01-15T12:00:00Z"}           | ${"America/Caracas"}   | ${false} | ${"the advance ahead is never undone"}
    ${"2013-01-15T12:00:00Z"}           | ${"Africa/Casablanca"} | ${true}  | ${"daylight period begins 2013-04-28"}
    ${"2013-07-20T12:00:00Z"}           | ${"Africa/Casablanca"} | ${true}  | ${"daylight period begins 2013-08-10"}
    ${"2019-12-01T12:00:00Z"}           | ${"Africa/Casablanca"} | ${true}  | ${"in daylight time, undone 2020-04-19"}
    ${"2019-06-15T12:00:00Z"}           | ${"Australia/Sydney"}  | ${true}  | ${"daylight period begins 2019-10-06"}
    ${"2020-01-15T12:00:00Z"}           | ${"Australia/Sydney"}  | ${true}  | ${"in daylight time, undone 2020-04-05"}
    ${"1950-10-01T12:00:00Z"}           | ${"Asia/Tokyo"}        | ${true}  | ${"daylight period begins 1951-05-05, 216 days on"}
    ${"1951-09-08T14:59:59.999999999Z"} | ${"Asia/Tokyo"}        | ${true}  | ${"last nanosecond of the last daylight period"}
    ${"1951-09-08T15:00:00Z"}           | ${"Asia/Tokyo"}        | ${false} | ${"the last set-back; no change ahead"}
    ${"2019-06-15T12:00:00Z"}           | ${"-03:30"}            | ${false} | ${"a fixed offset"}
  `(
    "returns $expected for $timeZone at $at ($why)",
    ({ at, timeZone, expected }) => {
      expect(hasDaylightSaving(timeZone, { at })).toBe(expected);
    },
  );

  // Asia/Tokyo's first daylight period began 1948-05-01T15:00:00Z, and it had none before.
  // 1948 is a leap year, so 1947-05-02T15:00:00Z is exactly 365 days earlier. A period that
  // begins exactly 365 days after `at` is outside the window; one nanosecond less is inside.
  it.each`
    at                                  | expected | why
    ${"1947-05-02T15:00:00Z"}           | ${false} | ${"the period begins exactly 365 days on"}
    ${"1947-05-02T15:00:00.000000001Z"} | ${true}  | ${"the period begins a nanosecond under 365 days on"}
    ${"1946-06-15T12:00:00Z"}           | ${false} | ${"the period begins 686 days on"}
  `(
    "returns $expected for Asia/Tokyo at $at, by the 365-day window ($why)",
    ({ at, expected }) => {
      expect(hasDaylightSaving("Asia/Tokyo", { at })).toBe(expected);
    },
  );

  // Daylight periods shorter than 14 days, read from several distances so the answer cannot
  // depend on where a search step falls. Histories from Node 26's native Temporal and zdump:
  // America/Boa_Vista -04→-03 2000-10-08T04:00Z, back 2000-10-15T03:00Z, and none since;
  // America/Noronha 2000-10-08T02:00Z to 2000-10-15T01:00Z; America/Recife 2000-10-08T03:00Z to
  // 2000-10-15T02:00Z; America/Fortaleza and America/Maceio 2000-10-08T03:00Z to
  // 2000-10-22T02:00Z; Europe/Tirane 1943-03-29T01:00Z to 1943-04-10T01:00Z, its last;
  // Europe/Vienna 1945-04-02T01:00Z to 1945-04-12T01:00Z; Africa/Tunis 1943-03-29T01:00Z to
  // 1943-04-17T00:00Z; America/Argentina/Tucuman put clocks back 2004-06-01 and forward
  // 2004-06-13, with no daylight time after.
  it.each`
    at                                  | timeZone                       | expected
    ${"2000-07-01T00:00:00Z"}           | ${"America/Boa_Vista"}         | ${true}
    ${"2000-07-02T00:00:00Z"}           | ${"America/Boa_Vista"}         | ${true}
    ${"2000-10-01T12:00:00Z"}           | ${"America/Boa_Vista"}         | ${true}
    ${"2000-10-07T00:00:00Z"}           | ${"America/Boa_Vista"}         | ${true}
    ${"2000-10-08T03:59:59Z"}           | ${"America/Boa_Vista"}         | ${true}
    ${"2000-10-10T00:00:00Z"}           | ${"America/Boa_Vista"}         | ${true}
    ${"2000-10-15T02:59:59.999999999Z"} | ${"America/Boa_Vista"}         | ${true}
    ${"2000-10-15T03:00:00Z"}           | ${"America/Boa_Vista"}         | ${false}
    ${"2001-01-01T00:00:00Z"}           | ${"America/Boa_Vista"}         | ${false}
    ${"2000-07-01T00:00:00Z"}           | ${"America/Noronha"}           | ${true}
    ${"2000-10-01T12:00:00Z"}           | ${"America/Noronha"}           | ${true}
    ${"2000-07-01T00:00:00Z"}           | ${"America/Recife"}            | ${true}
    ${"2000-10-01T12:00:00Z"}           | ${"America/Recife"}            | ${true}
    ${"2000-07-01T00:00:00Z"}           | ${"America/Fortaleza"}         | ${true}
    ${"2000-10-01T12:00:00Z"}           | ${"America/Fortaleza"}         | ${true}
    ${"2000-07-01T00:00:00Z"}           | ${"America/Maceio"}            | ${true}
    ${"2000-10-01T12:00:00Z"}           | ${"America/Maceio"}            | ${true}
    ${"1943-01-15T00:00:00Z"}           | ${"Europe/Tirane"}             | ${true}
    ${"1943-03-25T00:00:00Z"}           | ${"Europe/Tirane"}             | ${true}
    ${"1943-04-10T01:00:00Z"}           | ${"Europe/Tirane"}             | ${false}
    ${"1945-01-15T00:00:00Z"}           | ${"Europe/Vienna"}             | ${true}
    ${"1945-03-25T00:00:00Z"}           | ${"Europe/Vienna"}             | ${true}
    ${"1943-01-15T00:00:00Z"}           | ${"Africa/Tunis"}              | ${true}
    ${"1943-04-20T00:00:00Z"}           | ${"Africa/Tunis"}              | ${true}
    ${"2004-01-15T00:00:00Z"}           | ${"America/Argentina/Tucuman"} | ${false}
    ${"2004-06-05T00:00:00Z"}           | ${"America/Argentina/Tucuman"} | ${false}
  `(
    "returns $expected for $timeZone at $at, beside a period shorter than 14 days",
    ({ at, timeZone, expected }) => {
      expect(hasDaylightSaving(timeZone, { at })).toBe(expected);
    },
    10_000,
  );

  // Three offsets inside 14 days, where the polyfill's own search never returns.
  // Europe/Riga: daylight 1944-04-03T01:00Z to 1944-10-02T01:00Z, then +01→+03 1944-10-12T23:00Z.
  // Europe/Simferopol: daylight 1943-03-29T01:00Z to 1943-10-04T01:00Z; the advances of
  // 1944-04-03 and 1944-04-12 were never undone.
  it.each`
    at                        | timeZone               | expected | why
    ${"1943-10-15T12:00:00Z"} | ${"Europe/Riga"}       | ${true}  | ${"daylight period begins 1944-04-03"}
    ${"1944-06-15T12:00:00Z"} | ${"Europe/Riga"}       | ${true}  | ${"in daylight time"}
    ${"1944-10-05T12:00:00Z"} | ${"Europe/Riga"}       | ${false} | ${"the advance ahead is never undone"}
    ${"1943-01-15T12:00:00Z"} | ${"Europe/Simferopol"} | ${true}  | ${"daylight period begins 1943-03-29"}
    ${"1943-10-15T12:00:00Z"} | ${"Europe/Simferopol"} | ${false} | ${"the advances ahead are never undone"}
    ${"1944-04-05T12:00:00Z"} | ${"Europe/Simferopol"} | ${false} | ${"the advances are never undone"}
  `(
    "returns $expected for $timeZone at $at, beside three offsets in 14 days ($why)",
    ({ at, timeZone, expected }) => {
      expect(hasDaylightSaving(timeZone, { at })).toBe(expected);
    },
    10_000,
  );

  it.each`
    at                                               | why
    ${"2015-06-15T12:00:00Z"}                        | ${"UTC"}
    ${"2015-06-15T15:00:00+03:00"}                   | ${"an offset"}
    ${"2015-06-15T15:00:00+03:00[Europe/Istanbul]"}  | ${"a zoned string"}
    ${"2015-06-15T08:00:00-04:00[America/New_York]"} | ${"a zoned string in another zone"}
  `("reads at $at as its instant ($why)", ({ at }) => {
    expect(hasDaylightSaving("Europe/Istanbul", { at })).toBe(true);
  });

  it.each`
    at
    ${"2015-06-15"}
    ${"2015-06-15T12:00:00"}
    ${"2016-12-31T23:59:60Z"}
    ${"invalid"}
    ${""}
    ${null}
    ${123}
    ${true}
  `("returns false for invalid at $at", ({ at }) => {
    vi.useFakeTimers();
    vi.setSystemTime("2015-06-15T12:00:00.000Z");
    expect(hasDaylightSaving("Europe/Istanbul")).toBe(true);
    expect(hasDaylightSaving("Europe/Istanbul", { at: at as never })).toBe(
      false,
    );
  });

  it.each`
    options
    ${null}
    ${"2015-06-15T12:00:00Z"}
    ${5}
    ${true}
  `("returns false for non-object options $options", ({ options }) => {
    vi.useFakeTimers();
    vi.setSystemTime("2015-06-15T12:00:00.000Z");
    expect(hasDaylightSaving("Europe/Istanbul", options as never)).toBe(false);
  });

  it.each`
    now                           | expected
    ${"2015-06-15T12:00:00.000Z"} | ${true}
    ${"2016-06-15T12:00:00.000Z"} | ${false}
  `(
    "reads the current instant when at is omitted: Europe/Istanbul is $expected when now is $now",
    ({ now, expected }) => {
      vi.useFakeTimers();
      vi.setSystemTime(now);
      expect(hasDaylightSaving("Europe/Istanbul")).toBe(expected);
      expect(hasDaylightSaving("Europe/Istanbul", undefined)).toBe(expected);
      expect(hasDaylightSaving("Europe/Istanbul", {})).toBe(expected);
      expect(hasDaylightSaving("Europe/Istanbul", { at: undefined })).toBe(
        expected,
      );
    },
  );

  it.each`
    now                           | at                        | expected
    ${"2015-06-15T12:00:00.000Z"} | ${"2016-06-15T12:00:00Z"} | ${false}
    ${"2016-06-15T12:00:00.000Z"} | ${"2015-06-15T12:00:00Z"} | ${true}
    ${"2030-01-01T00:00:00.000Z"} | ${"2015-06-15T12:00:00Z"} | ${true}
  `(
    "returns $expected for Europe/Istanbul at $at whatever the clock says (now $now)",
    ({ now, at, expected }) => {
      vi.useFakeTimers();
      vi.setSystemTime(now);
      expect(hasDaylightSaving("Europe/Istanbul", { at })).toBe(expected);
    },
  );

  it("returns false when the clock read fails", () => {
    mockTemporalNowZonedDateTimeISOThrow();
    expect(hasDaylightSaving("America/New_York")).toBe(false);
  });

  it("does not read the clock when at is given", () => {
    mockTemporalNowZonedDateTimeISOThrow();
    expect(
      hasDaylightSaving("America/New_York", { at: "2019-06-15T12:00:00Z" }),
    ).toBe(true);
  });
});
