import { Temporal } from "@js-temporal/polyfill";
import { isValidUtcOffset } from "../instant/validate/isValidUtcOffset";
import { battleTestTimeZones, mockSystemTimeZone } from "../test";
import { isValidTimeZone } from "../zoned/validate/isValidTimeZone";
import {
  frameEpochNanoseconds,
  frameInstant,
  frameNowWallClock,
  frameOffset,
  frameWallClock,
  frameZoned,
  instantOfWallClock,
  normalizeZoneFrame,
  zoneFrame,
} from "./zoneFrame";

// Every candidate the rules have to sort: identifiers, stored offsets, and values neither
// validator accepts.
const CANDIDATES: readonly unknown[] = [
  ...battleTestTimeZones,
  "utc",
  "Japan",
  "+05:30",
  "+0530",
  "-08",
  "-00:00",
  "+05:30:00",
  "+00:00:00",
  "-00:00:00",
  "-00:44:30",
  "+23:59:59",
  "-23:59:59",
  "Z",
  "+05:30:00.5",
  "+24:00",
  "+05:30:60",
  "-0400:30",
  "Invalid/Zone",
  "local",
  "",
  5,
  null,
  undefined,
  {},
];

describe("zoneFrame", () => {
  // Rule 1.
  it.each`
    zone         | kind
    ${5}         | ${"a number"}
    ${null}      | ${"null"}
    ${undefined} | ${"undefined"}
    ${{}}        | ${"an object"}
    ${["UTC"]}   | ${"an array"}
  `("returns null for $kind ($zone), which is not a string", ({ zone }) => {
    expect(zoneFrame(zone)).toBeNull();
  });

  // Rule 2: a time zone identifier is handed on exactly as the caller wrote it.
  it.each`
    zone
    ${"America/New_York"}
    ${"utc"}
    ${"Japan"}
    ${"+05:30"}
    ${"+0530"}
    ${"-08"}
    ${"-00:00"}
  `("returns identifier $zone unchanged with no shift", ({ zone }) => {
    expect(zoneFrame(zone)).toEqual({ timeZone: zone, shiftNanoseconds: 0n });
  });

  // Rule 3: neither an identifier nor a stored offset.
  it.each`
    zone              | reason
    ${"Z"}            | ${"a designator, not an offset"}
    ${"+05:30:00.5"}  | ${"a fraction of a second"}
    ${"+24:00"}       | ${"hour out of range"}
    ${"+05:30:60"}    | ${"second out of range"}
    ${"-0400:30"}     | ${"basic hours and minutes with extended seconds"}
    ${"Invalid/Zone"} | ${"an unknown name"}
    ${"local"}        | ${"the keyword only normalizeZoneFrame reads"}
    ${""}             | ${"empty"}
  `("returns null for $zone ($reason)", ({ zone }) => {
    expect(zoneFrame(zone)).toBeNull();
  });

  // Rule 4: whole minutes spelled with seconds are the identifier without them. `-00:00:00` is
  // zero, and zero is written `+00:00`.
  it.each`
    zone           | timeZone
    ${"+05:30:00"} | ${"+05:30"}
    ${"-08:00:00"} | ${"-08:00"}
    ${"+00:00:00"} | ${"+00:00"}
    ${"-00:00:00"} | ${"+00:00"}
    ${"+23:59:00"} | ${"+23:59"}
  `(
    "returns the identifier $timeZone for whole-minute offset $zone",
    ({ zone, timeZone }) => {
      expect(zoneFrame(zone)).toEqual({ timeZone, shiftNanoseconds: 0n });
    },
  );

  // Rule 5: the whole minutes of the offset are the zone, and the seconds are the shift, with the
  // offset's own sign. -00:44:30 is -00:44 and 30 s more to the west; +02:10:08 is +02:10 and 8 s
  // more to the east. Within a minute of zero the zone is +00:00 on either side.
  it.each`
    zone           | timeZone    | shiftNanoseconds
    ${"-00:44:30"} | ${"-00:44"} | ${-30_000_000_000n}
    ${"+02:10:08"} | ${"+02:10"} | ${8_000_000_000n}
    ${"-03:30:52"} | ${"-03:30"} | ${-52_000_000_000n}
    ${"+00:00:01"} | ${"+00:00"} | ${1_000_000_000n}
    ${"+00:00:30"} | ${"+00:00"} | ${30_000_000_000n}
    ${"-00:00:30"} | ${"+00:00"} | ${-30_000_000_000n}
    ${"-00:00:01"} | ${"+00:00"} | ${-1_000_000_000n}
    ${"+23:59:59"} | ${"+23:59"} | ${59_000_000_000n}
    ${"-23:58:30"} | ${"-23:58"} | ${-30_000_000_000n}
    ${"-23:59:59"} | ${"-23:59"} | ${-59_000_000_000n}
  `(
    "returns the minute zone $timeZone shifted by $shiftNanoseconds ns for seconds offset $zone",
    ({ zone, timeZone, shiftNanoseconds }) => {
      expect(zoneFrame(zone)).toEqual({ timeZone, shiftNanoseconds });
    },
  );

  // The zone's own offset, asked of plain Temporal, plus the shift is the offset as written.
  it.each`
    zone           | offsetNanoseconds
    ${"-00:44:30"} | ${-2_670_000_000_000n}
    ${"+02:10:08"} | ${7_808_000_000_000n}
    ${"-03:30:52"} | ${-12_652_000_000_000n}
    ${"+23:59:59"} | ${86_399_000_000_000n}
    ${"-23:59:59"} | ${-86_399_000_000_000n}
    ${"-00:00:01"} | ${-1_000_000_000n}
  `(
    "splits $zone into a zone and a shift under a minute that add up to $offsetNanoseconds ns",
    ({ zone, offsetNanoseconds }) => {
      const frame = zoneFrame(zone)!;
      const zoneOffset = BigInt(
        Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(
          frame.timeZone,
        ).offsetNanoseconds,
      );

      expect(zoneOffset + frame.shiftNanoseconds).toBe(offsetNanoseconds);
      expect(frame.shiftNanoseconds).not.toBe(0n);
      expect(frame.shiftNanoseconds < 60_000_000_000n).toBe(true);
      expect(frame.shiftNanoseconds > -60_000_000_000n).toBe(true);
    },
  );

  it.each(CANDIDATES.map((zone) => ({ zone })))(
    "accepts $zone exactly when isValidTimeZone or isValidUtcOffset does",
    ({ zone }) => {
      const accepted =
        isValidTimeZone(zone as string) || isValidUtcOffset(zone as string);
      expect(zoneFrame(zone) !== null).toBe(accepted);
    },
  );

  it.each(CANDIDATES.map((zone) => ({ zone })))(
    "never returns a timeZone that is not a time zone identifier (for $zone)",
    ({ zone }) => {
      const frame = zoneFrame(zone);
      expect(frame === null || isValidTimeZone(frame.timeZone)).toBe(true);
    },
  );
});

