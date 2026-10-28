import { Temporal } from "../../internal/temporal";
import { isValidMonthDay } from "../validate";
import { parseMonthDay } from "./parseMonthDay";
import { parseMonthDayFromDateTime } from "./parseMonthDayFromDateTime";

describe("parseMonthDayFromDateTime", () => {
  it.each`
    value                                   | expected     | why
    ${"2024-12-25T10:00:00"}                | ${"--12-25"} | ${"plain date-time"}
    ${"2024-12-25T10:00"}                   | ${"--12-25"} | ${"seconds optional"}
    ${"2024-02-29T23:59:59.999999999"}      | ${"--02-29"} | ${"time never moves the day"}
    ${"2024-12-31T00:00:00"}                | ${"--12-31"} | ${"last day of year"}
    ${"-271821-04-19T00:00:00.000000001"}   | ${"--04-19"} | ${"lowest PlainDateTime"}
    ${"+275760-09-13T00:00:00"}             | ${"--09-13"} | ${"highest day, midnight"}
    ${"+275760-09-13T23:59:59.999999999"}   | ${"--09-13"} | ${"highest PlainDateTime"}
    ${"2024-12-25T10:00:00[Europe/Paris]"}  | ${"--12-25"} | ${"zone annotation ignored"}
    ${"2024-12-25T10:00:00[!Europe/Paris]"} | ${"--12-25"} | ${"critical zone annotation ignored"}
    ${"2024-12-25T10:00:00[u-ca=iso8601]"}  | ${"--12-25"} | ${"iso calendar annotation"}
  `("returns $expected for date-time $value ($why)", ({ value, expected }) => {
    const result = parseMonthDayFromDateTime(value);
    expect(result).toBe(expected);
    expect(isValidMonthDay(result)).toBe(true);
    expect(parseMonthDay(result)).toBe(result);
  });

  it.each`
    label                                          | value                                        | why
    ${`"2024-12-25"`}                              | ${"2024-12-25"}                              | ${"date only"}
    ${`"2024-12-25T10:00:00Z"`}                    | ${"2024-12-25T10:00:00Z"}                    | ${"UTC designator"}
    ${`"2024-12-25T10:00:00+01:00"`}               | ${"2024-12-25T10:00:00+01:00"}               | ${"offset"}
    ${`"2024-12-25T10:00:00+01:00[Europe/Paris]"`} | ${"2024-12-25T10:00:00+01:00[Europe/Paris]"} | ${"zoned"}
    ${`"2024-12-25T24:00:00"`}                     | ${"2024-12-25T24:00:00"}                     | ${"hour 24"}
    ${`"2024-12-25T23:59:60"`}                     | ${"2024-12-25T23:59:60"}                     | ${"second 60"}
    ${`"-271821-04-19T00:00:00"`}                  | ${"-271821-04-19T00:00:00"}                  | ${"below PlainDateTime limit"}
    ${`"+275760-09-14T00:00:00"`}                  | ${"+275760-09-14T00:00:00"}                  | ${"above PlainDateTime limit"}
    ${`"2024-12-25T10:00:00[!foo=bar]"`}           | ${"2024-12-25T10:00:00[!foo=bar]"}           | ${"unknown critical annotation"}
    ${`"2024-12-25T10:00:00[u-ca=gregory]"`}       | ${"2024-12-25T10:00:00[u-ca=gregory]"}       | ${"not ISO"}
    ${`""`}                                        | ${""}                                        | ${"empty string"}
    ${`null`}                                      | ${null}                                      | ${"null"}
    ${`{}`}                                        | ${{}}                                        | ${"object"}
  `("returns empty string for $label ($why)", ({ value }) => {
    expect(parseMonthDayFromDateTime(value)).toBe("");
  });

  it("returns empty string when Temporal.PlainDate#toPlainMonthDay throws", () => {
    const spy = vi
      .spyOn(Temporal.PlainDate.prototype, "toPlainMonthDay")
      .mockImplementation(() => {
        throw new Error("simulated failure");
      });
    try {
      expect(parseMonthDayFromDateTime("2024-02-29T10:00:00")).toBe("");
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});
