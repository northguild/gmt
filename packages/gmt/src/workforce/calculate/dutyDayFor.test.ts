import { Temporal } from "@js-temporal/polyfill";
import { localNoonBattleCases } from "../../test";
import type { DutyDay } from "../../types";
import { dutyDayFor } from "./dutyDayFor";

const ns = (instant: string) => Temporal.Instant.from(instant).epochNanoseconds;

describe("dutyDayFor", () => {
  it("accepts a DutyDay-typed reference day", () => {
    const day: DutyDay = { timeZone: "UTC", dayStartTime: "04:00" };

    expect(dutyDayFor("2024-01-01T10:00:00Z", day)).toEqual({
      start: "2024-01-01T04:00:00Z",
      end: "2024-01-02T04:00:00Z",
    });
  });

  // New York is UTC-5 in January, so its 04:00 is 09:00Z. 03:59 local is still the day that
  // began at 04:00 the day before; 04:00 local opens the next one (half-open).
  it.each`
    instant                                    | start                     | end                       | reason
    ${"2024-01-01T08:59:00Z"}                  | ${"2023-12-31T09:00:00Z"} | ${"2024-01-01T09:00:00Z"} | ${"03:59 local belongs to the previous day"}
    ${"2024-01-01T09:00:00Z"}                  | ${"2024-01-01T09:00:00Z"} | ${"2024-01-02T09:00:00Z"} | ${"04:00 local opens the next day"}
    ${"2024-01-01T04:00:00-05:00"}             | ${"2024-01-01T09:00:00Z"} | ${"2024-01-02T09:00:00Z"} | ${"the same instant written with an offset"}
    ${"2024-01-01T12:00:00+09:00[Asia/Tokyo]"} | ${"2023-12-31T09:00:00Z"} | ${"2024-01-01T09:00:00Z"} | ${"a Tokyo entry read in the reference zone: 22:00 the evening before"}
    ${"2024-01-01T23:59:59.999999999-05:00"}   | ${"2024-01-01T09:00:00Z"} | ${"2024-01-02T09:00:00Z"} | ${"local midnight is not a day boundary"}
  `(
    "returns [$start, $end) for $instant with 04:00 in America/New_York ($reason)",
    ({ instant, start, end }) => {
      expect(
        dutyDayFor(instant, {
          timeZone: "America/New_York",
          dayStartTime: "04:00",
        }),
      ).toEqual({ start, end });
    },
  );

  it.each`
    dayStartTime    | start                       | end                         | reason
    ${"00:00"}      | ${"2024-01-01T05:00:00Z"}   | ${"2024-01-02T05:00:00Z"}   | ${"local midnight, when the caller names it"}
    ${"18:30"}      | ${"2023-12-31T23:30:00Z"}   | ${"2024-01-01T23:30:00Z"}   | ${"a day starting in the evening"}
    ${"04:00:00.5"} | ${"2024-01-01T09:00:00.5Z"} | ${"2024-01-02T09:00:00.5Z"} | ${"a fractional start time"}
  `(
    "returns [$start, $end) for 2024-01-01T12:00:00Z with $dayStartTime ($reason)",
    ({ dayStartTime, start, end }) => {
      expect(
        dutyDayFor("2024-01-01T12:00:00Z", {
          timeZone: "America/New_York",
          dayStartTime,
        }),
      ).toEqual({ start, end });
    },
  );

  // A day start a clock change skips or repeats resolves "compatible" (CORE-4): a skipped time
  // is read after the gap, a repeated one at its first pass. The period that holds the change is
  // then shorter or longer by the change (expected values from Temporal's own "compatible"
  // resolution).
  it.each`
    timeZone                 | dayStartTime | instant                   | start                     | end                       | hours   | reason
    ${"America/New_York"}    | ${"02:30"}   | ${"2024-03-10T12:00:00Z"} | ${"2024-03-10T07:30:00Z"} | ${"2024-03-11T06:30:00Z"} | ${23}   | ${"02:30 is skipped on the spring-forward day and read as 03:30"}
    ${"America/New_York"}    | ${"02:30"}   | ${"2024-03-10T05:00:00Z"} | ${"2024-03-09T07:30:00Z"} | ${"2024-03-10T07:30:00Z"} | ${24}   | ${"the day before ends where the skipped start resolves"}
    ${"America/New_York"}    | ${"01:30"}   | ${"2024-11-03T12:00:00Z"} | ${"2024-11-03T05:30:00Z"} | ${"2024-11-04T06:30:00Z"} | ${25}   | ${"01:30 is repeated on the fall-back day; the first pass starts it"}
    ${"America/New_York"}    | ${"04:00"}   | ${"2024-11-03T07:00:00Z"} | ${"2024-11-02T08:00:00Z"} | ${"2024-11-03T09:00:00Z"} | ${25}   | ${"a fall-back inside the day"}
    ${"America/Santiago"}    | ${"00:00"}   | ${"2024-09-08T12:00:00Z"} | ${"2024-09-08T04:00:00Z"} | ${"2024-09-09T03:00:00Z"} | ${23}   | ${"local midnight is skipped and read as 01:00"}
    ${"America/Havana"}      | ${"00:30"}   | ${"2024-11-03T12:00:00Z"} | ${"2024-11-03T04:30:00Z"} | ${"2024-11-04T05:30:00Z"} | ${25}   | ${"midnight is repeated on the same date"}
    ${"America/Goose_Bay"}   | ${"23:30"}   | ${"2010-11-07T12:00:00Z"} | ${"2010-11-07T02:30:00Z"} | ${"2010-11-08T03:30:00Z"} | ${25}   | ${"the fall-back reopens the previous date"}
    ${"Australia/Lord_Howe"} | ${"01:45"}   | ${"2024-04-07T00:00:00Z"} | ${"2024-04-06T14:45:00Z"} | ${"2024-04-07T15:15:00Z"} | ${24.5} | ${"a 30-minute fall-back"}
    ${"Pacific/Chatham"}     | ${"03:15"}   | ${"2024-09-29T00:00:00Z"} | ${"2024-09-28T14:30:00Z"} | ${"2024-09-29T13:30:00Z"} | ${23}   | ${"a gap in a +12:45 zone"}
    ${"Antarctica/Casey"}    | ${"01:00"}   | ${"2020-10-04T00:00:00Z"} | ${"2020-10-03T17:00:00Z"} | ${"2020-10-04T14:00:00Z"} | ${21}   | ${"a three-hour jump"}
    ${"Pacific/Apia"}        | ${"04:00"}   | ${"2011-12-30T13:00:00Z"} | ${"2011-12-29T14:00:00Z"} | ${"2011-12-30T14:00:00Z"} | ${24}   | ${"the day before the deleted date"}
    ${"Pacific/Apia"}        | ${"04:00"}   | ${"2011-12-30T14:00:00Z"} | ${"2011-12-30T14:00:00Z"} | ${"2011-12-31T14:00:00Z"} | ${24}   | ${"the deleted date opens no day of its own"}
  `(
    "returns a $hours-hour day [$start, $end) for $instant with $dayStartTime in $timeZone ($reason)",
    ({ timeZone, dayStartTime, instant, start, end, hours }) => {
      const day = dutyDayFor(instant, { timeZone, dayStartTime });

      expect(day).toEqual({ start, end });
      expect(ns(start) <= ns(instant) && ns(instant) < ns(end)).toBe(true);
      expect(Number(ns(end) - ns(start)) / 3.6e12).toBe(hours);
    },
  );

  // New York skips 02:30 on 2024-03-10 and repeats 01:30 on 2024-11-03 (expected instants from
  // Temporal's own resolution of each wall time under each policy).
  it.each`
    dayStartTime | instant                   | disambiguation  | expected
    ${"02:30"}   | ${"2024-03-10T12:00:00Z"} | ${undefined}    | ${{ start: "2024-03-10T07:30:00Z", end: "2024-03-11T06:30:00Z" }}
    ${"02:30"}   | ${"2024-03-10T12:00:00Z"} | ${"compatible"} | ${{ start: "2024-03-10T07:30:00Z", end: "2024-03-11T06:30:00Z" }}
    ${"02:30"}   | ${"2024-03-10T12:00:00Z"} | ${"earlier"}    | ${{ start: "2024-03-10T06:30:00Z", end: "2024-03-11T06:30:00Z" }}
    ${"02:30"}   | ${"2024-03-10T12:00:00Z"} | ${"later"}      | ${{ start: "2024-03-10T07:30:00Z", end: "2024-03-11T06:30:00Z" }}
    ${"02:30"}   | ${"2024-03-10T12:00:00Z"} | ${"reject"}     | ${null}
    ${"02:30"}   | ${"2024-03-10T05:00:00Z"} | ${"reject"}     | ${null}
    ${"02:30"}   | ${"2024-03-08T12:00:00Z"} | ${"reject"}     | ${{ start: "2024-03-08T07:30:00Z", end: "2024-03-09T07:30:00Z" }}
    ${"01:30"}   | ${"2024-11-03T12:00:00Z"} | ${"earlier"}    | ${{ start: "2024-11-03T05:30:00Z", end: "2024-11-04T06:30:00Z" }}
    ${"01:30"}   | ${"2024-11-03T12:00:00Z"} | ${"later"}      | ${{ start: "2024-11-03T06:30:00Z", end: "2024-11-04T06:30:00Z" }}
    ${"01:30"}   | ${"2024-11-03T06:00:00Z"} | ${"later"}      | ${{ start: "2024-11-02T05:30:00Z", end: "2024-11-03T06:30:00Z" }}
    ${"01:30"}   | ${"2024-11-03T12:00:00Z"} | ${"reject"}     | ${null}
  `(
    "resolves a $dayStartTime start under $disambiguation for $instant",
    ({ dayStartTime, instant, disambiguation, expected }) => {
      expect(
        dutyDayFor(instant, {
          timeZone: "America/New_York",
          dayStartTime,
          disambiguation,
        }),
      ).toEqual(expected);
    },
  );

  // Apia deleted 30 December 2011: its 00:00 is skipped and resolves onto 31 December's 00:00
  // (10:00Z on the 30th), a wall time the zone has. The deleted date opens no day, so the 29th's
  // day ends where the 31st's starts, and "reject" has no skipped boundary to refuse.
  it.each`
    instant                   | start                     | end
    ${"2011-12-30T09:59:59Z"} | ${"2011-12-29T10:00:00Z"} | ${"2011-12-30T10:00:00Z"}
    ${"2011-12-30T10:00:00Z"} | ${"2011-12-30T10:00:00Z"} | ${"2011-12-31T10:00:00Z"}
  `(
    "accepts the day holding $instant in Pacific/Apia under reject",
    ({ instant, start, end }) => {
      expect(
        dutyDayFor(instant, {
          timeZone: "Pacific/Apia",
          dayStartTime: "00:00",
          disambiguation: "reject",
        }),
      ).toEqual({ start, end });
    },
  );

  it.each`
    timeZone       | instant
    ${"UTC"}       | ${"2024-11-03T12:00:00Z"}
    ${"-00:44:30"} | ${"1970-01-01T12:00:00Z"}
  `(
    "rejects nothing in $timeZone, which never repeats or skips a time",
    ({ timeZone, instant }) => {
      expect(
        dutyDayFor(instant, {
          timeZone,
          dayStartTime: "01:30",
          disambiguation: "reject",
        }),
      ).not.toBeNull();
    },
  );

  it.each(localNoonBattleCases)(
    "returns the day from 04:00 on 2024-02-29 to 04:00 on 2024-03-01 for local noon in $timeZone",
    ({ timeZone, value }) => {
      // No battle-test zone changes its clock between these two local 04:00s.
      const at = (month: number, day: number) =>
        Temporal.ZonedDateTime.from({
          year: 2024,
          month,
          day,
          hour: 4,
          timeZone,
        })
          .toInstant()
          .toString();
      const start = at(2, 29);
      const end = at(3, 1);

      expect(dutyDayFor(value, { timeZone, dayStartTime: "04:00" })).toEqual({
        start,
        end,
      });
    },
  );

  it.each`
    timeZone       | instant                   | start                     | end
    ${"+05:30"}    | ${"2024-01-01T00:00:00Z"} | ${"2023-12-31T22:30:00Z"} | ${"2024-01-01T22:30:00Z"}
    ${"-00:44:30"} | ${"1970-01-01T12:00:00Z"} | ${"1970-01-01T04:44:30Z"} | ${"1970-01-02T04:44:30Z"}
  `(
    "reads $timeZone, a UTC offset, as a fixed reference zone",
    ({ timeZone, instant, start, end }) => {
      expect(dutyDayFor(instant, { timeZone, dayStartTime: "04:00" })).toEqual({
        start,
        end,
      });
    },
  );

  it.each`
    instant                      | day                                                                      | reason
    ${"2024-01-01T12:00:00"}     | ${{ timeZone: "UTC", dayStartTime: "04:00" }}                            | ${"a zoneless instant"}
    ${123}                       | ${{ timeZone: "UTC", dayStartTime: "04:00" }}                            | ${"a non-string instant"}
    ${"2024-01-01T12:00:00Z"}    | ${null}                                                                  | ${"a null day"}
    ${"2024-01-01T12:00:00Z"}    | ${"UTC"}                                                                 | ${"a day that is not an object"}
    ${"2024-01-01T12:00:00Z"}    | ${{ timeZone: "UTC" }}                                                   | ${"no dayStartTime: local midnight is never assumed"}
    ${"2024-01-01T12:00:00Z"}    | ${{ dayStartTime: "04:00" }}                                             | ${"no timeZone"}
    ${"2024-01-01T12:00:00Z"}    | ${{ timeZone: "Invalid/Zone", dayStartTime: "04:00" }}                   | ${"an invalid zone"}
    ${"2024-01-01T12:00:00Z"}    | ${{ timeZone: "UTC", dayStartTime: "4am" }}                              | ${"a malformed start time"}
    ${"2024-01-01T12:00:00Z"}    | ${{ timeZone: "UTC", dayStartTime: "24:00" }}                            | ${"hour 24"}
    ${"2024-01-01T12:00:00Z"}    | ${{ timeZone: "UTC", dayStartTime: "04:00", disambiguation: "nearest" }} | ${"an unknown disambiguation"}
    ${"2024-01-01T12:00:00Z"}    | ${{ timeZone: "UTC", dayStartTime: "04:00", disambiguation: null }}      | ${"a null disambiguation"}
    ${"+275760-09-13T00:00:00Z"} | ${{ timeZone: "UTC", dayStartTime: "04:00" }}                            | ${"a day that ends past the instant range"}
  `("returns null for $reason", ({ instant, day }) => {
    expect(dutyDayFor(instant, day)).toBeNull();
  });
});
