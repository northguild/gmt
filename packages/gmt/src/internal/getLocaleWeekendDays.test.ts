import { MustTestLocales } from "../test";
import { getLocaleWeekendDays } from "./getLocaleWeekendDays";

describe("getLocaleWeekendDays", () => {
  // CLDR 48 supplementalData weekData: weekend sat-sun for region 001, fri-sat for SA and IL.
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

  // Regions where some runtime's weekend differs from CLDR (compat D36): GMT returns null on every
  // runtime. BD has no weekend entry, so CLDR gives it 001's sat-sun; DZ is fri-sat.
  it.each`
    locale                 | why
    ${"ar-DZ"}             | ${"DZ"}
    ${"fr-DZ"}             | ${"DZ"}
    ${"und-DZ"}            | ${"DZ"}
    ${"bn-BD"}             | ${"BD"}
    ${"bn"}                | ${"likely region BD"}
    ${"en-US-u-rg-bdzzzz"} | ${"rg BD"}
    ${"en-US-u-rg-dzzzzz"} | ${"rg DZ"}
    ${"ar-u-rg-dzzzzz"}    | ${"rg DZ on a likely-region tag"}
    ${"ar-DZ-u-fw-mon"}    | ${"fw changes the first day, not the weekend"}
    ${"pi"}                | ${"likely region disputed between runtimes"}
    ${"bh"}                | ${"likely region disputed between runtimes"}
    ${"aii"}               | ${"three-letter language with a disputed likely region"}
  `("returns null for $locale ($why)", ({ locale }) => {
    expect(getLocaleWeekendDays(locale)).toBeNull();
  });

  // A written region or a `-u-rg-` region needs no likely region, so the same languages read the
  // region's weekend (IN is Sunday only, CLDR 48).
  it.each`
    locale              | expected
    ${"pi-IN"}          | ${[7]}
    ${"pi-u-rg-inzzzz"} | ${[7]}
  `("returns $expected for $locale", ({ locale, expected }) => {
    expect(getLocaleWeekendDays(locale)).toEqual(new Set(expected));
  });

  // The weekend does not depend on a disputed first day: these regions have a first day GMT
  // refuses, and a weekend every runtime returns.
  it.each`
    locale                 | expected           | why
    ${"ar-JO"}             | ${new Set([5, 6])} | ${"JO, fri-sat"}
    ${"en-US-u-rg-jozzzz"} | ${new Set([5, 6])} | ${"rg JO, fri-sat"}
    ${"ar-AE"}             | ${new Set([6, 7])} | ${"AE, sat-sun"}
    ${"en-CN"}             | ${new Set([6, 7])} | ${"CN, sat-sun"}
    ${"zh"}                | ${new Set([6, 7])} | ${"likely region CN"}
    ${"zh-CN-u-fw-mon"}    | ${new Set([6, 7])} | ${"CN with fw"}
    ${"en-US-u-rg-gbzzzz"} | ${new Set([6, 7])} | ${"rg GB"}
    ${"und-BU"}            | ${new Set([6, 7])} | ${"BU is MM, sat-sun"}
    ${"und-YD"}            | ${new Set([5, 6])} | ${"YD is YE, fri-sat"}
    ${"und-AN"}            | ${null}            | ${"some runtimes keep AN"}
    ${"ru-SU"}             | ${null}            | ${"some runtimes keep SU"}
  `("returns $expected for $locale ($why)", ({ locale, expected }) => {
    expect(getLocaleWeekendDays(locale)).toEqual(expected);
  });

  it.each`
    invalidLocale
    ${"invalid!!"}
    ${"en_US"}
    ${""}
    ${"x"}
  `("returns null for invalid locale '$invalidLocale'", ({ invalidLocale }) => {
    expect(getLocaleWeekendDays(invalidLocale)).toBeNull();
  });
});
