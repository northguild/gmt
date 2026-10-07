import { isDeepStrictEqual } from "node:util";
import {
  addDate,
  addDateTime,
  addTime,
  addUnix,
  addUtc,
  addZoned,
  billingTimeline,
  compareDurations,
  cutoffSchedule,
  durationAs,
  fromOffsetInstant,
  intervalXorAllDate,
  intervalXorAllDateTime,
  intervalXorAllTime,
  intervalXorAllUtc,
  intervalXorAllZoned,
  intervalsOverlap,
  isValidDateRange,
  mergeIntervalsDate,
  mergeIntervalsDateTime,
  mergeIntervalsTime,
  mergeIntervalsUtc,
  mergeIntervalsZoned,
  multimodalETA,
  nextBusinessDay,
  normalizeDuration,
  operatingIntervals,
  punctualityRate,
  scheduleDelivery,
  subtractDate,
  subtractDateTime,
  subtractTime,
  subtractUnix,
  subtractUtc,
  subtractZoned,
} from "../index";

/**
 * Object arguments other than options bags: a function is an Object (ECMA-262 §6.1.7), so a
 * function carrying the properties is read as the object it is. Temporal reads a duration-like or
 * a property bag that way (ToTemporalDuration, ToTemporalDate: "If item is an Object"), and GMT's
 * own records (intervals, legs, calendars, schedules) follow the same rule. `isObject` is the one
 * check; options bags are covered for every function in `optionsObject.test.ts`.
 *
 * Each row calls the function twice, once with the plain objects (`wrap` is the identity) and
 * once with each object wrapped in a function, and expects the same, non-sentinel result.
 */
type Wrap = <T extends object>(value: T) => T;
const asIs: Wrap = (value) => value;
const asFunction: Wrap = (value) =>
  Object.assign(() => undefined, value) as unknown as typeof value;

const date = { start: "2024-01-01", end: "2024-01-05" };
const dateLater = { start: "2024-01-03", end: "2024-01-08" };
const time = { start: "09:00:00", end: "12:00:00" };
const timeLater = { start: "11:00:00", end: "15:00:00" };
const dateTime = { start: "2024-01-01T09:00:00", end: "2024-01-01T12:00:00" };
const dateTimeLater = {
  start: "2024-01-01T11:00:00",
  end: "2024-01-01T15:00:00",
};
const utc = { start: "2024-01-01T09:00:00Z", end: "2024-01-01T12:00:00Z" };
const utcLater = { start: "2024-01-01T11:00:00Z", end: "2024-01-01T15:00:00Z" };
const zoned = {
  start: "2024-01-01T00:00:00+00:00[UTC]",
  end: "2024-01-10T00:00:00+00:00[UTC]",
};
const zonedLater = {
  start: "2024-01-05T00:00:00+00:00[UTC]",
  end: "2024-01-15T00:00:00+00:00[UTC]",
};
/** A `relativeTo` property bag, plain and zoned, and one near the top of the instant range. */
const relativeBag = { year: 2024, month: 1, day: 31 };
const zonedRelativeBag = { ...relativeBag, timeZone: "America/New_York" };
const sydneyNearMax = {
  year: 275760,
  month: 9,
  day: 10,
  hour: 5,
  timeZone: "Australia/Sydney",
};
const leg = {
  departure: "2024-06-15T10:00:00Z",
  duration: "PT36H",
  timeZone: "Asia/Tokyo",
};

