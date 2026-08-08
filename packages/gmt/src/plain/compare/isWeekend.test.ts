import { MustTestLocales } from "../../test";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { isWeekend } from "./isWeekend";

describe("isWeekend", () => {
  // Full week boundary coverage for a Saturday/Sunday-weekend locale.
  it.each`
    value           | expected
    ${"2024-02-02"} | ${false}
    ${"2024-02-03"} | ${true}
    ${"2024-02-04"} | ${true}
    ${"2024-02-05"} | ${false}
    ${"2024-02-06"} | ${false}
    ${"2024-02-07"} | ${false}
    ${"2024-02-08"} | ${false}
  `(
    "returns $expected for $value in en-US (Sat/Sun weekend)",
    ({ value, expected }) => {
      expect(isWeekend(value, MustTestLocales.enUS)).toBe(expected);
    },
  );

  // Full week boundary coverage for a Friday/Saturday-weekend locale.
  it.each`
    value           | expected
    ${"2024-02-02"} | ${true}
    ${"2024-02-03"} | ${true}
    ${"2024-02-04"} | ${false}
    ${"2024-02-05"} | ${false}
    ${"2024-02-06"} | ${false}
    ${"2024-02-07"} | ${false}
    ${"2024-02-08"} | ${false}
  `(
    "returns $expected for $value in he-IL (Fri/Sat weekend)",
    ({ value, expected }) => {
      expect(isWeekend(value, MustTestLocales.heIL)).toBe(expected);
    },
  );

  // One representative Saturday check per must-test locale.
  it.each`
    locale                  | expected
    ${MustTestLocales.enUS} | ${true}
    ${MustTestLocales.enGB} | ${true}
    ${MustTestLocales.deDE} | ${true}
    ${MustTestLocales.frFR} | ${true}
    ${MustTestLocales.esES} | ${true}
    ${MustTestLocales.itIT} | ${true}
    ${MustTestLocales.ptPT} | ${true}
    ${MustTestLocales.svSE} | ${true}
    ${MustTestLocales.isIS} | ${true}
    ${MustTestLocales.zhCN} | ${true}
    ${MustTestLocales.zhTW} | ${true}
    ${MustTestLocales.jaJP} | ${true}
    ${MustTestLocales.koKR} | ${true}
    ${MustTestLocales.arSA} | ${true}
    ${MustTestLocales.heIL} | ${true}
    ${MustTestLocales.ruRU} | ${true}
    ${MustTestLocales.trTR} | ${true}
  `(
    "returns $expected for Saturday 2024-02-03 in $locale",
    ({ locale, expected }) => {
      expect(isWeekend("2024-02-03", locale)).toBe(expected);
    },
  );

  // Sunday: distinguishes Fri/Sat-weekend locales (ar-SA, he-IL) from the rest.
  it.each`
    locale                  | expected
    ${MustTestLocales.enUS} | ${true}
    ${MustTestLocales.arSA} | ${false}
    ${MustTestLocales.heIL} | ${false}
  `(
    "returns $expected for Sunday 2024-02-04 in $locale",
    ({ locale, expected }) => {
      expect(isWeekend("2024-02-04", locale)).toBe(expected);
    },
  );

  it.each`
    value
    ${"invalid-date"}
    ${"2024-02-30"}
    ${"2024-02-29T00:00:00"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `("returns false for invalid value $value", ({ value }) => {
    expect(isWeekend(value, MustTestLocales.enUS)).toBe(false);
  });

  it.each`
    locale
    ${"not-a-locale-!!"}
    ${""}
    ${null}
    ${undefined}
  `("returns false for invalid locale $locale", ({ locale }) => {
    expect(isWeekend("2024-02-03", locale)).toBe(false);
  });

  it("returns false when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(isWeekend("2024-02-03", MustTestLocales.enUS)).toBe(false);
  });
});
