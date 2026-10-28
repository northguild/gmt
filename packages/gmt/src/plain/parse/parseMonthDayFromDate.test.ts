import { Temporal } from "../../internal/temporal";
import { isValidMonthDay } from "../validate";
import { parseMonthDay } from "./parseMonthDay";
import { parseMonthDayFromDate } from "./parseMonthDayFromDate";

describe("parseMonthDayFromDate", () => {
  it.each`
    value                         | expected     | why
    ${"2024-12-25"}               | ${"--12-25"} | ${"plain date"}
    ${"2024-02-29"}               | ${"--02-29"} | ${"leap day kept"}
    ${"2023-02-28"}               | ${"--02-28"} | ${"year dropped, non-leap"}
    ${"2024-02-28"}               | ${"--02-28"} | ${"year dropped, leap"}
    ${"2024-01-01"}               | ${"--01-01"} | ${"first day of year"}
    ${"2024-12-31"}               | ${"--12-31"} | ${"last day of year"}
    ${"-271821-04-19"}            | ${"--04-19"} | ${"lowest PlainDate"}
    ${"+275760-09-13"}            | ${"--09-13"} | ${"highest PlainDate"}
    ${"-000001-03-01"}            | ${"--03-01"} | ${"negative year"}
    ${"2024-12-25[u-ca=iso8601]"} | ${"--12-25"} | ${"lowercase iso annotation"}
    ${"2024-12-25[u-ca=ISO8601]"} | ${"--12-25"} | ${"uppercase iso annotation"}
  `("returns $expected for date $value ($why)", ({ value, expected }) => {
    const result = parseMonthDayFromDate(value);
    expect(result).toBe(expected);
    expect(isValidMonthDay(result)).toBe(true);
    expect(parseMonthDay(result)).toBe(result);
  });

  it.each`
    label                          | value                        | why
    ${`"2024-12-25[u-ca=hebrew]"`} | ${"2024-12-25[u-ca=hebrew]"} | ${"not ISO"}
    ${`"-271821-04-18"`}           | ${"-271821-04-18"}           | ${"below PlainDate limit"}
    ${`"+275760-09-14"`}           | ${"+275760-09-14"}           | ${"above PlainDate limit"}
    ${`"2024-02-30"`}              | ${"2024-02-30"}              | ${"no such day"}
    ${`"2023-02-29"`}              | ${"2023-02-29"}              | ${"not a leap year"}
    ${`"2024-12-25T10:00:00"`}     | ${"2024-12-25T10:00:00"}     | ${"date-time"}
    ${`"2024-12-25Z"`}             | ${"2024-12-25Z"}             | ${"UTC designator"}
    ${`"--12-25"`}                 | ${"--12-25"}                 | ${"month-day"}
    ${`"12-25"`}                   | ${"12-25"}                   | ${"short month-day"}
    ${`"20241225"`}                | ${"20241225"}                | ${"basic form"}
    ${`""`}                        | ${""}                        | ${"empty string"}
    ${`20241225`}                  | ${20241225}                  | ${"number"}
    ${`null`}                      | ${null}                      | ${"null"}
    ${`undefined`}                 | ${undefined}                 | ${"undefined"}
  `("returns empty string for $label ($why)", ({ value }) => {
    expect(parseMonthDayFromDate(value)).toBe("");
  });

  it("returns empty string when Temporal.PlainDate#toPlainMonthDay throws", () => {
    const spy = vi
      .spyOn(Temporal.PlainDate.prototype, "toPlainMonthDay")
      .mockImplementation(() => {
        throw new Error("simulated failure");
      });
    try {
      expect(parseMonthDayFromDate("2024-02-29")).toBe("");
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});
