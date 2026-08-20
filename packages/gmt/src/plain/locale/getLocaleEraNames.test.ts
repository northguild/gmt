import { describe, expect, it } from "vitest";
import { MustTestLocales } from "../../test";
import { getLocaleEraNames } from "./getLocaleEraNames";

describe("getLocaleEraNames", () => {
  it.each`
    locale                  | long                                                  | short                         | narrow
    ${MustTestLocales.enUS} | ${["Before Christ", "Anno Domini"]}                   | ${["BC", "AD"]}               | ${["B", "A"]}
    ${MustTestLocales.enGB} | ${["Before Christ", "Anno Domini"]}                   | ${["BC", "AD"]}               | ${["B", "A"]}
    ${MustTestLocales.deDE} | ${["v. Chr.", "n. Chr."]}                             | ${["v. Chr.", "n. Chr."]}     | ${["v. Chr.", "n. Chr."]}
    ${MustTestLocales.frFR} | ${["avant Jésus-Christ", "après Jésus-Christ"]}       | ${["av. J.-C.", "ap. J.-C."]} | ${["av. J.-C.", "ap. J.-C."]}
    ${MustTestLocales.esES} | ${["antes de Cristo", "después de Cristo"]}           | ${["a. C.", "d. C."]}         | ${["a. C.", "d. C."]}
    ${MustTestLocales.itIT} | ${["avanti Cristo", "dopo Cristo"]}                   | ${["a.C.", "d.C."]}           | ${["aC", "dC"]}
    ${MustTestLocales.ptPT} | ${["antes de Cristo", "depois de Cristo"]}            | ${["a.C.", "d.C."]}           | ${["a.C.", "d.C."]}
    ${MustTestLocales.svSE} | ${["före Kristus", "efter Kristus"]}                  | ${["f.Kr.", "e.Kr."]}         | ${["f.Kr.", "e.Kr."]}
    ${MustTestLocales.isIS} | ${["fyrir Krist", "eftir Krist"]}                     | ${["f.Kr.", "e.Kr."]}         | ${["f.k.", "e.k."]}
    ${MustTestLocales.zhCN} | ${["公元前", "公元"]}                                 | ${["公元前", "公元"]}         | ${["公元前", "公元"]}
    ${MustTestLocales.zhTW} | ${["西元前", "西元"]}                                 | ${["西元前", "西元"]}         | ${["西元前", "西元"]}
    ${MustTestLocales.jaJP} | ${["紀元前", "西暦"]}                                 | ${["紀元前", "西暦"]}         | ${["BC", "AD"]}
    ${MustTestLocales.koKR} | ${["기원전", "서기"]}                                 | ${["BC", "AD"]}               | ${["BC", "AD"]}
    ${MustTestLocales.arSA} | ${["قبل الميلاد", "ميلادي"]}                            | ${["ق.م", "م"]}               | ${["ق.م", "م"]}
    ${MustTestLocales.heIL} | ${["לפני הספירה", "לספירה"]}                          | ${["לפנה״ס", "לספירה"]}       | ${["לפני", "אחריי"]}
    ${MustTestLocales.ruRU} | ${["до Рождества Христова", "от Рождества Христова"]} | ${["до н. э.", "н. э."]}      | ${["до н.э.", "н.э."]}
    ${MustTestLocales.trTR} | ${["Milattan Önce", "Milattan Sonra"]}                | ${["MÖ", "MS"]}               | ${["MÖ", "MS"]}
  `(
    "returns Gregorian era names (long/short/narrow) for $locale",
    ({ locale, long, short, narrow }) => {
      expect(getLocaleEraNames(locale)).toEqual(long);
      expect(getLocaleEraNames(locale, "long")).toEqual(long);
      expect(getLocaleEraNames(locale, "short")).toEqual(short);
      expect(getLocaleEraNames(locale, "narrow")).toEqual(narrow);
    },
  );

  it("returns long names when style is omitted for fr-FR", () => {
    expect(getLocaleEraNames(MustTestLocales.frFR)).toEqual([
      "avant Jésus-Christ",
      "après Jésus-Christ",
    ]);
  });

  it("returns an empty array for invalid locales", () => {
    expect(getLocaleEraNames("")).toEqual([]);
    expect(getLocaleEraNames("!!!")).toEqual([]);
    expect(getLocaleEraNames(123 as unknown as string)).toEqual([]);
    expect(getLocaleEraNames(undefined as unknown as string)).toEqual([]);
  });

  it("always returns exactly 2 labels for valid locales", () => {
    for (const locale of Object.values(MustTestLocales)) {
      expect(getLocaleEraNames(locale)).toHaveLength(2);
    }
  });

  it("returns both elements as the same string when a locale has no distinct BCE/CE era names", () => {
    // Mock Intl.DateTimeFormat to simulate a locale whose ICU data
    // returns the same era string for both BCE and CE reference dates.
    const originalDTF = globalThis.Intl.DateTimeFormat;
    const mockParts = [
      { type: "era", value: "EraX" },
      { type: "literal", value: " " },
      { type: "year", value: "1" },
    ];
    (
      globalThis as unknown as {
        Intl: { DateTimeFormat: typeof Intl.DateTimeFormat };
      }
    ).Intl.DateTimeFormat = class MockDTF {
      constructor() {}
      formatToParts() {
        return mockParts;
      }
    } as unknown as typeof Intl.DateTimeFormat;

    try {
      expect(getLocaleEraNames("en-US")).toEqual(["EraX", "EraX"]);
    } finally {
      (
        globalThis as unknown as {
          Intl: { DateTimeFormat: typeof Intl.DateTimeFormat };
        }
      ).Intl.DateTimeFormat = originalDTF;
    }
  });
});
