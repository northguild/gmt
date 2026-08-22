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
