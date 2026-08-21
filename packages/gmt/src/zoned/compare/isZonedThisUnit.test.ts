import { Temporal } from "@js-temporal/polyfill";
import { MustTestLocales, MustTestLocaleTimezones } from "../../test";
import { mockTemporalNowZonedDateTimeISOThrow } from "../../test/mocks";
import { battleTestTimeZones } from "../../test/timeZoneMatrix";
import { isZonedThisUnit } from "./isZonedThisUnit";

function zonedAt(
  timeZone: string,
  date: Temporal.PlainDate,
  hour = 10,
): string {
  return Temporal.ZonedDateTime.from({
    year: date.year,
    month: date.month,
    day: date.day,
    hour,
    timeZone,
  }).toString();
}

describe("isZonedThisUnit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2024-02-29T00:00:00.000Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(battleTestTimeZones)(
    "returns true for %s's own local 'today' at unit day",
    (timeZone) => {
      const today = Temporal.Now.zonedDateTimeISO(timeZone).toPlainDate();
      expect(isZonedThisUnit(zonedAt(timeZone, today), "day")).toBe(true);
    },
  );

  it.each(battleTestTimeZones)(
    "returns false for %s's local yesterday at unit day",
    (timeZone) => {
      const yesterday = Temporal.Now.zonedDateTimeISO(timeZone)
        .toPlainDate()
        .subtract({ days: 1 });
      expect(isZonedThisUnit(zonedAt(timeZone, yesterday), "day")).toBe(false);
    },
  );

  it.each`
    unit
    ${"month"}
    ${"year"}
  `("returns true for UTC's own local 'today' at unit $unit", ({ unit }) => {
    const today = Temporal.Now.zonedDateTimeISO("UTC").toPlainDate();
    expect(isZonedThisUnit(zonedAt("UTC", today), unit)).toBe(true);
  });

  it("returns false for a month a year apart", () => {
    expect(isZonedThisUnit("2023-02-29T10:00:00+00:00[UTC]", "month")).toBe(
      false,
    );
  });

  it.each`
    locale                  | expected
    ${MustTestLocales.enUS} | ${true}
    ${MustTestLocales.enGB} | ${false}
    ${MustTestLocales.deDE} | ${false}
    ${MustTestLocales.frFR} | ${false}
    ${MustTestLocales.esES} | ${false}
    ${MustTestLocales.itIT} | ${false}
    ${MustTestLocales.ptPT} | ${true}
    ${MustTestLocales.svSE} | ${false}
    ${MustTestLocales.zhCN} | ${false}
    ${MustTestLocales.zhTW} | ${true}
    ${MustTestLocales.jaJP} | ${true}
    ${MustTestLocales.koKR} | ${true}
    ${MustTestLocales.arSA} | ${true}
    ${MustTestLocales.heIL} | ${true}
    ${MustTestLocales.ruRU} | ${false}
    ${MustTestLocales.trTR} | ${false}
  `(
    "week + locale: local 2024-02-25 vs today's local week in $locale -> $expected",
    ({ locale, expected }) => {
      const timeZone = (MustTestLocaleTimezones as Record<string, string>)[
        locale
      ];
      // 2024-02-25 is a Sunday: for a Sunday-first-day locale it falls in the
      // same week as the mocked Thursday "today"; for a Monday-first-day
      // locale it falls in the previous week.
      const value = zonedAt(timeZone, Temporal.PlainDate.from("2024-02-25"));
      expect(isZonedThisUnit(value, "week", locale)).toBe(expected);
    },
  );

  it("returns false for a locale-scoped week when locale is invalid", () => {
    expect(
      isZonedThisUnit(
        "2024-02-25T10:00:00+00:00[UTC]",
        "week",
        "not-a-locale-!!",
      ),
    ).toBe(false);
  });

  it.each`
    unit
    ${"hour"}
    ${"minute"}
  `("returns false for unsupported unit $unit", ({ unit }) => {
    expect(isZonedThisUnit("2024-02-29T10:00:00+00:00[UTC]", unit)).toBe(false);
  });

  it.each`
    value
    ${""}
    ${null}
    ${undefined}
    ${"not-a-zoned-datetime"}
  `("returns false for invalid value $value", ({ value }) => {
    expect(isZonedThisUnit(value as never, "day")).toBe(false);
  });

  it("returns false when Temporal.Now.zonedDateTimeISO throws", () => {
    vi.useRealTimers();
    mockTemporalNowZonedDateTimeISOThrow();
    expect(isZonedThisUnit("2024-02-29T10:00:00+00:00[UTC]", "day")).toBe(
      false,
    );
  });
});
