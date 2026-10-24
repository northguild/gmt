import { describe, expect, it } from "vitest";
import { Temporal } from "./temporal";
import { classifyWall } from "./earlierOccurrence";
import { nextTransitionAfter } from "./zonedTransitionSearch";
import { zoneFrame } from "./zoneFrame";
import { createLocalResolver, readOccurrenceWindow } from "./localResolution";
import type { LocalMoment } from "./recurrenceExpansion";
import { battleTestTimeZones } from "../test/timeZoneMatrix";

const SECONDS_PER_DAY = 86_400;

function moment(text: string): LocalMoment {
  const seconds = Temporal.Instant.from(`${text}Z`).epochMilliseconds / 1000;
  return {
    day: Math.floor(seconds / SECONDS_PER_DAY),
    second: ((seconds % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY,
  };
}

function nanoseconds(text: string): bigint {
  return Temporal.Instant.from(text).epochNanoseconds;
}

function resolver(zone: string) {
  return createLocalResolver(zoneFrame(zone)!);
}

describe("readOccurrenceWindow", () => {
  it.each`
    window                                                            | expected
    ${{ start: "2024-01-01T00:00:00Z", end: "2024-01-02T00:00:00Z" }} | ${{ kind: "interval", start: 1704067200000000000n, end: 1704153600000000000n }}
    ${{ start: "2024-01-01T00:00:00Z", end: "2024-01-01T00:00:00Z" }} | ${{ kind: "interval", start: 1704067200000000000n, end: 1704067200000000000n }}
    ${{ after: "2024-01-01T00:00:00Z", count: 1 }}                    | ${{ kind: "after", after: 1704067200000000000n, count: 1 }}
    ${{ after: "2024-01-01T00:00:00Z", count: 10_000 }}               | ${{ kind: "after", after: 1704067200000000000n, count: 10_000 }}
    ${{ start: "2024-01-02T00:00:00Z", end: "2024-01-01T00:00:00Z" }} | ${null}
    ${{ after: "2024-01-01T00:00:00Z", count: 0 }}                    | ${null}
    ${{ after: "2024-01-01T00:00:00Z", count: 10_001 }}               | ${null}
    ${{ after: "2024-01-01T00:00:00Z", count: 2.5 }}                  | ${null}
    ${{ after: "2024-01-01T00:00:00Z" }}                              | ${null}
    ${{ after: "2024-01-01T00:00:00", count: 1 }}                     | ${null}
    ${{ after: 5, count: 1 }}                                         | ${null}
    ${{ start: "x", end: "y" }}                                       | ${null}
    ${null}                                                           | ${null}
    ${"2024-01-01T00:00:00Z"}                                         | ${null}
    ${undefined}                                                      | ${null}
  `("$window reads as $expected", ({ window, expected }) => {
    expect(readOccurrenceWindow(window)).toEqual(expected);
  });
});

describe("createLocalResolver", () => {
  it.each`
    zone                     | local                    | kind             | earlier                   | later                     | transition
    ${"America/New_York"}    | ${"2024-07-15T12:00:00"} | ${"unique"}      | ${"2024-07-15T16:00:00Z"} | ${"2024-07-15T16:00:00Z"} | ${null}
    ${"America/New_York"}    | ${"2024-11-03T01:30:00"} | ${"ambiguous"}   | ${"2024-11-03T05:30:00Z"} | ${"2024-11-03T06:30:00Z"} | ${"2024-11-03T06:00:00Z"}
    ${"America/New_York"}    | ${"2024-03-10T02:30:00"} | ${"nonexistent"} | ${"2024-03-10T06:30:00Z"} | ${"2024-03-10T07:30:00Z"} | ${"2024-03-10T07:00:00Z"}
    ${"Australia/Lord_Howe"} | ${"2024-04-07T01:45:00"} | ${"ambiguous"}   | ${"2024-04-06T14:45:00Z"} | ${"2024-04-06T15:15:00Z"} | ${"2024-04-06T15:00:00Z"}
    ${"Pacific/Chatham"}     | ${"2024-09-29T03:15:00"} | ${"nonexistent"} | ${"2024-09-28T13:30:00Z"} | ${"2024-09-28T14:30:00Z"} | ${"2024-09-28T14:00:00Z"}
    ${"Pacific/Apia"}        | ${"2011-12-30T12:00:00"} | ${"nonexistent"} | ${"2011-12-29T22:00:00Z"} | ${"2011-12-30T22:00:00Z"} | ${"2011-12-30T10:00:00Z"}
    ${"UTC"}                 | ${"2024-11-03T01:30:00"} | ${"unique"}      | ${"2024-11-03T01:30:00Z"} | ${"2024-11-03T01:30:00Z"} | ${null}
    ${"-00:44:30"}           | ${"1970-01-01T12:00:00"} | ${"unique"}      | ${"1970-01-01T12:44:30Z"} | ${"1970-01-01T12:44:30Z"} | ${null}
    ${"+05:30"}              | ${"2024-03-10T02:30:00"} | ${"unique"}      | ${"2024-03-09T21:00:00Z"} | ${"2024-03-09T21:00:00Z"} | ${null}
  `(
    "$local in $zone is $kind",
    ({ zone, local, kind, earlier, later, transition }) => {
      expect(resolver(zone)(moment(local))).toEqual({
        kind,
        earlier: nanoseconds(earlier),
        later: nanoseconds(later),
        transition: transition === null ? null : nanoseconds(transition),
      });
    },
  );

  it("walks across a zone's transitions and past the three-year horizon of a zoneless future", () => {
    const resolve = resolver("America/New_York");
    // Ascending moments, one per ~half year, from 2024 to 2090: ordinary summer and winter noon.
    const expected: Array<[string, string]> = [
      ["2024-01-15T12:00:00", "2024-01-15T17:00:00Z"],
      ["2024-07-15T12:00:00", "2024-07-15T16:00:00Z"],
      ["2031-01-15T12:00:00", "2031-01-15T17:00:00Z"],
      ["2060-07-15T12:00:00", "2060-07-15T16:00:00Z"],
      ["2090-01-15T12:00:00", "2090-01-15T17:00:00Z"],
    ];
    for (const [local, instant] of expected) {
      expect(resolve(moment(local)).earlier).toBe(nanoseconds(instant));
    }
  });
});

describe("createLocalResolver, fixed rows worked out from tz offsets", () => {
  // Each row was checked with `Intl.DateTimeFormat` (`timeZoneName: "longOffset"`), not with GMT:
  // the offset before and after the change, the second the offset changes, then TC39 `Disambiguate`:
  // a reading is `L - offset` when the offset in force at that instant is that offset.
  it.each`
    zone                    | local                    | kind             | earlier                   | later                     | transition
    ${"Pacific/Apia"}       | ${"2011-12-30T12:00:00"} | ${"nonexistent"} | ${"2011-12-29T22:00:00Z"} | ${"2011-12-30T22:00:00Z"} | ${"2011-12-30T10:00:00Z"}
    ${"Pacific/Kiritimati"} | ${"1994-12-31T12:00:00"} | ${"nonexistent"} | ${"1994-12-30T22:00:00Z"} | ${"1994-12-31T22:00:00Z"} | ${"1994-12-31T10:00:00Z"}
    ${"America/Sitka"}      | ${"1867-10-19T12:00:00"} | ${"ambiguous"}   | ${"1867-10-18T21:01:13Z"} | ${"1867-10-19T21:01:13Z"} | ${"1867-10-19T00:31:13Z"}
    ${"Asia/Manila"}        | ${"1844-12-31T12:00:00"} | ${"nonexistent"} | ${"1844-12-31T03:56:08Z"} | ${"1845-01-01T03:56:08Z"} | ${"1844-12-31T15:56:08Z"}
    ${"America/Caracas"}    | ${"2007-12-09T02:45:00"} | ${"ambiguous"}   | ${"2007-12-09T06:45:00Z"} | ${"2007-12-09T07:15:00Z"} | ${"2007-12-09T07:00:00Z"}
    ${"America/Caracas"}    | ${"2016-05-01T02:45:00"} | ${"nonexistent"} | ${"2016-05-01T06:45:00Z"} | ${"2016-05-01T07:15:00Z"} | ${"2016-05-01T07:00:00Z"}
    ${"Africa/Casablanca"}  | ${"2024-03-10T02:30:00"} | ${"ambiguous"}   | ${"2024-03-10T01:30:00Z"} | ${"2024-03-10T02:30:00Z"} | ${"2024-03-10T02:00:00Z"}
    ${"Africa/Casablanca"}  | ${"2024-04-14T02:30:00"} | ${"nonexistent"} | ${"2024-04-14T01:30:00Z"} | ${"2024-04-14T02:30:00Z"} | ${"2024-04-14T02:00:00Z"}
  `(
    "$local in $zone is $kind",
    ({ zone, local, kind, earlier, later, transition }) => {
      expect(resolver(zone)(moment(local))).toEqual({
        kind,
        earlier: nanoseconds(earlier),
        later: nanoseconds(later),
        transition: nanoseconds(transition),
      });
    },
  );
});

describe("createLocalResolver equals classifyWall", () => {
  // The oracle is classifyWall (TC39 disambiguation), as the slice specifies. Every 30 minutes within
  // thirty hours of each transition in 2010-2030, and a 3989-minute grid (prime, so it meets every time of day) between.
  const zones = [
    ...battleTestTimeZones,
    "Australia/Lord_Howe",
    "Pacific/Chatham",
    "Pacific/Apia",
    "Antarctica/Casey",
  ];
  const MINUTE = 60_000_000_000n;
  const FROM = nanoseconds("2010-01-01T00:00:00Z");
  const SWEEP_FROM = nanoseconds("2018-01-01T00:00:00Z");
  const SWEEP_TO = nanoseconds("2025-01-01T00:00:00Z");
  const TO = nanoseconds("2030-01-01T00:00:00Z");

  function localSeconds(zone: string): number[] {
    const seconds = new Set<number>();
    const add = (instant: bigint, step: number, offset: number): void => {
      const wall = Temporal.Instant.fromEpochNanoseconds(instant)
        .toZonedDateTimeISO(zone)
        .toPlainDateTime();
      const base =
        Temporal.Instant.from(`${wall.toString({ smallestUnit: "second" })}Z`)
          .epochMilliseconds / 1000;
      seconds.add(base + offset * step);
    };
    for (let at = FROM; at < TO; at += 3989n * MINUTE) add(at, 1, 0);
    for (
      let change = nextTransitionAfter(zone, SWEEP_FROM);
      change !== null && change < SWEEP_TO;
      change = nextTransitionAfter(zone, change)
    ) {
      for (let k = -60; k <= 60; k += 1)
        add(change + BigInt(k) * 30n * MINUTE, 1, 0);
    }
    return [...seconds].sort((a, b) => a - b);
  }

  it.each(zones.map((zone) => ({ zone })))(
    "agrees for every sampled wall time in $zone",
    ({ zone }) => {
      const resolve = resolver(zone);
      const mismatches: string[] = [];
      for (const seconds of localSeconds(zone)) {
        const at = {
          day: Math.floor(seconds / SECONDS_PER_DAY),
          second:
            seconds - Math.floor(seconds / SECONDS_PER_DAY) * SECONDS_PER_DAY,
        };
        const wall = Temporal.PlainDateTime.from(
          Temporal.Instant.fromEpochMilliseconds(seconds * 1000)
            .toString()
            .replace("Z", "")
            .slice(0, 19),
        );
        const { kind, earliest, latest } = classifyWall(wall, zone);
        const got = resolve(at);
        if (
          got.kind !== kind ||
          got.earlier !== earliest.epochNanoseconds ||
          got.later !== latest.epochNanoseconds
        ) {
          mismatches.push(`${wall.toString()} ${got.kind}/${kind}`);
        }
      }
      expect(mismatches).toEqual([]);
    },
    60_000,
  );
});

describe("readOccurrenceWindow, more windows", () => {
  it.each`
    window                                                                 | expected
    ${{ after: "2024-01-01T02:00:00+02:00", count: 3 }}                    | ${{ kind: "after", after: 1704067200000000000n, count: 3 }}
    ${{ after: "2024-01-01T00:00:00.5Z", count: 3 }}                       | ${{ kind: "after", after: 1704067200500000000n, count: 3 }}
    ${{ after: "2024-01-01T00:00:00Z", count: 9_999 }}                     | ${{ kind: "after", after: 1704067200000000000n, count: 9_999 }}
    ${{ after: "2024-01-01T00:00:00Z", count: 3, start: "x" }}             | ${{ kind: "after", after: 1704067200000000000n, count: 3 }}
    ${{ start: "2024-01-01T02:00:00+02:00", end: "2024-01-01T00:00:01Z" }} | ${{ kind: "interval", start: 1704067200000000000n, end: 1704067201000000000n }}
    ${{ start: "1969-12-31T23:59:59Z", end: "1970-01-01T00:00:00Z" }}      | ${{ kind: "interval", start: -1000000000n, end: 0n }}
    ${{ after: "2024-01-01T00:00:00Z", count: "2" }}                       | ${null}
    ${{ after: "2024-01-01T00:00:00Z", count: Number.NaN }}                | ${null}
    ${{ after: "2024-01-01T00:00:00Z", count: Number.POSITIVE_INFINITY }}  | ${null}
    ${{ after: "2024-01-01T00:00:00Z", count: -1 }}                        | ${null}
    ${{ after: "2024-01-01T00:00:00Z", count: null }}                      | ${null}
    ${{ after: undefined, count: 1 }}                                      | ${null}
    ${{ after: null, count: 1 }}                                           | ${null}
    ${{ start: "2024-01-01T00:00:00Z" }}                                   | ${null}
    ${{ end: "2024-01-01T00:00:00Z" }}                                     | ${null}
    ${{}}                                                                  | ${null}
    ${5}                                                                   | ${null}
    ${true}                                                                | ${null}
  `("$window reads as $expected", ({ window, expected }) => {
    expect(readOccurrenceWindow(window)).toEqual(expected);
  });
});

describe("createLocalResolver at the edge of each transition", () => {
  // Derived from wall time and offset. A skipped time T (the wall clock jumps from `from` to `to`)
  // has two readings, T at the offset after the jump (earlier) and T at the offset before it (later);
  // a repeated time has T at the offset before the change (earlier) and after it (later).
  // `transition` is the instant the offset changes.
  it.each`
    zone                     | local                    | kind             | earlier                   | later                     | transition
    ${"America/New_York"}    | ${"2024-03-10T01:59:59"} | ${"unique"}      | ${"2024-03-10T06:59:59Z"} | ${"2024-03-10T06:59:59Z"} | ${null}
    ${"America/New_York"}    | ${"2024-03-10T02:00:00"} | ${"nonexistent"} | ${"2024-03-10T06:00:00Z"} | ${"2024-03-10T07:00:00Z"} | ${"2024-03-10T07:00:00Z"}
    ${"America/New_York"}    | ${"2024-03-10T02:59:59"} | ${"nonexistent"} | ${"2024-03-10T06:59:59Z"} | ${"2024-03-10T07:59:59Z"} | ${"2024-03-10T07:00:00Z"}
    ${"America/New_York"}    | ${"2024-03-10T03:00:00"} | ${"unique"}      | ${"2024-03-10T07:00:00Z"} | ${"2024-03-10T07:00:00Z"} | ${null}
    ${"America/New_York"}    | ${"2024-11-03T00:59:59"} | ${"unique"}      | ${"2024-11-03T04:59:59Z"} | ${"2024-11-03T04:59:59Z"} | ${null}
    ${"America/New_York"}    | ${"2024-11-03T01:00:00"} | ${"ambiguous"}   | ${"2024-11-03T05:00:00Z"} | ${"2024-11-03T06:00:00Z"} | ${"2024-11-03T06:00:00Z"}
    ${"America/New_York"}    | ${"2024-11-03T01:59:59"} | ${"ambiguous"}   | ${"2024-11-03T05:59:59Z"} | ${"2024-11-03T06:59:59Z"} | ${"2024-11-03T06:00:00Z"}
    ${"America/New_York"}    | ${"2024-11-03T02:00:00"} | ${"unique"}      | ${"2024-11-03T07:00:00Z"} | ${"2024-11-03T07:00:00Z"} | ${null}
    ${"Europe/Berlin"}       | ${"2024-03-31T02:00:00"} | ${"nonexistent"} | ${"2024-03-31T00:00:00Z"} | ${"2024-03-31T01:00:00Z"} | ${"2024-03-31T01:00:00Z"}
    ${"Europe/Berlin"}       | ${"2024-03-31T03:00:00"} | ${"unique"}      | ${"2024-03-31T01:00:00Z"} | ${"2024-03-31T01:00:00Z"} | ${null}
    ${"Europe/Berlin"}       | ${"2024-10-27T02:00:00"} | ${"ambiguous"}   | ${"2024-10-27T00:00:00Z"} | ${"2024-10-27T01:00:00Z"} | ${"2024-10-27T01:00:00Z"}
    ${"Europe/Berlin"}       | ${"2024-10-27T03:00:00"} | ${"unique"}      | ${"2024-10-27T02:00:00Z"} | ${"2024-10-27T02:00:00Z"} | ${null}
    ${"Europe/Dublin"}       | ${"2024-03-31T01:00:00"} | ${"nonexistent"} | ${"2024-03-31T00:00:00Z"} | ${"2024-03-31T01:00:00Z"} | ${"2024-03-31T01:00:00Z"}
    ${"Europe/Dublin"}       | ${"2024-10-27T01:59:59"} | ${"ambiguous"}   | ${"2024-10-27T00:59:59Z"} | ${"2024-10-27T01:59:59Z"} | ${"2024-10-27T01:00:00Z"}
    ${"America/Santiago"}    | ${"2024-09-07T23:59:59"} | ${"unique"}      | ${"2024-09-08T03:59:59Z"} | ${"2024-09-08T03:59:59Z"} | ${null}
    ${"America/Santiago"}    | ${"2024-09-08T00:00:00"} | ${"nonexistent"} | ${"2024-09-08T03:00:00Z"} | ${"2024-09-08T04:00:00Z"} | ${"2024-09-08T04:00:00Z"}
    ${"America/Santiago"}    | ${"2024-09-08T01:00:00"} | ${"unique"}      | ${"2024-09-08T04:00:00Z"} | ${"2024-09-08T04:00:00Z"} | ${null}
    ${"America/Santiago"}    | ${"2024-04-06T23:30:00"} | ${"ambiguous"}   | ${"2024-04-07T02:30:00Z"} | ${"2024-04-07T03:30:00Z"} | ${"2024-04-07T03:00:00Z"}
    ${"Australia/Lord_Howe"} | ${"2024-10-06T01:59:59"} | ${"unique"}      | ${"2024-10-05T15:29:59Z"} | ${"2024-10-05T15:29:59Z"} | ${null}
    ${"Australia/Lord_Howe"} | ${"2024-10-06T02:00:00"} | ${"nonexistent"} | ${"2024-10-05T15:00:00Z"} | ${"2024-10-05T15:30:00Z"} | ${"2024-10-05T15:30:00Z"}
    ${"Australia/Lord_Howe"} | ${"2024-10-06T02:29:59"} | ${"nonexistent"} | ${"2024-10-05T15:29:59Z"} | ${"2024-10-05T15:59:59Z"} | ${"2024-10-05T15:30:00Z"}
    ${"Australia/Lord_Howe"} | ${"2024-10-06T02:30:00"} | ${"unique"}      | ${"2024-10-05T15:30:00Z"} | ${"2024-10-05T15:30:00Z"} | ${null}
    ${"Australia/Lord_Howe"} | ${"2024-04-07T01:30:00"} | ${"ambiguous"}   | ${"2024-04-06T14:30:00Z"} | ${"2024-04-06T15:00:00Z"} | ${"2024-04-06T15:00:00Z"}
    ${"Australia/Lord_Howe"} | ${"2024-04-07T01:59:59"} | ${"ambiguous"}   | ${"2024-04-06T14:59:59Z"} | ${"2024-04-06T15:29:59Z"} | ${"2024-04-06T15:00:00Z"}
    ${"Australia/Lord_Howe"} | ${"2024-04-07T02:00:00"} | ${"unique"}      | ${"2024-04-06T15:30:00Z"} | ${"2024-04-06T15:30:00Z"} | ${null}
    ${"Pacific/Chatham"}     | ${"2024-09-29T02:44:59"} | ${"unique"}      | ${"2024-09-28T13:59:59Z"} | ${"2024-09-28T13:59:59Z"} | ${null}
    ${"Pacific/Chatham"}     | ${"2024-09-29T02:45:00"} | ${"nonexistent"} | ${"2024-09-28T13:00:00Z"} | ${"2024-09-28T14:00:00Z"} | ${"2024-09-28T14:00:00Z"}
    ${"Pacific/Chatham"}     | ${"2024-09-29T03:44:59"} | ${"nonexistent"} | ${"2024-09-28T13:59:59Z"} | ${"2024-09-28T14:59:59Z"} | ${"2024-09-28T14:00:00Z"}
    ${"Pacific/Chatham"}     | ${"2024-09-29T03:45:00"} | ${"unique"}      | ${"2024-09-28T14:00:00Z"} | ${"2024-09-28T14:00:00Z"} | ${null}
    ${"Pacific/Chatham"}     | ${"2024-04-07T02:45:00"} | ${"ambiguous"}   | ${"2024-04-06T13:00:00Z"} | ${"2024-04-06T14:00:00Z"} | ${"2024-04-06T14:00:00Z"}
    ${"Pacific/Chatham"}     | ${"2024-04-07T03:44:59"} | ${"ambiguous"}   | ${"2024-04-06T13:59:59Z"} | ${"2024-04-06T14:59:59Z"} | ${"2024-04-06T14:00:00Z"}
    ${"Pacific/Chatham"}     | ${"2024-04-07T03:45:00"} | ${"unique"}      | ${"2024-04-06T15:00:00Z"} | ${"2024-04-06T15:00:00Z"} | ${null}
    ${"Pacific/Apia"}        | ${"2011-12-29T23:59:59"} | ${"unique"}      | ${"2011-12-30T09:59:59Z"} | ${"2011-12-30T09:59:59Z"} | ${null}
    ${"Pacific/Apia"}        | ${"2011-12-30T00:00:00"} | ${"nonexistent"} | ${"2011-12-29T10:00:00Z"} | ${"2011-12-30T10:00:00Z"} | ${"2011-12-30T10:00:00Z"}
    ${"Pacific/Apia"}        | ${"2011-12-30T23:59:59"} | ${"nonexistent"} | ${"2011-12-30T09:59:59Z"} | ${"2011-12-31T09:59:59Z"} | ${"2011-12-30T10:00:00Z"}
    ${"Pacific/Apia"}        | ${"2011-12-31T00:00:00"} | ${"unique"}      | ${"2011-12-30T10:00:00Z"} | ${"2011-12-30T10:00:00Z"} | ${null}
    ${"Antarctica/Casey"}    | ${"2020-10-04T00:00:59"} | ${"unique"}      | ${"2020-10-03T16:00:59Z"} | ${"2020-10-03T16:00:59Z"} | ${null}
    ${"Antarctica/Casey"}    | ${"2020-10-04T00:01:00"} | ${"nonexistent"} | ${"2020-10-03T13:01:00Z"} | ${"2020-10-03T16:01:00Z"} | ${"2020-10-03T16:01:00Z"}
    ${"Antarctica/Casey"}    | ${"2020-10-04T03:00:59"} | ${"nonexistent"} | ${"2020-10-03T16:00:59Z"} | ${"2020-10-03T19:00:59Z"} | ${"2020-10-03T16:01:00Z"}
    ${"Antarctica/Casey"}    | ${"2020-10-04T03:01:00"} | ${"unique"}      | ${"2020-10-03T16:01:00Z"} | ${"2020-10-03T16:01:00Z"} | ${null}
  `(
    "$local in $zone is $kind",
    ({ zone, local, kind, earlier, later, transition }) => {
      expect(resolver(zone)(moment(local))).toEqual({
        kind,
        earlier: nanoseconds(earlier),
        later: nanoseconds(later),
        transition: transition === null ? null : nanoseconds(transition),
      });
    },
  );

  it.each`
    zone                 | local
    ${"Asia/Kolkata"}    | ${"2090-07-15T12:00:00"}
    ${"Asia/Shanghai"}   | ${"2090-07-15T12:00:00"}
    ${"America/Phoenix"} | ${"2090-03-10T02:30:00"}
    ${"Pacific/Niue"}    | ${"2090-07-15T12:00:00"}
    ${"Etc/GMT"}         | ${"2090-03-10T02:30:00"}
    ${"UTC"}             | ${"1900-03-10T02:30:00"}
  `(
    "$local in $zone, a zone with no further change, is unique",
    ({ zone, local }) => {
      const resolved = resolver(zone)(moment(local));

      expect(resolved.kind).toBe("unique");
      expect(resolved.earlier).toBe(resolved.later);
      expect(resolved.transition).toBeNull();
    },
  );
});

describe("createLocalResolver, order and reuse", () => {
  const gap = "2024-03-10T02:30:00";
  const gapAnswer = {
    kind: "nonexistent",
    earlier: nanoseconds("2024-03-10T06:30:00Z"),
    later: nanoseconds("2024-03-10T07:30:00Z"),
    transition: nanoseconds("2024-03-10T07:00:00Z"),
  };

  it("a moment before the cursor starts it again and is still right", () => {
    const resolve = resolver("America/New_York");

    expect(resolve(moment("2031-07-15T12:00:00")).earlier).toBe(
      nanoseconds("2031-07-15T16:00:00Z"),
    );
    expect(resolve(moment(gap))).toEqual(gapAnswer);
  });

  it("the same moment twice, and a moment on each side of a transition in turn, agree", () => {
    const resolve = resolver("America/New_York");
    const first = resolve(moment(gap));

    expect(resolve(moment(gap))).toEqual(first);
    expect(resolve(moment("2024-03-10T03:00:00")).kind).toBe("unique");
    expect(resolve(moment("2024-03-10T01:59:59")).kind).toBe("unique");
    expect(resolve(moment(gap))).toEqual(gapAnswer);
  });

  it("walks across many transitions in order without losing the offset", () => {
    const resolve = resolver("Europe/Berlin");
    const expected: Array<[string, string]> = [
      ["2024-01-15T12:00:00", "2024-01-15T11:00:00Z"],
      ["2024-03-30T12:00:00", "2024-03-30T11:00:00Z"],
      ["2024-03-31T12:00:00", "2024-03-31T10:00:00Z"],
      ["2024-10-26T12:00:00", "2024-10-26T10:00:00Z"],
      ["2024-10-27T12:00:00", "2024-10-27T11:00:00Z"],
      ["2025-07-01T12:00:00", "2025-07-01T10:00:00Z"],
      ["2025-12-01T12:00:00", "2025-12-01T11:00:00Z"],
    ];

    for (const [local, instant] of expected) {
      expect(resolve(moment(local)).earlier).toBe(nanoseconds(instant));
    }
  });

  it("jumps tens of thousands of years without walking each transition between", () => {
    // New York changes its offset twice a year, so walking from 2025 to +162933 would pass about
    // 320,000 changes. The expected readings come from Temporal, not from the cursor.
    const zone = "America/New_York";
    const resolve = resolver(zone);
    const march = Temporal.ZonedDateTime.from(
      "+100000-03-01T00:00:00[America/New_York]",
    ).getTimeZoneTransition("next")!;
    const gap = march.toPlainDateTime().with({ hour: 2, minute: 30 });
    const read = (
      local: Temporal.PlainDateTime,
      disambiguation: "earlier" | "later",
    ) => local.toZonedDateTime(zone, { disambiguation }).epochNanoseconds;

    const unique = (text: string) => {
      const at = read(Temporal.PlainDateTime.from(text), "earlier");

      return { kind: "unique", earlier: at, later: at, transition: null };
    };

    expect(
      [
        "2025-01-18T19:30:59",
        "+045127-11-16T00:01:59",
        "+095514-09-16T00:01:59",
        gap.toString(),
        "+162933-09-16T00:01:59",
      ].map((local) => resolve(moment(local))),
    ).toEqual([
      unique("2025-01-18T19:30:59"),
      unique("+045127-11-16T00:01:59"),
      unique("+095514-09-16T00:01:59"),
      {
        kind: "nonexistent",
        earlier: read(gap, "earlier"),
        later: read(gap, "later"),
        transition: march.epochNanoseconds,
      },
      unique("+162933-09-16T00:01:59"),
    ]);
  });

  it("two resolvers do not share a cursor", () => {
    const a = resolver("America/New_York");
    const b = resolver("Europe/Berlin");

    expect(a(moment("2024-07-15T12:00:00")).earlier).toBe(
      nanoseconds("2024-07-15T16:00:00Z"),
    );
    expect(b(moment("2024-07-15T12:00:00")).earlier).toBe(
      nanoseconds("2024-07-15T10:00:00Z"),
    );
    expect(a(moment("2024-01-15T12:00:00")).earlier).toBe(
      nanoseconds("2024-01-15T17:00:00Z"),
    );
  });

  it.each`
    zone           | local                    | instant
    ${"+14:00"}    | ${"2024-03-10T02:30:00"} | ${"2024-03-09T12:30:00Z"}
    ${"-12:00"}    | ${"2024-03-10T02:30:00"} | ${"2024-03-10T14:30:00Z"}
    ${"+05:45"}    | ${"2024-11-03T01:30:00"} | ${"2024-11-02T19:45:00Z"}
    ${"+02:10:08"} | ${"2024-01-01T00:00:00"} | ${"2023-12-31T21:49:52Z"}
    ${"-00:44:30"} | ${"1900-01-01T00:00:00"} | ${"1900-01-01T00:44:30Z"}
  `(
    "a stored offset $zone makes $local unique at $instant",
    ({ zone, local, instant }) => {
      const at = nanoseconds(instant);

      expect(resolver(zone)(moment(local))).toEqual({
        kind: "unique",
        earlier: at,
        later: at,
        transition: null,
      });
    },
  );
});

describe("createLocalResolver against the offsets Temporal reports", () => {
  // An oracle that does not use classifyWall or any GMT function: a wall time W (read as UTC) can
  // be an instant `W - offset` only when the zone's offset at that instant is `offset`. The offsets
  // in force a day either side of W are the only candidates (no two offsets differ by a day).
  const zones = [
    ...battleTestTimeZones,
    "Australia/Lord_Howe",
    "Pacific/Chatham",
    "Pacific/Apia",
    "Antarctica/Casey",
    "America/Santiago",
  ];
  const DAY = 86_400_000_000_000n;

  function offsetAtInstant(zone: string, instant: bigint): bigint {
    return BigInt(
      Temporal.Instant.fromEpochNanoseconds(instant).toZonedDateTimeISO(zone)
        .offsetNanoseconds,
    );
  }

  function candidates(zone: string, wall: bigint): bigint[] {
    const found = new Set<bigint>();
    for (const probe of [wall - DAY, wall, wall + DAY]) {
      const offset = offsetAtInstant(zone, probe);
      const instant = wall - offset;
      if (offsetAtInstant(zone, instant) === offset) found.add(instant);
    }
    return [...found].sort((a, b) => (a < b ? -1 : 1));
  }

  type Resolved = ReturnType<ReturnType<typeof resolver>>;

  /** Walls every 7 days (and an hour) for 2024-2025, and every 15 minutes within 2 hours of each transition. */
  function sweepWalls(zone: string, from: bigint, to: bigint): bigint[] {
    const walls: bigint[] = [];

    for (let at = from; at < to; at += 7n * DAY + 3_599_000_000_000n) {
      walls.push(at);
    }
    for (
      let change = nextTransitionAfter(zone, from);
      change !== null && change < to;
      change = nextTransitionAfter(zone, change)
    ) {
      const offset = offsetAtInstant(zone, change);
      for (let k = -8; k <= 8; k += 1) {
        walls.push(change + offset + BigInt(k) * 900_000_000_000n);
      }
    }

    return walls.sort((a, b) => (a < b ? -1 : 1));
  }

  function kindOf(found: bigint[]): "unique" | "ambiguous" | "nonexistent" {
    if (found.length === 2) return "ambiguous";

    return found.length === 0 ? "nonexistent" : "unique";
  }

  /** Whether `transition` is a real offset change inside `[earlier, later]`, with `earlier` before it. */
  function badTransition(zone: string, got: Resolved): boolean {
    return (
      got.transition === null ||
      !(got.earlier < got.transition && got.transition <= got.later) ||
      offsetAtInstant(zone, got.transition) ===
        offsetAtInstant(zone, got.transition - 1n)
    );
  }

  function badNonexistent(zone: string, wall: bigint, got: Resolved): boolean {
    // The two readings are the wall time at the offset after and before the jump.
    const before = wall - offsetAtInstant(zone, wall - DAY);
    const after = wall - offsetAtInstant(zone, wall + DAY);

    return (
      got.earlier !== (before < after ? before : after) ||
      got.later !== (before < after ? after : before) ||
      badTransition(zone, got)
    );
  }

  function badReadings(
    zone: string,
    kind: string,
    got: Resolved,
    found: bigint[],
  ): boolean {
    return (
      got.earlier !== found[0] ||
      got.later !== found[found.length - 1] ||
      (kind === "ambiguous" && badTransition(zone, got)) ||
      (kind === "unique" && got.transition !== null)
    );
  }

  /** What differs between the resolver's answer and the Temporal-derived one, or null when nothing does. */
  function mismatchOf(
    zone: string,
    wall: bigint,
    got: Resolved,
    found: bigint[],
  ): string | null {
    const kind = kindOf(found);

    if (got.kind !== kind) return `${wall} kind ${got.kind}/${kind}`;

    const bad =
      kind === "nonexistent"
        ? badNonexistent(zone, wall, got)
        : badReadings(zone, kind, got, found);

    return bad ? `${wall} readings` : null;
  }

  it.each(zones.map((zone) => ({ zone })))(
    "agrees in $zone around each transition of 2024-2025 and every 7 days",
    ({ zone }) => {
      const resolve = resolver(zone);
      const walls = sweepWalls(
        zone,
        nanoseconds("2024-01-01T00:00:00Z"),
        nanoseconds("2026-01-01T00:00:00Z"),
      );
      const mismatches: string[] = [];

      for (const wall of walls) {
        const seconds = Number(wall / 1_000_000_000n);
        const day = Math.floor(seconds / SECONDS_PER_DAY);
        const got = resolve({ day, second: seconds - day * SECONDS_PER_DAY });
        const mismatch = mismatchOf(zone, wall, got, candidates(zone, wall));

        if (mismatch !== null) mismatches.push(mismatch);
      }

      expect(mismatches).toEqual([]);
    },
    60_000,
  );
});
