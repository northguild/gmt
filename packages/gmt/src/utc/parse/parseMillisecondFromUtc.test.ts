import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { parseMillisecondFromUtc } from "./parseMillisecondFromUtc";

describe("parseMillisecondFromUtc", () => {
  it.each`
    value                         | expected
    ${"2024-03-17T14:30:45.123Z"} | ${"123"}
    ${"2024-03-17T14:30:45.000Z"} | ${"000"}
    ${"2024-03-17T14:30:45.999Z"} | ${"999"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseMillisecondFromUtc(value)).toBe(expected);
  });

  it.each`
    value
    ${"invalid"}
    ${""}
  `("returns empty string for invalid value $value", ({ value }) => {
    expect(parseMillisecondFromUtc(value)).toBe("");
  });

  it("returns empty string on failure", () => {
    mockTemporalInstantFromThrow();
    const result = parseMillisecondFromUtc("2024-03-17T14:30:45.123Z");
    expect(result).toBe("");
  });
});
