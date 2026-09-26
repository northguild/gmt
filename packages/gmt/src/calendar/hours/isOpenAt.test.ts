import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../../test";
import {
  mockTemporalInstantFromEpochNanosecondsThrow,
  mockTemporalPlainTimeFromThrow,
} from "../../test/mocks";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import { isOpenAt } from "./isOpenAt";

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

function local(dateTime: string, timeZone: string): string {
  return Temporal.PlainDateTime.from(dateTime)
    .toZonedDateTime(timeZone)
    .toInstant()
    .toString();
}

describe("isOpenAt", () => {
  it("is open at 01:00 on the morning after a 23:00–06:00 window starts", () => {
    expect(isOpenAt("2024-06-15T01:00:00Z", fridayNight)).toBe(true);
  });

  it.each`
    at                                    | expected | reads
    ${"2024-06-14T22:59:59.999999999Z"}   | ${false} | ${"one nanosecond before it opens"}
    ${"2024-06-14T23:00:00Z"}             | ${true}  | ${"the opening instant"}
    ${"2024-06-15T00:00:00Z"}             | ${true}  | ${"midnight inside the wrap"}
    ${"2024-06-15T05:59:59.999999999Z"}   | ${true}  | ${"one nanosecond before it closes"}
    ${"2024-06-15T06:00:00Z"}             | ${false} | ${"the closing instant (half-open)"}
    ${"2024-06-16T01:00:00Z"}             | ${false} | ${"the next night, which Saturday has no window for"}
    ${"2024-06-15T03:00:00+02:00"}        | ${true}  | ${"an offset spelling of 01:00Z"}
    ${"2024-06-15T01:00:00Z[Asia/Tokyo]"} | ${true}  | ${"a bracketed zone, which is ignored"}
  `("is $expected at $reads", ({ at, expected }) => {
    expect(isOpenAt(at, fridayNight)).toBe(expected);
  });

  it("stays open across midnight where two whole days touch", () => {
    const allDay = [{ from: "00:00", to: "00:00" }];
    expect(
      isOpenAt("2024-06-11T00:00:00Z", {
        timeZone: "UTC",
        weekly: { 1: allDay, 2: allDay },
      }),
    ).toBe(true);
  });

  it.each`
    holidays          | expected | reads
    ${["2024-06-14"]} | ${false} | ${"Friday is a holiday"}
    ${["2024-06-15"]} | ${true}  | ${"Saturday is a holiday, which does not own the window"}
  `("is $expected at Saturday 01:00 when $reads", ({ holidays, expected }) => {
    expect(isOpenAt("2024-06-15T01:00:00Z", { ...fridayNight, holidays })).toBe(
      expected,
    );
  });

  // Sunday 10 March 2024 in New York: 02:30 does not exist. 07:00Z is 03:00 EDT, 07:45Z is 03:45.
  describe("a window edge in the spring-forward gap", () => {
    const gap = {
      timeZone: "America/New_York",
      weekly: { 7: [{ from: "02:30", to: "04:00" }] },
    };
    const covered = {
      timeZone: "America/New_York",
      weekly: {
        7: [
          { from: "02:30", to: "04:00" },
          { from: "03:30", to: "05:00" },
        ],
      },
    };

    it.each`
      schedule   | at                        | disambiguation  | expected | reads
      ${gap}     | ${"2024-03-10T07:00:00Z"} | ${undefined}    | ${false} | ${"compatible reads 02:30 as 03:30 EDT"}
      ${gap}     | ${"2024-03-10T07:00:00Z"} | ${"compatible"} | ${false} | ${"compatible reads 02:30 as 03:30 EDT"}
      ${gap}     | ${"2024-03-10T07:00:00Z"} | ${"later"}      | ${false} | ${"later reads 02:30 as 03:30 EDT"}
      ${gap}     | ${"2024-03-10T07:00:00Z"} | ${"earlier"}    | ${true}  | ${"earlier reads 02:30 as 01:30 EST"}
      ${gap}     | ${"2024-03-10T07:45:00Z"} | ${"compatible"} | ${true}  | ${"inside the window either way"}
      ${gap}     | ${"2024-03-10T07:45:00Z"} | ${"reject"}     | ${false} | ${"only the rejected window could be open"}
      ${covered} | ${"2024-03-10T07:45:00Z"} | ${"reject"}     | ${true}  | ${"a resolved 03:30 window covers the instant"}
    `(
      "is $expected under $disambiguation at $at: $reads",
      ({ schedule, at, disambiguation, expected }) => {
        expect(isOpenAt(at, schedule, { disambiguation })).toBe(expected);
      },
    );
  });

  it.each(battleTestTimeZones)(
    "reads 09:00–17:00 on a Monday in %s's local time",
    (timeZone) => {
      const schedule = { ...office, timeZone };
      expect(isOpenAt(local("2024-06-10T08:59:59", timeZone), schedule)).toBe(
        false,
      );
      expect(isOpenAt(local("2024-06-10T09:00", timeZone), schedule)).toBe(
        true,
      );
      expect(isOpenAt(local("2024-06-10T12:00", timeZone), schedule)).toBe(
        true,
      );
      expect(isOpenAt(local("2024-06-10T17:00", timeZone), schedule)).toBe(
        false,
      );
      expect(isOpenAt(local("2024-06-15T12:00", timeZone), schedule)).toBe(
        false,
      );
    },
  );

  describe("invalid input", () => {
    it.each`
      at                        | schedule                                                  | options                          | reads
      ${"2024-06-15T01:00:00"}  | ${fridayNight}                                            | ${undefined}                     | ${"no offset"}
      ${"2024-06-15"}           | ${fridayNight}                                            | ${undefined}                     | ${"a date"}
      ${""}                     | ${fridayNight}                                            | ${undefined}                     | ${"an empty string"}
      ${"2024-06-15T01:00:00Z"} | ${{ ...fridayNight, timeZone: "Invalid/Zone" }}           | ${undefined}                     | ${"an invalid zone"}
      ${"2024-06-15T01:00:00Z"} | ${{ ...fridayNight, weekly: { 0: nineToFive } }}          | ${undefined}                     | ${"weekday 0"}
      ${"2024-06-15T01:00:00Z"} | ${{ ...fridayNight, weekly: { 5: [{ from: "23:00" }] } }} | ${undefined}                     | ${"a malformed window"}
      ${"2024-06-15T01:00:00Z"} | ${null}                                                   | ${undefined}                     | ${"a null schedule"}
      ${"2024-06-15T01:00:00Z"} | ${fridayNight}                                            | ${{ disambiguation: "nearest" }} | ${"an unknown disambiguation"}
      ${"2024-06-15T01:00:00Z"} | ${fridayNight}                                            | ${null}                          | ${"null options"}
    `("is false for $reads", ({ at, schedule, options }) => {
      expect(isOpenAt(at, schedule, options)).toBe(false);
    });

    it("is false rather than throwing for hostile arguments", () => {
      expect(isOpenAt(hostileProxy() as never, fridayNight)).toBe(false);
      expect(isOpenAt("2024-06-15T01:00:00Z", revokedProxy() as never)).toBe(
        false,
      );
      expect(
        isOpenAt("2024-06-15T01:00:00Z", fridayNight, hostileProxy() as never),
      ).toBe(false);
    });
  });
});

