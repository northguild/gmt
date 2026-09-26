import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../../test";
import {
  mockTemporalInstantFromEpochNanosecondsThrow,
  mockTemporalPlainTimeFromThrow,
} from "../../test/mocks";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import { nextOpenAt } from "./nextOpenAt";

const nineToFive = [{ from: "09:00", to: "17:00" }];
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
/** Saturday 15 June 2024, 12:00 EDT. */
const saturdayNoon = "2024-06-15T16:00:00Z";

function local(dateTime: string, timeZone: string): string {
  return Temporal.PlainDateTime.from(dateTime)
    .toZonedDateTime(timeZone)
    .toInstant()
    .toString();
}

describe("nextOpenAt", () => {
  it("returns Monday 09:00 local from Saturday noon on a weekday schedule", () => {
    // Saturday 15 June 2024 12:00 EDT → Monday 17 June 09:00 EDT, 13:00 UTC.
    expect(nextOpenAt(saturdayNoon, office)).toBe("2024-06-17T13:00:00Z");
  });

  it.each`
    from                                | expected                  | reads
    ${"2024-06-17T14:00:00Z"}           | ${"2024-06-17T14:00:00Z"} | ${"already open: the input itself"}
    ${"2024-06-17T10:00:00-04:00"}      | ${"2024-06-17T14:00:00Z"} | ${"already open, written with an offset: the input in UTC"}
    ${"2024-06-17T13:00:00Z"}           | ${"2024-06-17T13:00:00Z"} | ${"the opening instant"}
    ${"2024-06-17T12:59:59.999999999Z"} | ${"2024-06-17T13:00:00Z"} | ${"one nanosecond before it opens"}
    ${"2024-06-17T21:00:00Z"}           | ${"2024-06-18T13:00:00Z"} | ${"the closing instant: the next morning"}
    ${"2024-06-14T21:00:00Z"}           | ${"2024-06-17T13:00:00Z"} | ${"Friday's close: over the weekend"}
  `("returns $expected from $reads", ({ from, expected }) => {
    expect(nextOpenAt(from, office)).toBe(expected);
  });

  it("skips a Monday holiday to Tuesday", () => {
    expect(
      nextOpenAt(saturdayNoon, { ...office, holidays: ["2024-06-17"] }),
    ).toBe("2024-06-18T13:00:00Z");
  });

  it("finds a Friday night window from Friday evening", () => {
    expect(nextOpenAt("2024-06-14T20:00:00Z", fridayNight)).toBe(
      "2024-06-14T23:00:00Z",
    );
  });

  it("returns the input for a schedule open around the clock", () => {
    const allDay = [{ from: "00:00", to: "00:00" }];
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
    expect(nextOpenAt(saturdayNoon, always)).toBe(saturdayNoon);
  });

  describe("the within horizon", () => {
    // Saturday 12:00 EDT to Monday 09:00 EDT is one local day and 21 hours.
    it.each`
      within             | expected                  | reads
      ${"P1DT21H"}       | ${"2024-06-17T13:00:00Z"} | ${"an opening exactly at the horizon counts"}
      ${"P1DT20H59M59S"} | ${""}                     | ${"one second short"}
      ${"P1D"}           | ${""}                     | ${"one day"}
      ${"PT0S"}          | ${""}                     | ${"no time at all, from a closed instant"}
      ${"P1W"}           | ${"2024-06-17T13:00:00Z"} | ${"a week"}
      ${undefined}       | ${"2024-06-17T13:00:00Z"} | ${"the default"}
    `("$reads (within $within)", ({ within, expected }) => {
      expect(nextOpenAt(saturdayNoon, office, { within })).toBe(expected);
    });

    it("clamps a horizon past Temporal's last instant to that instant", () => {
      expect(nextOpenAt(saturdayNoon, office, { within: "P1000000Y" })).toBe(
        "2024-06-17T13:00:00Z",
      );
    });

    it("returns an open input even with a zero horizon", () => {
      expect(
        nextOpenAt("2024-06-17T14:00:00Z", office, { within: "PT0S" }),
      ).toBe("2024-06-17T14:00:00Z");
    });

    it("adds within in local days, so a day across the fall-back is 25 hours", () => {
      // Saturday 2 November 12:00 EDT (16:00Z) to Monday 4 November 09:00 EST (14:00Z) is 46
      // elapsed hours, but one local day and 21 hours.
      expect(
        nextOpenAt("2024-11-02T16:00:00Z", office, { within: "P1DT21H" }),
      ).toBe("2024-11-04T14:00:00Z");
      expect(
        nextOpenAt("2024-11-02T16:00:00Z", office, { within: "PT45H" }),
      ).toBe("");
    });

    it("defaults to one year, found inside it and not past it", () => {
      const closedUntil = (date: string) => ({
        timeZone: "UTC",
        weekly: {},
        overrides: [{ date, windows: nineToFive }],
      });
      expect(nextOpenAt(saturdayNoon, closedUntil("2025-06-01"))).toBe(
        "2025-06-01T09:00:00Z",
      );
      expect(nextOpenAt(saturdayNoon, closedUntil("2025-06-20"))).toBe("");
      expect(
        nextOpenAt(saturdayNoon, closedUntil("2025-06-20"), { within: "P2Y" }),
      ).toBe("2025-06-20T09:00:00Z");
    });

    // From Saturday 2024-06-15, the 10,000th local date is 2051-11-01. A search answers anywhere
    // on it, and nowhere on the date after, even at its first instant.
    it.each`
      date            | windows                             | expected
      ${"2051-11-01"} | ${nineToFive}                       | ${"2051-11-01T09:00:00Z"}
      ${"2051-11-01"} | ${[{ from: "23:00", to: "23:30" }]} | ${"2051-11-01T23:00:00Z"}
      ${"2051-11-02"} | ${[{ from: "00:00", to: "01:00" }]} | ${""}
    `(
      "returns $expected for an opening on $date under a 30-year horizon",
      ({ date, windows, expected }) => {
        expect(
          nextOpenAt(
            "2024-06-15T12:00:00Z",
            { timeZone: "UTC", weekly: {}, overrides: [{ date, windows }] },
            { within: "P30Y" },
          ),
        ).toBe(expected);
      },
    );

    it("returns the sentinel for a schedule that never opens", () => {
      expect(nextOpenAt(saturdayNoon, { timeZone: "UTC", weekly: {} })).toBe(
        "",
      );
    });
  });

  // Sunday 10 March 2024 in New York: 02:30 does not exist.
  describe("a window edge in the spring-forward gap", () => {
    const schedule = {
      timeZone: "America/New_York",
      weekly: {
        7: [
          { from: "02:30", to: "04:00" },
          { from: "12:00", to: "13:00" },
        ],
      },
    };

    it.each`
      from                      | disambiguation  | expected
      ${"2024-03-10T00:00:00Z"} | ${undefined}    | ${"2024-03-10T07:30:00Z"}
      ${"2024-03-10T00:00:00Z"} | ${"compatible"} | ${"2024-03-10T07:30:00Z"}
      ${"2024-03-10T00:00:00Z"} | ${"later"}      | ${"2024-03-10T07:30:00Z"}
      ${"2024-03-10T00:00:00Z"} | ${"earlier"}    | ${"2024-03-10T06:30:00Z"}
      ${"2024-03-10T00:00:00Z"} | ${"reject"}     | ${""}
      ${"2024-03-10T08:00:00Z"} | ${"reject"}     | ${"2024-03-10T16:00:00Z"}
    `(
      "returns $expected from $from under $disambiguation",
      ({ from, disambiguation, expected }) => {
        expect(nextOpenAt(from, schedule, { disambiguation })).toBe(expected);
      },
    );
  });

  it.each(battleTestTimeZones)(
    "returns Monday 09:00 local from Saturday noon in %s",
    (timeZone) => {
      expect(
        nextOpenAt(local("2024-06-15T12:00", timeZone), {
          ...office,
          timeZone,
        }),
      ).toBe(local("2024-06-17T09:00", timeZone));
    },
  );

  describe("invalid input", () => {
    it.each`
      from                     | schedule                                    | options                          | reads
      ${"2024-06-15T12:00:00"} | ${office}                                   | ${undefined}                     | ${"no offset"}
      ${"invalid"}             | ${office}                                   | ${undefined}                     | ${"garbage"}
      ${saturdayNoon}          | ${{ ...office, timeZone: "Mars/Olympus" }}  | ${undefined}                     | ${"an invalid zone"}
      ${saturdayNoon}          | ${{ ...office, weekly: { 8: nineToFive } }} | ${undefined}                     | ${"weekday 8"}
      ${saturdayNoon}          | ${office}                                   | ${{ within: "-P1D" }}            | ${"a negative horizon"}
      ${saturdayNoon}          | ${office}                                   | ${{ within: "1 day" }}           | ${"a malformed horizon"}
      ${saturdayNoon}          | ${office}                                   | ${{ within: 86400 }}             | ${"a numeric horizon"}
      ${saturdayNoon}          | ${office}                                   | ${{ disambiguation: "nearest" }} | ${"an unknown disambiguation"}
      ${saturdayNoon}          | ${office}                                   | ${null}                          | ${"null options"}
      ${saturdayNoon}          | ${office}                                   | ${"P1D"}                         | ${"a string options argument"}
    `("returns the sentinel for $reads", ({ from, schedule, options }) => {
      expect(nextOpenAt(from, schedule, options)).toBe("");
    });

    it("returns the sentinel rather than throwing for hostile arguments", () => {
      expect(nextOpenAt(hostileProxy() as never, office)).toBe("");
      expect(nextOpenAt(saturdayNoon, revokedProxy() as never)).toBe("");
      expect(nextOpenAt(saturdayNoon, office, hostileProxy() as never)).toBe(
        "",
      );
    });
  });
});

