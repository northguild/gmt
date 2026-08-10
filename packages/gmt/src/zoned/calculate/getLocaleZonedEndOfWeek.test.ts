import { Temporal } from "@js-temporal/polyfill";
import {
  battleTestTimeZones,
  localeZonedDateTimeInputByLocale,
  MustTestLocales,
} from "../../test";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { getLocaleZonedEndOfWeek } from "./getLocaleZonedEndOfWeek";

// Shared instant for local-week-boundary coverage: 2024-02-03T23:00:00Z is
// Saturday in UTC, but zones at a positive offset (Europe/Berlin eastward
// through Pacific/Chatham and Pacific/Apia) have already rolled to Sunday
// local time, while zones at a non-positive offset (Europe/Lisbon westward
// through Pacific/Niue) are still Saturday. For a Sunday-first locale, that
// puts the two groups' week-END a full week apart.
const saturdayRollsToSundayInstant = "2024-02-03T23:00:00Z";

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

describe("getLocaleZonedEndOfWeek", () => {
  // Full week coverage for a Sunday-first locale (en-US, firstDay 7), fixed at UTC.
  it.each`
    value                               | expected
    ${"2024-02-25T12:00:00+00:00[UTC]"} | ${"2024-03-02T23:59:59+00:00[UTC]"}
    ${"2024-02-26T12:00:00+00:00[UTC]"} | ${"2024-03-02T23:59:59+00:00[UTC]"}
    ${"2024-02-27T12:00:00+00:00[UTC]"} | ${"2024-03-02T23:59:59+00:00[UTC]"}
    ${"2024-02-28T12:00:00+00:00[UTC]"} | ${"2024-03-02T23:59:59+00:00[UTC]"}
    ${"2024-02-29T12:00:00+00:00[UTC]"} | ${"2024-03-02T23:59:59+00:00[UTC]"}
    ${"2024-03-01T12:00:00+00:00[UTC]"} | ${"2024-03-02T23:59:59+00:00[UTC]"}
    ${"2024-03-02T12:00:00+00:00[UTC]"} | ${"2024-03-02T23:59:59+00:00[UTC]"}
    ${"2024-03-03T12:00:00+00:00[UTC]"} | ${"2024-03-09T23:59:59+00:00[UTC]"}
  `(
    "returns $expected for $value in en-US (Sunday-first)",
    ({ value, expected }) => {
      expect(getLocaleZonedEndOfWeek(value, MustTestLocales.enUS)).toBe(
        expected,
      );
    },
  );

  // Full week coverage for a Monday-first locale (fr-FR, firstDay 1), fixed at UTC.
  it.each`
    value                               | expected
    ${"2024-02-25T12:00:00+00:00[UTC]"} | ${"2024-02-25T23:59:59+00:00[UTC]"}
    ${"2024-02-26T12:00:00+00:00[UTC]"} | ${"2024-03-03T23:59:59+00:00[UTC]"}
    ${"2024-02-27T12:00:00+00:00[UTC]"} | ${"2024-03-03T23:59:59+00:00[UTC]"}
    ${"2024-02-28T12:00:00+00:00[UTC]"} | ${"2024-03-03T23:59:59+00:00[UTC]"}
    ${"2024-02-29T12:00:00+00:00[UTC]"} | ${"2024-03-03T23:59:59+00:00[UTC]"}
    ${"2024-03-01T12:00:00+00:00[UTC]"} | ${"2024-03-03T23:59:59+00:00[UTC]"}
    ${"2024-03-02T12:00:00+00:00[UTC]"} | ${"2024-03-03T23:59:59+00:00[UTC]"}
    ${"2024-03-03T12:00:00+00:00[UTC]"} | ${"2024-03-03T23:59:59+00:00[UTC]"}
  `(
    "returns $expected for $value in fr-FR (Monday-first)",
    ({ value, expected }) => {
      expect(getLocaleZonedEndOfWeek(value, MustTestLocales.frFR)).toBe(
        expected,
      );
    },
  );

  // Local week must govern, not UTC week: at a single fixed instant, zones
  // with a positive UTC offset have already rolled to Sunday local time
  // while non-positive-offset zones are still Saturday. For a Sunday-first
  // locale, that puts the two groups' week-end a full week apart. Run
  // across every battle-test timeZone (UTC, half-hour/quarter-hour offsets,
  // and the -11/+13/+13:45 extremes, including Pacific/Apia and Pacific/Niue).
  it.each(
    battleTestTimeZones.map((timeZone) => ({
      timeZone,
      expected: zonesRolledForward.has(timeZone)
        ? "2024-02-10T23:59:59" // rolled forward: end of the NEW week (Saturday)
        : "2024-02-03T23:59:59", // still Saturday: end of the CURRENT week
    })),
  )(
    "returns end-of-week with date $expected for $timeZone at the Sat/Sun rollover instant (en-US)",
    ({ timeZone, expected }) => {
      const value = Temporal.Instant.from(saturdayRollsToSundayInstant)
        .toZonedDateTimeISO(timeZone)
        .toString();
      const result = getLocaleZonedEndOfWeek(value, MustTestLocales.enUS);
      expect(result.startsWith(expected)).toBe(true);
    },
  );

  // One representative Saturday check per must-test locale, using the shared
  // locale-zoned fixture (2024-02-03, a Saturday, per timeZone/offset).
  // is-IS is intentionally excluded from this static table: its weekInfo.firstDay
  // is CLDR-version-dependent (Monday on ICU 77 / Node 20, Sunday on ICU 78 /
  // Node 24), unlike every other locale here, which is stable across the
  // Node 20/22/24 range this package supports. Asserted dynamically below instead.
  it.each`
    locale                  | expected
    ${MustTestLocales.enUS} | ${"2024-02-03T23:59:59-05:00[America/New_York]"}
    ${MustTestLocales.enGB} | ${"2024-02-04T23:59:59+00:00[Europe/London]"}
    ${MustTestLocales.deDE} | ${"2024-02-04T23:59:59+01:00[Europe/Berlin]"}
    ${MustTestLocales.frFR} | ${"2024-02-04T23:59:59+01:00[Europe/Paris]"}
    ${MustTestLocales.esES} | ${"2024-02-04T23:59:59+01:00[Europe/Madrid]"}
    ${MustTestLocales.itIT} | ${"2024-02-04T23:59:59+01:00[Europe/Rome]"}
    ${MustTestLocales.ptPT} | ${"2024-02-03T23:59:59+00:00[Europe/Lisbon]"}
    ${MustTestLocales.svSE} | ${"2024-02-04T23:59:59+01:00[Europe/Stockholm]"}
    ${MustTestLocales.zhCN} | ${"2024-02-04T23:59:59+08:00[Asia/Shanghai]"}
    ${MustTestLocales.zhTW} | ${"2024-02-03T23:59:59+08:00[Asia/Taipei]"}
    ${MustTestLocales.jaJP} | ${"2024-02-03T23:59:59+09:00[Asia/Tokyo]"}
    ${MustTestLocales.koKR} | ${"2024-02-03T23:59:59+09:00[Asia/Seoul]"}
    ${MustTestLocales.arSA} | ${"2024-02-03T23:59:59+03:00[Asia/Riyadh]"}
    ${MustTestLocales.heIL} | ${"2024-02-03T23:59:59+02:00[Asia/Jerusalem]"}
    ${MustTestLocales.ruRU} | ${"2024-02-04T23:59:59+03:00[Europe/Moscow]"}
    ${MustTestLocales.trTR} | ${"2024-02-04T23:59:59+03:00[Europe/Istanbul]"}
  `(
    "returns $expected for the shared locale fixture in $locale",
    ({ locale, expected }) => {
      expect(
        getLocaleZonedEndOfWeek(
          localeZonedDateTimeInputByLocale[
            locale as keyof typeof localeZonedDateTimeInputByLocale
          ],
          locale,
        ),
      ).toBe(expected);
    },
  );

  it("returns the correct end-of-week for is-IS regardless of its CLDR-version-dependent firstDay", () => {
    const firstDay = new Intl.Locale(MustTestLocales.isIS).weekInfo.firstDay;
    const expected =
      firstDay === 1
        ? "2024-02-04T23:59:59+00:00[Atlantic/Reykjavik]"
        : "2024-02-03T23:59:59+00:00[Atlantic/Reykjavik]";
    expect(
      getLocaleZonedEndOfWeek(
        localeZonedDateTimeInputByLocale[MustTestLocales.isIS],
        MustTestLocales.isIS,
      ),
    ).toBe(expected);
  });

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
  `('returns "" for invalid value $value', ({ value }) => {
    expect(getLocaleZonedEndOfWeek(value, MustTestLocales.enUS)).toBe("");
  });

  it.each`
    locale
    ${"not-a-locale-!!"}
    ${""}
    ${null}
    ${undefined}
  `('returns "" for invalid locale $locale', ({ locale }) => {
    expect(
      getLocaleZonedEndOfWeek("2024-02-03T12:00:00+00:00[UTC]", locale),
    ).toBe("");
  });

  it('returns "" when Temporal.ZonedDateTime.from throws', () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      getLocaleZonedEndOfWeek(
        "2024-02-03T12:00:00+00:00[UTC]",
        MustTestLocales.enUS,
      ),
    ).toBe("");
  });

  // disambiguation: week-end time-of-day reset lands on a fall-back overlap
  // (America/Sao_Paulo repeated 23:59:59 on Saturday 2014-02-15).
  it.each`
    disambiguation  | offset       | expected
    ${"compatible"} | ${undefined} | ${"2014-02-15T23:59:59-02:00[America/Sao_Paulo]"}
    ${"later"}      | ${undefined} | ${"2014-02-15T23:59:59-03:00[America/Sao_Paulo]"}
    ${"reject"}     | ${undefined} | ${""}
    ${"reject"}     | ${"prefer"}  | ${"2014-02-15T23:59:59-02:00[America/Sao_Paulo]"}
  `(
    "resolves fall-back week-end overlap with disambiguation $disambiguation and offset $offset to $expected",
    ({ disambiguation, offset, expected }) => {
      const optionsArg =
        offset === undefined ? { disambiguation } : { disambiguation, offset };
      expect(
        getLocaleZonedEndOfWeek(
          "2014-02-12T12:00:00-02:00[America/Sao_Paulo]",
          MustTestLocales.enUS,
          optionsArg,
        ),
      ).toBe(expected);
    },
  );

  // Regression guard against offset:"prefer" silently no-opping disambiguation:
  // every pairing below must produce a genuinely different result (or "" for
  // "reject"), confirming disambiguation actually fires when offset defaults
  // to "ignore".
  it.each`
    disambiguationA | disambiguationB | expectSameResult
    ${"compatible"} | ${"later"}      | ${false}
    ${"compatible"} | ${"compatible"} | ${true}
  `(
    "disambiguation $disambiguationA vs $disambiguationB on the fall-back overlap: same result? $expectSameResult",
    ({ disambiguationA, disambiguationB, expectSameResult }) => {
      const value = "2014-02-12T12:00:00-02:00[America/Sao_Paulo]";
      const resultA = getLocaleZonedEndOfWeek(value, MustTestLocales.enUS, {
        disambiguation: disambiguationA,
      });
      const resultB = getLocaleZonedEndOfWeek(value, MustTestLocales.enUS, {
        disambiguation: disambiguationB,
      });
      expect(resultA === resultB).toBe(expectSameResult);
    },
  );

  it.each`
    disambiguation
    ${"compatible"}
    ${"later"}
    ${"reject"}
  `(
    'disambiguation $disambiguation rejects to "" only for reject',
    ({ disambiguation }) => {
      const value = "2014-02-12T12:00:00-02:00[America/Sao_Paulo]";
      const result = getLocaleZonedEndOfWeek(value, MustTestLocales.enUS, {
        disambiguation,
      });
      expect(result === "").toBe(disambiguation === "reject");
    },
  );
});
