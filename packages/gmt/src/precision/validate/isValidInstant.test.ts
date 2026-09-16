import { sameInstantBattleCases } from "../../test";
import { isValidUtc } from "../../utc/validate";
import { toNanoseconds } from "../convert/toNanoseconds";
import { isValidInstant } from "./isValidInstant";

describe("isValidInstant", () => {
  it.each`
    value                                            | reason
    ${"2024-03-10T12:00:00Z"}                        | ${"UTC designator"}
    ${"1970-01-01T00:00:00Z"}                        | ${"the epoch, where toNanoseconds returns 0n"}
    ${"1969-12-31T23:59:59Z"}                        | ${"pre-epoch"}
    ${"2024-03-10T12:00:00.123456789Z"}              | ${"nanosecond precision"}
    ${"2024-03-10T12:00:00-05:00"}                   | ${"numeric offset"}
    ${"2024-03-10T12:00:00-05:00[America/New_York]"} | ${"bracketed IANA zone"}
    ${"2024-03-10 12:00:00Z"}                        | ${"space separator"}
    ${"2024-03-10t12:00:00z"}                        | ${"lowercase t and z"}
    ${"20240310T120000Z"}                            | ${"basic format"}
    ${"+275760-09-13T00:00:00Z"}                     | ${"the latest representable instant"}
    ${"-271821-04-20T00:00:00Z"}                     | ${"the earliest representable instant"}
  `("returns true for $value ($reason)", ({ value }) => {
    expect(isValidInstant(value)).toBe(true);
  });

  // A bracketed zone annotation is syntactic only: Temporal.Instant.from ignores it, and the
  // offset alone fixes the instant (test262 Temporal/Instant/from/
  // argument-string-time-zone-annotation.js). A zone that does not exist, or one whose offset
  // contradicts the string's, is not checked. 12:00+05:00 is 07:00Z; 12:00-04:00 is 16:00Z.
  it.each`
    value                                            | reason
    ${"2024-03-10T12:00:00+05:00[America/New_York]"} | ${"offset contradicts the zone"}
    ${"2024-03-10T12:00:00Z[Not/AZone]"}             | ${"zone that does not exist"}
    ${"2024-03-10T12:00:00Z[+05:00]"}                | ${"numeric zone annotation"}
    ${"2024-01-01T00:00:00Z[x=T123460Z]"}            | ${"elective annotation value shaped like a basic leap second (RFC 9557 §4.1 alphanum)"}
    ${"2024-01-01T00:00:00Z[x=t000060-y]"}           | ${"elective annotation value shaped like a lowercase leap second"}
  `(
    "returns true for $value, whose annotation is not checked ($reason)",
    ({ value }) => {
      expect(isValidInstant(value)).toBe(true);
    },
  );

  it.each`
    value                                       | reason
    ${"2024-03-10"}                             | ${"date-only, no offset"}
    ${"2024-03-10T12:00:00"}                    | ${"no offset designator"}
    ${"2024-03-10T12:00:00[America/New_York]"}  | ${"bracketed zone but no offset designator"}
    ${"12:00:00Z"}                              | ${"time-only"}
    ${"2024-13-10T12:00:00Z"}                   | ${"month out of range"}
    ${"2024-02-30T12:00:00Z"}                   | ${"day out of range"}
    ${"+275760-09-13T00:00:00.001Z"}            | ${"past the representable range"}
    ${"-271821-04-19T23:59:59Z"}                | ${"before the representable range"}
    ${"2016-12-31T23:59:60Z"}                   | ${"leap second"}
    ${"2016-12-31 23:59:60Z"}                   | ${"leap second, space separator"}
    ${"20161231T235960Z"}                       | ${"leap second, basic format"}
    ${"2024-03-10T12:00:00-05:00[u-ca=hebrew]"} | ${"calendar annotation"}
    ${"2024-03-10T12:00:00Z[!u-ca=hebrew]"}     | ${"critical-flag calendar annotation"}
    ${"invalid"}                                | ${"unparseable"}
    ${""}                                       | ${"empty string"}
  `("returns false for $value ($reason)", ({ value }) => {
    expect(isValidInstant(value)).toBe(false);
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${123}
    ${1710072000123456789n}
    ${true}
    ${[]}
    ${{}}
  `("returns false when $value is non-string input", ({ value }) => {
    expect(isValidInstant(value as unknown as string)).toBe(false);
  });

  it.each(sameInstantBattleCases)(
    "returns true for 2024-02-29T00:00:00Z expressed in $timeZone",
    ({ value }) => {
      expect(isValidInstant(value)).toBe(true);
    },
  );

  it.each`
    value                                            | reason
    ${"2024-03-10 12:00:00Z"}                        | ${"space separator"}
    ${"20240310T120000Z"}                            | ${"basic format"}
    ${"2024-03-10T12:00:00-05:00"}                   | ${"numeric offset"}
    ${"2024-03-10T12:00:00-05:00[America/New_York]"} | ${"bracketed IANA zone"}
  `(
    "accepts $value ($reason), which isValidUtc rejects — the gap it exists to close",
    ({ value }) => {
      expect(isValidInstant(value)).toBe(true);
      expect(isValidUtc(value)).toBe(false);
      expect(toNanoseconds(value)).not.toBe(0n);
    },
  );

  it("is exactly the predicate that disambiguates toNanoseconds' 0n", () => {
    expect(isValidInstant("1970-01-01T00:00:00Z")).toBe(true);
    expect(toNanoseconds("1970-01-01T00:00:00Z")).toBe(0n);

    expect(isValidInstant("garbage")).toBe(false);
    expect(toNanoseconds("garbage")).toBe(0n);
  });
});
