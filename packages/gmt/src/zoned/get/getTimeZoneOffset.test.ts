import { battleTestTimeZones } from "../../test";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { getTimeZoneOffset } from "./getTimeZoneOffset";

describe("getTimeZoneOffset", () => {
  it.each`
    timeZone              | instant                   | expected
    ${"America/New_York"} | ${"2024-07-15T12:00:00Z"} | ${"-04:00"}
    ${"America/New_York"} | ${"2024-01-15T12:00:00Z"} | ${"-05:00"}
    ${"Asia/Kathmandu"}   | ${"2024-07-15T00:00:00Z"} | ${"+05:45"}
    ${"Asia/Kolkata"}     | ${"2024-07-15T00:00:00Z"} | ${"+05:30"}
    ${"Pacific/Chatham"}  | ${"2024-07-15T00:00:00Z"} | ${"+12:45"}
    ${"UTC"}              | ${"2024-07-15T00:00:00Z"} | ${"+00:00"}
    ${"Japan"}            | ${"2024-01-01T00:00:00Z"} | ${"+09:00"}
    ${"EST5EDT"}          | ${"2024-07-15T12:00:00Z"} | ${"-04:00"}
    ${"Zulu"}             | ${"2024-07-15T12:00:00Z"} | ${"+00:00"}
    ${"utc"}              | ${"2024-07-15T12:00:00Z"} | ${"+00:00"}
  `(
    "returns $expected for $timeZone at $instant",
    ({ timeZone, instant, expected }) => {
      expect(getTimeZoneOffset(timeZone, instant)).toBe(expected);
    },
  );

  it.each`
    timeZone             | before                    | beforeOffset | after                     | afterOffset
    ${"America/Chicago"} | ${"2024-03-10T07:59:00Z"} | ${"-06:00"}  | ${"2024-03-10T08:00:00Z"} | ${"-05:00"}
    ${"America/Chicago"} | ${"2024-11-03T06:59:00Z"} | ${"-05:00"}  | ${"2024-11-03T07:00:00Z"} | ${"-06:00"}
    ${"Europe/Berlin"}   | ${"2024-03-31T00:59:00Z"} | ${"+01:00"}  | ${"2024-03-31T01:00:00Z"} | ${"+02:00"}
    ${"Europe/Berlin"}   | ${"2024-10-27T00:59:00Z"} | ${"+02:00"}  | ${"2024-10-27T01:00:00Z"} | ${"+01:00"}
  `(
    "straddles $timeZone's DST transition around $before / $after",
    ({ timeZone, before, beforeOffset, after, afterOffset }) => {
      expect(getTimeZoneOffset(timeZone, before)).toBe(beforeOffset);
      expect(getTimeZoneOffset(timeZone, after)).toBe(afterOffset);
    },
  );

  it.each`
    timeZone
    ${"Not/AZone"}
    ${""}
    ${null}
    ${undefined}
    ${123}
    ${true}
  `("returns '' for invalid timeZone $timeZone", ({ timeZone }) => {
    expect(getTimeZoneOffset(timeZone as never, "2024-07-15T12:00:00Z")).toBe(
      "",
    );
  });

  it.each`
    instant
    ${"not an instant"}
    ${""}
    ${null}
    ${undefined}
  `("returns '' for invalid instant $instant", ({ instant }) => {
    expect(getTimeZoneOffset("America/New_York", instant as never)).toBe("");
  });

  // Temporal's ParseISODateTime clamps second 60 to 59 in every spelling its grammar accepts;
  // GMT rejects the leap second rather than report the offset of a different instant.
  it.each`
    instant                        | spelling
    ${"2016-12-31T23:59:60Z"}      | ${"extended, uppercase T"}
    ${"2016-12-31t23:59:60z"}      | ${"lowercase t and z"}
    ${"2016-12-31 23:59:60+00:00"} | ${"space separator"}
    ${"20161231T235960Z"}          | ${"basic format"}
  `(
    "returns '' for leap-second instant $instant ($spelling)",
    ({ instant }) => {
      expect(getTimeZoneOffset("UTC", instant)).toBe("");
    },
  );

  // Strict-shape rule (see coding-standards): an instant string is ISO 8601 extended format before its first `[`.
  // Polyfill 0.5.1 reads each of these as 2024-07-15T16:00Z, where New York is at -04:00.
  it.each`
    instant                       | spelling
    ${"2024-07-15T16:00:00z"}     | ${"lower-case z"}
    ${"2024-07-15t16:00:00Z"}     | ${"lower-case t separator"}
    ${"2024-07-15 16:00:00Z"}     | ${"space separator"}
    ${"20240715T160000Z"}         | ${"basic format"}
    ${"2024-07-15T12:00:00-0400"} | ${"basic offset"}
    ${"2024-07-15T12:00:00-04"}   | ${"hour-only offset"}
  `(
    "returns '' for non-extended instant $instant ($spelling)",
    ({ instant }) => {
      expect(getTimeZoneOffset("America/New_York", instant)).toBe("");
    },
  );

  it("still reads an instant whose elective annotation value looks like a leap second", () => {
    expect(
      getTimeZoneOffset("Asia/Tokyo", "2024-01-01T00:00:00Z[x=T123460Z]"),
    ).toBe("+09:00");
  });

  for (const timeZone of battleTestTimeZones) {
    it(`returns a non-empty offset for battle-test timeZone ${timeZone}`, () => {
      expect(getTimeZoneOffset(timeZone, "2024-07-15T12:00:00Z")).toMatch(
        /^[+-]\d{2}:\d{2}$/,
      );
    });
  }

  it("returns '' on failure", () => {
    mockTemporalInstantFromThrow();
    expect(getTimeZoneOffset("America/New_York", "2024-07-15T12:00:00Z")).toBe(
      "",
    );
  });
});