describe("isOpenAt across a skipped local midnight", () => {
  it("is open inside a window moved onto the previous date under earlier", () => {
    // Africa/Cairo: Friday 00:30–03:00 read "earlier" is 21:30Z–00:00Z.
    const fridayOnly = {
      timeZone: "Africa/Cairo",
      weekly: { 5: [{ from: "00:30", to: "03:00" }] },
    };
    expect(
      isOpenAt("2024-04-25T21:50:00Z", fridayOnly, {
        disambiguation: "earlier",
      }),
    ).toBe(true);
    expect(isOpenAt("2024-04-25T21:50:00Z", fridayOnly)).toBe(false);
  });
});

describe("isOpenAt at the limits of the instant range", () => {
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
    at                                     | expected | reads
    ${"+275734-01-01T12:00:00Z"}           | ${true}  | ${"within 10,000 days of the last instant"}
    ${"+275760-09-12T12:00:00Z"}           | ${true}  | ${"on the last whole day"}
    ${"+275760-09-13T00:00:00Z"}           | ${true}  | ${"the last representable instant"}
    ${"+275760-09-13T00:00:00.000000001Z"} | ${false} | ${"one nanosecond past it (not an instant)"}
    ${"-271821-04-20T12:00:00Z"}           | ${true}  | ${"on the first representable day"}
    ${"-271821-04-20T00:00:00Z"}           | ${true}  | ${"the first representable instant"}
    ${"-271821-04-19T23:59:59.999999999Z"} | ${false} | ${"one nanosecond before it (not an instant)"}
  `(
    "is $expected $reads for a schedule open around the clock",
    ({ at, expected }) => {
      expect(isOpenAt(at, always)).toBe(expected);
    },
  );
});

describe("isOpenAt when Temporal throws", () => {
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
    expect(isOpenAt("2024-06-10T14:00:00Z", schedule)).toBe(false);
  });
});
