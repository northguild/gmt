import { MustTestLocales } from "../../test";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { getWeeksInMonth } from "./getWeeksInMonth";

describe("getWeeksInMonth", () => {
  // The same month spans a different number of week-rows depending on
  // locale (whether the week starts Sunday or Monday).
  it.each`
    value           | locale                  | expected
    ${"2026-02-15"} | ${MustTestLocales.enUS} | ${4}
    ${"2026-02-15"} | ${MustTestLocales.enGB} | ${5}
    ${"2024-03-15"} | ${MustTestLocales.enUS} | ${6}
    ${"2024-03-15"} | ${MustTestLocales.enGB} | ${5}
    ${"2024-02-15"} | ${MustTestLocales.enUS} | ${5}
    ${"2024-02-15"} | ${MustTestLocales.enGB} | ${5}
  `(
    "returns $expected week-rows for $value in $locale",
    ({ value, locale, expected }) => {
      expect(getWeeksInMonth(value, locale)).toBe(expected);
    },
  );

  // Full 17-locale matrix: February 2026 spans 4 rows for Sunday-start
  // locales and 5 rows for Monday-start locales.
  it.each`
    locale                  | expected
    ${MustTestLocales.enUS} | ${4}
    ${MustTestLocales.enGB} | ${5}
    ${MustTestLocales.deDE} | ${5}
    ${MustTestLocales.frFR} | ${5}
    ${MustTestLocales.esES} | ${5}
    ${MustTestLocales.itIT} | ${5}
    ${MustTestLocales.ptPT} | ${4}
    ${MustTestLocales.svSE} | ${5}
    ${MustTestLocales.zhCN} | ${5}
    ${MustTestLocales.zhTW} | ${4}
    ${MustTestLocales.jaJP} | ${4}
    ${MustTestLocales.koKR} | ${4}
    ${MustTestLocales.arSA} | ${4}
    ${MustTestLocales.heIL} | ${4}
    ${MustTestLocales.ruRU} | ${5}
    ${MustTestLocales.trTR} | ${5}
  `(
    "returns $expected week-rows for 2026-02-15 in $locale",
    ({ locale, expected }) => {
      expect(getWeeksInMonth("2026-02-15", locale)).toBe(expected);
    },
  );

  it("returns the correct week-row count for is-IS regardless of its CLDR-version-dependent firstDay", () => {
    const firstDay = new Intl.Locale(MustTestLocales.isIS).weekInfo.firstDay;
    const expected = firstDay === 1 ? 5 : 4;
    expect(getWeeksInMonth("2026-02-15", MustTestLocales.isIS)).toBe(
      expected,
    );
  });

  it.each`
    value
    ${"invalid-date"}
    ${"2024-02-30"}
    ${"2024-02-29T00:00:00"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `('returns null for invalid value $value', ({ value }) => {
    expect(getWeeksInMonth(value, MustTestLocales.enUS)).toBeNull();
  });

  it.each`
    locale
    ${"not-a-locale-!!"}
    ${""}
    ${null}
    ${undefined}
  `('returns null for invalid locale $locale', ({ locale }) => {
    expect(getWeeksInMonth("2026-02-15", locale)).toBeNull();
  });

  it("returns null when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(getWeeksInMonth("2026-02-15", MustTestLocales.enUS)).toBeNull();
  });
});
