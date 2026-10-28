import { Temporal } from "../../internal/temporal";
import { mockTemporalPlainYearMonthFromThrow } from "../../test/mocks";
import { endOfYearMonth } from "./endOfYearMonth";

describe("endOfYearMonth", () => {
  it.each`
    value                      | expected           | why
    ${"2026-10"}               | ${"2026-10-31"}    | ${"31-day month"}
    ${"2026-04"}               | ${"2026-04-30"}    | ${"30-day month"}
    ${"+002026-10"}            | ${"2026-10-31"}    | ${"signed six-digit year, no annotation in output"}
    ${"2026-10[u-ca=ISO8601]"} | ${"2026-10-31"}    | ${"ISO calendar annotation, none in output"}
    ${"2024-02"}               | ${"2024-02-29"}    | ${"leap year"}
    ${"2023-02"}               | ${"2023-02-28"}    | ${"not a leap year"}
    ${"1900-02"}               | ${"1900-02-28"}    | ${"century, not a leap year"}
    ${"2000-02"}               | ${"2000-02-29"}    | ${"400-year rule"}
    ${"0000-02"}               | ${"0000-02-29"}    | ${"year 0 is a leap year (proleptic Gregorian)"}
    ${"-000001-02"}            | ${"-000001-02-28"} | ${"negative year, not a leap year"}
    ${"-271821-04"}            | ${"-271821-04-30"} | ${"lowest year-month, its last day is in range"}
    ${"+275760-08"}            | ${"+275760-08-31"} | ${"month before the highest is whole"}
  `("returns '$expected' for '$value' ($why)", ({ value, expected }) => {
    expect(endOfYearMonth(value)).toBe(expected);
  });

  it.each`
    label             | value           | why
    ${"'+275760-09'"} | ${"+275760-09"} | ${"day 30 is after +275760-09-13"}
    ${"'2026-13'"}    | ${"2026-13"}    | ${"no month 13"}
    ${"'2026-10-01'"} | ${"2026-10-01"} | ${"a date is not a year-month"}
    ${"''"}           | ${""}           | ${"empty string"}
    ${"null"}         | ${null}         | ${"null"}
    ${"202_610"}      | ${202_610}      | ${"number"}
  `("returns '' for $label ($why)", ({ value }) => {
    expect(endOfYearMonth(value)).toBe("");
  });

  it("returns '' when Temporal.PlainYearMonth.from throws", () => {
    mockTemporalPlainYearMonthFromThrow();
    try {
      expect(endOfYearMonth("2026-10")).toBe("");
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("returns '' when PlainYearMonth.prototype.toPlainDate throws inside the try", () => {
    const spy = vi
      .spyOn(Temporal.PlainYearMonth.prototype, "toPlainDate")
      .mockImplementation(() => {
        throw new Error("simulated failure");
      });
    try {
      expect(endOfYearMonth("2026-10")).toBe("");
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});
