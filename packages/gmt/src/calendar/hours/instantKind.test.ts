import { addOperatingTime } from "./addOperatingTime";
import { isOpenAt } from "./isOpenAt";
import { nextCloseAt } from "./nextCloseAt";
import { nextOpenAt } from "./nextOpenAt";
import { operatingIntervals } from "./operatingIntervals";
import { operatingTimeBetween } from "./operatingTimeBetween";

/**
 * Every operating-hours function reads its instants as the instant kind: `…Z` or `…±HH:MM` and
 * nothing after it. The cross-namespace sweep cannot reach these (each needs a valid schedule as
 * its second argument), so they are pinned here. 10 June 2024 is a Monday; the schedule is open
 * 09:00–17:00 UTC on Mondays.
 */
const schedule = {
  timeZone: "UTC",
  weekly: { 1: [{ from: "09:00", to: "17:00" }] },
};
const noon = "2024-06-10T12:00:00Z";
const two = "2024-06-10T14:00:00Z";

describe("operating-hours instants take the instant kind and nothing after it", () => {
  it.each`
    suffix              | why
    ${"[Asia/Tokyo]"}   | ${"a zone bracket"}
    ${"[!Asia/Tokyo]"}  | ${"a critical zone bracket"}
    ${"[+02:00]"}       | ${"an offset bracket"}
    ${"[u-ca=iso8601]"} | ${"a calendar annotation"}
    ${"[foo=bar]"}      | ${"an elective annotation"}
    ${"[!foo=bar]"}     | ${"a critical unknown annotation"}
    ${"[ junk ]"}       | ${"a bracket that breaks RFC 9557"}
    ${"junk"}           | ${"trailing text"}
    ${" "}              | ${"a trailing space"}
  `("reads a Z instant plus $suffix as no instant ($why)", ({ suffix }) => {
    const bad = `${noon}${suffix}`;
    expect(isOpenAt(bad, schedule)).toBe(false);
    expect(nextOpenAt(bad, schedule)).toBe("");
    expect(nextCloseAt(bad, schedule)).toBe("");
    expect(addOperatingTime(bad, "PT2H", schedule)).toBe("");
    expect(operatingTimeBetween(bad, two, schedule)).toBe("");
    expect(operatingTimeBetween(noon, `${two}${suffix}`, schedule)).toBe("");
    expect(operatingIntervals(schedule, { start: bad, end: two })).toEqual([]);
    expect(
      operatingIntervals(schedule, { start: noon, end: `${two}${suffix}` }),
    ).toEqual([]);
  });

  it("reads the same instants without a suffix", () => {
    expect(isOpenAt(noon, schedule)).toBe(true);
    expect(nextOpenAt(noon, schedule)).toBe(noon);
    expect(nextCloseAt(noon, schedule)).toBe("2024-06-10T17:00:00Z");
    expect(addOperatingTime(noon, "PT2H", schedule)).toBe(two);
    expect(operatingTimeBetween(noon, two, schedule)).toBe("PT2H");
    expect(operatingIntervals(schedule, { start: noon, end: two })).toEqual([
      { start: noon, end: two },
    ]);
  });

  it("reads an offset instant: 14:00+02:00 is 12:00Z", () => {
    expect(nextOpenAt("2024-06-10T14:00:00+02:00", schedule)).toBe(noon);
  });
});
