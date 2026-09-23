// Sometimes a UTC datetime needs to be treated as a plain local datetime string.
// This helper removes only the trailing Z marker and preserves the time portion.
import { chopUtc } from "./chopUtc";

describe("chopUtc", () => {
  it.each`
    value                         | expected
    ${"2024-02-29T00:00:00Z"}     | ${"2024-02-29T00:00:00"}
    ${"2024-02-29T12:30:45Z"}     | ${"2024-02-29T12:30:45"}
    ${"2024-02-29T23:59:59Z"}     | ${"2024-02-29T23:59:59"}
    ${"2024-02-29T12:30:45.123Z"} | ${"2024-02-29T12:30:45.123"}
    ${"2024-02-29T12:30:45,999Z"} | ${"2024-02-29T12:30:45,999"}
    ${"+001234-12-31T23:59:59Z"}  | ${"+001234-12-31T23:59:59"}
  `(
    "returns $expected for $value",
    ({ value, expected }: { value: string; expected: string }) => {
      expect(chopUtc(value)).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"2024-02-29T12:30:45"}
    ${"2024-02-29"}
    ${"2024-02-29T00:00:00z"}
    ${NaN}
    ${null}
    ${undefined}
    ${true}
    ${false}
    ${""}
  `("returns empty string for $invalidValue", ({ invalidValue }) => {
    expect(chopUtc(invalidValue)).toBe("");
  });

  // Temporal's ISO grammar reads an elective annotation (`[foo=bar]`) and `[u-ca=iso8601]` and ignores
  // them (RFC 9557 §3.3; native Temporal agrees), so the result is the unannotated input's.
  it.each`
    value                                   | expected
    ${"2024-03-10T12:00:00Z[foo=bar]"}      | ${"2024-03-10T12:00:00"}
    ${"2024-03-10T12:00:00Z[Europe/Paris]"} | ${"2024-03-10T12:00:00"}
  `(
    "drops the annotations Temporal ignores: $value → $expected",
    ({ value, expected }) => {
      expect(chopUtc(value)).toBe(expected);
    },
  );
});
