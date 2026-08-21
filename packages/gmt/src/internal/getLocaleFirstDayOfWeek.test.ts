import { MustTestLocales } from "../test";
import { getLocaleFirstDayOfWeek } from "./getLocaleFirstDayOfWeek";

describe("getLocaleFirstDayOfWeek", () => {
  it.each`
    locale                  | expected
    ${MustTestLocales.enUS} | ${7}
    ${MustTestLocales.enGB} | ${1}
    ${MustTestLocales.deDE} | ${1}
    ${MustTestLocales.frFR} | ${1}
    ${MustTestLocales.esES} | ${1}
    ${MustTestLocales.itIT} | ${1}
    ${MustTestLocales.ptPT} | ${7}
    ${MustTestLocales.svSE} | ${1}
    ${MustTestLocales.zhCN} | ${1}
    ${MustTestLocales.zhTW} | ${7}
    ${MustTestLocales.jaJP} | ${7}
    ${MustTestLocales.koKR} | ${7}
    ${MustTestLocales.arSA} | ${7}
    ${MustTestLocales.heIL} | ${7}
    ${MustTestLocales.ruRU} | ${1}
    ${MustTestLocales.trTR} | ${1}
  `("returns $expected for locale $locale", ({ locale, expected }) => {
    expect(getLocaleFirstDayOfWeek(locale)).toBe(expected);
  });

  // is-IS's own CLDR data disagrees on firstDay between ICU versions —
  // Monday under some, Sunday under others — so this asserts against the
  // runtime's actual weekInfo rather than a hardcoded value.
  it("returns the runtime's own weekInfo.firstDay for is-IS", () => {
    const expected = new Intl.Locale(MustTestLocales.isIS).weekInfo.firstDay;
    expect(getLocaleFirstDayOfWeek(MustTestLocales.isIS)).toBe(expected);
  });

  it.each`
    invalidLocale
    ${"invalid!!"}
    ${"en_US"}
    ${""}
    ${"x"}
  `("returns null for invalid locale $invalidLocale", ({ invalidLocale }) => {
    expect(getLocaleFirstDayOfWeek(invalidLocale)).toBeNull();
  });
});
