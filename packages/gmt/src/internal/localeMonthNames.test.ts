import { MustTestLocales } from "../test";
import { expectOneOfIcu, oneOfIcu } from "../test/icuVariants";
import { localeMonthNames } from "./localeMonthNames";

const overrides = vi.hoisted(() => ({
  standAlone: null as string[] | null,
}));

vi.mock("../plain/locale/getLocaleMonthNames", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../plain/locale/getLocaleMonthNames")
    >();
  return {
    ...actual,
    getLocaleMonthNames: (
      ...args: Parameters<typeof actual.getLocaleMonthNames>
    ) => overrides.standAlone ?? actual.getLocaleMonthNames(...args),
  };
});

describe("localeMonthNames", () => {
  // March is index 2. Format-context and stand-alone names, UTS #35 Part 4
  // (Date Field Symbol Table, Month rows); a locale that writes no month name
  // next to a day number (pt-PT short, zh-CN, zh-TW, ja-JP) falls back to the
  // stand-alone name.
  it.each`
    locale                  | width      | format     | standAlone | formatIcuVariant
    ${MustTestLocales.enUS} | ${"long"}  | ${"March"} | ${"March"} | ${""}
    ${MustTestLocales.enUS} | ${"short"} | ${"Mar"}   | ${"Mar"}   | ${""}
    ${MustTestLocales.enGB} | ${"long"}  | ${"March"} | ${"March"} | ${""}
    ${MustTestLocales.enGB} | ${"short"} | ${"Mar"}   | ${"Mar"}   | ${""}
    ${MustTestLocales.deDE} | ${"long"}  | ${"März"}  | ${"März"}  | ${""}
    ${MustTestLocales.deDE} | ${"short"} | ${"März"}  | ${"Mär"}   | ${""}
    ${MustTestLocales.frFR} | ${"long"}  | ${"mars"}  | ${"mars"}  | ${""}
    ${MustTestLocales.frFR} | ${"short"} | ${"mars"}  | ${"mars"}  | ${""}
    ${MustTestLocales.esES} | ${"long"}  | ${"marzo"} | ${"marzo"} | ${""}
    ${MustTestLocales.esES} | ${"short"} | ${"mar"}   | ${"mar"}   | ${""}
    ${MustTestLocales.itIT} | ${"long"}  | ${"marzo"} | ${"marzo"} | ${""}
    ${MustTestLocales.itIT} | ${"short"} | ${"mar"}   | ${"mar"}   | ${""}
    ${MustTestLocales.ptPT} | ${"long"}  | ${"março"} | ${"março"} | ${""}
    ${MustTestLocales.ptPT} | ${"short"} | ${"mar."}  | ${"mar."}  | ${""}
    ${MustTestLocales.svSE} | ${"long"}  | ${"mars"}  | ${"mars"}  | ${""}
    ${MustTestLocales.svSE} | ${"short"} | ${"mars"}  | ${"mars"}  | ${""}
    ${MustTestLocales.isIS} | ${"long"}  | ${"mars"}  | ${"mars"}  | ${""}
    ${MustTestLocales.isIS} | ${"short"} | ${"mar."}  | ${"mar."}  | ${""}
    ${MustTestLocales.zhCN} | ${"long"}  | ${"三月"}  | ${"三月"}  | ${""}
    ${MustTestLocales.zhCN} | ${"short"} | ${"3月"}   | ${"3月"}   | ${""}
    ${MustTestLocales.zhTW} | ${"long"}  | ${"3月"}   | ${"3月"}   | ${""}
    ${MustTestLocales.zhTW} | ${"short"} | ${"3月"}   | ${"3月"}   | ${""}
    ${MustTestLocales.jaJP} | ${"long"}  | ${"3月"}   | ${"3月"}   | ${""}
    ${MustTestLocales.jaJP} | ${"short"} | ${"3月"}   | ${"3月"}   | ${""}
    ${MustTestLocales.koKR} | ${"long"}  | ${"3월"}   | ${"3월"}   | ${""}
    ${MustTestLocales.koKR} | ${"short"} | ${"3월"}   | ${"3월"}   | ${""}
    ${MustTestLocales.arSA} | ${"long"}  | ${"مارس"}  | ${"مارس"}  | ${""}
    ${MustTestLocales.arSA} | ${"short"} | ${"مارس"}  | ${"مارس"}  | ${""}
    ${MustTestLocales.heIL} | ${"long"}  | ${"מרץ"}   | ${"מרץ"}   | ${""}
    ${MustTestLocales.heIL} | ${"short"} | ${"מרץ"}   | ${"מרץ"}   | ${""}
    ${MustTestLocales.ruRU} | ${"long"}  | ${"марта"} | ${"март"}  | ${""}
    ${MustTestLocales.ruRU} | ${"short"} | ${"мар."}  | ${"март"}  | ${"марта"}
    ${MustTestLocales.trTR} | ${"long"}  | ${"Mart"}  | ${"Mart"}  | ${""}
    ${MustTestLocales.trTR} | ${"short"} | ${"Mar"}   | ${"Mar"}   | ${""}
  `(
    "names March for $locale at width $width: format $format, stand-alone $standAlone",
    ({ locale, width, format, standAlone, formatIcuVariant }) => {
      const names = localeMonthNames(locale, width);
      expect(names?.format).toHaveLength(12);
      expect(names?.standAlone).toHaveLength(12);
      // WebKit's ICU prints the long genitive `марта` for the ru-RU short form.
      expectOneOfIcu(
        names?.format[2] ?? "",
        oneOfIcu(
          format,
          ...(formatIcuVariant === "" ? [] : [formatIcuVariant]),
        ),
      );
      expect(names?.standAlone[2]).toBe(standAlone);
    },
  );

  it("lists the ru-RU long format names, which are genitive", () => {
    expect(localeMonthNames("ru-RU", "long")?.format).toEqual([
      "января",
      "февраля",
      "марта",
      "апреля",
      "мая",
      "июня",
      "июля",
      "августа",
      "сентября",
      "октября",
      "ноября",
      "декабря",
    ]);
  });

  it("lists the ru-RU short format names that differ from the stand-alone ones", () => {
    // Chromium prints `мар.`, `июн.`, `июл.`; WebKit's ICU prints the long genitive
    // `марта`, `июня`, `июля`. `мая` is the same in both.
    const names = localeMonthNames("ru-RU", "short")?.format ?? [];
    expectOneOfIcu(names[2] ?? "", oneOfIcu("мар.", "марта"));
    expect(names[4]).toBe("мая");
    expectOneOfIcu(names[5] ?? "", oneOfIcu("июн.", "июня"));
    expectOneOfIcu(names[6] ?? "", oneOfIcu("июл.", "июля"));
  });

  it("lists the de-DE short format names", () => {
    const names = localeMonthNames("de-DE", "short")?.format ?? [];
    expect(names.slice(0, 3)).toEqual(["Jan.", "Feb.", "März"]);
    // Node ICU 78.3, Chromium 153 and WebKit 26.6 all print `Sept.`.
    expect(names[8]).toBe("Sept.");
    expect(names[11]).toBe("Dez.");
  });

  it("lists the zh-CN hanidec short format names as the stand-alone ones", () => {
    // Hanidec prints the short month number as 一, 二, …, 一二 (Lo and Nl, not Nd), so a
    // numeric format month must still reach the stand-alone fallback. Intl.DateTimeFormat
    // with month "short" for this locale prints "1月" … "12月".
    const expected = [
      "1月",
      "2月",
      "3月",
      "4月",
      "5月",
      "6月",
      "7月",
      "8月",
      "9月",
      "10月",
      "11月",
      "12月",
    ];
    const names = localeMonthNames("zh-CN-u-nu-hanidec", "short");
    expect(names?.standAlone).toEqual(expected);
    expect(names?.format).toEqual(expected);
  });

  it("returns null for an ill-formed locale", () => {
    expect(localeMonthNames("not-a-locale-!!", "long")).toBeNull();
  });

  it("returns null when one name stands for two months across both lists", () => {
    overrides.standAlone = [
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H",
      "I",
      "J",
      "K",
      "L",
    ];
    try {
      // The en-US format name for month 1 is "Jan"; make stand-alone month 2 "jan".
      overrides.standAlone[1] = "jan";
      expect(localeMonthNames("en-US", "short")).toBeNull();
    } finally {
      overrides.standAlone = null;
    }
  });
});
