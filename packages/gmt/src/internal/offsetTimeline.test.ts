import { Temporal } from "./temporal";
import { NANOSECONDS_PER_DAY } from "./foreignEpochs";
import {
  ensureTimeline,
  offsetOf,
  offsetTimeline,
  possibleAt,
  resolveWallNs,
  startOfDayNs,
} from "./offsetTimeline";
import type { OffsetTimeline } from "./offsetTimeline";
import { zoneFrame } from "./zoneFrame";
import type { ZoneFrame } from "./zoneFrame";
import type { Disambiguation } from "../types";

const ns = (iso: string) => Temporal.Instant.from(iso).epochNanoseconds;
const HOUR = 3_600_000_000_000n;
const DAY = NANOSECONDS_PER_DAY;

function timelineOf(zone: string, from: string, to: string) {
  const frame = zoneFrame(zone);
  if (frame === null) throw new Error(`no frame for ${zone}`);
  return offsetTimeline(frame, ns(from), ns(to));
}

describe("resolveWallNs", () => {
  // Expected instants are read from the zone's own offsets (zdump -v, tz 2026c) and the
  // DisambiguatePossibleEpochNanoseconds rule, not from the code under test.
  const london = timelineOf(
    "Europe/London",
    "2024-01-01T00:00:00Z",
    "2025-01-01T00:00:00Z",
  );
  const sydney = timelineOf(
    "Australia/Sydney",
    "2024-01-01T00:00:00Z",
    "2025-01-01T00:00:00Z",
  );
  const lordHowe = timelineOf(
    "Australia/Lord_Howe",
    "2024-01-01T00:00:00Z",
    "2025-01-01T00:00:00Z",
  );
  const dublin = timelineOf(
    "Europe/Dublin",
    "2024-01-01T00:00:00Z",
    "2025-01-01T00:00:00Z",
  );
  const gooseBay = timelineOf(
    "America/Goose_Bay",
    "2010-01-01T00:00:00Z",
    "2011-01-01T00:00:00Z",
  );
  const fixedSeconds = timelineOf(
    "+05:45:30",
    "2024-01-01T00:00:00Z",
    "2025-01-01T00:00:00Z",
  );

  it.each`
    zone                     | wall                      | disambiguation  | expected                  | why
    ${"Europe/London"}       | ${"2024-03-31T01:30:00Z"} | ${"earlier"}    | ${"2024-03-31T00:30:00Z"} | ${"gap 01:00-02:00, back an hour onto GMT"}
    ${"Europe/London"}       | ${"2024-03-31T01:30:00Z"} | ${"compatible"} | ${"2024-03-31T01:30:00Z"} | ${"gap, forward an hour is 02:30 BST"}
    ${"Europe/London"}       | ${"2024-03-31T01:30:00Z"} | ${"later"}      | ${"2024-03-31T01:30:00Z"} | ${"gap, forward an hour is 02:30 BST"}
    ${"Europe/London"}       | ${"2024-03-31T01:30:00Z"} | ${"reject"}     | ${undefined}              | ${"gap is refused"}
    ${"Europe/London"}       | ${"2024-10-27T01:30:00Z"} | ${"compatible"} | ${"2024-10-27T00:30:00Z"} | ${"repeated hour, first is BST"}
    ${"Europe/London"}       | ${"2024-10-27T01:30:00Z"} | ${"earlier"}    | ${"2024-10-27T00:30:00Z"} | ${"repeated hour, first is BST"}
    ${"Europe/London"}       | ${"2024-10-27T01:30:00Z"} | ${"later"}      | ${"2024-10-27T01:30:00Z"} | ${"repeated hour, second is GMT"}
    ${"Europe/London"}       | ${"2024-10-27T01:30:00Z"} | ${"reject"}     | ${undefined}              | ${"repeated hour is refused"}
    ${"Europe/London"}       | ${"2024-06-01T12:00:00Z"} | ${"reject"}     | ${"2024-06-01T11:00:00Z"} | ${"one candidate, BST is +01:00"}
    ${"Australia/Sydney"}    | ${"2024-10-06T02:30:00Z"} | ${"compatible"} | ${"2024-10-05T16:30:00Z"} | ${"gap 02:00-03:00, 03:30 at +11:00"}
    ${"Australia/Sydney"}    | ${"2024-10-06T02:30:00Z"} | ${"earlier"}    | ${"2024-10-05T15:30:00Z"} | ${"gap, 01:30 at +10:00"}
    ${"Australia/Lord_Howe"} | ${"2024-10-06T02:15:00Z"} | ${"compatible"} | ${"2024-10-05T15:45:00Z"} | ${"half-hour gap, 02:45 at +11:00"}
    ${"Australia/Lord_Howe"} | ${"2024-10-06T02:15:00Z"} | ${"earlier"}    | ${"2024-10-05T15:15:00Z"} | ${"half-hour gap, 01:45 at +10:30"}
    ${"Australia/Lord_Howe"} | ${"2024-10-06T02:15:00Z"} | ${"later"}      | ${"2024-10-05T15:45:00Z"} | ${"half-hour gap, 02:45 at +11:00"}
    ${"Australia/Lord_Howe"} | ${"2024-10-06T02:15:00Z"} | ${"reject"}     | ${undefined}              | ${"half-hour gap is refused"}
    ${"Australia/Lord_Howe"} | ${"2024-04-07T01:45:00Z"} | ${"compatible"} | ${"2024-04-06T14:45:00Z"} | ${"half-hour repeat, first is +11:00"}
    ${"Australia/Lord_Howe"} | ${"2024-04-07T01:45:00Z"} | ${"earlier"}    | ${"2024-04-06T14:45:00Z"} | ${"half-hour repeat, first is +11:00"}
    ${"Australia/Lord_Howe"} | ${"2024-04-07T01:45:00Z"} | ${"later"}      | ${"2024-04-06T15:15:00Z"} | ${"half-hour repeat, second is +10:30"}
    ${"Australia/Lord_Howe"} | ${"2024-04-07T01:45:00Z"} | ${"reject"}     | ${undefined}              | ${"half-hour repeat is refused"}
    ${"Australia/Sydney"}    | ${"2024-10-06T02:30:00Z"} | ${"later"}      | ${"2024-10-05T16:30:00Z"} | ${"gap, forward an hour is 03:30 at +11:00"}
    ${"Australia/Sydney"}    | ${"2024-10-06T02:30:00Z"} | ${"reject"}     | ${undefined}              | ${"gap is refused"}
    ${"Europe/Dublin"}       | ${"2024-03-31T01:30:00Z"} | ${"earlier"}    | ${"2024-03-31T00:30:00Z"} | ${"gap, back an hour (Dublin's winter time is a negative saving)"}
    ${"Europe/Dublin"}       | ${"2024-03-31T01:30:00Z"} | ${"compatible"} | ${"2024-03-31T01:30:00Z"} | ${"gap, forward an hour is 02:30 at +01:00"}
    ${"Europe/Dublin"}       | ${"2024-10-27T01:30:00Z"} | ${"later"}      | ${"2024-10-27T01:30:00Z"} | ${"repeat, second is 01:30 at +00:00"}
    ${"Europe/Dublin"}       | ${"2024-10-27T01:30:00Z"} | ${"compatible"} | ${"2024-10-27T00:30:00Z"} | ${"repeat, first is at +01:00"}
    ${"America/Goose_Bay"}   | ${"2010-11-06T23:45:00Z"} | ${"compatible"} | ${"2010-11-07T02:45:00Z"} | ${"the re-entered date, first pass"}
    ${"America/Goose_Bay"}   | ${"2010-11-06T23:45:00Z"} | ${"later"}      | ${"2010-11-07T03:45:00Z"} | ${"the re-entered date, second pass"}
    ${"America/Goose_Bay"}   | ${"2010-11-06T23:45:00Z"} | ${"reject"}     | ${undefined}              | ${"the re-entered date is refused"}
    ${"+05:45:30"}           | ${"2024-06-01T12:00:00Z"} | ${"reject"}     | ${"2024-06-01T06:14:30Z"} | ${"a fixed offset with seconds has one candidate"}
  `(
    "$zone reads $wall as $expected for $disambiguation ($why)",
    ({ zone, wall, disambiguation, expected }) => {
      const timeline = {
        "Europe/London": london,
        "Australia/Sydney": sydney,
        "Australia/Lord_Howe": lordHowe,
        "Europe/Dublin": dublin,
        "America/Goose_Bay": gooseBay,
        "+05:45:30": fixedSeconds,
      }[zone as string] as OffsetTimeline;
      expect(
        resolveWallNs(timeline, ns(wall), disambiguation as Disambiguation),
      ).toBe(expected === undefined ? undefined : ns(expected));
    },
  );
});

