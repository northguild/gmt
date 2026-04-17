import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { parseUnitFromUtc } from "./parseUnitFromUtc";

describe("parseUnitFromUtc", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it.each`
    value                         | unit             | expected
    ${"2024-03-17T14:30:45Z"}     | ${"year"}        | ${"2024"}
    ${"2024-03-17T14:30:45Z"}     | ${"month"}       | ${"03"}
    ${"2024-03-17T14:30:45Z"}     | ${"day"}         | ${"17"}
    ${"2024-03-17T14:30:45Z"}     | ${"hour"}        | ${"14"}
    ${"2024-03-17T14:30:45Z"}     | ${"minute"}      | ${"30"}
    ${"2024-03-17T14:30:45Z"}     | ${"second"}      | ${"45"}
    ${"2024-03-17T14:30:45.123Z"} | ${"millisecond"} | ${"123"}
  `(
    "returns $expected for $value and unit $unit",
    ({ value, unit, expected }) => {
      expect(parseUnitFromUtc(value, unit)).toBe(expected);
    },
  );

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
      expect(parseUnitFromUtc(invalidValue, "year")).toBe("");
    },
  );

  it("returns empty string on failure", () => {
    mockTemporalInstantFromThrow();
    const result = parseUnitFromUtc("2024-03-17T14:30:45Z", "year");
    expect(result).toBe("");
  });
});