describe("nextOpenAt across a skipped local midnight", () => {
  it("finds a window moved onto the previous date under earlier", () => {
    // Africa/Cairo: Friday 00:30 read "earlier" is Thursday 23:30 +02, 21:30Z.
    expect(
      nextOpenAt(
        "2024-04-25T20:00:00Z",
        {
          timeZone: "Africa/Cairo",
          weekly: { 5: [{ from: "00:30", to: "03:00" }] },
        },
        { disambiguation: "earlier" },
      ),
    ).toBe("2024-04-25T21:30:00Z");
  });
});

describe("nextOpenAt with a long horizon or at the limits", () => {
  const allDay = [{ from: "00:00", to: "00:00" }];
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

  it.each`
    from                         | within       | reads
    ${"2024-06-15T12:00:00Z"}    | ${"P30Y"}    | ${"an open input under a 30-year horizon"}
    ${"+275760-09-12T12:00:00Z"} | ${undefined} | ${"an input whose default horizon passes the last instant"}
    ${"-271821-04-20T12:00:00Z"} | ${undefined} | ${"an input on the first representable day"}
  `("returns $reads itself", ({ from, within }) => {
    expect(nextOpenAt(from, always, { within })).toBe(from);
  });
});

describe("nextOpenAt when Temporal throws", () => {
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
    expect(nextOpenAt("2024-06-09T14:00:00Z", schedule)).toBe("");
  });
});
