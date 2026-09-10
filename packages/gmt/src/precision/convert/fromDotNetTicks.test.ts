import { mockTemporalInstantFromEpochNanosecondsThrow } from "../../test/mocks";
import { fromDotNetTicks } from "./fromDotNetTicks";
import { toDotNetTicks } from "./toDotNetTicks";

describe("fromDotNetTicks", () => {
  it.each`
    value                   | expected                          | reason
    ${0n}                   | ${"0001-01-01T00:00:00Z"}         | ${"DateTime.MinValue"}
    ${504911232000000000n}  | ${"1601-01-01T00:00:00Z"}         | ${"the FILETIME epoch"}
    ${599266080000000000n}  | ${"1900-01-01T00:00:00Z"}         | ${"the NTP epoch"}
    ${621355967990000000n}  | ${"1969-12-31T23:59:59Z"}         | ${"one second before the Unix epoch"}
    ${621355968000000000n}  | ${"1970-01-01T00:00:00Z"}         | ${"DateTime.UnixEpoch.Ticks"}
    ${630822816000000000n}  | ${"2000-01-01T00:00:00Z"}         | ${"round millennium"}
    ${638447616000000000n}  | ${"2024-02-29T00:00:00Z"}         | ${"leap day"}
    ${638456708967890000n}  | ${"2024-03-10T12:34:56.789Z"}     | ${"millisecond precision"}
    ${638456688001234567n}  | ${"2024-03-10T12:00:00.1234567Z"} | ${"full 100 ns resolution"}
    ${3155378975999999999n} | ${"9999-12-31T23:59:59.9999999Z"} | ${"DateTime.MaxValue"}
  `("returns $expected for $value ($reason)", ({ value, expected }) => {
    expect(fromDotNetTicks(value)).toBe(expected);
  });

  it.each`
    value                             | reason
    ${"0001-01-01T00:00:00Z"}         | ${"DateTime.MinValue"}
    ${"1970-01-01T00:00:00Z"}         | ${"the Unix epoch"}
    ${"1969-12-31T23:59:59Z"}         | ${"pre-Unix-epoch"}
    ${"2024-02-29T00:00:00Z"}         | ${"leap day"}
    ${"2024-03-10T12:34:56.789Z"}     | ${"millisecond precision"}
    ${"2024-03-10T12:00:00.1234567Z"} | ${"exactly on the 100 ns grid"}
    ${"9999-12-31T23:59:59.9999999Z"} | ${"DateTime.MaxValue"}
  `("round-trips $value through toDotNetTicks ($reason)", ({ value }) => {
    expect(fromDotNetTicks(toDotNetTicks(value))).toBe(value);
  });

  it("round-trips a sub-100 ns instant only as far as the 100 ns grid", () => {
    expect(
      fromDotNetTicks(toDotNetTicks("2024-03-10T12:00:00.123456789Z")),
    ).toBe("2024-03-10T12:00:00.1234567Z");
  });

  it.each`
    value                   | reason
    ${-1n}                  | ${"one tick before DateTime.MinValue"}
    ${-621355968000000000n} | ${"far negative"}
    ${3155378976000000000n} | ${"one tick past DateTime.MaxValue"}
    ${10n ** 30n}           | ${"far beyond the DateTime range"}
  `('returns "" for $value ($reason)', ({ value }) => {
    expect(fromDotNetTicks(value)).toBe("");
  });

  it.each`
    value
    ${0}
    ${621355968000000000}
    ${"621355968000000000"}
    ${null}
    ${undefined}
    ${true}
    ${[]}
    ${{}}
  `('returns "" when $value is non-bigint input', ({ value }) => {
    expect(fromDotNetTicks(value as unknown as bigint)).toBe("");
  });

  it('returns "" when Temporal.Instant.fromEpochNanoseconds throws', () => {
    mockTemporalInstantFromEpochNanosecondsThrow();

    expect(fromDotNetTicks(621355968000000000n)).toBe("");
  });
});