describe("an Object argument that is a function is read as the object it is", () => {
  it.each`
    name                                                     | call
    ${"addDate units"}                                       | ${(w: Wrap) => addDate("2024-01-31", w({ months: 1 }))}
    ${"subtractDate units"}                                  | ${(w: Wrap) => subtractDate("2024-03-31", w({ months: 1 }))}
    ${"addDateTime units"}                                   | ${(w: Wrap) => addDateTime("2024-01-31T10:00:00", w({ hours: 1 }))}
    ${"subtractDateTime units"}                              | ${(w: Wrap) => subtractDateTime("2024-01-31T10:00:00", w({ hours: 1 }))}
    ${"addTime units"}                                       | ${(w: Wrap) => addTime("14:30:00", w({ hours: 1 }))}
    ${"subtractTime units"}                                  | ${(w: Wrap) => subtractTime("14:30:00", w({ hours: 1 }))}
    ${"addUnix units"}                                       | ${(w: Wrap) => addUnix(1706659200000, w({ days: 1 }))}
    ${"subtractUnix units"}                                  | ${(w: Wrap) => subtractUnix(1706659200000, w({ days: 1 }))}
    ${"addUtc units"}                                        | ${(w: Wrap) => addUtc("2024-06-15T10:00:00Z", w({ hours: 1 }))}
    ${"subtractUtc units"}                                   | ${(w: Wrap) => subtractUtc("2024-06-15T10:00:00Z", w({ hours: 1 }))}
    ${"addZoned units"}                                      | ${(w: Wrap) => addZoned("2024-06-15T10:00:00+00:00[UTC]", w({ hours: 1 }))}
    ${"subtractZoned units"}                                 | ${(w: Wrap) => subtractZoned("2024-06-15T10:00:00+00:00[UTC]", w({ hours: 1 }))}
    ${"mergeIntervalsDate"}                                  | ${(w: Wrap) => mergeIntervalsDate([w(date), w(dateLater)])}
    ${"mergeIntervalsTime"}                                  | ${(w: Wrap) => mergeIntervalsTime([w(time), w(timeLater)])}
    ${"mergeIntervalsDateTime"}                              | ${(w: Wrap) => mergeIntervalsDateTime([w(dateTime), w(dateTimeLater)])}
    ${"mergeIntervalsUtc"}                                   | ${(w: Wrap) => mergeIntervalsUtc([w(utc), w(utcLater)])}
    ${"mergeIntervalsZoned"}                                 | ${(w: Wrap) => mergeIntervalsZoned([w(zoned), w(zonedLater)])}
    ${"intervalXorAllDate"}                                  | ${(w: Wrap) => intervalXorAllDate([w(date), w(dateLater)])}
    ${"intervalXorAllTime"}                                  | ${(w: Wrap) => intervalXorAllTime([w(time), w(timeLater)])}
    ${"intervalXorAllDateTime"}                              | ${(w: Wrap) => intervalXorAllDateTime([w(dateTime), w(dateTimeLater)])}
    ${"intervalXorAllUtc"}                                   | ${(w: Wrap) => intervalXorAllUtc([w(utc), w(utcLater)])}
    ${"intervalXorAllZoned"}                                 | ${(w: Wrap) => intervalXorAllZoned([w(zoned), w(zonedLater)])}
    ${"intervalsOverlap"}                                    | ${(w: Wrap) => intervalsOverlap(w(utc), w(utcLater))}
    ${"isValidDateRange props"}                              | ${(w: Wrap) => isValidDateRange(w({ value1: "2024-01-01", value2: "2024-01-02" }))}
    ${"fromOffsetInstant"}                                   | ${(w: Wrap) => fromOffsetInstant(w({ instant: "2024-06-15T12:00:00Z", offset: "+02:00" }))}
    ${"nextBusinessDay"}                                     | ${(w: Wrap) => nextBusinessDay("2024-07-05", w({ weekend: [6, 7], holidays: [], timeZone: "UTC" }))}
    ${"operatingIntervals"}                                  | ${(w: Wrap) => operatingIntervals(w({ timeZone: "UTC", weekly: w({ 1: [w({ from: "09:00", to: "17:00" })] }) }), w({ start: "2024-06-10T00:00:00Z", end: "2024-06-11T00:00:00Z" }))}
    ${"punctualityRate"}                                     | ${(w: Wrap) => punctualityRate([w({ planned: "2024-06-15T12:00:00Z", actual: "2024-06-15T12:05:00Z" })], w({ late: "PT15M" }))}
    ${"billingTimeline"}                                     | ${(w: Wrap) => billingTimeline(w({ anchorOn: "2026-03-01", invoiceIssuedOn: "2026-03-31" }), w({ issueDays: 30, disputeDays: 30, resolutionDays: 30 }))}
    ${"scheduleDelivery leg"}                                | ${(w: Wrap) => scheduleDelivery([w(leg)])}
    ${"multimodalETA leg"}                                   | ${(w: Wrap) => multimodalETA([w(leg)])}
    ${"durationAs relativeTo (polyfill nudge workaround)"}   | ${(w: Wrap) => durationAs("P29DT12H", "months", { relativeTo: w(relativeBag) })}
    ${"normalizeDuration relativeTo (floor)"}                | ${(w: Wrap) => normalizeDuration("P29DT12H", { largestUnit: "months", smallestUnit: "months", roundingMode: "floor", relativeTo: w(relativeBag) })}
    ${"durationAs zoned relativeTo"}                         | ${(w: Wrap) => durationAs("P29DT12H", "months", { relativeTo: w(zonedRelativeBag) })}
    ${"normalizeDuration relativeTo near the range maximum"} | ${(w: Wrap) => normalizeDuration("PT73H", { largestUnit: "day", relativeTo: w(sydneyNearMax) })}
    ${"compareDurations relativeTo near the range maximum"}  | ${(w: Wrap) => compareDurations("P3D", "PT73H", { relativeTo: w(sydneyNearMax) })}
  `("$name reads a function as the object", ({ call }) => {
    const plain = (call as (w: Wrap) => unknown)(asIs);
    expect(
      [null, "", false, []].some((sentinel) =>
        isDeepStrictEqual(plain, sentinel),
      ),
    ).toBe(false);
    expect((call as (w: Wrap) => unknown)(asFunction)).toEqual(plain);
  });

  // A member is read with an ordinary property get, as Temporal's GetOption reads one, so an entry
  // written as a function has the function's own \`name\`, exactly as \`{ name: "", offset }\` has
  // an empty one. No special case hides a function's built-in properties from a named read.
  it.each`
    entry                                                        | name
    ${Object.assign(() => undefined, { offset: "P1D" })}         | ${""}
    ${Object.assign(function docCutoff() {}, { offset: "P1D" })} | ${"docCutoff"}
  `(
    "cutoffSchedule reads a function entry's own name, $name",
    ({ entry, name }) => {
      expect(
        cutoffSchedule("2024-06-14T22:00:00Z", [entry], { timeZone: "UTC" }),
      ).toEqual([{ name, at: "2024-06-13T22:00:00+00:00[UTC]" }]);
    },
  );
});
