import { battleTestTimeZones } from "../../test";
import { getDstTransitions } from ".";

describe("getDstTransitions", () => {
  it.each`
    timeZone
    ${"Not/AZone"}
    ${""}
    ${null}
    ${undefined}
    ${123}
    ${true}
  `("returns [] for invalid timeZone $timeZone", ({ timeZone }) => {
    expect(getDstTransitions(timeZone as never, 2024)).toEqual([]);
  });

  it.each`
    year
    ${"2024"}
    ${NaN}
    ${1.5}
    ${null}
    ${undefined}
    ${Infinity}
  `("returns [] for invalid year $year", ({ year }) => {
    expect(getDstTransitions("America/New_York", year as never)).toEqual([]);
  });

  it("returns exact transitions for America/New_York in 2024", () => {
    expect(getDstTransitions("America/New_York", 2024)).toEqual([
      {
        instant: "2024-03-10T07:00:00Z",
        offsetBefore: "-05:00",
        offsetAfter: "-04:00",
      },
      {
        instant: "2024-11-03T06:00:00Z",
        offsetBefore: "-04:00",
        offsetAfter: "-05:00",
      },
    ]);
  });

  it("returns exact transitions for Australia/Sydney in 2024 (southern hemisphere)", () => {
    expect(getDstTransitions("Australia/Sydney", 2024)).toEqual([
      {
        instant: "2024-04-06T16:00:00Z",
        offsetBefore: "+11:00",
        offsetAfter: "+10:00",
      },
      {
        instant: "2024-10-05T16:00:00Z",
        offsetBefore: "+10:00",
        offsetAfter: "+11:00",
      },
    ]);
  });

  it("returns [] for a zone with no transitions in the given year", () => {
    expect(getDstTransitions("Asia/Tokyo", 2024)).toEqual([]);
    expect(getDstTransitions("UTC", 2024)).toEqual([]);
  });

  it("returns 3 transitions for Africa/Casablanca in 2018 (Ramadan DST pause, historical rule change)", () => {
    const result = getDstTransitions("Africa/Casablanca", 2018);
    expect(result).toHaveLength(3);
    expect(result[0].offsetBefore).toBe("+00:00");
    expect(result[0].offsetAfter).toBe("+01:00");
    expect(result[1].offsetBefore).toBe("+01:00");
    expect(result[1].offsetAfter).toBe("+00:00");
    expect(result[2].offsetBefore).toBe("+00:00");
    expect(result[2].offsetAfter).toBe("+01:00");
  });

  it.each`
    timeZone              | expected
    ${"UTC"}              | ${0}
    ${"GMT"}              | ${0}
    ${"Etc/GMT"}          | ${0}
    ${"America/Nome"}     | ${2}
    ${"Asia/Anadyr"}      | ${0}
    ${"Europe/Lisbon"}    | ${2}
    ${"Europe/Dublin"}    | ${2}
    ${"Europe/Berlin"}    | ${2}
    ${"Europe/Helsinki"}  | ${2}
    ${"Europe/Istanbul"}  | ${0}
    ${"Asia/Kolkata"}     | ${0}
    ${"Asia/Kathmandu"}   | ${0}
    ${"Asia/Shanghai"}    | ${0}
    ${"America/New_York"} | ${2}
    ${"America/Chicago"}  | ${2}
    ${"America/Phoenix"}  | ${0}
  `(
    "returns $expected transitions for battle-test timeZone $timeZone in 2024",
    ({ timeZone, expected }) => {
      expect(getDstTransitions(timeZone, 2024)).toHaveLength(expected);
    },
  );

  it("returns transitions with correctly chained offsets for all battle-test timeZones", () => {
    for (const timeZone of battleTestTimeZones) {
      const result = getDstTransitions(timeZone, 2024);
      expect([0, 2]).toContain(result.length);
      if (result.length === 2) {
        expect(result[0].offsetBefore).not.toBe(result[0].offsetAfter);
        expect(result[1].offsetBefore).not.toBe(result[1].offsetAfter);
        expect(result[0].offsetAfter).toBe(result[1].offsetBefore);
        expect(result[0].offsetBefore).toBe(result[1].offsetAfter);
      }
    }
  });
});