describe("startOfDayNs", () => {
  it.each`
    zone                   | date            | expected                  | why
    ${"America/Sao_Paulo"} | ${"2018-11-04"} | ${"2018-11-04T03:00:00Z"} | ${"midnight skipped, the day starts at 01:00 -02:00"}
    ${"America/Sao_Paulo"} | ${"2018-11-03"} | ${"2018-11-03T03:00:00Z"} | ${"an ordinary day at -03:00"}
    ${"Europe/London"}     | ${"2024-10-27"} | ${"2024-10-26T23:00:00Z"} | ${"midnight at BST +01:00"}
  `("$zone starts $date at $expected ($why)", ({ zone, date, expected }) => {
    const timeline = timelineOf(
      zone,
      "2018-01-01T00:00:00Z",
      "2025-01-01T00:00:00Z",
    );
    const day = Number(ns(`${date}T00:00:00Z`) / NANOSECONDS_PER_DAY);
    expect(startOfDayNs(timeline, day)).toBe(ns(expected));
  });
});

describe("offsetOf and possibleAt", () => {
  const london = timelineOf(
    "Europe/London",
    "2024-01-01T00:00:00Z",
    "2025-01-01T00:00:00Z",
  );

  it.each`
    at                        | expected
    ${"2024-03-31T00:59:59Z"} | ${0n}
    ${"2024-03-31T01:00:00Z"} | ${HOUR}
    ${"2024-10-27T00:59:59Z"} | ${HOUR}
    ${"2024-10-27T01:00:00Z"} | ${0n}
  `("Europe/London offset at $at is $expected", ({ at, expected }) => {
    expect(offsetOf(london, ns(at))).toBe(expected);
  });

  it.each`
    wall                      | count | why
    ${"2024-03-31T01:30:00Z"} | ${0}  | ${"skipped hour"}
    ${"2024-10-27T01:30:00Z"} | ${2}  | ${"repeated hour"}
    ${"2024-07-01T01:30:00Z"} | ${1}  | ${"ordinary time"}
  `("Europe/London $wall has $count candidates ($why)", ({ wall, count }) => {
    expect(possibleAt(london, ns(wall))).toHaveLength(count);
  });

  it("a fixed offset zone is one stretch of its own offset", () => {
    const kathmandu = timelineOf(
      "+05:45",
      "2024-01-01T00:00:00Z",
      "2034-01-01T00:00:00Z",
    );
    expect(kathmandu.changes).toEqual([]);
    expect(offsetOf(kathmandu, ns("2030-06-01T00:00:00Z"))).toBe(
      (5n * 60n + 45n) * 60_000_000_000n,
    );
  });
});

