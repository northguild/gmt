import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones, MustTestLocales } from "../../test";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { isZonedWeekend } from "./isZonedWeekend";

// Shared instant for local-day-boundary coverage: 2024-02-03T23:00:00Z is
// Saturday in UTC, but zones at a positive offset (Europe/Berlin eastward
// through Pacific/Chatham and Pacific/Apia) have already rolled to Sunday
// local time, while zones at a non-positive offset (Europe/Lisbon westward
// through Pacific/Niue) are still Saturday. This single instant, spread
// across every battle-test timeZone (UTC, half-hour/quarter-hour offsets,
// and the -11/+13/+13:45 extremes), exercises the "local day governs, not
// UTC day" boundary far beyond a single zone.
const saturdayRollsToSundayInstant = "2024-02-03T23:00:00Z";

// Same idea one instant earlier: 2024-02-01T23:00:00Z is Thursday in UTC,
// with the same zone split rolling to Friday. Friday is a weekday in
// Sat/Sun-weekend locales but a weekend day in Fri/Sat-weekend locales,
// so this instant is what actually distinguishes the two locale families
// at the boundary (Saturday is a weekend day in both).
const thursdayRollsToFridayInstant = "2024-02-01T23:00:00Z";

const zonesRolledForward = new Set([
  "Asia/Anadyr",
  "Europe/Berlin",
  "Europe/Helsinki",
  "Europe/Istanbul",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Shanghai",
  "Australia/Lord_Howe",
  "Pacific/Chatham",
  "Pacific/Apia",
]);

