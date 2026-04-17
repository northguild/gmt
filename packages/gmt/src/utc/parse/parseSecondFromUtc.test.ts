import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { parseSecondFromUtc } from "./parseSecondFromUtc";

describe("parseSecondFromUtc", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it.each`
    value                     | expected
    ${"2024-03-17T14:30:45Z"} | ${"45"}
    ${"2024-03-17T14:30:00Z"} | ${"00"}
    ${"2024-03-17T14:30:59Z"} | ${"59"}
  `("returns $expected for $value", ({ value, expected }) => {
    expect(parseSecondFromUtc(value)).toBe(expected);
  });

  it.each`
    value
    ${"invalid"}
    ${""}
  `("returns empty string for invalid value $value", ({ value }) => {
    expect(parseSecondFromUtc(value)).toBe("");
  });

  it("returns empty string on failure", () => {
    mockTemporalInstantFromThrow();
    const result = parseSecondFromUtc("2024-03-17T14:30:45Z");
    expect(result).toBe("");
  });
});
