import { GTFS_SENTINEL_ROWS, GTFS_VALID_ROWS } from "../../test/gtfsTimeRows";
import { parseGtfsTime } from "./parseGtfsTime";

describe("parseGtfsTime", () => {
  it.each(GTFS_VALID_ROWS)(
    "reads '$value' as $seconds s and $dayOverflow overflow days ($reason)",
    ({ value, seconds, dayOverflow }) => {
      expect(parseGtfsTime(value)).toEqual({ seconds, dayOverflow });
    },
  );

  it.each(GTFS_SENTINEL_ROWS)("returns null for $reason", ({ value }) => {
    expect(parseGtfsTime(value as string)).toBeNull();
  });

  it("splits every hour from 0 to 999 into whole days and an hour of the day", () => {
    const wrong: number[] = [];
    for (let h = 0; h <= 999; h++) {
      const result = parseGtfsTime(`${h}:00:00`);
      const expected = {
        seconds: (h % 24) * 3600,
        dayOverflow: Math.floor(h / 24),
      };
      if (JSON.stringify(result) !== JSON.stringify(expected)) wrong.push(h);
    }
    expect(wrong).toEqual([]);
  });

  it("reads every zero-padded spelling of every hour 0-99 as the worked value", () => {
    const wrong: string[] = [];
    for (let h = 0; h <= 99; h++) {
      const expected = {
        seconds: (h % 24) * 3600 + 429,
        dayOverflow: Math.floor(h / 24),
      };
      const spellings = [
        String(h),
        String(h).padStart(2, "0"),
        String(h).padStart(3, "0"),
      ];
      for (const hh of spellings) {
        const value = `${hh}:07:09`;
        if (JSON.stringify(parseGtfsTime(value)) !== JSON.stringify(expected)) {
          wrong.push(value);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it("returns a distinct object on every call", () => {
    const first = parseGtfsTime("25:35:00");
    first!.seconds = 1;
    expect(parseGtfsTime("25:35:00")).toEqual({
      seconds: 5700,
      dayOverflow: 1,
    });
  });

  it("gives the same answer when the same value is read repeatedly", () => {
    const answers = [1, 2, 3].map(() => parseGtfsTime("25:35:00"));
    expect(answers).toEqual([
      { seconds: 5700, dayOverflow: 1 },
      { seconds: 5700, dayOverflow: 1 },
      { seconds: 5700, dayOverflow: 1 },
    ]);
    expect(parseGtfsTime("25:60:00")).toBeNull();
    expect(parseGtfsTime("25:60:00")).toBeNull();
  });
});
