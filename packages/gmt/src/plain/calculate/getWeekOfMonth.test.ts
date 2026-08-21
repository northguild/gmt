import { MustTestLocales } from "../../test";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { getWeekOfMonth } from "./getWeekOfMonth";

describe("getWeekOfMonth", () => {
  it.each`
    value           | locale                  | expected
    ${"2024-02-01"} | ${MustTestLocales.enUS} | ${1}
    ${"2024-02-03"} | ${MustTestLocales.enUS} | ${1}
    ${"2024-02-04"} | ${MustTestLocales.enUS} | ${2}
    ${"2024-02-10"} | ${MustTestLocales.enUS} | ${2}
    ${"2024-02-11"} | ${MustTestLocales.enUS} | ${3}
    ${"2024-02-17"} | ${MustTestLocales.enUS} | ${3}
    ${"2024-02-18"} | ${MustTestLocales.enUS} | ${4}
    ${"2024-02-24"} | ${MustTestLocales.enUS} | ${4}
    ${"2024-02-25"} | ${MustTestLocales.enUS} | ${5}
    ${"2024-02-29"} | ${MustTestLocales.enUS} | ${5}
    ${"2024-02-01"} | ${MustTestLocales.frFR} | ${1}
    ${"2024-02-03"} | ${MustTestLocales.frFR} | ${1}
    ${"2024-02-04"} | ${MustTestLocales.frFR} | ${1}
    ${"2024-02-10"} | ${MustTestLocales.frFR} | ${2}
    ${"2024-02-11"} | ${MustTestLocales.frFR} | ${2}
    ${"2024-02-17"} | ${MustTestLocales.frFR} | ${3}
    ${"2024-02-18"} | ${MustTestLocales.frFR} | ${3}
    ${"2024-02-24"} | ${MustTestLocales.frFR} | ${4}
    ${"2024-02-25"} | ${MustTestLocales.frFR} | ${4}
    ${"2024-02-29"} | ${MustTestLocales.frFR} | ${5}
  `(
    "returns $expected for $value in $locale",
    ({ value, locale, expected }) => {
      expect(getWeekOfMonth(value, locale)).toBe(expected);
    },
  );

  // Full 17-locale matrix: 2024-02-18 diverges between Sunday-start locales
  // (row 4, since Feb 1 is a Thursday and pushes into a partial first week)
  // and Monday-start locales (row 3).
  it.each`
    locale                  | expected
    ${MustTestLocales.enUS} | ${4}
    ${MustTestLocales.enGB} | ${3}
    ${MustTestLocales.deDE} | ${3}
    ${MustTestLocales.frFR} | ${3}
    ${MustTestLocales.esES} | ${3}
    ${MustTestLocales.itIT} | ${3}
    ${MustTestLocales.ptPT} | ${4}
    ${MustTestLocales.svSE} | ${3}
    ${MustTestLocales.zhCN} | ${3}
    ${MustTestLocales.zhTW} | ${4}
    ${MustTestLocales.jaJP} | ${4}
    ${MustTestLocales.koKR} | ${4}
    ${MustTestLocales.arSA} | ${4}
    ${MustTestLocales.heIL} | ${4}
    ${MustTestLocales.ruRU} | ${3}
    ${MustTestLocales.trTR} | ${3}
  `(
    "returns $expected for Sunday 2024-02-18 in $locale",
    ({ locale, expected }) => {
      expect(getWeekOfMonth("2024-02-18", locale)).toBe(expected);
    },
  );

  it("returns the correct week-of-month for is-IS regardless of its CLDR-version-dependent firstDay", () => {
    const firstDay = new Intl.Locale(MustTestLocales.isIS).weekInfo.firstDay;
    const expected = firstDay === 1 ? 3 : 4;
    expect(getWeekOfMonth("2024-02-18", MustTestLocales.isIS)).toBe(expected);
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
  `("returns null for invalid value $value", ({ value }) => {
    expect(getWeekOfMonth(value, MustTestLocales.enUS)).toBeNull();
  });

  it.each`
    locale
    ${"not-a-locale-!!"}
    ${""}
    ${null}
    ${undefined}
  `("returns null for invalid locale $locale", ({ locale }) => {
    expect(getWeekOfMonth("2024-02-18", locale)).toBeNull();
  });

  it("returns null when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(getWeekOfMonth("2024-02-18", MustTestLocales.enUS)).toBeNull();
  });
});
