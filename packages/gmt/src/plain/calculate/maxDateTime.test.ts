import { maxDateTime } from "./maxDateTime";

describe("maxDateTime", () => {
  it.each`
    dateTimes                                                                | expected
    ${["2024-03-10T12:00:00", "2024-01-01T08:00:00", "2024-02-15T15:30:00"]} | ${"2024-03-10T12:00:00"}
    ${["2023-12-31T23:59:59", "2024-01-01T00:00:00"]}                        | ${"2024-01-01T00:00:00"}
  `("returns $expected for dateTimes $dateTimes", ({ dateTimes, expected }) => {
    expect(maxDateTime(dateTimes)).toBe(expected);
  });

  it.each`
    dateTimes                  | expected
    ${[]}                      | ${null}
    ${["invalid"]}             | ${null}
    ${["2024-02-30T12:00:00"]} | ${null}
  `(
    "returns $expected for edge case: $dateTimes",
    ({ dateTimes, expected }) => {
      expect(maxDateTime(dateTimes)).toBe(expected);
    },
  );
});
