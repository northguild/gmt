import { Temporal } from "../../internal/temporal";
import { mockTemporalPlainYearMonthFromThrow } from "../../test/mocks";
import { parseYearMonthFromDate } from "../parse/parseYearMonthFromDate";
import { addDate } from "./addDate";
import { addYearMonth } from "./addYearMonth";
import { endOfYearMonth } from "./endOfYearMonth";
import { getDaysInMonth } from "./getDaysInMonth";
import { getDaysInYearMonth } from "./getDaysInYearMonth";
import { startOfYearMonth } from "./startOfYearMonth";

describe("getDaysInYearMonth", () => {
  it.each`
    value           | expected | why
    ${"2026-10"}    | ${31}    | ${"31-day month"}
    ${"2026-01"}    | ${31}    | ${"January"}
    ${"2026-12"}    | ${31}    | ${"December"}
    ${"2026-04"}    | ${30}    | ${"30-day month"}
    ${"2026-09"}    | ${30}    | ${"September"}
    ${"2026-11"}    | ${30}    | ${"November"}
    ${"2024-02"}    | ${29}    | ${"leap year"}
    ${"2000-02"}    | ${29}    | ${"400-year rule"}
    ${"0000-02"}    | ${29}    | ${"year 0 is a leap year"}
    ${"2023-02"}    | ${28}    | ${"not a leap year"}
    ${"1900-02"}    | ${28}    | ${"century, not a leap year"}
    ${"2100-02"}    | ${28}    | ${"century, not a leap year"}
    ${"-271821-04"} | ${30}    | ${"lowest year-month, thirty days though only twelve are PlainDates"}
    ${"+275760-09"} | ${30}    | ${"highest year-month, thirty days though only thirteen are PlainDates"}
  `("returns $expected for '$value' ($why)", ({ value, expected }) => {
    expect(getDaysInYearMonth(value)).toBe(expected);
  });

  it.each`
    label             | value           | why
    ${"'2026-13'"}    | ${"2026-13"}    | ${"no month 13"}
    ${"'2026-10-01'"} | ${"2026-10-01"} | ${"a date is not a year-month"}
    ${"''"}           | ${""}           | ${"empty string"}
    ${"null"}         | ${null}         | ${"null"}
    ${"202_610"}      | ${202_610}      | ${"number"}
  `("returns null for $label ($why)", ({ value }) => {
    expect(getDaysInYearMonth(value)).toBeNull();
  });

  it("returns null when Temporal.PlainYearMonth.from throws", () => {
    mockTemporalPlainYearMonthFromThrow();
    try {
      expect(getDaysInYearMonth("2026-10")).toBeNull();
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("returns null when reading daysInMonth throws inside the try", () => {
    const spy = vi
      .spyOn(Temporal.PlainYearMonth.prototype, "daysInMonth", "get")
      .mockImplementation(() => {
        throw new Error("simulated failure");
      });
    try {
      expect(getDaysInYearMonth("2026-10")).toBeNull();
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  const months = [2023, 2024].flatMap((year) =>
    Array.from(
      { length: 12 },
      (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`,
    ),
  );
  const properties = [...months, "0000-02", "-000001-02"];

  it.each(properties.map((value) => ({ value })))(
    "agrees with startOfYearMonth, endOfYearMonth and getDaysInMonth for '$value'",
    ({ value }) => {
      const days = getDaysInYearMonth(value);
      expect(
        endOfYearMonth(value).endsWith(`-${String(days).padStart(2, "0")}`),
      ).toBe(true);
      expect(days).toBe(getDaysInMonth(startOfYearMonth(value)));
    },
  );

  it.each(properties.map((value) => ({ value })))(
    "parseYearMonthFromDate of its first and last day gives '$value' back",
    ({ value }) => {
      expect(parseYearMonthFromDate(startOfYearMonth(value))).toBe(value);
      expect(parseYearMonthFromDate(endOfYearMonth(value))).toBe(value);
    },
  );

  it.each(properties.map((value) => ({ value })))(
    "the day after the end of '$value' is the start of the next year-month",
    ({ value }) => {
      expect(addDate(endOfYearMonth(value), { days: 1 })).toBe(
        startOfYearMonth(addYearMonth(value, { months: 1 })),
      );
    },
  );
});
