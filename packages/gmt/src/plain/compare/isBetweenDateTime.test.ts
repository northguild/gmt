import { isBetweenDateTime } from "./isBetweenDateTime";

describe("isBetweenDateTime", () => {
  it.each`
    dateTime                 | start                    | end                      | expected
    ${"2024-02-15T12:00:00"} | ${"2024-02-01T00:00:00"} | ${"2024-02-28T23:59:59"} | ${true}
    ${"2024-02-01T00:00:00"} | ${"2024-02-01T00:00:00"} | ${"2024-02-28T23:59:59"} | ${true}
    ${"2024-02-28T23:59:59"} | ${"2024-02-01T00:00:00"} | ${"2024-02-28T23:59:59"} | ${true}
    ${"2024-01-31T23:59:59"} | ${"2024-02-01T00:00:00"} | ${"2024-02-28T23:59:59"} | ${false}
    ${"2024-03-01T00:00:00"} | ${"2024-02-01T00:00:00"} | ${"2024-02-28T23:59:59"} | ${false}
    ${"2024-02-15T00:00:00"} | ${"2024-02-20T00:00:00"} | ${"2024-02-28T00:00:00"} | ${false}
  `(
    "returns $expected for dateTime $dateTime between $start and $end",
    ({ dateTime, start, end, expected }) => {
      expect(isBetweenDateTime(dateTime, start, end)).toBe(expected);
    },
  );

  it.each`
    dateTime                 | start                    | end                      | inclusiveStart | inclusiveEnd | expected
    ${"2024-02-01T00:00:00"} | ${"2024-02-01T00:00:00"} | ${"2024-02-28T23:59:59"} | ${false}       | ${true}      | ${false}
    ${"2024-02-28T23:59:59"} | ${"2024-02-01T00:00:00"} | ${"2024-02-28T23:59:59"} | ${true}        | ${false}     | ${false}
    ${"2024-02-01T00:00:00"} | ${"2024-02-01T00:00:00"} | ${"2024-02-28T23:59:59"} | ${false}       | ${false}     | ${false}
    ${"2024-02-15T12:00:00"} | ${"2024-02-01T00:00:00"} | ${"2024-02-28T23:59:59"} | ${false}       | ${false}     | ${true}
  `(
    "returns $expected for $dateTime between $start and $end with inclusiveStart=$inclusiveStart and inclusiveEnd=$inclusiveEnd",
    ({ dateTime, start, end, inclusiveStart, inclusiveEnd, expected }) => {
      expect(
        isBetweenDateTime(dateTime, start, end, {
          inclusiveStart,
          inclusiveEnd,
        }),
      ).toBe(expected);
    },
  );

  it.each`
    dateTime
    ${"invalid-date"}
    ${"2024-02-30"}
    ${"2024-02-29"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `("returns false for invalid dateTime $dateTime", ({ dateTime }) => {
    expect(
      isBetweenDateTime(dateTime, "2024-02-01T00:00:00", "2024-02-28T23:59:59"),
    ).toBe(false);
  });
});
