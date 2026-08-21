import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { getWeekYear } from "./getWeekYear";

describe("getWeekYear", () => {
  it.each`
    value           | expected
    ${"2024-06-15"} | ${2024}
    ${"2024-01-01"} | ${2024}
    ${"2024-12-31"} | ${2025}
    ${"2020-06-15"} | ${2020}
    ${"2026-06-15"} | ${2026}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(getWeekYear(value)).toBe(expected);
  });

  it("returns 2025 for 2024-12-30, a Monday that starts ISO week 1 of 2025", () => {
    expect(getWeekYear("2024-12-30")).toBe(2025);
  });

  it("returns 2020 for 2021-01-01, the symmetric early-January case belonging to the previous week-year", () => {
    // 2021-01-01 is a Friday, in ISO week 53 of 2020.
    expect(getWeekYear("2021-01-01")).toBe(2020);
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
    ${[]}
  `("returns null for invalid input $value", ({ value }) => {
    expect(getWeekYear(value)).toBeNull();
  });

  it("returns null when Temporal.PlainDate.from throws", () => {
    mockTemporalPlainDateFromThrow();
    expect(getWeekYear("2024-06-15")).toBeNull();
  });
});
