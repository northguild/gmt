import { mockTemporalInstantFromEpochNanosecondsThrow } from "../../test/mocks";
import { fromPgMicroseconds } from "./fromPgMicroseconds";
import { toPgMicroseconds } from "./toPgMicroseconds";

describe("fromPgMicroseconds", () => {
  it.each`
    value                   | expected                         | reason
    ${0n}                   | ${"2000-01-01T00:00:00Z"}        | ${"the PostgreSQL epoch"}
    ${-946684800000000n}    | ${"1970-01-01T00:00:00Z"}        | ${"the Unix epoch"}
    ${-946684801000000n}    | ${"1969-12-31T23:59:59Z"}        | ${"one second before the Unix epoch"}
    ${-12591158400000000n}  | ${"1601-01-01T00:00:00Z"}        | ${"the FILETIME epoch"}
    ${762480000000000n}     | ${"2024-02-29T00:00:00Z"}        | ${"leap day"}
    ${763389296789000n}     | ${"2024-03-10T12:34:56.789Z"}    | ${"millisecond precision"}
    ${763387200123456n}     | ${"2024-03-10T12:00:00.123456Z"} | ${"full microsecond resolution"}
    ${8639053315200000000n} | ${"+275760-09-13T00:00:00Z"}     | ${"the largest representable instant"}
    ${-211813488000000000n} | ${"-004713-11-24T00:00:00Z"}     | ${"MIN_TIMESTAMP — PostgreSQL's earliest timestamp"}
  `("returns $expected for $value ($reason)", ({ value, expected }) => {
    expect(fromPgMicroseconds(value)).toBe(expected);
  });

  it.each`
    value                            | reason
    ${"2000-01-01T00:00:00Z"}        | ${"the PostgreSQL epoch"}
    ${"1970-01-01T00:00:00Z"}        | ${"the Unix epoch"}
    ${"1969-12-31T23:59:59Z"}        | ${"pre-Unix-epoch"}
    ${"2024-02-29T00:00:00Z"}        | ${"leap day"}
    ${"2024-03-10T12:34:56.789Z"}    | ${"millisecond precision"}
    ${"2024-03-10T12:00:00.123456Z"} | ${"exactly on the microsecond grid"}
    ${"+275760-09-13T00:00:00Z"}     | ${"the largest representable instant"}
    ${"-004713-11-24T00:00:00Z"}     | ${"PostgreSQL's earliest timestamp"}
  `("round-trips $value through toPgMicroseconds ($reason)", ({ value }) => {
    expect(fromPgMicroseconds(toPgMicroseconds(value))).toBe(value);
  });

  it("round-trips a nanosecond instant only as far as the microsecond grid", () => {
    expect(
      fromPgMicroseconds(toPgMicroseconds("2024-03-10T12:00:00.123456789Z")),
    ).toBe("2024-03-10T12:00:00.123456Z");
  });

  it.each`
    value                    | reason
    ${8639053315200000001n}  | ${"one microsecond past the largest representable instant"}
    ${-8640946684800000001n} | ${"one microsecond before the smallest representable instant"}
    ${9223372036854775807n}  | ${"int64 maximum, still outside Temporal's range"}
    ${10n ** 30n}            | ${"far beyond int64"}
  `('returns "" for $value ($reason)', ({ value }) => {
    expect(fromPgMicroseconds(value)).toBe("");
  });

  it.each`
    value
    ${0}
    ${763387200123456}
    ${"763387200123456"}
    ${null}
    ${undefined}
    ${true}
    ${[]}
    ${{}}
  `('returns "" when $value is non-bigint input', ({ value }) => {
    expect(fromPgMicroseconds(value as unknown as bigint)).toBe("");
  });

  it('returns "" when Temporal.Instant.fromEpochNanoseconds throws', () => {
    mockTemporalInstantFromEpochNanosecondsThrow();

    expect(fromPgMicroseconds(0n)).toBe("");
  });
});
