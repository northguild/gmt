import { isBetweenZoned } from "./isBetweenZoned";

describe("isBetweenZoned", () => {
  it.each`
    zoned                                      | start                                      | end                                        | expected
    ${"2024-02-15T12:00:00[UTC]"}              | ${"2024-02-01T00:00:00[UTC]"}              | ${"2024-02-28T23:59:59[UTC]"}              | ${true}
    ${"2024-02-01T00:00:00[UTC]"}              | ${"2024-02-01T00:00:00[UTC]"}              | ${"2024-02-28T23:59:59[UTC]"}              | ${true}
    ${"2024-02-28T23:59:59[UTC]"}              | ${"2024-02-01T00:00:00[UTC]"}              | ${"2024-02-28T23:59:59[UTC]"}              | ${true}
    ${"2024-01-31T23:59:59[UTC]"}              | ${"2024-02-01T00:00:00[UTC]"}              | ${"2024-02-28T23:59:59[UTC]"}              | ${false}
    ${"2024-03-01T00:00:00[UTC]"}              | ${"2024-02-01T00:00:00[UTC]"}              | ${"2024-02-28T23:59:59[UTC]"}              | ${false}
    ${"2024-02-15T00:00:00[America/New_York]"} | ${"2024-02-20T00:00:00[America/New_York]"} | ${"2024-02-28T00:00:00[America/New_York]"} | ${false}
  `(
    "returns $expected for zoned $zoned between $start and $end",
    ({ zoned, start, end, expected }) => {
      expect(isBetweenZoned(zoned, start, end)).toBe(expected);
    },
  );

  it.each`
    zoned                         | start                         | end                           | inclusiveStart | inclusiveEnd | expected
    ${"2024-02-01T00:00:00[UTC]"} | ${"2024-02-01T00:00:00[UTC]"} | ${"2024-02-28T23:59:59[UTC]"} | ${false}       | ${true}      | ${false}
    ${"2024-02-28T23:59:59[UTC]"} | ${"2024-02-01T00:00:00[UTC]"} | ${"2024-02-28T23:59:59[UTC]"} | ${true}        | ${false}     | ${false}
    ${"2024-02-01T00:00:00[UTC]"} | ${"2024-02-01T00:00:00[UTC]"} | ${"2024-02-28T23:59:59[UTC]"} | ${false}       | ${false}     | ${false}
    ${"2024-02-15T12:00:00[UTC]"} | ${"2024-02-01T00:00:00[UTC]"} | ${"2024-02-28T23:59:59[UTC]"} | ${false}       | ${false}     | ${true}
  `(
    "returns $expected for $zoned between $start and $end with inclusiveStart=$inclusiveStart and inclusiveEnd=$inclusiveEnd",
    ({ zoned, start, end, inclusiveStart, inclusiveEnd, expected }) => {
      expect(
        isBetweenZoned(zoned, start, end, { inclusiveStart, inclusiveEnd }),
      ).toBe(expected);
    },
  );

  it.each`
    zoned
    ${"invalid-zoned"}
    ${"2024-02-30T00:00:00[UTC]"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `("returns false for invalid zoned $zoned", ({ zoned }) => {
    expect(
      isBetweenZoned(
        zoned,
        "2024-02-01T00:00:00[UTC]",
        "2024-02-28T23:59:59[UTC]",
      ),
    ).toBe(false);
  });
});