describe("startOfDayNs on dates a change deletes or repeats", () => {
  it.each`
    zone                     | from                      | to                        | date            | expected                  | why
    ${"Pacific/Apia"}        | ${"2011-06-01T00:00:00Z"} | ${"2012-06-01T00:00:00Z"} | ${"2011-12-29"} | ${"2011-12-29T10:00:00Z"} | ${"the day before the deleted one, at -10:00"}
    ${"Pacific/Apia"}        | ${"2011-06-01T00:00:00Z"} | ${"2012-06-01T00:00:00Z"} | ${"2011-12-30"} | ${"2011-12-30T10:00:00Z"} | ${"the deleted date starts where the next one does"}
    ${"Pacific/Apia"}        | ${"2011-06-01T00:00:00Z"} | ${"2012-06-01T00:00:00Z"} | ${"2011-12-31"} | ${"2011-12-30T10:00:00Z"} | ${"the day after, at +14:00"}
    ${"America/Goose_Bay"}   | ${"2010-06-01T00:00:00Z"} | ${"2011-06-01T00:00:00Z"} | ${"2010-11-07"} | ${"2010-11-07T03:00:00Z"} | ${"midnight happens twice, the first counts"}
    ${"Australia/Lord_Howe"} | ${"2024-01-01T00:00:00Z"} | ${"2025-01-01T00:00:00Z"} | ${"2024-10-06"} | ${"2024-10-05T13:30:00Z"} | ${"a half-hour change at 02:00 leaves midnight alone"}
  `(
    "$zone starts $date at $expected ($why)",
    ({ zone, from, to, date, expected }) => {
      const timeline = timelineOf(zone, from, to);
      const day = Number(ns(`${date}T00:00:00Z`) / DAY);
      expect(startOfDayNs(timeline, day)).toBe(ns(expected));
    },
  );
});

