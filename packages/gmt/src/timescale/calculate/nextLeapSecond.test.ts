import { Temporal } from "@js-temporal/polyfill";
import { LEAP_SECOND_STEPS } from "../../internal";
import {
  mockTemporalInstantFromEpochNanosecondsThrow,
  mockTemporalInstantFromThrow,
  mockTemporalPlainTimeFromThrow,
} from "../../test/mocks";
import { sameInstantBattleCases } from "../../test/timeZoneMatrix";
import { isLeapSecond } from "../validate/isLeapSecond";
import { nextLeapSecond } from "./nextLeapSecond";

/** The 27 insertion days: the UTC date before each row after the first (TF.460-6 Annex 1 §2.2). */
const insertionDays = LEAP_SECOND_STEPS.at.slice(1).map((at) => ({
  day: Temporal.Instant.fromEpochNanoseconds(at)
    .toZonedDateTimeISO("UTC")
    .toPlainDate()
    .subtract({ days: 1 })
    .toString(),
}));

describe("nextLeapSecond", () => {
  it.each`
    isoString                           | expected                  | why
    ${"2016-01-01T00:00:00Z"}           | ${"2016-12-31T23:59:60Z"} | ${"the 2017-01-01 row"}
    ${"2016-12-31T23:59:59.5Z"}         | ${"2016-12-31T23:59:60Z"} | ${"half a second before it"}
    ${"2015-06-30T23:59:60Z"}           | ${"2016-12-31T23:59:60Z"} | ${"from inside the 2015 insertion"}
    ${"1972-01-01T00:00:00Z"}           | ${"1972-06-30T23:59:60Z"} | ${"the first insertion"}
    ${"1999-08-22T00:00:00Z"}           | ${"2005-12-31T23:59:60Z"} | ${"the 2006-01-01 row"}
    ${"1972-06-30T23:59:59.999999999Z"} | ${"1972-06-30T23:59:60Z"} | ${"1 ns before the first insertion"}
    ${"1972-06-30T23:59:60.999999999Z"} | ${"1972-12-31T23:59:60Z"} | ${"the last nanosecond of the first insertion: it has started"}
    ${"2015-07-01T08:59:60+09:00"}      | ${"2016-12-31T23:59:60Z"} | ${"the 2015 insertion written at +09:00"}
  `("returns $expected after $isoString ($why)", ({ isoString, expected }) => {
    expect(nextLeapSecond(isoString)).toBe(expected);
  });

  it.each`
    isoString                    | why
    ${"2016-12-31T23:59:60Z"}    | ${"the last inserted second itself"}
    ${"2017-01-01T00:00:00Z"}    | ${"after the last insertion"}
    ${"2024-01-01T00:00:00Z"}    | ${"none scheduled (Bulletin C 72)"}
    ${"2027-05-20T00:00:00Z"}    | ${"continuous UTC from 20 May 2027 (CGPM 2026 Resolution 5)"}
    ${"+275760-09-13T00:00:00Z"} | ${"Temporal's last instant"}
  `("returns '' after $isoString: $why", ({ isoString }) => {
    expect(nextLeapSecond(isoString)).toBe("");
  });

  it.each`
    isoString
    ${"1971-06-01T00:00:00Z"}
    ${"1971-12-31T23:59:59.999999999Z"}
    ${"-271821-04-20T00:00:00Z"}
    ${"2017-12-31T23:59:60Z"}
    ${null}
    ${undefined}
    ${123}
    ${""}
    ${"x"}
    ${"2024-01-01"}
    ${"2024-01-01T00:00:00"}
    ${"2024-01-01T00:00:00[UTC]"}
    ${"20240101T000000Z"}
  `("returns '' for the invalid or pre-1972 $isoString", ({ isoString }) => {
    expect(nextLeapSecond(isoString)).toBe("");
  });

  it.each(insertionDays)(
    "returns $day T23:59:60Z from $day T00:00:00Z, and isLeapSecond confirms it",
    ({ day }) => {
      const next = nextLeapSecond(`${day}T00:00:00Z`);
      expect(next).toBe(`${day}T23:59:60Z`);
      expect(isLeapSecond(next)).toBe(true);
    },
  );

  it.each(sameInstantBattleCases)(
    "returns '' for 2024-02-29T00:00:00Z written in $timeZone",
    ({ value }) => {
      expect(nextLeapSecond(value)).toBe("");
    },
  );

  it("returns '' when Temporal.Instant.fromEpochNanoseconds throws", () => {
    mockTemporalInstantFromEpochNanosecondsThrow();
    expect(nextLeapSecond("2016-01-01T00:00:00Z")).toBe("");
  });

  it("returns '' when Temporal.Instant.from throws on a second-60 string", () => {
    mockTemporalInstantFromThrow();
    expect(nextLeapSecond("2015-06-30T23:59:60Z")).toBe("");
  });

  it("returns '' when Temporal.PlainTime.from throws while writing second 60", () => {
    mockTemporalPlainTimeFromThrow();
    expect(nextLeapSecond("2016-01-01T00:00:00Z")).toBe("");
  });
});
