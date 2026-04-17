import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { parseDayFromUtc } from "./parseDayFromUtc";

describe("parseDayFromUtc", () => {
  it.each`
    value                     | expected
    ${"2024-03-17T14:30:45Z"} | ${"17"}
    ${"2024-01-01T00:00:00Z"} | ${"01"}
    ${"2024-12-31T23:59:59Z"} | ${"31"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseDayFromUtc(value)).toBe(expected);
  });

  it.each`
    value
    ${"invalid"}
    ${""}
  `("returns empty string for invalid value $value", ({ value }) => {
    expect(parseDayFromUtc(value)).toBe("");
  });

  it("returns empty string on failure", () => {
    mockTemporalInstantFromThrow();
    const result = parseDayFromUtc("2024-03-17T14:30:45Z");
    expect(result).toBe("");
  });
});
