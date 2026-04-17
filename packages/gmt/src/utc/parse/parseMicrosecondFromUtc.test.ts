import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { parseMicrosecondFromUtc } from "./parseMicrosecondFromUtc";

describe("parseMicrosecondFromUtc", () => {
  it.each`
    value                     | expected
    ${"2024-03-17T14:30:45Z"} | ${"000"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseMicrosecondFromUtc(value)).toBe(expected);
  });

  it.each`
    value
    ${"invalid"}
    ${""}
  `("returns empty string for invalid value $value", ({ value }) => {
    expect(parseMicrosecondFromUtc(value)).toBe("");
  });

  it("returns empty string on failure", () => {
    mockTemporalInstantFromThrow();
    const result = parseMicrosecondFromUtc("2024-03-17T14:30:45Z");
    expect(result).toBe("");
  });
});