describe("normalizeZoneFrame", () => {
  it("returns UTC for an omitted zone whatever the system zone is", () => {
    const restore = mockSystemTimeZone("Asia/Tokyo");
    expect(normalizeZoneFrame(undefined)).toEqual({
      timeZone: "UTC",
      shiftNanoseconds: 0n,
    });
    restore();
  });

  it.each`
    systemTimeZone
    ${"Asia/Tokyo"}
    ${"America/New_York"}
  `(
    "returns the system zone $systemTimeZone for local",
    ({ systemTimeZone }) => {
      const restore = mockSystemTimeZone(systemTimeZone);
      expect(normalizeZoneFrame("local")).toEqual({
        timeZone: systemTimeZone,
        shiftNanoseconds: 0n,
      });
      restore();
    },
  );

  it("returns null for local when the system zone is not valid", () => {
    const restore = mockSystemTimeZone("not-a-timezone");
    expect(normalizeZoneFrame("local")).toBeNull();
    restore();
  });

  it.each(
    CANDIDATES.filter((zone) => zone !== undefined && zone !== "local").map(
      (zone) => ({ zone }),
    ),
  )("reads $zone as zoneFrame does", ({ zone }) => {
    expect(normalizeZoneFrame(zone)).toEqual(zoneFrame(zone));
  });
});

