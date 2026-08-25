import {
  ethiopicPagumenFixture,
  hebrewLeapYear5784,
  islamicVariantDivergence,
  japaneseEraBoundary,
  persianLeapYearFixture,
} from "../../test";
import { addDate } from "./addDate";

describe("addDate", () => {
  it.each`
    value           | units                                         | expected
    ${"2024-02-29"} | ${{ days: 1 }}                                | ${"2024-03-01"}
    ${"2024-02-29"} | ${{ weeks: 1 }}                               | ${"2024-03-07"}
    ${"2024-01-31"} | ${{ months: 1 }}                              | ${"2024-02-29"}
    ${"2024-02-29"} | ${{ years: 1 }}                               | ${"2025-02-28"}
    ${"2024-02-29"} | ${{ years: 1, months: 1, weeks: 1, days: 1 }} | ${"2025-04-06"}
  `("returns $expected for $value + $units", ({ value, units, expected }) => {
    expect(addDate(value, units)).toBe(expected);
  });

  it.each`
    negativeAmount                                    | expectedDate
    ${{ years: -1 }}                                  | ${"2023-02-28"}
    ${{ months: -1 }}                                 | ${"2024-01-29"}
    ${{ weeks: -1 }}                                  | ${"2024-02-22"}
    ${{ days: -1 }}                                   | ${"2024-02-28"}
    ${{ years: -1, months: -1, weeks: -1, days: -1 }} | ${"2023-01-21"}
  `(
    "returns the correct date when adding a negative amount: $negativeAmount",
    ({ negativeAmount, expectedDate }) => {
      expect(addDate("2024-02-29", negativeAmount)).toEqual(expectedDate);
    },
  );

  it.each`
    value           | units                      | expected
    ${"2024-01-01"} | ${{ days: 0 }}             | ${"2024-01-01"}
    ${"2024-02-29"} | ${{ days: 0 }}             | ${"2024-02-29"}
    ${"2024-01-01"} | ${{ months: 0, years: 0 }} | ${"2024-01-01"}
  `(
    "returns $expected for zero-unit $value + $units",
    ({ value, units, expected }) => {
      expect(addDate(value, units)).toBe(expected);
    },
  );

  it.each`
    invalidDate
    ${"2024-02-30"}
    ${"not-a-date"}
    ${"2024-13-01"}
    ${"2024-00-10"}
    ${""}
    ${true}
    ${null}
    ${undefined}
    ${"12"}
    ${"2024"}
    ${"2024-02"}
    ${"2024-02-29T12:00:00"}
    ${"2024-02-29T12:00:00Z"}
  `(
    "returns an empty string for an invalid date $invalidDate",
    ({ invalidDate }) => {
      expect(addDate(invalidDate, { days: 1 })).toEqual("");
    },
  );

  it.each`
    invalidUnit
    ${"invalid"}
    ${""}
    ${null}
    ${undefined}
  `("returns an empty string for an invalid unit", ({ invalidUnit }) => {
    expect(addDate("2024-02-29", { [invalidUnit as never]: 1 })).toEqual("");
  });

  it.each`
    invalidAmount
    ${"not-a-number"}
    ${NaN}
    ${null}
    ${undefined}
    ${true}
    ${false}
  `(
    "returns an empty string for an invalid amount: $invalidAmount",
    ({ invalidAmount }) => {
      expect(
        addDate("2024-02-29", { days: invalidAmount as never } as never),
      ).toEqual("");
    },
  );

  it.each`
    value           | units             | overflow       | expected
    ${"2024-01-31"} | ${{ months: 1 }}  | ${undefined}   | ${"2024-02-29"}
    ${"2024-01-31"} | ${{ months: 1 }}  | ${"constrain"} | ${"2024-02-29"}
    ${"2024-01-31"} | ${{ months: 1 }}  | ${"reject"}    | ${""}
    ${"2024-01-31"} | ${{ months: 13 }} | ${undefined}   | ${"2025-02-28"}
    ${"2024-01-31"} | ${{ months: 13 }} | ${"constrain"} | ${"2025-02-28"}
    ${"2024-01-31"} | ${{ months: 13 }} | ${"reject"}    | ${""}
    ${"2024-02-29"} | ${{ years: 1 }}   | ${undefined}   | ${"2025-02-28"}
    ${"2024-02-29"} | ${{ years: 1 }}   | ${"constrain"} | ${"2025-02-28"}
    ${"2024-02-29"} | ${{ years: 1 }}   | ${"reject"}    | ${""}
    ${"2024-01-15"} | ${{ months: 1 }}  | ${"reject"}    | ${"2024-02-15"}
    ${"2024-01-15"} | ${{ days: 1 }}    | ${"reject"}    | ${"2024-01-16"}
    ${"2024-03-31"} | ${{ months: -1 }} | ${undefined}   | ${"2024-02-29"}
    ${"2024-03-31"} | ${{ months: -1 }} | ${"constrain"} | ${"2024-02-29"}
    ${"2024-03-31"} | ${{ months: -1 }} | ${"reject"}    | ${""}
  `(
    "returns $expected for $value + $units with overflow $overflow",
    ({ value, units, overflow, expected }) => {
      expect(
        addDate(
          value,
          units,
          overflow === undefined ? undefined : { overflow },
        ),
      ).toBe(expected);
    },
  );

  // E5 (issue #78): addDate accepts a GMT calendar-annotated PlainDate string, resolves
  // calendar-unit arithmetic in that calendar, and re-derives the output tag (never copies
  // it) since arithmetic can cross a leap-month or era boundary. All goldens verified
  // directly against @js-temporal/polyfill during E5 research.
  it.each`
    value                                    | units            | options                      | expected                                | note
    ${hebrewLeapYear5784.adarI15}            | ${{ months: 1 }} | ${undefined}                 | ${hebrewLeapYear5784.adar15}            | ${"Adar I -> Adar (Hebrew leap month)"}
    ${japaneseEraBoundary.heisei31_0430}     | ${{ days: 1 }}   | ${undefined}                 | ${japaneseEraBoundary.reiwa1_0501}      | ${"Heisei -> Reiwa era transition"}
    ${islamicVariantDivergence.civil}        | ${{ months: 1 }} | ${undefined}                 | ${"1441-07-29[u-ca=islamic-civil]"}     | ${"islamic-civil variant"}
    ${islamicVariantDivergence.tabular}      | ${{ months: 1 }} | ${undefined}                 | ${"1441-08-01[u-ca=islamic-tabular]"}   | ${"islamic-tabular variant"}
    ${islamicVariantDivergence.umalqura}     | ${{ months: 1 }} | ${undefined}                 | ${"1441-07-29[u-ca=islamic-umalqura]"}  | ${"islamic-umalqura variant"}
    ${persianLeapYearFixture.month12day30_1403} | ${{ years: 1 }} | ${undefined}              | ${"1404-12-29[u-ca=persian]"}           | ${"Persian leap year -> non-leap (30 -> 29 day month 12)"}
    ${ethiopicPagumenFixture.m12d30_7515}    | ${{ months: 1 }} | ${{ overflow: "constrain" }} | ${ethiopicPagumenFixture.pagumen6_7515} | ${"30-day month 12 constrains into the 6-day leap Pagumen"}
  `(
    "returns $expected for calendar-annotated $value + $units ($note)",
    ({ value, units, options, expected }) => {
      expect(addDate(value, units, options)).toBe(expected);
    },
  );

  it("returns \"\" when overflow: \"reject\" hits the Ethiopic Pagumen boundary (the sharpest overflow case in the library)", () => {
    expect(
      addDate(
        ethiopicPagumenFixture.m12d30_7515,
        { months: 1 },
        { overflow: "reject" },
      ),
    ).toBe("");
  });

  it("returns \"\" for a datetime/zoned string instead of silently truncating to its date portion (parseCalendarDateValue regression, E5)", () => {
    expect(addDate("2024-03-10T14:30:00", { days: 1 })).toBe("");
  });
});
