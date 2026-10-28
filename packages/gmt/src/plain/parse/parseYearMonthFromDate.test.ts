import { Temporal } from "../../internal/temporal";
import { isValidYearMonth } from "../validate";
import { parseYearMonth } from "./parseYearMonth";
import { parseYearMonthFromDate } from "./parseYearMonthFromDate";

describe("parseYearMonthFromDate", () => {
  it.each`
    value                         | expected        | why
    ${"2026-10-01"}               | ${"2026-10"}    | ${"first day of month"}
    ${"2026-10-31"}               | ${"2026-10"}    | ${"last day, same year-month as the first"}
    ${"2024-02-29"}               | ${"2024-02"}    | ${"leap day"}
    ${"2026-01-01"}               | ${"2026-01"}    | ${"first day of year"}
    ${"2026-12-31"}               | ${"2026-12"}    | ${"last day of year"}
    ${"0000-01-01"}               | ${"0000-01"}    | ${"year 0"}
    ${"-000001-12-31"}            | ${"-000001-12"} | ${"negative year"}
    ${"-271821-04-19"}            | ${"-271821-04"} | ${"lowest PlainDate"}
    ${"+275760-09-13"}            | ${"+275760-09"} | ${"highest PlainDate"}
    ${"+002026-10-01"}            | ${"2026-10"}    | ${"six-digit input, canonical output"}
    ${"2026-10-01[u-ca=iso8601]"} | ${"2026-10"}    | ${"lowercase iso annotation"}
    ${"2026-10-01[u-ca=ISO8601]"} | ${"2026-10"}    | ${"uppercase iso annotation"}
  `("returns $expected for date $value ($why)", ({ value, expected }) => {
    const result = parseYearMonthFromDate(value);
    expect(result).toBe(expected);
    expect(isValidYearMonth(result)).toBe(true);
    expect(parseYearMonth(result)).toBe(result);
  });

  it.each`
    label                          | value                        | why
    ${`"2026-10-01[u-ca=hebrew]"`} | ${"2026-10-01[u-ca=hebrew]"} | ${"not ISO"}
    ${`"2023-02-29"`}              | ${"2023-02-29"}              | ${"not a leap year"}
    ${`"2026-10-32"`}              | ${"2026-10-32"}              | ${"no such day"}
    ${`"-271821-04-18"`}           | ${"-271821-04-18"}           | ${"below PlainDate limit"}
    ${`"+275760-09-14"`}           | ${"+275760-09-14"}           | ${"above PlainDate limit"}
    ${`"2026-10-01T10:00:00"`}     | ${"2026-10-01T10:00:00"}     | ${"date-time"}
    ${`"2026-10-01Z"`}             | ${"2026-10-01Z"}             | ${"UTC designator"}
    ${`"2024-02-30"`}              | ${"2024-02-30"}              | ${"no such day in a leap year"}
    ${`"2026-10"`}                 | ${"2026-10"}                 | ${"year-month"}
    ${`"20261001"`}                | ${"20261001"}                | ${"basic form"}
    ${`"--10-01"`}                 | ${"--10-01"}                 | ${"month-day"}
    ${`""`}                        | ${""}                        | ${"empty string"}
    ${`20261001`}                  | ${20261001}                  | ${"number"}
    ${`null`}                      | ${null}                      | ${"null"}
    ${`undefined`}                 | ${undefined}                 | ${"undefined"}
  `("returns empty string for $label ($why)", ({ value }) => {
    expect(parseYearMonthFromDate(value)).toBe("");
  });

  it("returns empty string when Temporal.PlainDate#toPlainYearMonth throws", () => {
    const spy = vi
      .spyOn(Temporal.PlainDate.prototype, "toPlainYearMonth")
      .mockImplementation(() => {
        throw new Error("simulated failure");
      });
    try {
      expect(parseYearMonthFromDate("2024-02-29")).toBe("");
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});
