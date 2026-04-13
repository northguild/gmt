import { isBetweenDate } from "./isBetweenDate";

describe("isBetweenDate", () => {
  it.each`
    date            | start           | end             | expected
    ${"2024-02-15"} | ${"2024-02-01"} | ${"2024-02-28"} | ${true}
    ${"2024-02-01"} | ${"2024-02-01"} | ${"2024-02-28"} | ${true}
    ${"2024-02-28"} | ${"2024-02-01"} | ${"2024-02-28"} | ${true}
    ${"2024-01-31"} | ${"2024-02-01"} | ${"2024-02-28"} | ${false}
    ${"2024-03-01"} | ${"2024-02-01"} | ${"2024-02-28"} | ${false}
    ${"2024-02-10"} | ${"2024-02-20"} | ${"2024-02-28"} | ${false}
  `(
    "returns $expected for date $date between $start and $end",
    ({ date, start, end, expected }) => {
      expect(isBetweenDate(date, start, end)).toBe(expected);
    },
  );

  it.each`
    date            | start           | end             | inclusiveStart | inclusiveEnd | expected
    ${"2024-02-01"} | ${"2024-02-01"} | ${"2024-02-28"} | ${false}       | ${true}      | ${false}
    ${"2024-02-28"} | ${"2024-02-01"} | ${"2024-02-28"} | ${true}        | ${false}     | ${false}
    ${"2024-02-01"} | ${"2024-02-01"} | ${"2024-02-28"} | ${false}       | ${false}     | ${false}
    ${"2024-02-15"} | ${"2024-02-01"} | ${"2024-02-28"} | ${false}       | ${false}     | ${true}
  `(
    "returns $expected for $date between $start and $end with inclusiveStart=$inclusiveStart and inclusiveEnd=$inclusiveEnd",
    ({ date, start, end, inclusiveStart, inclusiveEnd, expected }) => {
      expect(
        isBetweenDate(date, start, end, { inclusiveStart, inclusiveEnd }),
      ).toBe(expected);
    },
  );

  it.each`
    date
    ${"invalid-date"}
    ${"2024-02-30"}
    ${"2024-02-29T00:00:00"}
    ${"2024-02-29T00:00:00Z"}
    ${"2024-02-29T12:00:00+01:00"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `("returns false for invalid date $date", ({ date }) => {
    expect(isBetweenDate(date, "2024-02-01", "2024-02-28")).toBe(false);
  });

  it.each`
    start
    ${"invalid-date"}
    ${"2024-02-30"}
    ${null}
    ${undefined}
  `("returns false for invalid start $start", ({ start }) => {
    expect(isBetweenDate("2024-02-15", start, "2024-02-28")).toBe(false);
  });

  it.each`
    end
    ${"invalid-date"}
    ${"2024-02-30"}
    ${null}
    ${undefined}
  `("returns false for invalid end $end", ({ end }) => {
    expect(isBetweenDate("2024-02-15", "2024-02-01", end)).toBe(false);
  });
});
