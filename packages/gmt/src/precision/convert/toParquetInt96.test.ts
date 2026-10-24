import { hostileProxy, revokedProxy } from "../../test/hostileValues";
import { toParquetInt96 } from "./toParquetInt96";

describe("toParquetInt96", () => {
  it.each`
    iso                                              | julianDay    | nanosOfDay
    ${"1970-01-01T00:00:00Z"}                        | ${2440588}   | ${0n}
    ${"1970-01-01T00:00:00.000000001Z"}              | ${2440588}   | ${1n}
    ${"1969-12-31T23:59:59.999999999Z"}              | ${2440587}   | ${86_399_999_999_999n}
    ${"2024-03-10T12:34:56.789Z"}                    | ${2460380}   | ${45_296_789_000_000n}
    ${"2024-03-10T13:34:56.789+01:00[Europe/Paris]"} | ${2460380}   | ${45_296_789_000_000n}
    ${"-004713-11-24T00:00:00Z"}                     | ${0}         | ${0n}
    ${"-271821-04-20T00:00:00Z"}                     | ${-97559412} | ${0n}
    ${"+275760-09-13T00:00:00Z"}                     | ${102440588} | ${0n}
    ${"1969-12-31T00:00:00Z"}                        | ${2440587}   | ${0n}
    ${"2024-03-10T23:59:59.999999999Z"}              | ${2460380}   | ${86_399_999_999_999n}
    ${"2024-03-11T00:00:00Z"}                        | ${2460381}   | ${0n}
    ${"2024-03-10T23:30:00-02:00"}                   | ${2460381}   | ${5_400_000_000_000n}
    ${"2024-03-10T00:30:00+05:30"}                   | ${2460379}   | ${68_400_000_000_000n}
    ${"2024-02-29T12:00:00Z"}                        | ${2460370}   | ${43_200_000_000_000n}
    ${"+275760-09-13T00:00:00.000000000Z"}           | ${102440588} | ${0n}
  `(
    "returns day $julianDay + $nanosOfDay ns for $iso",
    ({ iso, julianDay, nanosOfDay }) => {
      expect(toParquetInt96(iso)).toStrictEqual({ julianDay, nanosOfDay });
    },
  );

  it("produces the 12 bytes a hand-built little-endian layout expects", () => {
    const { julianDay, nanosOfDay } = toParquetInt96(
      "2024-03-10T12:34:56.789Z",
    )!;
    const view = new DataView(new ArrayBuffer(12));
    view.setBigInt64(0, nanosOfDay, true);
    view.setInt32(8, julianDay, true);

    // 12:34:56.789 is 45_296_789_000_000 ns (0x29327b048f40); 2024-03-10 is Julian day
    // 2_460_380 (0x258adc). Little-endian: int64 nanos, then int32 day.
    const expected = new Uint8Array([
      0x40, 0x8f, 0x04, 0x7b, 0x32, 0x29, 0x00, 0x00, 0xdc, 0x8a, 0x25, 0x00,
    ]);

    expect(new Uint8Array(view.buffer)).toStrictEqual(expected);
  });

  it.each`
    value
    ${"+275760-09-13T00:00:00.000000001Z"}
    ${"-271821-04-19T23:59:59.999999999Z"}
    ${"2024-03-10T12:34:56"}
    ${"invalid"}
    ${""}
    ${42}
    ${null}
  `("returns null for $value", ({ value }) => {
    expect(toParquetInt96(value)).toBeNull();
  });

  it.each`
    reason                               | value
    ${"proxy that throws on every trap"} | ${hostileProxy()}
    ${"revoked proxy"}                   | ${revokedProxy()}
    ${"throwing getter"} | ${{ get length() {
    throw new Error("hostile getter");
  } }}
  `("returns null without throwing for $reason", ({ value }) => {
    expect(toParquetInt96(value)).toBeNull();
  });
});
