import { Temporal } from "../../internal/temporal";
import { mockTemporalPlainYearMonthFromThrow } from "../../test/mocks";
import { startOfYearMonth } from "./startOfYearMonth";

describe("startOfYearMonth", () => {
  it.each`
    value                      | expected           | why
    ${"2026-10"}               | ${"2026-10-01"}    | ${"ordinary month"}
    ${"2024-02"}               | ${"2024-02-01"}    | ${"leap-year February"}
    ${"0000-01"}               | ${"0000-01-01"}    | ${"year 0"}
    ${"-000001-12"}            | ${"-000001-12-01"} | ${"negative year"}
    ${"+002026-10"}            | ${"2026-10-01"}    | ${"signed six-digit year"}
    ${"2026-10[u-ca=ISO8601]"} | ${"2026-10-01"}    | ${"ISO calendar annotation"}
    ${"+275760-09"}            | ${"+275760-09-01"} | ${"highest year-month, day 1 is in range"}
    ${"-271821-05"}            | ${"-271821-05-01"} | ${"the month after the lowest is whole"}
  `("returns $expected for '$value' ($why)", ({ value, expected }) => {
    expect(startOfYearMonth(value)).toBe(expected);
  });

  it.each`
    label             | value           | why
    ${"'-271821-04'"} | ${"-271821-04"} | ${"day 1 is before -271821-04-19"}
    ${"'2026-13'"}    | ${"2026-13"}    | ${"no month 13"}
    ${"'2026-10-01'"} | ${"2026-10-01"} | ${"a date is not a year-month"}
    ${"'202610'"}     | ${"202610"}     | ${"no separator"}
    ${"''"}           | ${""}           | ${"empty string"}
    ${"null"}         | ${null}         | ${"null"}
    ${"undefined"}    | ${undefined}    | ${"undefined"}
    ${"202_610"}      | ${202_610}      | ${"number"}
  `("returns '' for $label ($why)", ({ value }) => {
    expect(startOfYearMonth(value)).toBe("");
  });

  it("returns '' when Temporal.PlainYearMonth.from throws", () => {
    mockTemporalPlainYearMonthFromThrow();
    try {
      expect(startOfYearMonth("2026-10")).toBe("");
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
      expect(startOfYearMonth("2026-10")).toBe("");
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});
