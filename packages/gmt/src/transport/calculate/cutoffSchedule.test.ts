import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../../test";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import type { BusinessCalendar } from "../../types";
import { cutoffAt } from "./cutoffAt";
import { cutoffSchedule } from "./cutoffSchedule";

/** A vessel leaving Friday 14 June 2024 at 18:00 in Amsterdam (+02:00, summer time). */
const departure = "2024-06-14T16:00:00Z";
const amsterdam = "Europe/Amsterdam";

/** The ocean stack, listed out of order on purpose. */
const stack = [
  { name: "gate-in", offset: "P1D" },
  { name: "document", offset: "P2D", atLocalTime: "17:00" },
  { name: "customs", offset: "PT30H" },
  { name: "VGM", offset: "P1D", atLocalTime: "10:00" },
];

describe("cutoffSchedule", () => {
  // Each value is cutoffAt's for the same entry (derived and polyfill-checked in
  // cutoffAt.test.ts); customs is 30 exact hours before 18:00 Friday, 12:00 Thursday.
  it("returns the whole stack against one anchor, earliest first", () => {
    expect(cutoffSchedule(departure, stack, { timeZone: amsterdam })).toEqual([
      { name: "document", at: "2024-06-12T17:00:00+02:00[Europe/Amsterdam]" },
      { name: "VGM", at: "2024-06-13T10:00:00+02:00[Europe/Amsterdam]" },
      { name: "customs", at: "2024-06-13T12:00:00+02:00[Europe/Amsterdam]" },
      { name: "gate-in", at: "2024-06-13T18:00:00+02:00[Europe/Amsterdam]" },
    ]);
  });

  it("moves every cut-off by a day when the anchor moves by a day", () => {
    const later = cutoffSchedule("2024-06-15T16:00:00Z", stack, {
      timeZone: amsterdam,
    });
    const before = cutoffSchedule(departure, stack, { timeZone: amsterdam });
    expect(later.map(({ name }) => name)).toEqual(
      before.map(({ name }) => name),
    );
    for (const [index, { at }] of later.entries()) {
      expect(
        Temporal.ZonedDateTime.from(before[index]!.at)
          .add({ days: 1 })
          .toString(),
      ).toBe(at);
    }
  });

  it("keeps entries that fall on the same instant in the order given", () => {
    expect(
      cutoffSchedule(
        departure,
        [
          { name: "second", offset: "PT24H" },
          { name: "first", offset: "P1D" },
          { name: "third", offset: "PT24H" },
        ],
        { timeZone: amsterdam },
      ).map(({ name }) => name),
    ).toEqual(["second", "first", "third"]);
  });

  it("orders by instant, not by the local wall clock text", () => {
    // 01:30 EDT (05:30Z) and 01:15 EST (06:15Z) on the fall-back day: the later-reading wall
    // clock is the earlier instant.
    expect(
      cutoffSchedule(
        "2024-11-03T07:15:00Z",
        [
          { name: "exact", offset: "PT1H" },
          { name: "pinned", offset: "P0D", atLocalTime: "01:30" },
        ],
        { timeZone: "America/New_York" },
      ),
    ).toEqual([
      { name: "pinned", at: "2024-11-03T01:30:00-04:00[America/New_York]" },
      { name: "exact", at: "2024-11-03T01:15:00-05:00[America/New_York]" },
    ]);
  });

  it("rolls every entry against the calendar", () => {
    // Tuesday 18 June 18:00: the document cut-off falls on Sunday and rolls back to Friday,
    // past the Monday VGM cut-off, and the order follows the rolled instants.
    const weekdays: BusinessCalendar = {
      weekend: [6, 7],
      holidays: [],
      timeZone: amsterdam,
    };
    expect(
      cutoffSchedule("2024-06-18T16:00:00Z", stack, {
        timeZone: amsterdam,
        calendar: weekdays,
      }),
    ).toEqual([
      { name: "document", at: "2024-06-14T17:00:00+02:00[Europe/Amsterdam]" },
      { name: "VGM", at: "2024-06-17T10:00:00+02:00[Europe/Amsterdam]" },
      { name: "customs", at: "2024-06-17T12:00:00+02:00[Europe/Amsterdam]" },
      { name: "gate-in", at: "2024-06-17T18:00:00+02:00[Europe/Amsterdam]" },
    ]);
  });

  it.each(battleTestTimeZones)(
    "agrees with cutoffAt entry by entry in %s",
    (timeZone) => {
      const schedule = cutoffSchedule(departure, stack, { timeZone });
      expect(schedule).toHaveLength(stack.length);
      for (const { name, offset, atLocalTime } of stack) {
        expect(schedule).toContainEqual({
          name,
          at: cutoffAt(departure, offset, { timeZone, atLocalTime }),
        });
      }
      const instants = schedule.map(({ at }) => Temporal.Instant.from(at));
      for (let index = 1; index < instants.length; index += 1) {
        expect(
          Temporal.Instant.compare(instants[index - 1]!, instants[index]!),
        ).toBeLessThanOrEqual(0);
      }
    },
  );

  it("reads atLocalTime from each entry, never from the options", () => {
    expect(
      cutoffSchedule(departure, [{ name: "gate-in", offset: "P1D" }], {
        timeZone: amsterdam,
        atLocalTime: "09:00",
      } as never),
    ).toEqual([
      { name: "gate-in", at: "2024-06-13T18:00:00+02:00[Europe/Amsterdam]" },
    ]);
  });

  it("returns an empty schedule for no cut-offs", () => {
    expect(cutoffSchedule(departure, [], { timeZone: amsterdam })).toEqual([]);
  });

  describe("invalid input returns the sentinel", () => {
    it.each`
      anchor                    | cutoffs                                                   | options                                       | why
      ${"2024-06-14T18:00:00"}  | ${stack}                                                  | ${{ timeZone: amsterdam }}                    | ${"a zoneless anchor"}
      ${departure}              | ${"stack"}                                                | ${{ timeZone: amsterdam }}                    | ${"cut-offs that are not an array"}
      ${departure}              | ${[...stack, null]}                                       | ${{ timeZone: amsterdam }}                    | ${"an entry that is not an object"}
      ${departure}              | ${[{ offset: "P1D" }]}                                    | ${{ timeZone: amsterdam }}                    | ${"an entry with no name"}
      ${departure}              | ${[{ name: 7, offset: "P1D" }]}                           | ${{ timeZone: amsterdam }}                    | ${"a name that is not a string"}
      ${departure}              | ${[...stack, { name: "bad", offset: "2 days" }]}          | ${{ timeZone: amsterdam }}                    | ${"one malformed offset spoils the stack"}
      ${departure}              | ${[{ name: "bad", offset: "P1D", atLocalTime: "5pm" }]}   | ${{ timeZone: amsterdam }}                    | ${"a malformed atLocalTime"}
      ${"2024-03-11T22:00:00Z"} | ${[{ name: "gap", offset: "P1D", atLocalTime: "02:30" }]} | ${{ timeZone: "America/New_York" }}           | ${"one cut-off in a skipped hour"}
      ${departure}              | ${stack}                                                  | ${{ timeZone: "Not/AZone" }}                  | ${"an unknown zone"}
      ${departure}              | ${stack}                                                  | ${{ timeZone: amsterdam, roll: "preceding" }} | ${"a roll with no calendar"}
      ${departure}              | ${stack}                                                  | ${undefined}                                  | ${"no options"}
      ${departure}              | ${stack}                                                  | ${null}                                       | ${"null options"}
    `("$why", ({ anchor, cutoffs, options }) => {
      expect(cutoffSchedule(anchor, cutoffs, options)).toEqual([]);
    });

    it("returns the sentinel when the instant parse throws", () => {
      mockTemporalInstantFromThrow();
      expect(cutoffSchedule(departure, stack, { timeZone: amsterdam })).toEqual(
        [],
      );
    });
  });
});
