import { MustTestLocales } from "../../test";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { getWeeksInMonth } from "./getWeeksInMonth";
import { runtimeWeekInfo } from "../../test/runtimeWeekInfo";

describe("getWeeksInMonth", () => {
  // The same month spans a different number of week-rows depending on
  // locale (whether the week starts Sunday or Monday).
  it.each`
    value           | locale                  | expected
    ${"2026-02-15"} | ${MustTestLocales.enUS} | ${4}
    ${"2026-02-15"} | ${MustTestLocales.enGB} | ${5}
    ${"2024-03-15"} | ${MustTestLocales.enUS} | ${6}
    ${"2024-03-15"} | ${MustTestLocales.enGB} | ${5}
    ${"2024-02-15"} | ${MustTestLocales.enUS} | ${5}
    ${"2024-02-15"} | ${MustTestLocales.enGB} | ${5}
  `(
    "returns $expected week-rows for $value in $locale",
    ({ value, locale, expected }) => {
      expect(getWeeksInMonth(value, locale)).toBe(expected);
    },
  );

  // Full 17-locale matrix: February 2026 spans 4 rows for Sunday-start
  // locales and 5 rows for Monday-start locales.
  it.each`
    locale                  | expected
    ${MustTestLocales.enUS} | ${4}
    ${MustTestLocales.enGB} | ${5}
    ${MustTestLocales.deDE} | ${5}
    ${MustTestLocales.frFR} | ${5}
    ${MustTestLocales.esES} | ${5}
    ${MustTestLocales.itIT} | ${5}
    ${MustTestLocales.ptPT} | ${4}
    ${MustTestLocales.svSE} | ${5}
    ${MustTestLocales.zhCN} | ${5}
    ${MustTestLocales.zhTW} | ${4}
    ${MustTestLocales.jaJP} | ${4}
    ${MustTestLocales.koKR} | ${4}
    ${MustTestLocales.arSA} | ${4}
    ${MustTestLocales.heIL} | ${4}
    ${MustTestLocales.ruRU} | ${5}
    ${MustTestLocales.trTR} | ${5}
  `(
    "returns $expected week-rows for 2026-02-15 in $locale",
    ({ locale, expected }) => {
      expect(getWeeksInMonth("2026-02-15", locale)).toBe(expected);
    },
  );

  it("returns the correct week-row count for is-IS regardless of its CLDR-version-dependent firstDay", () => {
    const firstDay = runtimeWeekInfo(MustTestLocales.isIS).firstDay;
    const expected = firstDay === 1 ? 5 : 4;
    expect(getWeeksInMonth("2026-02-15", MustTestLocales.isIS)).toBe(expected);
  });

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
  `("returns null for invalid value $value", ({ value }) => {
    expect(getWeeksInMonth(value, MustTestLocales.enUS)).toBeNull();
  });

  it.each`
    locale
    ${"not-a-locale-!!"}
    ${""}
    ${null}
    ${undefined}
  `("returns null for invalid locale $locale", ({ locale }) => {
    expect(getWeeksInMonth("2026-02-15", locale)).toBeNull();
  });

  // Range edges, from proleptic Gregorian day arithmetic (days-from-civil), not GMT. April -271821
  // began on a Thursday (before the first PlainDate, -271821-04-19) and has 30 days: 4 + 30 = 34
  // cells in a Sunday-first grid and 3 + 30 = 33 in a Monday-first one, 5 rows each. September
  // +275760 began on a Monday and has 30 days: 1 + 30 and 0 + 30 cells, 5 rows each.
  it.each`
    value              | locale                  | expected
    ${"-271821-04-19"} | ${MustTestLocales.enUS} | ${5}
    ${"-271821-04-19"} | ${MustTestLocales.deDE} | ${5}
    ${"+275760-09-13"} | ${MustTestLocales.enUS} | ${5}
    ${"+275760-09-13"} | ${MustTestLocales.deDE} | ${5}
  `(
    "returns $expected week rows for the range-edge month of $value in $locale",
    ({ value, locale, expected }) => {
      expect(getWeeksInMonth(value, locale)).toBe(expected);
    },
  );

  it("returns null when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(getWeeksInMonth("2026-02-15", MustTestLocales.enUS)).toBeNull();
  });
});
