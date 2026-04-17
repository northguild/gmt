import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { parseHourFromUtc } from "./parseHourFromUtc";

describe("parseHourFromUtc", () => {
  it.each`
    value                     | expected
    ${"2024-03-17T14:30:45Z"} | ${"14"}
    ${"2024-03-17T00:00:00Z"} | ${"00"}
    ${"2024-03-17T23:59:59Z"} | ${"23"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseHourFromUtc(value)).toBe(expected);
  });

  it.each`
    value
    ${"invalid"}
    ${""}
  `("returns empty string for invalid value $value", ({ value }) => {
    expect(parseHourFromUtc(value)).toBe("");
  });

  it("returns empty string on failure", () => {
    mockTemporalInstantFromThrow();
    const result = parseHourFromUtc("2024-03-17T14:30:45Z");
    expect(result).toBe("");
  });
});
