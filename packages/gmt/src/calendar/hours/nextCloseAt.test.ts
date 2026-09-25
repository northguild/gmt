import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../../test";
import {
  mockTemporalInstantFromEpochNanosecondsThrow,
  mockTemporalPlainTimeFromThrow,
} from "../../test/mocks";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import { nextCloseAt } from "./nextCloseAt";
import { nextOpenAt } from "./nextOpenAt";

const nineToFive = [{ from: "09:00", to: "17:00" }];
const allDay = [{ from: "00:00", to: "00:00" }];
const office = {
  timeZone: "America/New_York",
  weekly: {
    1: nineToFive,
    2: nineToFive,
    3: nineToFive,
    4: nineToFive,
    5: nineToFive,
  },
};
const fridayNight = {
  timeZone: "UTC",
  weekly: { 5: [{ from: "23:00", to: "06:00" }] },
};
/** Monday 17 June 2024, 10:00 EDT. */
const mondayTen = "2024-06-17T14:00:00Z";

function local(dateTime: string, timeZone: string): string {
  return Temporal.PlainDateTime.from(dateTime)
    .toZonedDateTime(timeZone)
    .toInstant()
    .toString();
}

describe("nextCloseAt", () => {
  it("returns 17:00 local from Monday 10:00", () => {
    expect(nextCloseAt(mondayTen, office)).toBe("2024-06-17T21:00:00Z");
  });

  it.each`
    from                                | expected                  | reads
    ${"2024-06-17T13:00:00Z"}           | ${"2024-06-17T21:00:00Z"} | ${"the opening instant: the close"}
    ${"2024-06-17T20:59:59.999999999Z"} | ${"2024-06-17T21:00:00Z"} | ${"one nanosecond before the close"}
    ${"2024-06-17T21:00:00Z"}           | ${"2024-06-17T21:00:00Z"} | ${"the closing instant: already closed"}
    ${"2024-06-15T16:00:00Z"}           | ${"2024-06-15T16:00:00Z"} | ${"a closed Saturday: the input itself"}
    ${"2024-06-15T12:00:00-04:00"}      | ${"2024-06-15T16:00:00Z"} | ${"a closed instant written with an offset: the input in UTC"}
  `("returns $expected from $reads", ({ from, expected }) => {
    expect(nextCloseAt(from, office)).toBe(expected);
  });

  it("follows a night window across midnight", () => {
    expect(nextCloseAt("2024-06-14T23:30:00Z", fridayNight)).toBe(
      "2024-06-15T06:00:00Z",
    );
  });

  it("runs through whole days that touch", () => {
    expect(
      nextCloseAt(mondayTen, {
        timeZone: "UTC",
        weekly: { 1: allDay, 2: allDay, 3: allDay },
      }),
    ).toBe("2024-06-20T00:00:00Z");
  });

  it("honours an override that closes early", () => {
    expect(
      nextCloseAt(mondayTen, {
        ...office,
        overrides: [
          { date: "2024-06-17", windows: [{ from: "09:00", to: "12:00" }] },
        ],
      }),
    ).toBe("2024-06-17T16:00:00Z");
  });

  it("gives the next open interval when paired with nextOpenAt", () => {
    const opens = nextOpenAt("2024-06-15T16:00:00Z", office);
    expect(opens).toBe("2024-06-17T13:00:00Z");
    expect(nextCloseAt(opens, office)).toBe("2024-06-17T21:00:00Z");
  });

  describe("the within horizon", () => {
    // Monday 10:00 EDT to the 17:00 EDT close is seven hours.
    it.each`
      within       | expected                  | reads
      ${"PT7H"}    | ${"2024-06-17T21:00:00Z"} | ${"a close exactly at the horizon counts"}
      ${"PT6H59M"} | ${""}                     | ${"one minute short"}
      ${undefined} | ${"2024-06-17T21:00:00Z"} | ${"the default"}
    `("$reads (within $within)", ({ within, expected }) => {
      expect(nextCloseAt(mondayTen, office, { within })).toBe(expected);
    });

    it("returns a closed input even with a zero horizon", () => {
      expect(
        nextCloseAt("2024-06-15T16:00:00Z", office, { within: "PT0S" }),
      ).toBe("2024-06-15T16:00:00Z");
    });

    it("returns the sentinel for a schedule open around the clock", () => {
      const always = {
        timeZone: "UTC",
        weekly: {
          1: allDay,
          2: allDay,
          3: allDay,
          4: allDay,
          5: allDay,
          6: allDay,
          7: allDay,
        },
      };
      expect(nextCloseAt(mondayTen, always)).toBe("");
      expect(nextCloseAt(mondayTen, always, { within: "P5Y" })).toBe("");
    });

    it("finds the close of a long run within the default year", () => {
      const always = {
        timeZone: "UTC",
        weekly: {
          1: allDay,
          2: allDay,
          3: allDay,
          4: allDay,
          5: allDay,
          6: allDay,
          7: allDay,
        },
        overrides: [{ date: "2025-01-01", windows: [] }],
      };
      expect(nextCloseAt(mondayTen, always)).toBe("2025-01-01T00:00:00Z");
    });
  });

  // Sunday 10 March 2024 in New York: 02:00–03:00 does not exist. 05:30Z is 00:30 EST.
  describe("a window edge in the spring-forward gap", () => {
    it.each`
      windows                                                             | disambiguation | expected                  | reads
      ${[{ from: "00:00", to: "02:30" }]}                                 | ${undefined}   | ${"2024-03-10T07:30:00Z"} | ${"compatible reads 02:30 as 03:30 EDT"}
      ${[{ from: "00:00", to: "02:30" }]}                                 | ${"later"}     | ${"2024-03-10T07:30:00Z"} | ${"later reads 02:30 as 03:30 EDT"}
      ${[{ from: "00:00", to: "02:30" }]}                                 | ${"earlier"}   | ${"2024-03-10T06:30:00Z"} | ${"earlier reads 02:30 as 01:30 EST"}
      ${[{ from: "00:00", to: "02:30" }]}                                 | ${"reject"}    | ${""}                     | ${"the open window itself is rejected"}
      ${[{ from: "00:00", to: "01:00" }, { from: "02:30", to: "04:00" }]} | ${"reject"}    | ${"2024-03-10T06:00:00Z"} | ${"a rejected window after the close cannot extend it"}
      ${[{ from: "00:00", to: "01:30" }, { from: "02:30", to: "04:00" }]} | ${"reject"}    | ${""}                     | ${"a rejected window that could start at the close"}
    `("$reads", ({ windows, disambiguation, expected }) => {
      expect(
        nextCloseAt(
          "2024-03-10T05:30:00Z",
          { timeZone: "America/New_York", weekly: { 7: windows } },
          { disambiguation },
        ),
      ).toBe(expected);
    });
  });

  it.each(battleTestTimeZones)(
    "returns 17:00 local from Monday 10:00 in %s",
    (timeZone) => {
      expect(
        nextCloseAt(local("2024-06-17T10:00", timeZone), {
          ...office,
          timeZone,
        }),
      ).toBe(local("2024-06-17T17:00", timeZone));
    },
  );

  describe("invalid input", () => {
    it.each`
      from                     | schedule                                 | options                          | reads
      ${"2024-06-17T10:00:00"} | ${office}                                | ${undefined}                     | ${"no offset"}
      ${"invalid"}             | ${office}                                | ${undefined}                     | ${"garbage"}
      ${mondayTen}             | ${{ ...office, timeZone: "" }}           | ${undefined}                     | ${"an empty zone"}
      ${mondayTen}             | ${{ ...office, holidays: ["tomorrow"] }} | ${undefined}                     | ${"an invalid holiday"}
      ${mondayTen}             | ${office}                                | ${{ within: "-PT1H" }}           | ${"a negative horizon"}
      ${mondayTen}             | ${office}                                | ${{ within: "" }}                | ${"an empty horizon"}
      ${mondayTen}             | ${office}                                | ${{ disambiguation: "reject " }} | ${"a misspelt disambiguation"}
      ${mondayTen}             | ${office}                                | ${null}                          | ${"null options"}
    `("returns the sentinel for $reads", ({ from, schedule, options }) => {
      expect(nextCloseAt(from, schedule, options)).toBe("");
    });

    it("returns the sentinel rather than throwing for hostile arguments", () => {
      expect(nextCloseAt(hostileProxy() as never, office)).toBe("");
      expect(nextCloseAt(mondayTen, revokedProxy() as never)).toBe("");
      expect(nextCloseAt(mondayTen, office, hostileProxy() as never)).toBe("");
    });
  });
});

describe("nextCloseAt when Temporal throws", () => {
  const schedule = {
    timeZone: "America/New_York",
    weekly: { 1: [{ from: "09:00", to: "17:00" }] },
  };

  it.each`
    mock                                            | reads
    ${mockTemporalPlainTimeFromThrow}               | ${"reading a window"}
    ${mockTemporalInstantFromEpochNanosecondsThrow} | ${"walking the local days"}
  `("returns the sentinel when $reads throws", ({ mock }) => {
    mock();
    expect(nextCloseAt("2024-06-10T14:00:00Z", schedule)).toBe("");
  });
});
