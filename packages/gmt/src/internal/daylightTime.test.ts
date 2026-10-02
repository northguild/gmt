import type { Temporal } from "@js-temporal/polyfill";
import { isInDaylightTime, observesDaylightTime } from "./daylightTime";

const DAY = 86_400_000_000_000n;
const HOUR = 3_600_000_000_000;
const MINUTE = 60_000_000_000;

/**
 * A made-up zone with the given clock changes (`day` since the epoch, `step` in nanoseconds), read
 * at `day`. No real zone changes its clocks more than 64 times in a year, so the walk bound can
 * only be reached with one built for the purpose. The id is an offset so the transition wrappers
 * take the changes as given.
 */
function madeUpZone(
  changes: Array<{ day: number; step: number }>,
  day: number,
): Temporal.ZonedDateTime {
  const sorted = changes
    .map((change) => ({ at: BigInt(change.day) * DAY, step: change.step }))
    .sort((a, b) => (a.at < b.at ? -1 : 1));

  const at = (epochNanoseconds: bigint): Temporal.ZonedDateTime =>
    ({
      epochNanoseconds,
      timeZoneId: "+00:00",
      offsetNanoseconds: sorted
        .filter((change) => change.at <= epochNanoseconds)
        .reduce((total, change) => total + change.step, 0),
      getTimeZoneTransition(direction: "next" | "previous") {
        const found =
          direction === "next"
            ? sorted.find((change) => change.at > epochNanoseconds)
            : sorted.findLast((change) => change.at < epochNanoseconds);
        return found === undefined ? null : at(found.at);
      },
      subtract({ nanoseconds }: { nanoseconds: number }) {
        return at(epochNanoseconds - BigInt(nanoseconds));
      },
    }) as unknown as Temporal.ZonedDateTime;

  return at(BigInt(day) * DAY + DAY / 2n);
}

/** `count` one-minute set-backs on consecutive days from `firstDay`. */
function dailySetBacks(firstDay: number, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    day: firstDay + i,
    step: -MINUTE,
  }));
}

describe("isInDaylightTime", () => {
  // An advance on day 0, undone on day 200. Between them, `count` small set-backs that undo
  // nothing. The instant on day 150 is in daylight time by the rule.
  it.each`
    count | expected | why
    ${0}  | ${true}  | ${"the ordinary case"}
    ${10} | ${true}  | ${"11 changes in the year before"}
    ${63} | ${true}  | ${"64 changes in the year before"}
    ${64} | ${true}  | ${"65 changes in the year before, the most the walk reads"}
    ${65} | ${false} | ${"66 changes in the year before: past the bound"}
    ${90} | ${false} | ${"91 changes in the year before: past the bound"}
  `(
    "returns $expected with $count changes between an advance and the instant ($why)",
    ({ count, expected }) => {
      const zoned = madeUpZone(
        [
          { day: 0, step: HOUR },
          ...dailySetBacks(10, count),
          { day: 200, step: -HOUR },
        ],
        150,
      );
      expect(isInDaylightTime(zoned)).toBe(expected);
    },
  );

  // An advance on day 0, undone on day 300. After the instant on day 5, `count` small set-backs
  // come first.
  it.each`
    count | expected | why
    ${0}  | ${true}  | ${"the ordinary case"}
    ${10} | ${true}  | ${"the undoing change is the 11th ahead"}
    ${64} | ${true}  | ${"the undoing change is the 65th ahead, the last the walk reads"}
    ${65} | ${false} | ${"the undoing change is the 66th ahead: past the bound"}
    ${90} | ${false} | ${"the undoing change is the 91st ahead: past the bound"}
  `(
    "returns $expected with $count changes between the instant and the undoing change ($why)",
    ({ count, expected }) => {
      const zoned = madeUpZone(
        [
          { day: 0, step: HOUR },
          ...dailySetBacks(10, count),
          { day: 300, step: -HOUR },
        ],
        5,
      );
      expect(isInDaylightTime(zoned)).toBe(expected);
    },
  );

  // The pairing itself, on histories no real zone gives in so small a space.
  it.each`
    changes                                                                                                  | day    | expected | why
    ${[{ day: 0, step: HOUR }, { day: 100, step: -HOUR }]}                                                   | ${50}  | ${true}  | ${"advance undone 100 days on"}
    ${[{ day: 0, step: HOUR }, { day: 100, step: -HOUR }]}                                                   | ${150} | ${false} | ${"after the set-back"}
    ${[{ day: 0, step: HOUR }, { day: 364, step: -HOUR }]}                                                   | ${50}  | ${true}  | ${"undone 364 days on"}
    ${[{ day: 0, step: HOUR }, { day: 365, step: -HOUR }]}                                                   | ${50}  | ${false} | ${"undone exactly 365 days on"}
    ${[{ day: 0, step: HOUR }, { day: 100, step: -30 * MINUTE }]}                                            | ${50}  | ${false} | ${"set-back of another size"}
    ${[{ day: 0, step: HOUR }]}                                                                              | ${50}  | ${false} | ${"never undone"}
    ${[{ day: 0, step: -HOUR }, { day: 100, step: HOUR }]}                                                   | ${50}  | ${false} | ${"clocks put back, then forward"}
    ${[{ day: 0, step: HOUR }, { day: 30, step: HOUR }, { day: 60, step: -HOUR }, { day: 90, step: -HOUR }]} | ${15}  | ${true}  | ${"outer advance undone by the second set-back"}
    ${[{ day: 0, step: HOUR }, { day: 30, step: HOUR }, { day: 60, step: -HOUR }, { day: 90, step: -HOUR }]} | ${75}  | ${true}  | ${"outer advance still open after the first set-back"}
    ${[{ day: 0, step: HOUR }, { day: 30, step: HOUR }, { day: 60, step: -HOUR }]}                           | ${15}  | ${false} | ${"the set-back undoes the later advance"}
    ${[{ day: 0, step: HOUR }, { day: 30, step: HOUR }, { day: 60, step: -HOUR }]}                           | ${45}  | ${true}  | ${"the later advance is the one undone"}
    ${[{ day: 0, step: HOUR }, { day: 30, step: HOUR }, { day: 60, step: -HOUR }]}                           | ${75}  | ${false} | ${"the earlier advance is never undone"}
    ${[{ day: 0, step: HOUR }, { day: 30, step: 24 * HOUR }, { day: 60, step: -HOUR }]}                      | ${15}  | ${true}  | ${"undone across a jump of another size"}
    ${[{ day: 0, step: HOUR }, { day: 30, step: 24 * HOUR }, { day: 60, step: -HOUR }]}                      | ${45}  | ${true}  | ${"undone across a jump of another size"}
    ${[{ day: 0, step: HOUR }, { day: 30, step: 24 * HOUR }, { day: 60, step: -HOUR }]}                      | ${75}  | ${false} | ${"the jump is never undone"}
  `(
    "returns $expected on day $day of a made-up zone ($why)",
    ({ changes, day, expected }) => {
      expect(isInDaylightTime(madeUpZone(changes, day))).toBe(expected);
    },
  );
});