describe("isZonedWeekend", () => {
  // Full week boundary coverage for a Saturday/Sunday-weekend locale.
  it.each`
    value                                            | expected
    ${"2024-02-02T10:00:00-05:00[America/New_York]"} | ${false}
    ${"2024-02-03T10:00:00-05:00[America/New_York]"} | ${true}
    ${"2024-02-04T10:00:00-05:00[America/New_York]"} | ${true}
    ${"2024-02-05T10:00:00-05:00[America/New_York]"} | ${false}
    ${"2024-02-06T10:00:00-05:00[America/New_York]"} | ${false}
    ${"2024-02-07T10:00:00-05:00[America/New_York]"} | ${false}
    ${"2024-02-08T10:00:00-05:00[America/New_York]"} | ${false}
  `(
    "returns $expected for $value in en-US (Sat/Sun weekend)",
    ({ value, expected }) => {
      expect(isZonedWeekend(value, MustTestLocales.enUS)).toBe(expected);
    },
  );

  // Full week boundary coverage for a Friday/Saturday-weekend locale.
  it.each`
    value                                          | expected
    ${"2024-02-02T10:00:00+02:00[Asia/Jerusalem]"} | ${true}
    ${"2024-02-03T10:00:00+02:00[Asia/Jerusalem]"} | ${true}
    ${"2024-02-04T10:00:00+02:00[Asia/Jerusalem]"} | ${false}
    ${"2024-02-05T10:00:00+02:00[Asia/Jerusalem]"} | ${false}
    ${"2024-02-06T10:00:00+02:00[Asia/Jerusalem]"} | ${false}
    ${"2024-02-07T10:00:00+02:00[Asia/Jerusalem]"} | ${false}
    ${"2024-02-08T10:00:00+02:00[Asia/Jerusalem]"} | ${false}
  `(
    "returns $expected for $value in he-IL (Fri/Sat weekend)",
    ({ value, expected }) => {
      expect(isZonedWeekend(value, MustTestLocales.heIL)).toBe(expected);
    },
  );

  // Local day must govern, not UTC day: at a single fixed instant, zones
  // with a positive UTC offset have already rolled to the next calendar
  // day while non-positive-offset zones haven't. Run across every
  // battle-test timeZone (UTC, half-hour/quarter-hour offsets, and the
  // -11/+13/+13:45 extremes) for a Sat/Sun-weekend locale, where Saturday
  // and Sunday are both weekend days so this isolates the day-boundary
  // behavior from locale weekend-day differences.
  it.each(
    battleTestTimeZones.map((timeZone) => ({
      timeZone,
      expected: true, // every zone lands on Sat or Sun at this instant
    })),
  )(
    "returns true for $timeZone at the Sat/Sun UTC-day-rollover instant (en-US)",
    ({ timeZone, expected }) => {
      const value = Temporal.Instant.from(saturdayRollsToSundayInstant)
        .toZonedDateTimeISO(timeZone)
        .toString();
      expect(isZonedWeekend(value, MustTestLocales.enUS)).toBe(expected);
    },
  );

  // Same day-boundary instant one day earlier: zones split between
  // Thursday (weekday everywhere) and Friday (weekend only for
  // Fri/Sat-weekend locales), so this is what actually exercises the
  // boundary differently per locale family, across every offset shape.
  it.each(
    battleTestTimeZones.flatMap((timeZone) => [
      {
        timeZone,
        locale: MustTestLocales.enUS,
        expected: false, // Thu and Fri are both weekdays for Sat/Sun locales
      },
      {
        timeZone,
        locale: MustTestLocales.heIL,
        expected: zonesRolledForward.has(timeZone), // Fri is weekend for Fri/Sat locales
      },
    ]),
  )(
    "returns $expected for $timeZone at the Thu/Fri UTC-day-rollover instant ($locale)",
    ({ timeZone, locale, expected }) => {
      const value = Temporal.Instant.from(thursdayRollsToFridayInstant)
        .toZonedDateTimeISO(timeZone)
        .toString();
      expect(isZonedWeekend(value, locale)).toBe(expected);
    },
  );

  // One representative Saturday check per must-test locale, fixed at UTC.
  it.each`
    locale                  | expected
    ${MustTestLocales.enUS} | ${true}
    ${MustTestLocales.enGB} | ${true}
    ${MustTestLocales.deDE} | ${true}
    ${MustTestLocales.frFR} | ${true}
    ${MustTestLocales.esES} | ${true}
    ${MustTestLocales.itIT} | ${true}
    ${MustTestLocales.ptPT} | ${true}
    ${MustTestLocales.svSE} | ${true}
    ${MustTestLocales.isIS} | ${true}
    ${MustTestLocales.zhCN} | ${true}
    ${MustTestLocales.zhTW} | ${true}
    ${MustTestLocales.jaJP} | ${true}
    ${MustTestLocales.koKR} | ${true}
    ${MustTestLocales.arSA} | ${true}
    ${MustTestLocales.heIL} | ${true}
    ${MustTestLocales.ruRU} | ${true}
    ${MustTestLocales.trTR} | ${true}
  `(
    "returns $expected for Saturday 2024-02-03T12:00:00+00:00[UTC] in $locale",
    ({ locale, expected }) => {
      expect(isZonedWeekend("2024-02-03T12:00:00+00:00[UTC]", locale)).toBe(
        expected,
      );
    },
  );

  // Sunday: distinguishes Fri/Sat-weekend locales (ar-SA, he-IL) from the rest.
  it.each`
    locale                  | expected
    ${MustTestLocales.enUS} | ${true}
    ${MustTestLocales.arSA} | ${false}
    ${MustTestLocales.heIL} | ${false}
  `(
    "returns $expected for Sunday 2024-02-04T12:00:00+00:00[UTC] in $locale",
    ({ locale, expected }) => {
      expect(isZonedWeekend("2024-02-04T12:00:00+00:00[UTC]", locale)).toBe(
        expected,
      );
    },
  );

  it.each`
    value
    ${"invalid-zoned"}
    ${"2024-02-03T12:00:00"}
    ${"2024-06-30T23:59:60+00:00[UTC]"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `("returns false for invalid value $value", ({ value }) => {
    expect(isZonedWeekend(value, MustTestLocales.enUS)).toBe(false);
  });

  it.each`
    locale
    ${"not-a-locale-!!"}
    ${""}
    ${null}
    ${undefined}
  `("returns false for invalid locale $locale", ({ locale }) => {
    expect(isZonedWeekend("2024-02-03T12:00:00+00:00[UTC]", locale)).toBe(
      false,
    );
  });

  it("returns false when Temporal.ZonedDateTime.from throws", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      isZonedWeekend("2024-02-03T12:00:00+00:00[UTC]", MustTestLocales.enUS),
    ).toBe(false);
  });
});
