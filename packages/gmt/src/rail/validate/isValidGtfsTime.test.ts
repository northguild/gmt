import {
  GTFS_SENTINEL_ROWS,
  GTFS_VALID_ROWS,
  gtfsRoundTripStrings,
} from "../../test/gtfsTimeRows";
import { parseGtfsTime } from "../parse/parseGtfsTime";
import { isValidGtfsTime } from "./isValidGtfsTime";

describe("isValidGtfsTime", () => {
  it.each(GTFS_VALID_ROWS)(
    "returns true for '$value' ($reason)",
    ({ value }) => {
      expect(isValidGtfsTime(value)).toBe(true);
    },
  );

  it.each(GTFS_SENTINEL_ROWS)("returns false for $reason", ({ value }) => {
    expect(isValidGtfsTime(value as unknown as string)).toBe(false);
  });

  it("returns false for the issue row isValidGtfsTime(5700)", () => {
    expect(isValidGtfsTime(5700 as unknown as string)).toBe(false);
  });

  it("returns false for the issue row isValidGtfsTime(null)", () => {
    expect(isValidGtfsTime(null as unknown as string)).toBe(false);
  });

  describe("agreement with parseGtfsTime", () => {
    it("is true exactly when the parser returns a value, for every row", () => {
      const values = [
        ...GTFS_VALID_ROWS.map((r) => r.value),
        ...GTFS_SENTINEL_ROWS.map((r) => r.value),
      ] as string[];
      const disagree = values.filter(
        (v) => isValidGtfsTime(v) !== (parseGtfsTime(v) !== null),
      );
      expect(disagree).toEqual([]);
    });

    it("agrees with the parser on every round-trip string", () => {
      const disagree = gtfsRoundTripStrings().filter(
        (v) => isValidGtfsTime(v) !== (parseGtfsTime(v) !== null),
      );
      expect(disagree).toEqual([]);
    });
  });
});
