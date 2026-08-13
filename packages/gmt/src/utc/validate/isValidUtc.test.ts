import { isValidUtc } from "./isValidUtc";
import { mockTemporalInstantFromThrow } from "../../test/mocks";

describe("isValidUtc", () => {
  it.each`
    value
    ${"2024-01-01T00:00:00Z"}
    ${"2024-12-31T23:59:59Z"}
    ${"2024-02-29T14:30:45Z"}
    ${"2024-02-29T14:30:45.123Z"}
    ${"2024-02-29T14:30:45,999Z"}
    ${"2024-02-29T14:30Z"}
    ${"+001234-12-31T23:59:59Z"}
  `(
    "returns true for valid UTC datetime: $value",
    ({ value }: { value: string }) => {
      expect(isValidUtc(value)).toBe(true);
    },
  );

  it.each`
    value
    ${"2024-02-29T14:30:45"}
    ${"2024-02-29"}
    ${"2024-02-29Z"}
    ${"2024-02-29T24:00:00Z"}
    ${"not-a-datetime"}
    ${"2024-02-29T14:30Z "}
  `(
    "returns false for invalid UTC datetime: $value",
    ({ value }: { value: string }) => {
      expect(isValidUtc(value)).toBe(false);
    },
  );

  it.each`
    value
    ${"2024-12-31T23:59:60Z"}
    ${"2024-12-31T23:59:60.123Z"}
  `(
    "returns false for leap-second input: $value",
    ({ value }: { value: string }) => {
      expect(isValidUtc(value)).toBe(false);
    },
  );

  it("returns false when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(isValidUtc("2024-01-01T00:00:00Z")).toBe(false);
  });
});
