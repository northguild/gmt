import { getLocaleEraNames } from "./getLocaleEraNames";
import { getLocaleMonthNames } from "./getLocaleMonthNames";
import { getLocaleWeekdayNames } from "./getLocaleWeekdayNames";

// The style is `"long"`, `"short"` or `"narrow"`; an omitted style is `"long"`. Any other value
// is not a style: ECMA-402 GetOption throws RangeError there, so GMT returns `[]`.
describe("the style of a locale name list", () => {
  it.each`
    style       | label
    ${"shortx"} | ${"a misspelt style"}
    ${"LONG"}   | ${"an upper-case style"}
    ${""}       | ${"an empty style"}
    ${null}     | ${"null"}
    ${5}        | ${"a number"}
    ${{}}       | ${"an object"}
  `("returns [] for $label", ({ style }) => {
    expect(getLocaleWeekdayNames("de-DE", style)).toEqual([]);
    expect(getLocaleMonthNames("de-DE", style)).toEqual([]);
    expect(getLocaleEraNames("de-DE", style)).toEqual([]);
  });

  it("reads an omitted style as long", () => {
    expect(getLocaleWeekdayNames("de-DE", undefined)).toEqual(
      getLocaleWeekdayNames("de-DE", "long"),
    );
    expect(getLocaleMonthNames("de-DE", undefined)).toHaveLength(12);
    expect(getLocaleEraNames("de-DE", undefined)).toHaveLength(2);
  });
});
