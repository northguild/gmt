import { mockSystemTimeZone } from "../test";
import { mockTemporalInstantFromThrow } from "../test/mocks";
import { utcWallClock } from "./utcWallClock";

describe("utcWallClock", () => {
  // 14:30Z is 23:30 in Asia/Tokyo (+09:00); 12:44:30Z is 12:00:00 at -00:44:30.
  it.each`
    value                        | options                         | expected
    ${"2024-03-15T14:30:00Z"}    | ${undefined}                    | ${"2024-03-15T14:30:00"}
    ${"2024-03-15T14:30:00Z"}    | ${{ timeZone: "Asia/Tokyo" }}   | ${"2024-03-15T23:30:00"}
    ${"2024-03-15T14:30:00Z"}    | ${{ timeZone: "local" }}        | ${"2024-03-15T23:30:00"}
    ${"1970-01-01T12:44:30Z"}    | ${{ timeZone: "-00:44:30" }}    | ${"1970-01-01T12:00:00"}
    ${"1970-01-01T12:44:30Z"}    | ${{ timeZone: "+05:30:00" }}    | ${"1970-01-01T18:14:30"}
    ${"+275760-09-13T00:00:00Z"} | ${{ timeZone: "+23:59:59" }}    | ${"+275760-09-13T23:59:59"}
    ${"2024-03-15T14:30:00Z"}    | ${{ timeZone: "Invalid/Zone" }} | ${null}
    ${"2024-03-15T14:30:00Z"}    | ${{ timeZone: "-0400:30" }}     | ${null}
    ${"2024-03-15T14:30:00"}     | ${undefined}                    | ${null}
  `(
    "returns $expected for $value with options $options",
    ({ value, options, expected }) => {
      const restore = mockSystemTimeZone("Asia/Tokyo");
      expect(utcWallClock(value, options)?.toString() ?? null).toBe(expected);
      restore();
    },
  );

  it("returns null when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();
    expect(utcWallClock("2024-03-15T14:30:00Z")).toBeNull();
  });
});
