import { Temporal } from "@js-temporal/polyfill";
import { MustTestLocales } from "../../test";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { getLocaleStartOfWeek } from "./getLocaleStartOfWeek";
import { runtimeWeekInfo } from "../../test/runtimeWeekInfo";

describe("getLocaleStartOfWeek", () => {
  it.each`
    value           | locale                  | expected
    ${"2024-02-25"} | ${MustTestLocales.enUS} | ${"2024-02-25"}
    ${"2024-02-26"} | ${MustTestLocales.enUS} | ${"2024-02-25"}
    ${"2024-02-27"} | ${MustTestLocales.enUS} | ${"2024-02-25"}
    ${"2024-02-28"} | ${MustTestLocales.enUS} | ${"2024-02-25"}
    ${"2024-02-29"} | ${MustTestLocales.enUS} | ${"2024-02-25"}
    ${"2024-03-01"} | ${MustTestLocales.enUS} | ${"2024-02-25"}
    ${"2024-03-02"} | ${MustTestLocales.enUS} | ${"2024-02-25"}
    ${"2024-03-03"} | ${MustTestLocales.enUS} | ${"2024-03-03"}
    ${"2024-02-25"} | ${MustTestLocales.frFR} | ${"2024-02-19"}
    ${"2024-02-26"} | ${MustTestLocales.frFR} | ${"2024-02-26"}
    ${"2024-02-27"} | ${MustTestLocales.frFR} | ${"2024-02-26"}
    ${"2024-02-28"} | ${MustTestLocales.frFR} | ${"2024-02-26"}
    ${"2024-02-29"} | ${MustTestLocales.frFR} | ${"2024-02-26"}
    ${"2024-03-01"} | ${MustTestLocales.frFR} | ${"2024-02-26"}
    ${"2024-03-02"} | ${MustTestLocales.frFR} | ${"2024-02-26"}
    ${"2024-03-03"} | ${MustTestLocales.frFR} | ${"2024-02-26"}
  `(
    "returns $expected for $value in $locale",
    ({ value, locale, expected }) => {
      expect(getLocaleStartOfWeek(value, locale)).toBe(expected);
    },
  );

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
    const firstDay = runtimeWeekInfo(MustTestLocales.isIS).firstDay;
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

  // A well-formed tag with no locale data is not invalid input: ECMA-402 `ResolveLocale` falls
  // back instead of throwing, so the sentinel would be wrong here. Only a malformed tag such as
  // "not-a-locale-!!" is invalid. The expected value comes from the runtime's own week data.
  it("falls back for a well-formed tag with no locale data instead of returning the sentinel", () => {
    const { firstDay } = runtimeWeekInfo("not-a-locale");
    const date = Temporal.PlainDate.from("2024-02-29");
    const offset = (date.dayOfWeek - firstDay + 7) % 7;
    expect(getLocaleStartOfWeek("2024-02-29", "not-a-locale")).toBe(
      date.subtract({ days: offset }).toString(),
    );
  });

  // ECMA-402 CanonicalizeLocaleList: `locale` may be a preference list; the first tag with locale
  // data is read (en-US weeks start on Sunday, fr-FR on Monday, ar-EG weekends are Friday and
  // Saturday: Intl.Locale#getWeekInfo), and a malformed tag anywhere in the list is invalid input.
  it.each`
    locale                                          | expected
    ${[MustTestLocales.enUS, MustTestLocales.frFR]} | ${"2024-05-12"}
    ${[MustTestLocales.frFR, MustTestLocales.enUS]} | ${"2024-05-13"}
    ${[MustTestLocales.frFR, "not a locale!!"]}     | ${""}
  `(
    "returns $expected for 2024-05-15 with locale list $locale",
    ({ locale, expected }) => {
      expect(getLocaleStartOfWeek("2024-05-15", locale)).toBe(expected);
    },
  );
});
