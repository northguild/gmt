import { MustTestLocales } from "../../test";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { getLocaleEndOfWeek } from "./getLocaleEndOfWeek";

describe("getLocaleEndOfWeek", () => {
  it.each`
    value           | locale                  | expected
    ${"2024-02-25"} | ${MustTestLocales.enUS} | ${"2024-03-02"}
    ${"2024-02-26"} | ${MustTestLocales.enUS} | ${"2024-03-02"}
    ${"2024-02-27"} | ${MustTestLocales.enUS} | ${"2024-03-02"}
    ${"2024-02-28"} | ${MustTestLocales.enUS} | ${"2024-03-02"}
    ${"2024-02-29"} | ${MustTestLocales.enUS} | ${"2024-03-02"}
    ${"2024-03-01"} | ${MustTestLocales.enUS} | ${"2024-03-02"}
    ${"2024-03-02"} | ${MustTestLocales.enUS} | ${"2024-03-02"}
    ${"2024-03-03"} | ${MustTestLocales.enUS} | ${"2024-03-09"}
    ${"2024-02-25"} | ${MustTestLocales.frFR} | ${"2024-02-25"}
    ${"2024-02-26"} | ${MustTestLocales.frFR} | ${"2024-03-03"}
    ${"2024-02-27"} | ${MustTestLocales.frFR} | ${"2024-03-03"}
    ${"2024-02-28"} | ${MustTestLocales.frFR} | ${"2024-03-03"}
    ${"2024-02-29"} | ${MustTestLocales.frFR} | ${"2024-03-03"}
    ${"2024-03-01"} | ${MustTestLocales.frFR} | ${"2024-03-03"}
    ${"2024-03-02"} | ${MustTestLocales.frFR} | ${"2024-03-03"}
    ${"2024-03-03"} | ${MustTestLocales.frFR} | ${"2024-03-03"}
  `(
    "returns $expected for $value in $locale",
    ({ value, locale, expected }) => {
      expect(getLocaleEndOfWeek(value, locale)).toBe(expected);
    },
  );

  it.each`
    locale                  | expected
    ${MustTestLocales.enUS} | ${"2024-03-02"}
    ${MustTestLocales.enGB} | ${"2024-03-03"}
    ${MustTestLocales.deDE} | ${"2024-03-03"}
    ${MustTestLocales.frFR} | ${"2024-03-03"}
    ${MustTestLocales.esES} | ${"2024-03-03"}
    ${MustTestLocales.itIT} | ${"2024-03-03"}
    ${MustTestLocales.ptPT} | ${"2024-03-02"}
    ${MustTestLocales.svSE} | ${"2024-03-03"}
    ${MustTestLocales.zhCN} | ${"2024-03-03"}
    ${MustTestLocales.zhTW} | ${"2024-03-02"}
    ${MustTestLocales.jaJP} | ${"2024-03-02"}
    ${MustTestLocales.koKR} | ${"2024-03-02"}
    ${MustTestLocales.arSA} | ${"2024-03-02"}
    ${MustTestLocales.heIL} | ${"2024-03-02"}
    ${MustTestLocales.ruRU} | ${"2024-03-03"}
    ${MustTestLocales.trTR} | ${"2024-03-03"}
  `(
    "returns $expected for Thursday 2024-02-29 in $locale",
    ({ locale, expected }) => {
      expect(getLocaleEndOfWeek("2024-02-29", locale)).toBe(expected);
    },
  );

  it("returns the correct end-of-week for is-IS regardless of its CLDR-version-dependent firstDay", () => {
    const firstDay = new Intl.Locale(MustTestLocales.isIS).weekInfo.firstDay;
    const expected = firstDay === 1 ? "2024-03-03" : "2024-03-02";
    expect(getLocaleEndOfWeek("2024-02-29", MustTestLocales.isIS)).toBe(
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
  `('returns "" for invalid value $value', ({ value }) => {
    expect(getLocaleEndOfWeek(value, MustTestLocales.enUS)).toBe("");
  });

  it.each`
    locale
    ${"not-a-locale-!!"}
    ${""}
    ${null}
    ${undefined}
  `('returns "" for invalid locale $locale', ({ locale }) => {
    expect(getLocaleEndOfWeek("2024-02-29", locale)).toBe("");
  });

  it('returns "" when Temporal.PlainDate.from throws', () => {
    mockTemporalPlainDateFromThrow();
    expect(getLocaleEndOfWeek("2024-02-29", MustTestLocales.enUS)).toBe("");
  });
});
