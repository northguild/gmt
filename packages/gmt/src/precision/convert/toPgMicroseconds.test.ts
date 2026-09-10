import { sameInstantBattleCases } from "../../test";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { toPgMicroseconds } from "./toPgMicroseconds";

describe("toPgMicroseconds", () => {
  it.each`
    value                            | expected               | reason
    ${"2000-01-01T00:00:00Z"}        | ${0n}                  | ${"the PostgreSQL epoch itself"}
    ${"1970-01-01T00:00:00Z"}        | ${-946684800000000n}   | ${"the Unix epoch, 30 years earlier"}
    ${"1969-12-31T23:59:59Z"}        | ${-946684801000000n}   | ${"one second before the Unix epoch"}
    ${"1601-01-01T00:00:00Z"}        | ${-12591158400000000n} | ${"the FILETIME epoch"}
    ${"2024-02-29T00:00:00Z"}        | ${762480000000000n}    | ${"leap day"}
    ${"2024-03-10T12:00:00Z"}        | ${763387200000000n}    | ${"whole second"}
    ${"2024-03-10T12:34:56.789Z"}    | ${763389296789000n}    | ${"millisecond precision"}
    ${"2024-03-10T12:00:00.123456Z"} | ${763387200123456n}    | ${"exactly on the microsecond grid"}
  `("returns $expected for $value ($reason)", ({ value, expected }) => {
    expect(toPgMicroseconds(value)).toBe(expected);
  });

  it.each`
    value                               | expected             | reason
    ${"2024-03-10T12:00:00.123456789Z"} | ${763387200123456n}  | ${"sub-microsecond digits floor away"}
    ${"1969-12-31T23:59:59.999999999Z"} | ${-946684800000001n} | ${"floors toward negative infinity before the epoch"}
  `(
    "truncates $value to the microsecond grid as $expected ($reason)",
    ({ value, expected }) => {
      expect(toPgMicroseconds(value)).toBe(expected);
    },
  );

  it.each(sameInstantBattleCases)(
    "returns the same microsecond count for 2024-02-29T00:00:00Z expressed in $timeZone",
    ({ value }) => {
      expect(toPgMicroseconds(value)).toBe(762480000000000n);
    },
  );

  it.each`
    value                        | expected                | reason
    ${"+275760-09-13T00:00:00Z"} | ${8639053315200000000n} | ${"the largest representable instant, well inside PostgreSQL's 294276 AD"}
    ${"-004713-11-24T00:00:00Z"} | ${-211813488000000000n} | ${"MIN_TIMESTAMP — PostgreSQL's earliest timestamp"}
    ${"-004713-11-24T00:00:01Z"} | ${-211813487999000000n} | ${"one second after it"}
  `(
    "returns $expected at the range boundary $value ($reason)",
    ({ value, expected }) => {
      expect(toPgMicroseconds(value)).toBe(expected);
    },
  );

  it.each`
    value                               | reason
    ${"-004713-11-23T23:59:59.999999Z"} | ${"one microsecond before MIN_TIMESTAMP"}
    ${"-004713-11-23T00:00:00Z"}        | ${"the day before MIN_TIMESTAMP"}
    ${"-005000-01-01T00:00:00Z"}        | ${"centuries before PostgreSQL's minimum"}
    ${"-271821-04-20T00:00:00Z"}        | ${"the smallest representable instant, 40x below PostgreSQL's minimum"}
  `(
    "returns 0n for $value, which PostgreSQL cannot store ($reason)",
    ({ value }) => {
      expect(toPgMicroseconds(value)).toBe(0n);
    },
  );

  it.each`
    value                                       | reason
    ${"2024-03-10"}                             | ${"date-only, no offset"}
    ${"2024-03-10T12:00:00"}                    | ${"no offset designator"}
    ${"2024-02-30T12:00:00Z"}                   | ${"day out of range"}
    ${"2016-12-31T23:59:60Z"}                   | ${"leap second"}
    ${"2016-12-31 23:59:60Z"}                   | ${"leap second, space separator"}
    ${"2024-03-10T12:00:00-05:00[u-ca=hebrew]"} | ${"calendar annotation"}
    ${"invalid"}                                | ${"unparseable"}
    ${""}                                       | ${"empty string"}
  `("returns 0n when $value is invalid ($reason)", ({ value }) => {
    expect(toPgMicroseconds(value)).toBe(0n);
  });

  it.each`
    value
    ${null}
    ${undefined}
    ${123}
    ${0n}
    ${true}
    ${[]}
    ${{}}
  `("returns 0n when $value is non-string input", ({ value }) => {
    expect(toPgMicroseconds(value as unknown as string)).toBe(0n);
  });

  it("returns 0n when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();

    expect(toPgMicroseconds("2024-03-10T12:00:00Z")).toBe(0n);
  });
});
