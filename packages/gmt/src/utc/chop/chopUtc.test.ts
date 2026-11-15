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
    invalidValue              | label
    ${"2024-02-29T12:30:45"}  | ${"'2024-02-29T12:30:45'"}
    ${"2024-02-29"}           | ${"'2024-02-29'"}
    ${"2024-02-29T00:00:00z"} | ${"'2024-02-29T00:00:00z'"}
    ${NaN}                    | ${"NaN"}
    ${null}                   | ${"null"}
    ${undefined}              | ${"undefined"}
    ${true}                   | ${"true"}
    ${false}                  | ${"false"}
    ${""}                     | ${"''"}
  `("returns empty string for $label", ({ invalidValue }) => {
    expect(chopUtc(invalidValue)).toBe("");
  });

  // CORE-113 (#528): a UTC value is `…Z` and nothing after it, so an annotation of any kind makes it
  // invalid.
  it.each`
    value                                           | expected
    ${"2024-03-10T12:00:00Z[foo=bar]"}              | ${""}
    ${"2024-03-10T12:00:00Z[Europe/Paris]"}         | ${""}
    ${"2024-03-10T12:00:00Z[Europe/Helsinkiddddd]"} | ${""}
    ${"2024-03-10T12:00:00Z[u-ca=iso8601]"}         | ${""}
  `(
    "returns an empty string for the annotated $value → '$expected'",
    ({ value, expected }) => {
      expect(chopUtc(value)).toBe(expected);
    },
  );
});
