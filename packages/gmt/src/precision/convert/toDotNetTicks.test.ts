import { sameInstantBattleCases } from "../../test";
import { mockTemporalInstantFromThrow } from "../../test/mocks";
import { toDotNetTicks } from "./toDotNetTicks";

describe("toDotNetTicks", () => {
  it.each`
    value                             | expected                | reason
    ${"0001-01-01T00:00:00Z"}         | ${0n}                   | ${"DateTime.MinValue"}
    ${"1601-01-01T00:00:00Z"}         | ${504911232000000000n}  | ${"the FILETIME epoch, same unit different origin"}
    ${"1900-01-01T00:00:00Z"}         | ${599266080000000000n}  | ${"the NTP epoch"}
    ${"1969-12-31T23:59:59Z"}         | ${621355967990000000n}  | ${"one second before the Unix epoch"}
    ${"1970-01-01T00:00:00Z"}         | ${621355968000000000n}  | ${"DateTime.UnixEpoch.Ticks"}
    ${"2000-01-01T00:00:00Z"}         | ${630822816000000000n}  | ${"round millennium"}
    ${"2024-02-29T00:00:00Z"}         | ${638447616000000000n}  | ${"leap day"}
    ${"2024-03-10T12:00:00Z"}         | ${638456688000000000n}  | ${"whole second"}
    ${"2024-03-10T12:34:56.789Z"}     | ${638456708967890000n}  | ${"millisecond precision"}
    ${"9999-12-31T23:59:59.9999999Z"} | ${3155378975999999999n} | ${"DateTime.MaxValue"}
  `("returns $expected for $value ($reason)", ({ value, expected }) => {
    expect(toDotNetTicks(value)).toBe(expected);
  });

  it("differs from toFileTime by exactly the 1601-01-01 tick offset", () => {
    expect(
      toDotNetTicks("2024-03-10T12:00:00Z") -
        toDotNetTicks("1601-01-01T00:00:00Z"),
    ).toBe(133545456000000000n);
  });

  it.each`
    value                               | expected               | reason
    ${"2024-03-10T12:00:00.1234567Z"}   | ${638456688001234567n} | ${"exactly on the 100 ns grid"}
    ${"2024-03-10T12:00:00.123456789Z"} | ${638456688001234567n} | ${"sub-100 ns digits floor away"}
    ${"1969-12-31T23:59:59.999999999Z"} | ${621355967999999999n} | ${"floors toward negative infinity before the Unix epoch"}
  `(
    "truncates $value to the 100 ns grid as $expected ($reason)",
    ({ value, expected }) => {
      expect(toDotNetTicks(value)).toBe(expected);
    },
  );

  it.each(sameInstantBattleCases)(
    "returns the same tick count for 2024-02-29T00:00:00Z expressed in $timeZone",
    ({ value }) => {
      expect(toDotNetTicks(value)).toBe(638447616000000000n);
    },
  );

  it.each`
    value                        | reason
    ${"0000-12-31T23:59:59Z"}    | ${"before DateTime.MinValue"}
    ${"-000001-01-01T00:00:00Z"} | ${"a negative proleptic year"}
    ${"+010000-01-01T00:00:00Z"} | ${"one tick past DateTime.MaxValue"}
    ${"+275760-09-13T00:00:00Z"} | ${"the largest representable instant"}
  `(
    "returns 0n for $value, which DateTime cannot represent ($reason)",
    ({ value }) => {
      expect(toDotNetTicks(value)).toBe(0n);
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
    expect(toDotNetTicks(value)).toBe(0n);
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
    expect(toDotNetTicks(value as unknown as string)).toBe(0n);
  });

  it("returns 0n when Temporal.Instant.from throws", () => {
    mockTemporalInstantFromThrow();

    expect(toDotNetTicks("2024-03-10T12:00:00Z")).toBe(0n);
  });
});
