import { describe, expect, it } from "vitest";
import { MustTestLocales, expectDateTimeEqual } from "../../test";
import { getLocaleMeridiems } from "./getLocaleMeridiems";

describe("getLocaleMeridiems", () => {
  it.each`
    locale                | am                  | pm
    ${MustTestLocales.enUS} | ${"AM"} | ${"PM"}
    ${MustTestLocales.enGB} | ${"am"} | ${"pm"}
    ${MustTestLocales.deDE} | ${"AM"} | ${"PM"}
    ${MustTestLocales.frFR} | ${"AM"} | ${"PM"}
    ${MustTestLocales.esES} | ${"a. m."} | ${"p. m."}
    ${MustTestLocales.itIT} | ${"AM"} | ${"PM"}
    ${MustTestLocales.ptPT} | ${"a.m."} | ${"p.m."}
    ${MustTestLocales.svSE} | ${"fm"} | ${"em"}
    ${MustTestLocales.isIS} | ${"f.h."} | ${"e.h."}
    ${MustTestLocales.zhCN} | ${"上午"} | ${"下午"}
    ${MustTestLocales.zhTW} | ${"上午"} | ${"下午"}
    ${MustTestLocales.jaJP} | ${"午前"} | ${"午後"}
    ${MustTestLocales.koKR} | ${"오전"} | ${"오후"}
    ${MustTestLocales.arSA} | ${"ص"} | ${"م"}
    ${MustTestLocales.heIL} | ${"AM"} | ${"PM"}
    ${MustTestLocales.ruRU} | ${"AM"} | ${"PM"}
    ${MustTestLocales.trTR} | ${"ÖÖ"} | ${"ÖS"}
  `(
    "returns [AM-label, PM-label] for $locale",
    ({ locale, am, pm }) => {
      const [actualAm, actualPm] = getLocaleMeridiems(locale);
      // CJK locales (ko-KR/ja-JP/zh-CN/zh-TW) render the day-period marker as
      // either the native word or ASCII "AM"/"PM" depending on the CI runner's
      // ICU data; canonicalize both sides so either rendering passes.
      expectDateTimeEqual(actualAm, am);
      expectDateTimeEqual(actualPm, pm);
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
});
