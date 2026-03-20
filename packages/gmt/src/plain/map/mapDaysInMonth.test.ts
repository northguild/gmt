import { mapDaysInMonth } from "./mapDaysInMonth";

describe("mapDaysInMonth", () => {
  it.each`
    month        | expectedLength
    ${"2024-02"} | ${29}
    ${"2023-02"} | ${28}
    ${"2024-04"} | ${30}
    ${"2024-03"} | ${31}
  `(
    "returns $expectedLength days for $month",
    ({ month, expectedLength }: { month: string; expectedLength: number }) => {
      expect(mapDaysInMonth(month)).toHaveLength(expectedLength);
    },
  );

  it.each`
    month        | expectedFirst   | expectedLast
    ${"2024-03"} | ${"2024-03-01"} | ${"2024-03-31"}
    ${"2024-02"} | ${"2024-02-01"} | ${"2024-02-29"}
  `(
    "returns zero-padded ISO date strings for $month",
    ({ month, expectedFirst, expectedLast }) => {
      const result = mapDaysInMonth(month);
      expect(result[0]).toBe(expectedFirst);
      expect(result.at(-1)).toBe(expectedLast);
    },
  );

  it.each`
    invalidMonth
    ${"2024-13"}
    ${"not-a-month"}
    ${"2024-03-01"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns an empty array for invalid month $invalidMonth",
    ({ invalidMonth }) => {
      expect(mapDaysInMonth(invalidMonth as never)).toEqual([]);
    },
  );
});