describe("offsetTimeline", () => {
  const frameOf = (zone: string) => {
    const frame = zoneFrame(zone);
    if (frame === null) throw new Error(`no frame for ${zone}`);
    return frame;
  };

  it("lists every Europe/London change of ten years across three-year searches", () => {
    // The last Sunday of March and of October at 01:00Z, 2020 to 2029 (tz 2026c).
    const timeline = timelineOf(
      "Europe/London",
      "2020-01-01T00:00:00Z",
      "2030-01-01T00:00:00Z",
    );
    expect(timeline.changes).toEqual(
      [
        "2020-03-29T01:00:00Z",
        "2020-10-25T01:00:00Z",
        "2021-03-28T01:00:00Z",
        "2021-10-31T01:00:00Z",
        "2022-03-27T01:00:00Z",
        "2022-10-30T01:00:00Z",
        "2023-03-26T01:00:00Z",
        "2023-10-29T01:00:00Z",
        "2024-03-31T01:00:00Z",
        "2024-10-27T01:00:00Z",
        "2025-03-30T01:00:00Z",
        "2025-10-26T01:00:00Z",
        "2026-03-29T01:00:00Z",
        "2026-10-25T01:00:00Z",
        "2027-03-28T01:00:00Z",
        "2027-10-31T01:00:00Z",
        "2028-03-26T01:00:00Z",
        "2028-10-29T01:00:00Z",
        "2029-03-25T01:00:00Z",
        "2029-10-28T01:00:00Z",
      ].map(ns),
    );
    expect(timeline.offsets).toEqual(
      Array.from({ length: 21 }, (_, index) => (index % 2 === 0 ? 0n : HOUR)),
    );
  });

  it.each`
    back     | shift  | why
    ${1098n} | ${-1n} | ${"a nanosecond before the first search ends at the change"}
    ${1098n} | ${0n}  | ${"the first search ends at the change"}
    ${1098n} | ${1n}  | ${"a nanosecond after"}
    ${2196n} | ${-1n} | ${"a nanosecond before the second search ends at the change"}
    ${2196n} | ${0n}  | ${"the second search ends at the change"}
    ${2196n} | ${1n}  | ${"a nanosecond after"}
  `(
    "keeps a change that falls on the end of a three-year search ($why)",
    ({ back, shift }) => {
      const change = ns("2024-03-31T01:00:00Z");
      const timeline = offsetTimeline(
        zoneFrame("Europe/London") as ZoneFrame,
        change - (back as bigint) * DAY + (shift as bigint),
        change + 400n * DAY,
      );
      expect(timeline.changes).toContain(change);
      expect(offsetOf(timeline, change - 1n)).toBe(0n);
      expect(offsetOf(timeline, change)).toBe(HOUR);
    },
  );

  it("a span of no length is the offset at its instant", () => {
    const at = ns("2024-07-01T00:00:00Z");
    const timeline = offsetTimeline(frameOf("Europe/London"), at, at);
    expect(timeline.changes).toEqual([]);
    expect(timeline.offsets).toEqual([HOUR]);
    expect(timeline.toNs).toBe(at);
  });

  it("the offset of a fixed offset with seconds includes the seconds", () => {
    const timeline = timelineOf(
      "+05:45:30",
      "2024-01-01T00:00:00Z",
      "2034-01-01T00:00:00Z",
    );
    expect(timeline.changes).toEqual([]);
    expect(timeline.offsets).toEqual([
      (5n * 60n + 45n) * 60_000_000_000n + 30_000_000_000n,
    ]);
  });

  it("a negative seconds offset is read west of UTC", () => {
    const timeline = timelineOf(
      "-00:44:30",
      "2024-01-01T00:00:00Z",
      "2024-02-01T00:00:00Z",
    );
    expect(timeline.offsets).toEqual([-(44n * 60n + 30n) * 1_000_000_000n]);
  });

  it("reads the offset before the span from its first stretch", () => {
    const timeline = timelineOf(
      "Europe/London",
      "2024-06-01T00:00:00Z",
      "2024-12-01T00:00:00Z",
    );
    expect(offsetOf(timeline, ns("2020-01-01T00:00:00Z"))).toBe(HOUR);
    expect(offsetOf(timeline, ns("2024-12-01T00:00:00Z"))).toBe(0n);
  });
});

