import { convertUtcToPlainDateTime } from "./convertUtcToPlainDateTime";

describe("convertUtcToPlainDateTime", () => {
  it.each`
    value                     | expected
    ${"2024-02-29T00:00:00Z"} | ${"2024-02-29T00:00:00"}
    ${"2024-01-01T12:30:45Z"} | ${"2024-01-01T12:30:45"}
    ${"2024-03-01T15:30:45Z"} | ${"2024-03-01T15:30:45"}
  `("returns $expected for UTC value $value", ({ value, expected }) => {
    expect(convertUtcToPlainDateTime(value)).toBe(expected);
  });

  it.each`
    value                     | timeZone              | expected
    ${"2024-02-29T00:00:00Z"} | ${"UTC"}              | ${"2024-02-29T00:00:00"}
    ${"2024-02-29T00:00:00Z"} | ${"America/New_York"} | ${"2024-02-28T19:00:00"}
  `(
    "returns $expected for UTC value $value in timeZone $timeZone",
    ({ value, timeZone, expected }) => {
      expect(convertUtcToPlainDateTime(value, { timeZone })).toBe(expected);
    },
  );

  it.each`
    value
    ${"invalid"}
    ${"2024-02-29T00:00:00"}
    ${""}
    ${null}
  `("returns empty string for invalid value $value", ({ value }) => {
    expect(convertUtcToPlainDateTime(value as never)).toBe("");
  });
});
