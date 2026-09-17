import { MustTestLocales } from "../../test";
import { mockTemporalNowZonedDateTimeISOThrow } from "../../test/mocks";
import * as getSystemTimeZoneModule from "../../zoned/get/getSystemTimeZone";
import { getLocaleStartOfWeek } from "../calculate/getLocaleStartOfWeek";
import { isThisUnit } from "./isThisUnit";

describe("isThisUnit", () => {
  let timeZoneSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    // Today = 2024-02-29 (Thursday), UTC.
    vi.setSystemTime("2024-02-29T00:00:00.000Z");
    timeZoneSpy = vi
      .spyOn(getSystemTimeZoneModule, "getSystemTimeZone")
      .mockReturnValue("UTC");
  });

  afterEach(() => {
    timeZoneSpy.mockRestore();
    vi.useRealTimers();
  });

  it.each`
    value           | unit       | expected
    ${"2024-02-29"} | ${"day"}   | ${true}
    ${"2024-02-28"} | ${"day"}   | ${false}
    ${"2024-02-01"} | ${"month"} | ${true}
    ${"2024-02-29"} | ${"month"} | ${true}
    ${"2024-01-31"} | ${"month"} | ${false}
    ${"2024-01-01"} | ${"year"}  | ${true}
    ${"2024-12-31"} | ${"year"}  | ${true}
    ${"2023-12-31"} | ${"year"}  | ${false}
    ${"2024-02-26"} | ${"week"}  | ${true}
    ${"2024-03-03"} | ${"week"}  | ${true}
    ${"2024-02-25"} | ${"week"}  | ${false}
    ${"2024-03-04"} | ${"week"}  | ${false}
  `(
    "returns $expected for $value at unit $unit with no locale (today is 2024-02-29, ISO Monday-start week)",
    ({ value, unit, expected }) => {
      expect(isThisUnit(value, unit)).toBe(expected);
    },
  );

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
    "week + locale: 2024-02-25 vs today 2024-02-29 in $locale -> $expected",
    ({ locale, expected }) => {
      // 2024-02-25 is a Sunday: for a Sunday-first-day locale it falls in the
      // same week as Thursday 2024-02-29; for a Monday-first-day locale it
      // falls in the *previous* week.
      expect(isThisUnit("2024-02-25", "week", locale)).toBe(expected);
    },
  );

  it("returns the correct locale-aware week result for is-IS regardless of its CLDR-version-dependent firstDay", () => {
    const startOfTodayWeek = getLocaleStartOfWeek(
      "2024-02-29",
      MustTestLocales.isIS,
    );
    const startOfValueWeek = getLocaleStartOfWeek(
      "2024-02-25",
      MustTestLocales.isIS,
    );
    expect(isThisUnit("2024-02-25", "week", MustTestLocales.isIS)).toBe(
      startOfTodayWeek === startOfValueWeek,
    );
  });

  it("returns false for a locale-scoped week when locale is invalid", () => {
    expect(isThisUnit("2024-02-25", "week", "not-a-locale-!!")).toBe(false);
  });

  it.each`
    unit
    ${"hour"}
    ${"minute"}
  `("returns false for unsupported unit $unit", ({ unit }) => {
    expect(isThisUnit("2024-02-29", unit)).toBe(false);
  });

  it.each`
    value
    ${""}
    ${null}
    ${undefined}
    ${"not-a-date"}
  `("returns false for invalid value $value", ({ value }) => {
    expect(isThisUnit(value as never, "month")).toBe(false);
  });

  it("returns false when the system timeZone is unavailable", () => {
    timeZoneSpy.mockReturnValue("");
    expect(isThisUnit("2024-02-29", "day")).toBe(false);
  });

  it("returns false when Temporal.Now.zonedDateTimeISO throws", () => {
    vi.useRealTimers();
    mockTemporalNowZonedDateTimeISOThrow();
    expect(isThisUnit("2024-02-29", "day")).toBe(false);
  });

  // Temporal §13.17 GetTemporalUnitValuedOption: a plural unit name is the same unit as its singular.
  // Today is 2024-02-29, a Thursday; its ISO week runs Monday 2024-02-26 to Sunday 2024-03-03.
  it.each`
    value           | unit        | expected
    ${"2024-02-29"} | ${"days"}   | ${true}
    ${"2024-02-28"} | ${"days"}   | ${false}
    ${"2024-02-26"} | ${"weeks"}  | ${true}
    ${"2024-02-25"} | ${"weeks"}  | ${false}
    ${"2024-02-01"} | ${"months"} | ${true}
    ${"2024-01-31"} | ${"months"} | ${false}
    ${"2024-01-01"} | ${"years"}  | ${true}
    ${"2023-12-31"} | ${"years"}  | ${false}
  `(
    "returns $expected for $value by plural unit $unit",
    ({ value, unit, expected }) => {
      expect(isThisUnit(`${value}`, unit)).toBe(expected);
    },
  );

  // The locale is validated for every unit, not only "week": a malformed tag is invalid input.
  it.each`
    unit       | locale
    ${"day"}   | ${"not-a-locale-!!"}
    ${"day"}   | ${[MustTestLocales.frFR, "not a locale!!"]}
    ${"day"}   | ${42}
    ${"week"}  | ${"not-a-locale-!!"}
    ${"week"}  | ${[MustTestLocales.frFR, "not a locale!!"]}
    ${"week"}  | ${42}
    ${"month"} | ${"not-a-locale-!!"}
    ${"month"} | ${[MustTestLocales.frFR, "not a locale!!"]}
    ${"month"} | ${42}
    ${"year"}  | ${"not-a-locale-!!"}
    ${"year"}  | ${[MustTestLocales.frFR, "not a locale!!"]}
    ${"year"}  | ${42}
  `(
    "returns false for unit $unit with invalid locale $locale",
    ({ unit, locale }) => {
      expect(isThisUnit("2024-02-29", unit, locale)).toBe(false);
    },
  );

  // ECMA-402 CanonicalizeLocaleList: `locale` may be a preference list; the first tag with locale
  // data is read (en-US weeks start on Sunday, fr-FR on Monday, ar-EG weekends are Friday and
  // Saturday: Intl.Locale#getWeekInfo), and a malformed tag anywhere in the list is invalid input.
  // Sunday 2024-02-25 shares today's en-US (Sunday-first) week but not its fr-FR (Monday-first) week.
  it.each`
    locale                                          | expected
    ${[MustTestLocales.enUS, MustTestLocales.frFR]} | ${true}
    ${[MustTestLocales.frFR, MustTestLocales.enUS]} | ${false}
  `(
    "returns $expected for Sunday 2024-02-25 by week with locale list $locale",
    ({ locale, expected }) => {
      expect(isThisUnit("2024-02-25", "week", locale)).toBe(expected);
    },
  );
});
