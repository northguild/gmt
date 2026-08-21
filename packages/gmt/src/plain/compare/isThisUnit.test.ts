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
});
