import { Temporal } from "../../internal/temporal";
import { isValidYearMonth } from "../validate";
import { parseYearMonth } from "./parseYearMonth";
import { parseYearMonthFromDateTime } from "./parseYearMonthFromDateTime";

describe("parseYearMonthFromDateTime", () => {
  it.each`
    value                                   | expected        | why
    ${"2026-10-01T10:00:00"}                | ${"2026-10"}    | ${"plain date-time"}
    ${"2026-10-31T23:59:59.999999999"}      | ${"2026-10"}    | ${"time never moves the month"}
    ${"2026-10-01T10:00"}                   | ${"2026-10"}    | ${"seconds optional"}
    ${"-271821-04-19T00:00:00.000000001"}   | ${"-271821-04"} | ${"lowest PlainDateTime"}
    ${"+275760-09-13T00:00:00"}             | ${"+275760-09"} | ${"highest day, midnight"}
    ${"+275760-09-13T23:59:59.999999999"}   | ${"+275760-09"} | ${"highest PlainDateTime"}
    ${"2026-12-31T23:59:59"}                | ${"2026-12"}    | ${"last day of year"}
    ${"2026-10-01T10:00:00[Europe/Paris]"}  | ${"2026-10"}    | ${"zone annotation ignored"}
    ${"2026-10-01T10:00:00[!Europe/Paris]"} | ${"2026-10"}    | ${"critical zone annotation ignored"}
    ${"2026-10-01T10:00:00[u-ca=iso8601]"}  | ${"2026-10"}    | ${"iso calendar annotation"}
  `("returns $expected for date-time $value ($why)", ({ value, expected }) => {
    const result = parseYearMonthFromDateTime(value);
    expect(result).toBe(expected);
    expect(isValidYearMonth(result)).toBe(true);
    expect(parseYearMonth(result)).toBe(result);
  });

  it.each`
    label                                          | value                                        | why
    ${`"-271821-04-19T00:00:00"`}                  | ${"-271821-04-19T00:00:00"}                  | ${"below PlainDateTime limit"}
    ${`"+275760-09-14T00:00:00"`}                  | ${"+275760-09-14T00:00:00"}                  | ${"above PlainDateTime limit"}
    ${`"2026-10-01T23:59:60"`}                     | ${"2026-10-01T23:59:60"}                     | ${"second 60"}
    ${`"2026-10-01T10:00:00[!foo=bar]"`}           | ${"2026-10-01T10:00:00[!foo=bar]"}           | ${"unknown critical annotation"}
    ${`"2026-10-01"`}                              | ${"2026-10-01"}                              | ${"date only"}
    ${`"2026-10-01T10:00:00Z"`}                    | ${"2026-10-01T10:00:00Z"}                    | ${"UTC designator"}
    ${`"2026-10-01T10:00:00+01:00"`}               | ${"2026-10-01T10:00:00+01:00"}               | ${"offset"}
    ${`"2026-10-01T10:00:00+01:00[Europe/Paris]"`} | ${"2026-10-01T10:00:00+01:00[Europe/Paris]"} | ${"zoned"}
    ${`"2026-10-01T24:00:00"`}                     | ${"2026-10-01T24:00:00"}                     | ${"hour 24"}
    ${`"2026-10-01T10:00:00[u-ca=gregory]"`}       | ${"2026-10-01T10:00:00[u-ca=gregory]"}       | ${"not ISO"}
    ${`""`}                                        | ${""}                                        | ${"empty string"}
    ${`null`}                                      | ${null}                                      | ${"null"}
    ${`{}`}                                        | ${{}}                                        | ${"object"}
  `("returns empty string for $label ($why)", ({ value }) => {
    expect(parseYearMonthFromDateTime(value)).toBe("");
  });

  it("returns empty string when Temporal.PlainDate#toPlainYearMonth throws", () => {
    const spy = vi
      .spyOn(Temporal.PlainDate.prototype, "toPlainYearMonth")
      .mockImplementation(() => {
        throw new Error("simulated failure");
      });
    try {
      expect(parseYearMonthFromDateTime("2024-02-29T10:00:00")).toBe("");
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});