describe("observesDaylightTime", () => {
  // From day 0, `count` small set-backs on consecutive days, then a daylight period from day 200
  // to day 250. Every change ahead is within 365 days.
  it.each`
    count | expected | why
    ${0}  | ${true}  | ${"the period is the first change ahead"}
    ${10} | ${true}  | ${"the period is the 11th change ahead"}
    ${64} | ${true}  | ${"the period is the 65th change ahead, the last the walk reads"}
    ${65} | ${false} | ${"the period is the 66th change ahead: past the bound"}
    ${90} | ${false} | ${"the period is the 91st change ahead: past the bound"}
  `(
    "returns $expected with $count changes before the daylight period ahead ($why)",
    ({ count, expected }) => {
      const zoned = madeUpZone(
        [
          ...dailySetBacks(10, count),
          { day: 200, step: HOUR },
          { day: 250, step: -HOUR },
        ],
        0,
      );
      expect(observesDaylightTime(zoned)).toBe(expected);
    },
  );

  it.each`
    changes                                                  | day    | expected | why
    ${[{ day: 100, step: HOUR }, { day: 200, step: -HOUR }]} | ${150} | ${true}  | ${"in the period"}
    ${[{ day: 100, step: HOUR }, { day: 200, step: -HOUR }]} | ${0}   | ${true}  | ${"the period begins 100 days on"}
    ${[{ day: 400, step: HOUR }, { day: 500, step: -HOUR }]} | ${0}   | ${false} | ${"the period begins 400 days on"}
    ${[{ day: 100, step: HOUR }, { day: 200, step: -HOUR }]} | ${250} | ${false} | ${"nothing ahead"}
    ${[{ day: 100, step: HOUR }]}                            | ${0}   | ${false} | ${"the advance ahead is never undone"}
    ${[]}                                                    | ${0}   | ${false} | ${"no changes"}
  `(
    "returns $expected from day $day of a made-up zone ($why)",
    ({ changes, day, expected }) => {
      expect(observesDaylightTime(madeUpZone(changes, day))).toBe(expected);
    },
  );
});
