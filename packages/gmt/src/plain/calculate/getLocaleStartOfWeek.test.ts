import { MustTestLocales } from "../../test";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { getLocaleStartOfWeek } from "./getLocaleStartOfWeek";

describe("getLocaleStartOfWeek", () => {
  // Full week coverage for a Sunday-first locale (en-US, firstDay 7).
  it.each`
    value           | expected
    ${"2024-02-25"} | ${"2024-02-25"}
    ${"2024-02-26"} | ${"2024-02-25"}
    ${"2024-02-27"} | ${"2024-02-25"}
    ${"2024-02-28"} | ${"2024-02-25"}
    ${"2024-02-29"} | ${"2024-02-25"}
    ${"2024-03-01"} | ${"2024-02-25"}
    ${"2024-03-02"} | ${"2024-02-25"}
    ${"2024-03-03"} | ${"2024-03-03"}
  `(
    "returns $expected for $value in en-US (Sunday-first)",
    ({ value, expected }) => {
      expect(getLocaleStartOfWeek(value, MustTestLocales.enUS)).toBe(expected);
    },
  );

  // Full week coverage for a Monday-first locale (fr-FR, firstDay 1).
  it.each`
    value           | expected
    ${"2024-02-25"} | ${"2024-02-19"}
    ${"2024-02-26"} | ${"2024-02-26"}
    ${"2024-02-27"} | ${"2024-02-26"}
    ${"2024-02-28"} | ${"2024-02-26"}
    ${"2024-02-29"} | ${"2024-02-26"}
    ${"2024-03-01"} | ${"2024-02-26"}
    ${"2024-03-02"} | ${"2024-02-26"}
    ${"2024-03-03"} | ${"2024-02-26"}
  `(
    "returns $expected for $value in fr-FR (Monday-first)",
    ({ value, expected }) => {
      expect(getLocaleStartOfWeek(value, MustTestLocales.frFR)).toBe(expected);
    },
  );

  // One representative Thursday (2024-02-29) check per must-test locale.
  // firstDay: 7 (Sunday-first) -> enUS, ptPT, zhTW, jaJP, koKR, arSA, heIL.
  // firstDay: 1 (Monday-first) -> the rest.
  // is-IS is intentionally excluded from this static table: its weekInfo.firstDay
  // is CLDR-version-dependent (Monday on ICU 77 / Node 20, Sunday on ICU 78 /
  // Node 24), unlike every other locale here, which is stable across the
  // Node 20/22/24 range this package supports. Asserted dynamically below instead.
  it.each`
    locale                  | expected
    ${MustTestLocales.enUS} | ${"2024-02-25"}
    ${MustTestLocales.enGB} | ${"2024-02-26"}
    ${MustTestLocales.deDE} | ${"2024-02-26"}
    ${MustTestLocales.frFR} | ${"2024-02-26"}
    ${MustTestLocales.esES} | ${"2024-02-26"}
    ${MustTestLocales.itIT} | ${"2024-02-26"}
    ${MustTestLocales.ptPT} | ${"2024-02-25"}
    ${MustTestLocales.svSE} | ${"2024-02-26"}
    ${MustTestLocales.zhCN} | ${"2024-02-26"}
    ${MustTestLocales.zhTW} | ${"2024-02-25"}
    ${MustTestLocales.jaJP} | ${"2024-02-25"}
    ${MustTestLocales.koKR} | ${"2024-02-25"}
    ${MustTestLocales.arSA} | ${"2024-02-25"}
    ${MustTestLocales.heIL} | ${"2024-02-25"}
    ${MustTestLocales.ruRU} | ${"2024-02-26"}
    ${MustTestLocales.trTR} | ${"2024-02-26"}
  `(
    "returns $expected for Thursday 2024-02-29 in $locale",
    ({ locale, expected }) => {
      expect(getLocaleStartOfWeek("2024-02-29", locale)).toBe(expected);
    },
  );

  it("returns the correct start-of-week for is-IS regardless of its CLDR-version-dependent firstDay", () => {
    const firstDay = new Intl.Locale(MustTestLocales.isIS).weekInfo.firstDay;
    const expected = firstDay === 1 ? "2024-02-26" : "2024-02-25";
    expect(getLocaleStartOfWeek("2024-02-29", MustTestLocales.isIS)).toBe(
      expected,
    );
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
  `('returns "" for invalid value $value', ({ value }) => {
    expect(getLocaleStartOfWeek(value, MustTestLocales.enUS)).toBe("");
  });

  it.each`
    locale
    ${"not-a-locale-!!"}
    ${""}
    ${null}
    ${undefined}
  `('returns "" for invalid locale $locale', ({ locale }) => {
    expect(getLocaleStartOfWeek("2024-02-29", locale)).toBe("");
  });

  it('returns "" when Temporal.PlainDate.from throws', () => {
    mockTemporalPlainDateFromThrow();
    expect(getLocaleStartOfWeek("2024-02-29", MustTestLocales.enUS)).toBe("");
  });
});