describe("frameWallClock", () => {
  // The local clock is the instant plus the offset, worked by hand. A PlainDateTime reaches a day
  // past the last instant (TC39 ISODateTimeWithinLimits), so the limits have a clock too.
  it.each`
    instant                      | zone           | expected
    ${"1970-01-01T12:44:30Z"}    | ${"-00:44:30"} | ${"1970-01-01T12:00:00"}
    ${"1970-01-01T00:00:00Z"}    | ${"-00:44:30"} | ${"1969-12-31T23:15:30"}
    ${"1925-01-01T12:00:00Z"}    | ${"+02:10:08"} | ${"1925-01-01T14:10:08"}
    ${"+275760-09-13T00:00:00Z"} | ${"+23:59:59"} | ${"+275760-09-13T23:59:59"}
    ${"-271821-04-20T00:00:00Z"} | ${"-23:59:59"} | ${"-271821-04-19T00:00:01"}
    ${"2024-03-10T12:00:00Z"}    | ${"+05:30:00"} | ${"2024-03-10T17:30:00"}
  `(
    "reads $instant at stored offset $zone as $expected",
    ({ instant, zone, expected }) => {
      const frame = zoneFrame(zone);
      expect(frame).not.toBeNull();
      expect(
        frameWallClock(Temporal.Instant.from(instant), frame!).toString(),
      ).toBe(expected);
    },
  );

  it.each(battleTestTimeZones.map((timeZone) => ({ timeZone })))(
    "reads an instant in $timeZone as the wall clock of Temporal's zoned date-time",
    ({ timeZone }) => {
      const instant = Temporal.Instant.from("2024-03-10T12:00:00Z");
      expect(frameWallClock(instant, zoneFrame(timeZone)!).toString()).toBe(
        instant.toZonedDateTimeISO(timeZone).toPlainDateTime().toString(),
      );
    },
  );
});

describe("frameNowWallClock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("1970-01-01T12:44:30.000Z");
  });

  it.each`
    zone                 | expected
    ${"-00:44:30"}       | ${"1970-01-01T12:00:00"}
    ${"Africa/Monrovia"} | ${"1970-01-01T12:00:00"}
    ${"+05:30:00"}       | ${"1970-01-01T18:14:30"}
    ${"UTC"}             | ${"1970-01-01T12:44:30"}
  `(
    "reads the clock at 12:44:30Z in $zone as $expected",
    ({ zone, expected }) => {
      // The polyfill's clock carries a sub-millisecond counter; the second is what is pinned.
      expect(
        frameNowWallClock(zoneFrame(zone)!).toString({
          smallestUnit: "second",
        }),
      ).toBe(expected);
    },
  );
});

describe("frameZoned and frameInstant", () => {
  // The start of the local day at -00:44:30 is local midnight, 00:44:30Z.
  it("does day arithmetic on the local clock of a stored offset and returns the real instant", () => {
    const frame = zoneFrame("-00:44:30")!;
    const zoned = frameZoned(
      Temporal.Instant.from("1970-01-01T12:44:30Z"),
      frame,
    );

    expect(zoned.toPlainDateTime().toString()).toBe("1970-01-01T12:00:00");
    expect(frameInstant(zoned.startOfDay(), frame).toString()).toBe(
      "1970-01-01T00:44:30Z",
    );
    expect(frameInstant(zoned.add({ days: 1 }), frame).toString()).toBe(
      "1970-01-02T12:44:30Z",
    );
  });

  it.each`
    zone
    ${"-00:44:30"}
    ${"+02:10:08"}
    ${"+05:30:00"}
    ${"Africa/Monrovia"}
    ${"America/New_York"}
  `("returns the instant it was given for $zone", ({ zone }) => {
    const frame = zoneFrame(zone)!;
    const instant = Temporal.Instant.from("1970-01-01T12:00:00.123456789Z");

    expect(frameInstant(frameZoned(instant, frame), frame).toString()).toBe(
      instant.toString(),
    );
  });

  // The stand-in instant is the real one plus the shift. So it leaves the range only within the
  // shift's length of one end: the last instant for an offset east of UTC, the first for one west.
  it.each`
    zone           | instant                          | placed
    ${"+00:00:30"} | ${"+275760-09-12T23:59:30Z"}     | ${true}
    ${"+00:00:30"} | ${"+275760-09-12T23:59:30.001Z"} | ${false}
    ${"+00:00:30"} | ${"-271821-04-20T00:00:00Z"}     | ${true}
    ${"+23:59:59"} | ${"+275760-09-12T23:59:01Z"}     | ${true}
    ${"+23:59:59"} | ${"+275760-09-12T23:59:01.001Z"} | ${false}
    ${"-00:44:30"} | ${"+275760-09-13T00:00:00Z"}     | ${true}
    ${"-00:44:30"} | ${"-271821-04-20T00:00:30Z"}     | ${true}
    ${"-00:44:30"} | ${"-271821-04-20T00:00:29.999Z"} | ${false}
    ${"-23:59:59"} | ${"-271821-04-20T00:00:59Z"}     | ${true}
    ${"-23:59:59"} | ${"-271821-04-20T00:00:58.999Z"} | ${false}
  `("places $instant at $zone: $placed", ({ zone, instant, placed }) => {
    const frame = zoneFrame(zone)!;
    const place = () => frameZoned(Temporal.Instant.from(instant), frame);

    if (placed) {
      expect(frameInstant(place(), frame).toString()).toBe(
        Temporal.Instant.from(instant).toString(),
      );
    } else {
      expect(place).toThrow(RangeError);
    }
  });
});

