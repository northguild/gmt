import { Temporal } from "../../internal/temporal";
import { mockTemporalPlainMonthDayFromThrow } from "../../test/mocks";
import { parseMonthDay } from "../parse/parseMonthDay";
import { parseMonthDayFromDate } from "../parse/parseMonthDayFromDate";
import { monthDayToDate } from "./monthDayToDate";

describe("monthDayToDate", () => {
  it.each`
    monthDay                   | year        | expected           | why
    ${"--12-25"}               | ${2024}     | ${"2024-12-25"}    | ${"extended form"}
    ${"12-25"}                 | ${2024}     | ${"2024-12-25"}    | ${"input form"}
    ${"--12-25[u-ca=ISO8601]"} | ${2024}     | ${"2024-12-25"}    | ${"D20 annotation"}
    ${"--02-29"}               | ${2024}     | ${"2024-02-29"}    | ${"leap year"}
    ${"--02-29"}               | ${2023}     | ${"2023-02-28"}    | ${"constrain: not a leap year"}
    ${"--02-29"}               | ${1900}     | ${"1900-02-28"}    | ${"century that is not a leap year"}
    ${"--02-29"}               | ${2000}     | ${"2000-02-29"}    | ${"divisible by 400"}
    ${"--02-29"}               | ${2100}     | ${"2100-02-28"}    | ${"century that is not a leap year"}
    ${"--02-28"}               | ${2023}     | ${"2023-02-28"}    | ${"no constrain needed"}
    ${"--01-01"}               | ${2024}     | ${"2024-01-01"}    | ${"first day"}
    ${"--12-31"}               | ${2024}     | ${"2024-12-31"}    | ${"last day"}
    ${"--12-25"}               | ${0}        | ${"0000-12-25"}    | ${"year 0 is 1 BCE"}
    ${"--12-25"}               | ${-0}       | ${"0000-12-25"}    | ${"negative zero is an integer"}
    ${"--12-25"}               | ${-1}       | ${"-000001-12-25"} | ${"six-digit signed year"}
    ${"--12-25"}               | ${10_000}   | ${"+010000-12-25"} | ${"five digits need a sign"}
    ${"--04-19"}               | ${-271_821} | ${"-271821-04-19"} | ${"lowest PlainDate"}
    ${"--09-13"}               | ${275_760}  | ${"+275760-09-13"} | ${"highest PlainDate"}
  `(
    "returns $expected for $monthDay in $year ($why)",
    ({ monthDay, year, expected }) => {
      expect(monthDayToDate(monthDay, year)).toBe(expected);
    },
  );

  it.each`
    label                                     | monthDay                   | year                        | why
    ${'"--04-18" / -271_821'}                 | ${"--04-18"}               | ${-271_821}                 | ${"below the range"}
    ${'"--09-14" / 275_760'}                  | ${"--09-14"}               | ${275_760}                  | ${"above the range"}
    ${'"--12-25" / 275_761'}                  | ${"--12-25"}               | ${275_761}                  | ${"year above the range"}
    ${'"--12-25" / -271_822'}                 | ${"--12-25"}               | ${-271_822}                 | ${"year below the range"}
    ${'"--12-25" / 1e21'}                     | ${"--12-25"}               | ${1e21}                     | ${"huge integer"}
    ${'"--12-25" / 2024.5'}                   | ${"--12-25"}               | ${2024.5}                   | ${"fraction"}
    ${'"--12-25" / Number.NaN'}               | ${"--12-25"}               | ${Number.NaN}               | ${"NaN"}
    ${'"--12-25" / Number.POSITIVE_INFINITY'} | ${"--12-25"}               | ${Number.POSITIVE_INFINITY} | ${"Infinity"}
    ${'"--12-25" / Number.NEGATIVE_INFINITY'} | ${"--12-25"}               | ${Number.NEGATIVE_INFINITY} | ${"-Infinity"}
    ${'"--12-25" / "2024"'}                   | ${"--12-25"}               | ${"2024"}                   | ${"string year"}
    ${'"--12-25" / 2024n'}                    | ${"--12-25"}               | ${2024n}                    | ${"bigint year"}
    ${'"--12-25" / null'}                     | ${"--12-25"}               | ${null}                     | ${"null year"}
    ${'"--12-25" / undefined'}                | ${"--12-25"}               | ${undefined}                | ${"undefined year"}
    ${'"--02-30" / 2024'}                     | ${"--02-30"}               | ${2024}                     | ${"no such day"}
    ${'"2024-12-25" / 2024'}                  | ${"2024-12-25"}            | ${2024}                     | ${"a date is not a month-day"}
    ${'"--12-25[u-ca=gregory]" / 2024'}       | ${"--12-25[u-ca=gregory]"} | ${2024}                     | ${"not ISO"}
    ${'"" / 2024'}                            | ${""}                      | ${2024}                     | ${"empty string"}
    ${"null / 2024"}                          | ${null}                    | ${2024}                     | ${"null month-day"}
    ${"undefined / 2024"}                     | ${undefined}               | ${2024}                     | ${"undefined month-day"}
    ${"20_241_225 / 2024"}                    | ${20_241_225}              | ${2024}                     | ${"number month-day"}
  `("returns '' for $label ($why)", ({ monthDay, year }) => {
    expect(monthDayToDate(monthDay, year)).toBe("");
  });

  it("returns '' when Temporal.PlainMonthDay.from throws", () => {
    mockTemporalPlainMonthDayFromThrow();
    expect(monthDayToDate("--12-25", 2024)).toBe("");
    vi.restoreAllMocks();
  });

  it("returns '' when PlainMonthDay.prototype.toPlainDate throws inside the try", () => {
    const spy = vi
      .spyOn(Temporal.PlainMonthDay.prototype, "toPlainDate")
      .mockImplementation(() => {
        throw new Error("simulated failure");
      });
    try {
      expect(monthDayToDate("--12-25", 2024)).toBe("");
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it.each`
    monthDay                   | year        | expected
    ${"--12-25"}               | ${2024}     | ${"2024-12-25"}
    ${"12-25"}                 | ${2024}     | ${"2024-12-25"}
    ${"--12-25[u-ca=ISO8601]"} | ${2024}     | ${"2024-12-25"}
    ${"--02-29"}               | ${2024}     | ${"2024-02-29"}
    ${"--02-29"}               | ${2023}     | ${"2023-02-28"}
    ${"--02-29"}               | ${1900}     | ${"1900-02-28"}
    ${"--02-29"}               | ${2000}     | ${"2000-02-29"}
    ${"--02-29"}               | ${2100}     | ${"2100-02-28"}
    ${"--02-28"}               | ${2023}     | ${"2023-02-28"}
    ${"--01-01"}               | ${2024}     | ${"2024-01-01"}
    ${"--12-31"}               | ${2024}     | ${"2024-12-31"}
    ${"--12-25"}               | ${0}        | ${"0000-12-25"}
    ${"--12-25"}               | ${-0}       | ${"0000-12-25"}
    ${"--12-25"}               | ${-1}       | ${"-000001-12-25"}
    ${"--12-25"}               | ${10_000}   | ${"+010000-12-25"}
    ${"--04-19"}               | ${-271_821} | ${"-271821-04-19"}
    ${"--09-13"}               | ${275_760}  | ${"+275760-09-13"}
  `(
    "round-trips $monthDay in $year to the month-day of $expected",
    ({ monthDay, year, expected }) => {
      const result = monthDayToDate(monthDay, year);
      expect(result).toBe(expected);
      // The month-day of the date is the input, except 29 February in a common year.
      const constrained =
        expected.endsWith("-02-28") && monthDay.includes("02-29")
          ? "--02-28"
          : parseMonthDay(monthDay);
      expect(parseMonthDayFromDate(result)).toBe(constrained);
    },
  );

  describe("all 366 month-days", () => {
    const all = Array.from({ length: 366 }, (_, i) =>
      Temporal.PlainDate.from("2024-01-01").add({ days: i }).toPlainMonthDay(),
    );

    it("has 366 distinct month-days", () => {
      expect(new Set(all.map((md) => md.toString())).size).toBe(366);
    });

    it("year 2024 gives a date whose month-day is the input", () => {
      const mismatches = all.filter(
        (md) =>
          !Temporal.PlainDate.from(monthDayToDate(md.toString(), 2024))
            .toPlainMonthDay()
            .equals(md),
      );
      expect(mismatches).toHaveLength(0);
    });

    it("year 2023 keeps every month-day but --02-29", () => {
      const mismatches = all
        .filter(
          (md) =>
            !Temporal.PlainDate.from(monthDayToDate(md.toString(), 2023))
              .toPlainMonthDay()
              .equals(md),
        )
        .map((md) => md.toString());
      expect(mismatches).toEqual(["02-29"]);
    });
  });
});
