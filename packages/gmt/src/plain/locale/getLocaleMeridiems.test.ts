import { describe, expect, it } from "vitest";
import {
  MustTestLocales,
  expectDateTimeEqual,
  expectOneOfDateTimeIcu,
  oneOfIcu,
} from "../../test";
import { getLocaleMeridiems } from "./getLocaleMeridiems";

// es-ES's AM/PM markers use a space between "a."/"p." and "m." whose
// exact character varies by ICU version: a regular space, U+00A0
// (no-break space, ICU 77/Node 20-22), and U+202F (narrow no-break
// space, ICU 78/Node 24+) have all been observed. Spelled out with
// explicit escapes (rather than literal invisible characters) so the
// distinction survives editors/diffs that normalize whitespace.
const esAm = ["a. m.", "a.\u00a0m.", "a.\u202fm."];
const esPm = ["p. m.", "p.\u00a0m.", "p.\u202fm."];

describe("getLocaleMeridiems", () => {
  it.each`
    locale                  | am                              | pm
    ${MustTestLocales.enUS} | ${oneOfIcu("AM")}               | ${oneOfIcu("PM")}
    ${MustTestLocales.enGB} | ${oneOfIcu("am")}               | ${oneOfIcu("pm")}
    ${MustTestLocales.deDE} | ${oneOfIcu("AM")}               | ${oneOfIcu("PM")}
    ${MustTestLocales.frFR} | ${oneOfIcu("AM")}               | ${oneOfIcu("PM")}
    ${MustTestLocales.esES} | ${oneOfIcu(...esAm)}            | ${oneOfIcu(...esPm)}
    ${MustTestLocales.itIT} | ${oneOfIcu("AM")}               | ${oneOfIcu("PM")}
    ${MustTestLocales.ptPT} | ${oneOfIcu("a.m.", "da manhã")} | ${oneOfIcu("p.m.", "da tarde")}
    ${MustTestLocales.svSE} | ${oneOfIcu("fm")}               | ${oneOfIcu("em")}
    ${MustTestLocales.isIS} | ${oneOfIcu("f.h.")}             | ${oneOfIcu("e.h.")}
    ${MustTestLocales.zhCN} | ${oneOfIcu("上午")}             | ${oneOfIcu("下午")}
    ${MustTestLocales.zhTW} | ${oneOfIcu("上午")}             | ${oneOfIcu("下午")}
    ${MustTestLocales.jaJP} | ${oneOfIcu("午前")}             | ${oneOfIcu("午後")}
    ${MustTestLocales.koKR} | ${oneOfIcu("오전")}             | ${oneOfIcu("오후")}
    ${MustTestLocales.arSA} | ${oneOfIcu("ص")}                | ${oneOfIcu("م")}
    ${MustTestLocales.heIL} | ${oneOfIcu("AM")}               | ${oneOfIcu("PM")}
    ${MustTestLocales.ruRU} | ${oneOfIcu("AM")}               | ${oneOfIcu("PM")}
    ${MustTestLocales.trTR} | ${oneOfIcu("ÖÖ")}               | ${oneOfIcu("ÖS")}
  `("returns [AM-label, PM-label] for $locale", ({ locale, am, pm }) => {
    const [actualAm, actualPm] = getLocaleMeridiems(locale);
    // CJK locales (ko-KR/ja-JP/zh-CN/zh-TW) render the day-period marker as
    // either the native word or ASCII "AM"/"PM" depending on the runtime's
    // ICU data; pt-PT's wording ("da manhã"/"da tarde" -> "a.m."/"p.m.")
    // and es-ES's inter-word space character also vary between ICU 77
    // (Node 20) and ICU 78 (Node 22+) — see `test/icuVariants.ts`.
    // `expectOneOfDateTimeIcu` tolerates all of these without masking an
    // actual regression.
    expectOneOfDateTimeIcu(actualAm, am);
    expectOneOfDateTimeIcu(actualPm, pm);
  });

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
