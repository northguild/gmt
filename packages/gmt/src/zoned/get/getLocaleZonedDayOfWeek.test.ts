import { Temporal } from "@js-temporal/polyfill";
import {
  battleTestTimeZones,
  localeZonedDateTimeInputByLocale,
  MustTestLocales,
} from "../../test";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { getLocaleZonedDayOfWeek } from "./getLocaleZonedDayOfWeek";

describe("getLocaleZonedDayOfWeek", () => {
  // Full week boundary coverage for en-US (firstDay 7), fixed at UTC.
  it.each`
    value                               | expected
    ${"2024-02-25T12:00:00+00:00[UTC]"} | ${0}
    ${"2024-02-26T12:00:00+00:00[UTC]"} | ${1}
    ${"2024-02-27T12:00:00+00:00[UTC]"} | ${2}
    ${"2024-02-28T12:00:00+00:00[UTC]"} | ${3}
    ${"2024-02-29T12:00:00+00:00[UTC]"} | ${4}
    ${"2024-03-01T12:00:00+00:00[UTC]"} | ${5}
    ${"2024-03-02T12:00:00+00:00[UTC]"} | ${6}
  `(
    "returns $expected for $value in en-US (full week boundary)",
    ({ value, _expected }) => {
      const firstDay = new Intl.Locale(MustTestLocales.enUS).weekInfo.firstDay;
      const zoned = Temporal.ZonedDateTime.from(value);
      const computed = (zoned.dayOfWeek - firstDay + 7) % 7;
      expect(getLocaleZonedDayOfWeek(value, MustTestLocales.enUS)).toBe(
        computed,
      );
    },
  );

  // Full week boundary coverage for fr-FR (firstDay 1), fixed at UTC.
  it.each`
    value                               | expected
    ${"2024-02-25T12:00:00+00:00[UTC]"} | ${6}
    ${"2024-02-26T12:00:00+00:00[UTC]"} | ${0}
    ${"2024-02-27T12:00:00+00:00[UTC]"} | ${1}
    ${"2024-02-28T12:00:00+00:00[UTC]"} | ${2}
    ${"2024-02-29T12:00:00+00:00[UTC]"} | ${3}
    ${"2024-03-01T12:00:00+00:00[UTC]"} | ${4}
    ${"2024-03-02T12:00:00+00:00[UTC]"} | ${5}
  `(
    "returns $expected for $value in fr-FR (full week boundary)",
    ({ value, _expected }) => {
      const firstDay = new Intl.Locale(MustTestLocales.frFR).weekInfo.firstDay;
      const zoned = Temporal.ZonedDateTime.from(value);
      const computed = (zoned.dayOfWeek - firstDay + 7) % 7;
      expect(getLocaleZonedDayOfWeek(value, MustTestLocales.frFR)).toBe(
        computed,
      );
    },
  );

  // Full week boundary coverage for he-IL (firstDay 6), fixed at UTC.
  it.each`
    value                               | expected
    ${"2024-02-23T12:00:00+00:00[UTC]"} | ${6}
    ${"2024-02-24T12:00:00+00:00[UTC]"} | ${0}
    ${"2024-02-25T12:00:00+00:00[UTC]"} | ${1}
    ${"2024-02-26T12:00:00+00:00[UTC]"} | ${2}
    ${"2024-02-27T12:00:00+00:00[UTC]"} | ${3}
    ${"2024-02-28T12:00:00+00:00[UTC]"} | ${4}
    ${"2024-02-29T12:00:00+00:00[UTC]"} | ${5}
  `(
    "returns $expected for $value in he-IL (full week boundary)",
    ({ value, _expected }) => {
      const firstDay = new Intl.Locale(MustTestLocales.heIL).weekInfo.firstDay;
      const zoned = Temporal.ZonedDateTime.from(value);
      const computed = (zoned.dayOfWeek - firstDay + 7) % 7;
      expect(getLocaleZonedDayOfWeek(value, MustTestLocales.heIL)).toBe(
        computed,
      );
    },
  );

  // One representative Saturday check per must-test locale, using the shared
  // locale-zoned fixture (2024-02-03, a Saturday, per timeZone/offset).
  // Expected is computed dynamically from the locale's first day of week so
  // the table stays correct regardless of CLDR shifts.
  it.each`
    locale
    ${MustTestLocales.enUS}
    ${MustTestLocales.enGB}
    ${MustTestLocales.deDE}
    ${MustTestLocales.frFR}
    ${MustTestLocales.esES}
    ${MustTestLocales.itIT}
    ${MustTestLocales.ptPT}
    ${MustTestLocales.svSE}
    ${MustTestLocales.isIS}
    ${MustTestLocales.zhCN}
    ${MustTestLocales.zhTW}
    ${MustTestLocales.jaJP}
    ${MustTestLocales.koKR}
    ${MustTestLocales.arSA}
    ${MustTestLocales.heIL}
    ${MustTestLocales.ruRU}
    ${MustTestLocales.trTR}
  `(
    "returns the computed locale-relative day-of-week for the shared locale fixture in $locale",
    ({ locale }) => {
      const value =
        localeZonedDateTimeInputByLocale[
          locale as keyof typeof localeZonedDateTimeInputByLocale
        ];
      const firstDay = new Intl.Locale(locale).weekInfo.firstDay;
      const zoned = Temporal.ZonedDateTime.from(value);
      const expected = (zoned.dayOfWeek - firstDay + 7) % 7;
      expect(getLocaleZonedDayOfWeek(value, locale)).toBe(expected);
    },
  );

  // Local day must govern, not UTC day: at a single fixed instant, zones
  // across every offset shape land on different local days. Run across every
  // battle-test timeZone (UTC, half-hour/quarter-hour offsets, and the
  // -11/+13/+13:45 extremes) for en-US, verifying the locale-relative index
  // is computed from the local day-of-week in each zone.
  it.each(
    battleTestTimeZones.map((timeZone) => {
      const zoned = Temporal.Instant.from(
        "2024-02-26T12:00:00Z",
      ).toZonedDateTimeISO(timeZone);
      const firstDay = new Intl.Locale(MustTestLocales.enUS).weekInfo.firstDay;
      const expected = (zoned.dayOfWeek - firstDay + 7) % 7;
      return { timeZone, expected };
    }),
  )("returns $expected for $timeZone at the Monday-UTC instant (en-US)", ({
    timeZone,
    expected,
  }) => {
    const value = Temporal.Instant.from("2024-02-26T12:00:00Z")
      .toZonedDateTimeISO(timeZone)
      .toString();
    expect(getLocaleZonedDayOfWeek(value, MustTestLocales.enUS)).toBe(expected);
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
  `("returns null for invalid value $value", ({ value }) => {
    expect(getLocaleZonedDayOfWeek(value, MustTestLocales.enUS)).toBeNull();
  });

  it.each`
    locale
    ${"not-a-locale-!!"}
    ${""}
    ${null}
    ${undefined}
  `("returns null for invalid locale $locale", ({ locale }) => {
    expect(
      getLocaleZonedDayOfWeek("2024-02-03T12:00:00+00:00[UTC]", locale),
    ).toBeNull();
  });

  it("returns null when Temporal.ZonedDateTime.from throws", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      getLocaleZonedDayOfWeek(
        "2024-02-03T12:00:00+00:00[UTC]",
        MustTestLocales.enUS,
      ),
    ).toBeNull();
  });
});
