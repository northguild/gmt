import { fromUuidTimestamp } from "./fromUuidTimestamp";
import { uuidV7TimestampPrefix } from "./uuidV7TimestampPrefix";

describe("uuidV7TimestampPrefix", () => {
  it.each`
    input                                      | expected           | reason
    ${"2024-01-01T00:00:00Z"}                  | ${"018cc251-f400"} | ${"1704067200000 ms = 0x018cc251f400"}
    ${"2022-02-22T19:22:22Z"}                  | ${"017f22e2-79b0"} | ${"RFC 9562 A.6 prefix, lower case"}
    ${"1970-01-01T00:00:00Z"}                  | ${"00000000-0000"} | ${"Unix epoch"}
    ${"2024-01-01T00:00:00.0009Z"}             | ${"018cc251-f400"} | ${"sub-millisecond digits floor"}
    ${"2024-01-01T09:00:00+09:00[Asia/Tokyo]"} | ${"018cc251-f400"} | ${"zoned input reads as its instant"}
    ${"2024-01-01T09:00:00+09:00"}             | ${"018cc251-f400"} | ${"offset input"}
    ${"+010889-08-02T05:31:50.655Z"}           | ${"ffffffff-ffff"} | ${"2^48 - 1 ms"}
    ${"1970-01-01T00:00:00.001Z"}              | ${"00000000-0001"} | ${"one millisecond"}
    ${"1970-02-19T17:02:47.296Z"}              | ${"00010000-0000"} | ${"2^32 ms = 0x000100000000"}
    ${"1970-02-19T17:02:47.295Z"}              | ${"0000ffff-ffff"} | ${"2^32 - 1 ms"}
  `("returns $expected for $input ($reason)", ({ input, expected }) => {
    expect(uuidV7TimestampPrefix(input)).toBe(expected);
  });

  it.each`
    input                             | reason
    ${"+010889-08-02T05:31:50.656Z"}  | ${"past 2^48 - 1 ms"}
    ${"1969-12-31T23:59:59.999Z"}     | ${"before the Unix epoch"}
    ${"1969-12-31T23:59:59.9999999Z"} | ${"sub-ms before the epoch still negative"}
    ${"2024-01-01T00:00:00"}          | ${"no offset"}
    ${"invalid"}                      | ${"not a date"}
    ${""}                             | ${"empty"}
    ${42}                             | ${"number"}
    ${undefined}                      | ${"undefined"}
  `("returns an empty string for $input ($reason)", ({ input }) => {
    expect(uuidV7TimestampPrefix(input)).toBe("");
  });

  it.each`
    input                                        | floored
    ${"2024-01-01T00:00:00Z"}                    | ${"2024-01-01T00:00:00Z"}
    ${"2022-02-22T19:22:22.123456789Z"}          | ${"2022-02-22T19:22:22.123Z"}
    ${"2024-01-01T09:00:00.5+09:00[Asia/Tokyo]"} | ${"2024-01-01T00:00:00.5Z"}
    ${"+010889-08-02T05:31:50.655Z"}             | ${"+010889-08-02T05:31:50.655Z"}
  `(
    "round-trips $input through fromUuidTimestamp as $floored",
    ({ input, floored }) => {
      const prefix = uuidV7TimestampPrefix(input);
      expect(fromUuidTimestamp(prefix + "-7000-8000-000000000000")).toEqual({
        instant: floored,
        version: 7,
      });
    },
  );

  it("orders prefixes like instants", () => {
    const a = uuidV7TimestampPrefix("2024-01-01T00:00:00.001Z");
    const b = uuidV7TimestampPrefix("2024-01-01T00:00:00.002Z");
    expect(a < b).toBe(true);
  });

  it("orders prefixes across a 9 to a hex digit boundary", () => {
    const a = uuidV7TimestampPrefix("2024-01-01T00:00:00.009Z");
    const b = uuidV7TimestampPrefix("2024-01-01T00:00:00.010Z");
    expect(a).toBe("018cc251-f409");
    expect(b).toBe("018cc251-f40a");
    expect(a < b).toBe(true);
  });

  it("selects UUIDs minted in [start, end) by text comparison", () => {
    const start = uuidV7TimestampPrefix("2024-01-01T00:00:00Z");
    const end = uuidV7TimestampPrefix("2024-01-01T00:00:01Z");
    const inside = "018cc251-f7e7-7fff-bfff-ffffffffffff";
    const atEnd = "018cc251-f7e8-7000-8000-000000000000"; // 1000 ms = 0x3e8
    expect(end).toBe("018cc251-f7e8");
    expect(inside >= start && inside < end).toBe(true);
    expect(atEnd >= start && atEnd < end).toBe(false);
  });
});
