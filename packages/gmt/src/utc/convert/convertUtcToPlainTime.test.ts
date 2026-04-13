import { convertUtcToPlainTime } from "./convertUtcToPlainTime";

describe("convertUtcToPlainTime", () => {
  it.each`
    value                     | expected
    ${"2024-02-29T00:00:00Z"} | ${"00:00:00"}
    ${"2024-01-01T12:00:00Z"} | ${"12:00:00"}
    ${"2024-03-01T15:30:45Z"} | ${"15:30:45"}
  `("returns $expected for UTC value $value", ({ value, expected }) => {
    expect(convertUtcToPlainTime(value)).toBe(expected);
  });

  it.each`
    value                     | timeZone              | expected
    ${"2024-02-29T00:00:00Z"} | ${"UTC"}              | ${"00:00:00"}
    ${"2024-02-29T00:00:00Z"} | ${"America/New_York"} | ${"19:00:00"}
  `(
    "returns $expected for UTC value $value in timeZone $timeZone",
    ({ value, timeZone, expected }) => {
      expect(convertUtcToPlainTime(value, { timeZone })).toBe(expected);
    },
  );

  it.each`
    value
    ${"invalid"}
    ${"2024-02-29T00:00:00"}
    ${""}
    ${null}
  `("returns empty string for invalid value $value", ({ value }) => {
    expect(convertUtcToPlainTime(value as never)).toBe("");
  });
});