describe("ensureTimeline", () => {
  const london = () =>
    timelineOf("Europe/London", "2024-01-01T00:00:00Z", "2024-01-21T00:00:00Z");

  it("leaves a timeline that already reaches the instant alone", () => {
    const timeline = london();
    ensureTimeline(timeline, ns("2024-01-21T00:00:00Z"));
    expect(timeline.toNs).toBe(ns("2024-01-21T00:00:00Z"));
    expect(timeline.changes).toEqual([]);
  });

  it("grows by its own length when the instant is just past it", () => {
    const timeline = london();
    ensureTimeline(timeline, ns("2024-01-21T00:00:01Z"));
    expect(timeline.toNs).toBe(ns("2024-02-10T00:00:00Z"));
  });

  it("grows to the instant when it is further than its own length", () => {
    const timeline = london();
    ensureTimeline(timeline, ns("2024-11-01T00:00:00Z"));
    expect(timeline.toNs).toBe(ns("2024-11-01T00:00:00Z"));
    expect(timeline.changes).toEqual(
      ["2024-03-31T01:00:00Z", "2024-10-27T01:00:00Z"].map(ns),
    );
  });

  it("grows by at most three years when the timeline is longer than that", () => {
    const timeline = timelineOf(
      "Europe/London",
      "2020-01-01T00:00:00Z",
      "2025-01-01T00:00:00Z",
    );
    ensureTimeline(timeline, ns("2025-01-01T00:00:01Z"));
    expect(timeline.toNs).toBe(ns("2025-01-01T00:00:00Z") + 3n * 366n * DAY);
    expect(timeline.changes).toHaveLength(16);
    expect(timeline.changes[15]).toBe(ns("2027-10-31T01:00:00Z"));
  });

  it("a fixed offset timeline grows without searching", () => {
    const timeline = timelineOf(
      "+05:45",
      "2024-01-01T00:00:00Z",
      "2024-01-21T00:00:00Z",
    );
    ensureTimeline(timeline, ns("2030-01-01T00:00:00Z"));
    expect(timeline.toNs).toBe(ns("2030-01-01T00:00:00Z"));
    expect(timeline.changes).toEqual([]);
  });
});

describe("possibleAt at the edges of a stretch", () => {
  const london = timelineOf(
    "Europe/London",
    "2024-01-01T00:00:00Z",
    "2025-01-01T00:00:00Z",
  );

  it.each`
    wall                      | expected                                            | why
    ${"2024-03-31T00:59:59Z"} | ${["2024-03-31T00:59:59Z"]}                         | ${"the last second before the change, GMT"}
    ${"2024-03-31T02:00:00Z"} | ${["2024-03-31T01:00:00Z"]}                         | ${"the first wall second after the gap is the change instant, BST"}
    ${"2024-10-27T00:59:59Z"} | ${["2024-10-26T23:59:59Z"]}                         | ${"before the repeated hour, BST"}
    ${"2024-10-27T01:00:00Z"} | ${["2024-10-27T00:00:00Z", "2024-10-27T01:00:00Z"]} | ${"the repeated hour starts at the change instant"}
    ${"2024-10-27T01:59:59Z"} | ${["2024-10-27T00:59:59Z", "2024-10-27T01:59:59Z"]} | ${"the repeated hour's last second"}
    ${"2024-10-27T02:00:00Z"} | ${["2024-10-27T02:00:00Z"]}                         | ${"after the repeated hour, GMT"}
  `("Europe/London reads $wall as $expected ($why)", ({ wall, expected }) => {
    expect(possibleAt(london, ns(wall))).toEqual(
      (expected as string[]).map(ns),
    );
  });
});

describe("resolveWallNs on a timeline no zone produces", () => {
  it("throws when the moved wall clock names no instant either", () => {
    // Offsets 0, +2 h at 00:00Z and +4 h at 01:00Z: 00:30 is in the first gap, and moving it
    // forward by the 4 h across the day lands on 04:30, which no stretch holds.
    const timeline: OffsetTimeline = {
      frame: zoneFrame("UTC") as ZoneFrame,
      fromNs: -10n * DAY,
      toNs: 10n * DAY,
      changes: [0n, HOUR],
      offsets: [0n, 2n * HOUR, 4n * HOUR],
    };
    expect(possibleAt(timeline, HOUR / 2n)).toEqual([]);
    expect(() => resolveWallNs(timeline, HOUR / 2n, "compatible")).toThrow(
      RangeError,
    );
    expect(() => resolveWallNs(timeline, HOUR / 2n, "later")).toThrow(
      RangeError,
    );
  });
});
