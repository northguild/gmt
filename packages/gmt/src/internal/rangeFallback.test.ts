import { fallbackTemplate, joinFallback, readTemplate } from "./rangeFallback";

/*
 * CORE-112 slice 7, D25 and D29: the text between two dates of a fallback range (UTS #35
 * `intervalFormatFallback`, ECMA-402 PartitionDateTimeRangePattern). GMT owns no joiner: it is the
 * text a helper range prints around its two single texts, in one of three shapes.
 */
describe("readTemplate", () => {
  it.each`
    range                         | first          | last            | prefix   | joiner    | suffix       | shape
    ${"6/15/2024 – 6/17/2024"}    | ${"6/15/2024"} | ${"6/17/2024"}  | ${""}    | ${" – "}  | ${""}        | ${"the two singles and a joiner"}
    ${"15/6 – 17/6 15:00"}        | ${"15/6"}      | ${"17/6 15:00"} | ${""}    | ${" – "}  | ${""}        | ${"the two singles and a joiner, the second with a time"}
    ${"du 15/06 au 17/06 inclus"} | ${"15/06"}     | ${"17/06"}      | ${"du "} | ${" au "} | ${" inclus"} | ${"the singles inside words"}
  `(
    "reads prefix '$prefix', joiner '$joiner' and suffix '$suffix' from $shape",
    ({ range, first, last, prefix, joiner, suffix }) => {
      expect(readTemplate(range, first, last)).toEqual({
        prefix,
        joiner,
        suffix,
      });
    },
  );

  it("reads the joiner of a block written twice when the singles differ in form", () => {
    expect(
      readTemplate("15.06. 13:25 – 17.06. 13:25", "15.06.", "17.06."),
    ).toEqual({
      prefix: "",
      joiner: " – ",
      suffix: "",
    });
  });

  it("answers null for a range that holds neither single", () => {
    expect(readTemplate("xyz", "a1", "b2")).toBeNull();
  });
});

describe("fallbackTemplate", () => {
  it.each`
    locale  | numberingSystem | calendar      | joiner
    ${"en"} | ${"latn"}       | ${"gregory"}  | ${/^\s*–\s*$/}
    ${"ja"} | ${"latn"}       | ${"gregory"}  | ${/^～$/}
    ${"en"} | ${"arab"}       | ${"gregory"}  | ${/^\s*–\s*$/}
    ${"en"} | ${"latn"}       | ${"japanese"} | ${/^\s*–\s*$/}
  `(
    "reads the joiner of '$locale' in $numberingSystem digits and $calendar",
    ({ locale, numberingSystem, calendar, joiner }) => {
      expect(
        fallbackTemplate(locale, numberingSystem, calendar)?.joiner,
      ).toMatch(joiner);
    },
  );

  it("answers null for a locale the engine rejects", () => {
    expect(fallbackTemplate("not a locale", "latn", "gregory")).toBeNull();
  });
});

describe("joinFallback", () => {
  it("writes the prefix, the first text, the joiner, the last text and the suffix", () => {
    expect(
      joinFallback(
        { prefix: "du ", joiner: " au ", suffix: "!" },
        "15/06",
        "17/06",
      ),
    ).toBe("du 15/06 au 17/06!");
  });
});