describe("frameEpochNanoseconds", () => {
  // 12:44:30Z is 45 870 s after the epoch. At -00:44:30 it is placed in -00:44 thirty seconds
  // earlier, at 45 840 s, so the wall clock there reads 12:00:00. The real instant is that less the
  // shift.
  it("returns the real epoch nanoseconds of a value placed on a stored offset", () => {
    const frame = zoneFrame("-00:44:30")!;
    const zoned = frameZoned(
      Temporal.Instant.from("1970-01-01T12:44:30Z"),
      frame,
    );

    expect(zoned.epochNanoseconds).toBe(45_840_000_000_000n);
    expect(zoned.timeZoneId).toBe("-00:44");
    expect(zoned.toPlainDateTime().toString()).toBe("1970-01-01T12:00:00");
    expect(frameEpochNanoseconds(zoned, frame)).toBe(45_870_000_000_000n);
  });

  it("returns a zoned value's own epoch nanoseconds for a time zone identifier", () => {
    const frame = zoneFrame("America/New_York")!;
    const instant = Temporal.Instant.from("2024-03-10T12:00:00Z");

    expect(frameEpochNanoseconds(frameZoned(instant, frame), frame)).toBe(
      instant.epochNanoseconds,
    );
  });
});

describe("frameOffset", () => {
  it.each`
    zone           | expected
    ${"-00:44:30"} | ${"-00:44:30"}
    ${"+23:59:59"} | ${"+23:59:59"}
    ${"+02:10:08"} | ${"+02:10:08"}
  `("returns $expected for the stored offset $zone", ({ zone, expected }) => {
    expect(frameOffset(zoneFrame(zone)!)).toBe(expected);
  });

  it.each`
    zone
    ${"UTC"}
    ${"+05:30"}
    ${"+05:30:00"}
  `("throws for $zone, whose offset is its zone's to give", ({ zone }) => {
    expect(() => frameOffset(zoneFrame(zone)!)).toThrow(RangeError);
  });
});

describe("instantOfWallClock", () => {
  // instant = local time - offset. The last instant is +275760-09-13T00:00:00Z.
  it.each`
    wallClock                          | zone           | expected
    ${"1970-01-01T12:00:00"}           | ${"-00:44:30"} | ${"1970-01-01T12:44:30Z"}
    ${"1970-01-01T12:00"}              | ${"-00:44:30"} | ${"1970-01-01T12:44:30Z"}
    ${"1970-01-01T12:00:00.123456789"} | ${"+02:10:08"} | ${"1970-01-01T09:49:52.123456789Z"}
    ${"+275760-09-13T00:00:30"}        | ${"+00:00:30"} | ${"+275760-09-13T00:00:00Z"}
  `(
    "reads $wallClock at $zone as $expected",
    ({ wallClock, zone, expected }) => {
      expect(instantOfWallClock(wallClock, zoneFrame(zone)!).toString()).toBe(
        expected,
      );
    },
  );

  it("throws past the last instant", () => {
    expect(() =>
      instantOfWallClock(
        "+275760-09-13T00:00:30.000000001",
        zoneFrame("+00:00:30")!,
      ),
    ).toThrow(RangeError);
  });
});
