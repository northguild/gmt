import { describe, expect, it } from "vitest";
import {
  MustTestLocales,
  expectDateTimeEqual,
  expectOneOfDateTimeIcu,
  oneOfIcu,
} from "../../test";
import { getLocaleMeridiems } from "./getLocaleMeridiems";

// es-ES's AM/PM markers use a space between "a."/"p." and "m." whose
// exact character varies by runtime: U+202F (narrow no-break space, ICU 78
// on Node 24), a regular space (ICU 78 on Node 26, whose V8 replaces U+202F —
// see `test/icuVariants.ts`), and U+00A0 (no-break space, ICU 77 / Node
// 22.16–22.22, from the original golden, not re-run here). Spelled out with
// explicit escapes (rather than literal invisible characters) so the
// distinction survives editors/diffs that normalize whitespace.
const esAm = ["a. m.", "a.\u00a0m.", "a.\u202fm."];
const esPm = ["p. m.", "p.\u00a0m.", "p.\u202fm."];

describe("getLocaleMeridiems", () => {
  // One label per locale on every supported runtime. CJK labels go through
  // `expectDateTimeEqual`, which tolerates the ASCII "AM"/"PM" some CI ICU
  // builds render (see `test/icuVariants.ts`).
  it.each`
    locale                  | am        | pm
    ${MustTestLocales.enUS} | ${"AM"}   | ${"PM"}
    ${MustTestLocales.enGB} | ${"am"}   | ${"pm"}
    ${MustTestLocales.deDE} | ${"AM"}   | ${"PM"}
    ${MustTestLocales.frFR} | ${"AM"}   | ${"PM"}
    ${MustTestLocales.itIT} | ${"AM"}   | ${"PM"}
    ${MustTestLocales.svSE} | ${"fm"}   | ${"em"}
    ${MustTestLocales.isIS} | ${"f.h."} | ${"e.h."}
    ${MustTestLocales.zhCN} | ${"上午"} | ${"下午"}
    ${MustTestLocales.zhTW} | ${"上午"} | ${"下午"}
    ${MustTestLocales.jaJP} | ${"午前"} | ${"午後"}
    ${MustTestLocales.koKR} | ${"오전"} | ${"오후"}
    ${MustTestLocales.arSA} | ${"ص"}    | ${"م"}
    ${MustTestLocales.heIL} | ${"AM"}   | ${"PM"}
    ${MustTestLocales.ruRU} | ${"AM"}   | ${"PM"}
    ${MustTestLocales.trTR} | ${"ÖÖ"}   | ${"ÖS"}
  `("returns [$am, $pm] for $locale", ({ locale, am, pm }) => {
    const [actualAm, actualPm] = getLocaleMeridiems(locale);
    expectDateTimeEqual(actualAm, am);
    expectDateTimeEqual(actualPm, pm);
  });

  // Labels whose wording or spacing differs between runtimes: es-ES spacing
  // (see `esAm`/`esPm` above) and pt-PT, where CLDR changed "da manhã"/"da
  // tarde" (ICU 77 / Node 22.16–22.22) to "a.m."/"p.m." (ICU 78 / Node
  // 22.23+, 24, 26).
  it.each`
    locale                  | am                              | pm
    ${MustTestLocales.esES} | ${oneOfIcu(...esAm)}            | ${oneOfIcu(...esPm)}
    ${MustTestLocales.ptPT} | ${oneOfIcu("a.m.", "da manhã")} | ${oneOfIcu("p.m.", "da tarde")}
  `(
    "returns [AM-label, PM-label] for $locale as one of the known ICU variants",
    ({ locale, am, pm }) => {
      const [actualAm, actualPm] = getLocaleMeridiems(locale);
      expectOneOfDateTimeIcu(actualAm, am);
      expectOneOfDateTimeIcu(actualPm, pm);
    },
  );

  it("varies by locale", () => {
    expect(getLocaleMeridiems(MustTestLocales.enUS)).toEqual(["AM", "PM"]);
    expect(getLocaleMeridiems(MustTestLocales.enGB)).toEqual(["am", "pm"]);
    expect(getLocaleMeridiems(MustTestLocales.svSE)).toEqual(["fm", "em"]);
    const [zhAm, zhPm] = getLocaleMeridiems(MustTestLocales.zhCN);
    expectDateTimeEqual(zhAm, "上午");
    expectDateTimeEqual(zhPm, "下午");
  });

  it("returns an empty array for invalid locales", () => {
    expect(getLocaleMeridiems("")).toEqual([]);
    expect(getLocaleMeridiems("!!!")).toEqual([]);
    expect(getLocaleMeridiems(123 as unknown as string)).toEqual([]);
  });

  it("always returns exactly 2 labels", () => {
    for (const locale of Object.values(MustTestLocales)) {
      expect(getLocaleMeridiems(locale)).toHaveLength(2);
    }
  });

  // A well-formed tag with no locale data is not invalid input: ECMA-402 `ResolveLocale` falls
  // back to the host's default locale instead of throwing, so the sentinel would be wrong here.
  // Only the length is asserted, because the labels depend on the host locale.
  it("falls back for a well-formed tag with no locale data instead of returning []", () => {
    expect(getLocaleMeridiems("not-a-locale")).toHaveLength(2);
  });

  // ECMA-402 CanonicalizeLocaleList: `locale` may be a preference list; the first tag with locale
  // data is read (en-US weeks start on Sunday, fr-FR on Monday, ar-EG weekends are Friday and
  // Saturday: Intl.Locale#getWeekInfo), and a malformed tag anywhere in the list is invalid input.
  it.each`
    locale                                          | expected
    ${[MustTestLocales.frFR, MustTestLocales.enUS]} | ${["AM", "PM"]}
    ${[MustTestLocales.frFR, "not a locale!!"]}     | ${[]}
    ${[42]}                                         | ${[]}
  `("returns $expected for locale list $locale", ({ locale, expected }) => {
    expect(getLocaleMeridiems(locale)).toEqual(expected);
  });

  it.each`
    locale                                          | expected
    ${[MustTestLocales.jaJP, MustTestLocales.enUS]} | ${["午前", "午後"]}
  `("returns $expected for locale list $locale", ({ locale, expected }) => {
    expect(getLocaleMeridiems(locale)).toEqual(expected);
  });
});
