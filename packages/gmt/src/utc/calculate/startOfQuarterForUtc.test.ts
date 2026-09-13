import { startOfQuarterForUtc } from "./startOfQuarterForUtc";
import { mockTemporalInstantFromThrow } from "../../test/mocks";

describe("startOfQuarterForUtc", () => {
  it.each`
    value                     | expected
    ${"2024-01-15T12:00:00Z"} | ${"2024-01-01T00:00:00Z"}
    ${"2024-04-15T12:00:00Z"} | ${"2024-04-01T00:00:00Z"}
    ${"2024-07-15T12:00:00Z"} | ${"2024-07-01T00:00:00Z"}
    ${"2024-10-15T12:00:00Z"} | ${"2024-10-01T00:00:00Z"}
    ${"2024-03-31T23:59:59Z"} | ${"2024-01-01T00:00:00Z"}
    ${"2024-06-30T23:59:59Z"} | ${"2024-04-01T00:00:00Z"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(startOfQuarterForUtc(value)).toBe(expected);
  });

  it.each`
    value                               | expected
    ${"2024-05-15T12:34:56.789Z"}       | ${"2024-04-01T00:00:00Z"}
    ${"2024-05-15T12:34:56.789123456Z"} | ${"2024-04-01T00:00:00Z"}
    ${"2024-12-31T23:59:59.999999999Z"} | ${"2024-10-01T00:00:00Z"}
  `(
    "resets sub-second fields of $value to return $expected",
    ({ value, expected }) => {
      expect(startOfQuarterForUtc(value)).toBe(expected);
    },
  );

  it.each`
    invalidValue
    ${"invalid"}
    ${"2024-02-29T12:00:00"}
    ${""}
    ${null}
    ${undefined}
  `(
    "returns empty string for invalid value $invalidValue",
    ({ invalidValue }) => {
      expect(startOfQuarterForUtc(invalidValue as never)).toBe("");
    },
  );

  it("returns empty string when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(startOfQuarterForUtc("2024-01-15T12:00:00Z")).toBe("");
  });
});
