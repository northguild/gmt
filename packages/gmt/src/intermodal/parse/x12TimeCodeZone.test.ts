import { X12_TIME_CODES } from "../../internal";
import { hostileProxy, revokedProxy } from "../../test/noThrow";
import { X12_TIME_CODE_EXPECTATIONS } from "../../test/x12TimeCodeMatrix";
import { x12TimeCodeZone } from "./x12TimeCodeZone";

/**
 * Every expected value is read off the X12 data element 623 code list (release 008010, Stedi's
 * X12-licensed dictionary): `zone` is the definition with "Daylight Time", "Standard Time" or
 * "Time" taken off, and `daylight` is which of the three it was.
 */
describe("x12TimeCodeZone", () => {
  describe("named daylight and standard codes: a zone name and a flag", () => {
    it.each`
      timeCode | definition                         | zone                 | daylight
      ${"AD"}  | ${"Alaska Daylight Time"}          | ${"Alaska"}          | ${true}
      ${"AS"}  | ${"Alaska Standard Time"}          | ${"Alaska"}          | ${false}
      ${"CD"}  | ${"Central Daylight Time"}         | ${"Central"}         | ${true}
      ${"CS"}  | ${"Central Standard Time"}         | ${"Central"}         | ${false}
      ${"ED"}  | ${"Eastern Daylight Time"}         | ${"Eastern"}         | ${true}
      ${"ES"}  | ${"Eastern Standard Time"}         | ${"Eastern"}         | ${false}
      ${"HD"}  | ${"Hawaii-Aleutian Daylight Time"} | ${"Hawaii-Aleutian"} | ${true}
      ${"HS"}  | ${"Hawaii-Aleutian Standard Time"} | ${"Hawaii-Aleutian"} | ${false}
      ${"MD"}  | ${"Mountain Daylight Time"}        | ${"Mountain"}        | ${true}
      ${"MS"}  | ${"Mountain Standard Time"}        | ${"Mountain"}        | ${false}
      ${"ND"}  | ${"Newfoundland Daylight Time"}    | ${"Newfoundland"}    | ${true}
      ${"NS"}  | ${"Newfoundland Standard Time"}    | ${"Newfoundland"}    | ${false}
      ${"PD"}  | ${"Pacific Daylight Time"}         | ${"Pacific"}         | ${true}
      ${"PS"}  | ${"Pacific Standard Time"}         | ${"Pacific"}         | ${false}
      ${"TD"}  | ${"Atlantic Daylight Time"}        | ${"Atlantic"}        | ${true}
      ${"TS"}  | ${"Atlantic Standard Time"}        | ${"Atlantic"}        | ${false}
    `(
      "reads $timeCode ($definition) as the zone $zone, daylight $daylight",
      ({ timeCode, zone, daylight }) => {
        expect(x12TimeCodeZone(timeCode)).toEqual({ zone, daylight });
      },
    );
  });

  describe("generic codes and LT: a zone name, and daylight null because the date decides", () => {
    it.each`
      timeCode | definition                | zone
      ${"AT"}  | ${"Alaska Time"}          | ${"Alaska"}
      ${"CT"}  | ${"Central Time"}         | ${"Central"}
      ${"ET"}  | ${"Eastern Time"}         | ${"Eastern"}
      ${"HT"}  | ${"Hawaii-Aleutian Time"} | ${"Hawaii-Aleutian"}
      ${"MT"}  | ${"Mountain Time"}        | ${"Mountain"}
      ${"NT"}  | ${"Newfoundland Time"}    | ${"Newfoundland"}
      ${"PT"}  | ${"Pacific Time"}         | ${"Pacific"}
      ${"TT"}  | ${"Atlantic Time"}        | ${"Atlantic"}
      ${"LT"}  | ${"Local Time"}           | ${"Local"}
    `(
      "reads $timeCode ($definition) as the zone $zone, daylight null",
      ({ timeCode, zone }) => {
        expect(x12TimeCodeZone(timeCode)).toEqual({ zone, daylight: null });
      },
    );
  });

  describe("the 56-code list", () => {
    const rows = X12_TIME_CODES.map((timeCode) => ({
      timeCode,
      ...X12_TIME_CODE_EXPECTATIONS[timeCode],
    }));

    it.each(rows.filter((row) => "zone" in row))(
      "$timeCode ($definition) is the zone $zone, daylight $daylight",
      (row) => {
        const expected =
          "zone" in row ? { zone: row.zone, daylight: row.daylight } : null;
        expect(x12TimeCodeZone(row.timeCode as never)).toEqual(expected);
      },
    );

    // An offset code names no zone. `GM` ("Greenwich Mean Time") is a name X12 gives no ISO
    // designator, and GMT reads it as the offset +00:00, so it is not a zone here.
    it.each(rows.filter((row) => "offset" in row))(
      "$timeCode ($definition) names no zone: null",
      ({ timeCode }) => {
        expect(x12TimeCodeZone(timeCode as never)).toBeNull();
      },
    );

    it("both members are always present, and each call returns a new object", () => {
      for (const { timeCode } of rows.filter((row) => "zone" in row)) {
        const first = x12TimeCodeZone(timeCode as never);
        expect(Object.keys(first ?? {}), timeCode).toEqual([
          "zone",
          "daylight",
        ]);
        expect(x12TimeCodeZone(timeCode as never), timeCode).not.toBe(first);
      }
    });

    it("a caller cannot change the table through a result", () => {
      const result = x12TimeCodeZone("ES");
      if (result !== null) {
        result.zone = "Changed";
        result.daylight = true;
      }
      expect(x12TimeCodeZone("ES")).toEqual({
        zone: "Eastern",
        daylight: false,
      });
    });
  });

  it.each`
    timeCode         | reads
    ${"et"}          | ${"lower case: matching is exact"}
    ${"Et"}          | ${"mixed case"}
    ${" ET"}         | ${"a leading space"}
    ${"ET "}         | ${"a trailing space"}
    ${"EST"}         | ${"an abbreviation, not a 623 code"}
    ${"EDT"}         | ${"an abbreviation, not a 623 code"}
    ${"LS"}          | ${"two letters shaped like a standard-time code"}
    ${"ZZ"}          | ${"an unknown code"}
    ${"DT"}          | ${"a 1250 format code, not a 623 time code"}
    ${""}            | ${"an empty string"}
    ${"toString"}    | ${"an inherited property name"}
    ${"constructor"} | ${"an inherited property name"}
    ${"__proto__"}   | ${"an inherited property name"}
  `("returns null for '$timeCode' ($reads)", ({ timeCode }) => {
    expect(x12TimeCodeZone(timeCode)).toBeNull();
  });

  it("returns null for a time code that is not a string", () => {
    const nonStrings: [string, () => unknown][] = [
      ["null", () => null],
      ["undefined", () => undefined],
      ["a number", () => 1],
      ["a boolean", () => true],
      ["an array holding a code", () => ["ET"]],
      ["an object", () => ({ ET: true })],
      ["a Proxy that throws on any trap", hostileProxy],
      ["a revoked Proxy", revokedProxy],
    ];
    for (const [kind, make] of nonStrings) {
      expect(x12TimeCodeZone(make() as never), kind).toBeNull();
    }
  });
});
