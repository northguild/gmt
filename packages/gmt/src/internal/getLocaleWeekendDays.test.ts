import { MustTestLocales } from "../test";
import { getLocaleWeekendDays } from "./getLocaleWeekendDays";

describe("getLocaleWeekendDays", () => {
  it.each`
    locale                  | expected
    ${MustTestLocales.enUS} | ${new Set([6, 7])}
    ${MustTestLocales.enGB} | ${new Set([6, 7])}
    ${MustTestLocales.deDE} | ${new Set([6, 7])}
    ${MustTestLocales.frFR} | ${new Set([6, 7])}
    ${MustTestLocales.esES} | ${new Set([6, 7])}
    ${MustTestLocales.itIT} | ${new Set([6, 7])}
    ${MustTestLocales.ptPT} | ${new Set([6, 7])}
    ${MustTestLocales.svSE} | ${new Set([6, 7])}
    ${MustTestLocales.isIS} | ${new Set([6, 7])}
    ${MustTestLocales.zhCN} | ${new Set([6, 7])}
    ${MustTestLocales.zhTW} | ${new Set([6, 7])}
    ${MustTestLocales.jaJP} | ${new Set([6, 7])}
    ${MustTestLocales.koKR} | ${new Set([6, 7])}
    ${MustTestLocales.arSA} | ${new Set([5, 6])}
    ${MustTestLocales.heIL} | ${new Set([5, 6])}
    ${MustTestLocales.ruRU} | ${new Set([6, 7])}
    ${MustTestLocales.trTR} | ${new Set([6, 7])}
  `(
    "returns expected weekend days for locale $locale",
    ({ locale, expected }) => {
      expect(getLocaleWeekendDays(locale)).toEqual(expected);
    },
  );

  it.each`
    invalidLocale
    ${"invalid!!"}
    ${"en_US"}
    ${""}
    ${"x"}
  `("returns null for invalid locale $invalidLocale", ({ invalidLocale }) => {
    expect(getLocaleWeekendDays(invalidLocale)).toBeNull();
  });
});
