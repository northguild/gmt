import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { parseMinuteFromUtc } from "./parseMinuteFromUtc";

describe("parseMinuteFromUtc", () => {
  it.each`
    value                     | expected
    ${"2024-03-17T14:30:45Z"} | ${"30"}
    ${"2024-03-17T14:00:00Z"} | ${"00"}
    ${"2024-03-17T14:59:59Z"} | ${"59"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseMinuteFromUtc(value)).toBe(expected);
  });

  it.each`
    value
    ${"invalid"}
    ${""}
  `("returns empty string for invalid value $value", ({ value }) => {
    expect(parseMinuteFromUtc(value)).toBe("");
  });

  it("returns empty string on failure", () => {
    mockTemporalInstantFromThrow();
    const result = parseMinuteFromUtc("2024-03-17T14:30:45Z");
    expect(result).toBe("");
  });
});
