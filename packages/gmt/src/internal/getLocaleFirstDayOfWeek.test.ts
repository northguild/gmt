import { MustTestLocales } from "../test";
import { getLocaleFirstDayOfWeek } from "./getLocaleFirstDayOfWeek";

describe("getLocaleFirstDayOfWeek", () => {
  // CLDR 48 supplementalData weekData firstDay, per region: mon for GB, DE, FR, ES, IT, SE, RU, TR
  // and CN-free tags; sun for US, PT, TW, JP, KR, SA, IL.
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

  // Regions where some runtime's week data differs from CLDR (compat D36): GMT returns null on every
  // runtime, so the answer is the same everywhere. A region comes from the tag, from its likely
  // region (`zh` is CN), or from a `-u-rg-` keyword.
  it.each`
    locale                        | why
    ${MustTestLocales.zhCN}       | ${"CN"}
    ${"zh"}                       | ${"likely region CN"}
    ${"zh-Hans"}                  | ${"likely region CN"}
    ${"zh-Hant-CN"}               | ${"script and region CN"}
    ${"en-CN"}                    | ${"CN"}
    ${"und-CN"}                   | ${"CN"}
    ${"ar-JO"}                    | ${"JO"}
    ${"ar-DZ"}                    | ${"DZ"}
    ${"fr-DZ"}                    | ${"DZ"}
    ${"ar-AE"}                    | ${"AE"}
    ${MustTestLocales.isIS}       | ${"IS"}
    ${"is"}                       | ${"likely region IS"}
    ${"en-US-u-rg-cnzzzz"}        | ${"rg CN"}
    ${"en-US-u-rg-dzzzzz"}        | ${"rg DZ"}
    ${"ar-u-rg-dzzzzz"}           | ${"rg DZ on a likely-region tag"}
    ${"en-US-u-rg-iszzzz"}        | ${"rg IS"}
    ${"en-US-u-fw-xyz-rg-cnzzzz"} | ${"fw that names no day"}
    ${["zh-CN", "en-US"]}         | ${"first of a list"}
    ${"pi"}                       | ${"likely region disputed between runtimes"}
    ${"bh"}                       | ${"likely region disputed between runtimes"}
    ${"pi-Thai"}                  | ${"language with a disputed likely region, with a script"}
    ${"adp"}                      | ${"three-letter language with a disputed likely region"}
  `("returns null for $locale ($why)", ({ locale }) => {
    expect(getLocaleFirstDayOfWeek(locale)).toBeNull();
  });

  // A written region or a `-u-rg-` region needs no likely region, so the same languages read the
  // region's value (IN is Sunday-first, CLDR 48).
  it.each`
    locale              | expected
    ${"pi-IN"}          | ${7}
    ${"bh-IN"}          | ${7}
    ${"pi-u-rg-inzzzz"} | ${7}
    ${"pi-u-fw-mon"}    | ${1}
  `("returns $expected for $locale", ({ locale, expected }) => {
    expect(getLocaleFirstDayOfWeek(locale)).toBe(expected);
  });

  // Deprecated region codes: UTS #35 territoryAlias replaces them with a successor, but runtimes
  // disagree on whether they do. GMT reads the successor where every runtime does, and refuses
  // the codes some runtime keeps.
  it.each`
    locale                 | expected | why
    ${"und-BU"}            | ${7}     | ${"BU is MM, first day sun"}
    ${"my-BU"}             | ${7}     | ${"BU is MM, first day sun"}
    ${"und-TP"}            | ${1}     | ${"TP is TL, first day mon"}
    ${"und-YD"}            | ${7}     | ${"YD is YE, first day sun"}
    ${"und-AN"}            | ${null}  | ${"some runtimes keep AN"}
    ${"und-NT"}            | ${null}  | ${"some runtimes keep NT"}
    ${"ru-SU"}             | ${null}  | ${"some runtimes keep SU"}
    ${"en-US-u-rg-buzzzz"} | ${null}  | ${"a deprecated rg region is not canonicalized everywhere"}
  `(
    "returns $expected for deprecated region $locale ($why)",
    ({ locale, expected }) => {
      expect(getLocaleFirstDayOfWeek(locale)).toBe(expected);
    },
  );

  // UTS #35 key fw: the caller names the first day, so no runtime data is read.
  it.each`
    locale                          | expected | why
    ${"zh-CN-u-fw-mon"}             | ${1}     | ${"CN, fw mon"}
    ${"zh-CN-u-fw-sun"}             | ${7}     | ${"CN, fw sun"}
    ${"zh-u-fw-tue"}                | ${2}     | ${"likely region CN, fw tue"}
    ${"ar-DZ-u-fw-fri"}             | ${5}     | ${"DZ, fw fri"}
    ${"ar-JO-u-fw-sat"}             | ${6}     | ${"JO, fw sat"}
    ${"is-IS-u-fw-wed"}             | ${3}     | ${"IS, fw wed"}
    ${"en-US-u-fw-thu"}             | ${4}     | ${"US, fw thu overrides sun"}
    ${"en-US-u-fw-mon-rg-dzzzzz"}   | ${1}     | ${"fw wins over a refused rg region"}
    ${"und-CN-u-ca-gregory-fw-mon"} | ${1}     | ${"fw after another keyword"}
  `("returns $expected for $locale ($why)", ({ locale, expected }) => {
    expect(getLocaleFirstDayOfWeek(locale)).toBe(expected);
  });

  // `rg` gives the region for regional preferences (UTS #35 key rg); an undisputed rg region reads
  // that region's data.
  it.each`
    locale                 | expected | why
    ${"en-US-u-rg-gbzzzz"} | ${1}     | ${"rg GB, mon"}
    ${"en-GB-u-rg-uszzzz"} | ${7}     | ${"rg US, sun"}
    ${"en-US-u-rg-bdzzzz"} | ${7}     | ${"rg BD, sun"}
    ${"en-US-u-rg-cn"}     | ${7}     | ${"rg value too short, ignored, US sun"}
    ${"bn-BD"}             | ${7}     | ${"BD first day is not disputed"}
  `("returns $expected for $locale ($why)", ({ locale, expected }) => {
    expect(getLocaleFirstDayOfWeek(locale)).toBe(expected);
  });

  it.each`
    invalidLocale
    ${"invalid!!"}
    ${"en_US"}
    ${""}
    ${"x"}
  `("returns null for invalid locale '$invalidLocale'", ({ invalidLocale }) => {
    expect(getLocaleFirstDayOfWeek(invalidLocale)).toBeNull();
  });
});
