import { countIntlConstructions } from "../../test/countIntlConstructions";
import {
  GTFS_FORMAT_ROWS,
  GTFS_FORMAT_SENTINEL_ROWS,
  gtfsRoundTripStrings,
} from "../../test/gtfsTimeRows";
import { parseGtfsTime } from "../parse/parseGtfsTime";
import { formatGtfsTime } from "./formatGtfsTime";

const fmt = (value: unknown): string =>
  formatGtfsTime(value as Parameters<typeof formatGtfsTime>[0]);

describe("formatGtfsTime", () => {
  it.each(GTFS_FORMAT_ROWS)(
    "writes $seconds s and $dayOverflow days as '$expected' ($reason)",
    ({ seconds, dayOverflow, expected }) => {
      expect(formatGtfsTime({ seconds, dayOverflow })).toBe(expected);
    },
  );

  it.each(GTFS_FORMAT_SENTINEL_ROWS)("returns '' for $reason", ({ value }) => {
    expect(fmt(value)).toBe("");
  });

  describe("the issue's rows", () => {
    it.each`
      seconds  | dayOverflow | expected
      ${5700}  | ${1}        | ${"25:35:00"}
      ${29100} | ${0}        | ${"08:05:00"}
      ${0}     | ${5}        | ${"120:00:00"}
      ${86400} | ${0}        | ${""}
      ${1.5}   | ${0}        | ${""}
      ${0}     | ${-1}       | ${""}
    `(
      "writes {$seconds, $dayOverflow} as '$expected'",
      ({ seconds, dayOverflow, expected }) => {
        expect(formatGtfsTime({ seconds, dayOverflow })).toBe(expected);
      },
    );
  });

  describe("reading the record like a property bag", () => {
    it("reads a function carrying the members", () => {
      const fn = Object.assign(() => 0, { seconds: 5700, dayOverflow: 1 });
      expect(fmt(fn)).toBe("25:35:00");
    });

    it("ignores extra members", () => {
      expect(fmt({ seconds: 5700, dayOverflow: 1, zone: "x" })).toBe(
        "25:35:00",
      );
    });

    it("reads inherited members", () => {
      expect(fmt(Object.create({ seconds: 5700, dayOverflow: 1 }))).toBe(
        "25:35:00",
      );
    });

    it("reads a record with no prototype", () => {
      const bag = Object.assign(Object.create(null), {
        seconds: 5700,
        dayOverflow: 1,
      });
      expect(fmt(bag)).toBe("25:35:00");
    });

    it("never coerces a member that is not a number", () => {
      let coercions = 0;
      const seconds = {
        valueOf(): number {
          coercions++;
          return 5700;
        },
      };
      expect(fmt({ seconds, dayOverflow: 1 })).toBe("");
      expect(coercions).toBe(0);
    });

    it("reads each member exactly once", () => {
      const reads = { seconds: 0, dayOverflow: 0 };
      const bag = {
        get seconds() {
          reads.seconds++;
          return 5700;
        },
        get dayOverflow() {
          reads.dayOverflow++;
          return 1;
        },
      };
      expect(fmt(bag)).toBe("25:35:00");
      expect(reads).toEqual({ seconds: 1, dayOverflow: 1 });
    });
  });

  describe("hostile input", () => {
    it("returns '' when a getter throws", () => {
      const bag = {
        get seconds(): number {
          throw new Error("boom");
        },
        dayOverflow: 1,
      };
      expect(fmt(bag)).toBe("");
    });

    it("returns '' when a Proxy get trap throws", () => {
      const proxy = new Proxy(
        {},
        {
          get() {
            throw new Error("boom");
          },
        },
      );
      expect(fmt(proxy)).toBe("");
    });

    it("returns a string when a Proxy has and ownKeys traps throw", () => {
      const proxy = new Proxy(
        { seconds: 5700, dayOverflow: 1 },
        {
          has() {
            throw new Error("boom");
          },
          ownKeys() {
            throw new Error("boom");
          },
        },
      );
      expect(fmt(proxy)).toBe("25:35:00");
    });
  });

  describe("round trips with parseGtfsTime", () => {
    it("writes back every hour 0-999 with minutes and seconds 0, 1, 30, 59", () => {
      expect(gtfsRoundTripStrings()).toHaveLength(16_000);
      const wrong: string[] = [];
      for (const text of gtfsRoundTripStrings()) {
        const parsed = parseGtfsTime(text);
        if (parsed === null || formatGtfsTime(parsed) !== text) {
          wrong.push(text);
        }
      }
      expect(wrong).toEqual([]);
    });

    it.each`
      input          | expected
      ${"8:05:00"}   | ${"08:05:00"}
      ${"008:05:00"} | ${"08:05:00"}
      ${"25:35:00"}  | ${"25:35:00"}
    `("normalises '$input' to '$expected'", ({ input, expected }) => {
      const parsed = parseGtfsTime(input);
      expect(parsed === null ? "" : formatGtfsTime(parsed)).toBe(expected);
    });

    it("reads back what it wrote for the boundary seconds and days", () => {
      const wrong: string[] = [];
      const days = [0, 1, 2, 3, 4, 40, 41];
      for (const seconds of [0, 1, 3599, 3600, 43_200, 86_399]) {
        for (const dayOverflow of days) {
          if (dayOverflow * 24 + Math.floor(seconds / 3600) > 999) continue;
          const parsed = parseGtfsTime(
            formatGtfsTime({ seconds, dayOverflow }),
          );
          if (
            parsed === null ||
            parsed.seconds !== seconds ||
            parsed.dayOverflow !== dayOverflow
          ) {
            wrong.push(`${seconds}/${dayOverflow}`);
          }
        }
      }
      expect(wrong).toEqual([]);
    });
  });

  describe("locale independence", () => {
    it("constructs no Intl formatter", () => {
      const run = (): void => {
        for (const { seconds, dayOverflow } of GTFS_FORMAT_ROWS) {
          formatGtfsTime({ seconds, dayOverflow });
        }
      };
      expect(
        countIntlConstructions(["DateTimeFormat", "NumberFormat"], run, run),
      ).toBe(0);
    });
  });
});
