import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { parseDateFromUtc } from "./parseDateFromUtc";

describe("parseDateFromUtc", () => {
  it.each`
    value                     | expected
    ${"2024-03-17T14:30:45Z"} | ${"2024-03-17"}
    ${"2024-01-01T00:00:00Z"} | ${"2024-01-01"}
    ${"2024-12-31T23:59:59Z"} | ${"2024-12-31"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseDateFromUtc(value)).toBe(expected);
  });

  it.each`
    invalidValue
    ${"invalid-date"}
    ${"2024-03-17T14:30:45"}
    ${"2024-03-17T14:30:45+00:00"}
    ${null}
    ${undefined}
    ${12}
    ${true}
    ${false}
  `(
    "returns empty string for invalid value $invalidValue",
    ({ invalidValue }) => {
      expect(parseDateFromUtc(invalidValue)).toBe("");
    },
  );

  it("returns empty string on failure", () => {
    mockTemporalInstantFromThrow();
    const result = parseDateFromUtc("2024-03-17T14:30:45Z");
    expect(result).toBe("");
  });
});
