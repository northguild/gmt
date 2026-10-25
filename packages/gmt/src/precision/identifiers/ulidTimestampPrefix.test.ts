import { fromUlid } from "./fromUlid";
import { ulidTimestampPrefix } from "./ulidTimestampPrefix";

describe("ulidTimestampPrefix", () => {
  it.each`
    input                                      | expected        | reason
    ${"2024-01-01T00:00:00Z"}                  | ${"01HK153X00"} | ${"1704067200000 ms"}
    ${"2016-07-30T23:54:10.259Z"}              | ${"01ARZ3NDEK"} | ${"spec README example"}
    ${"2022-02-22T19:22:22Z"}                  | ${"01FWHE4YDG"} | ${"RFC 9562 A.6 instant"}
    ${"1970-01-01T00:00:00Z"}                  | ${"0000000000"} | ${"Unix epoch"}
    ${"2024-01-01T00:00:00.0009Z"}             | ${"01HK153X00"} | ${"sub-millisecond digits floor"}
    ${"2024-01-01T09:00:00+09:00[Asia/Tokyo]"} | ${"01HK153X00"} | ${"zoned input reads as its instant"}
    ${"2024-01-01T09:00:00+09:00"}             | ${"01HK153X00"} | ${"offset input"}
    ${"+010889-08-02T05:31:50.655Z"}           | ${"7ZZZZZZZZZ"} | ${"2^48 - 1 ms"}
    ${"+010889-08-02T05:31:50.6559999Z"}       | ${"7ZZZZZZZZZ"} | ${"sub-ms digits floor at the 48-bit max"}
    ${"+010889-08-02T05:31:50.656Z"}           | ${"8000000000"} | ${"2^48 ms: the exclusive end no ULID carries"}
    ${"+010889-08-02T05:31:50.656999999Z"}     | ${"8000000000"} | ${"sub-ms digits floor to the exclusive end"}
    ${"+010889-08-02T14:31:50.656+09:00"}      | ${"8000000000"} | ${"the exclusive end, expressed with an offset"}
    ${"1970-01-01T00:00:00.0009999Z"}          | ${"0000000000"} | ${"sub-ms digits floor at the epoch"}
    ${"1970-01-01T00:00:00.001Z"}              | ${"0000000001"} | ${"one millisecond"}
    ${"1970-01-01T00:00:00.032Z"}              | ${"0000000010"} | ${"32 ms carries into the next digit"}
    ${"1970-01-01T00:00:00.999Z"}              | ${"00000000Z7"} | ${"999 ms"}
    ${"2024-01-01T00:00:00.999Z"}              | ${"01HK153XZ7"} | ${"last millisecond of a second"}
    ${"1969-12-31T19:00:00-05:00"}             | ${"0000000000"} | ${"negative offset landing on the epoch"}
  `("returns $expected for $input ($reason)", ({ input, expected }) => {
    expect(ulidTimestampPrefix(input)).toBe(expected);
  });

  it.each`
    input                                 | reason                                                | label
    ${"+010889-08-02T05:31:50.657Z"}      | ${"past the exclusive end 2^48 ms"}                   | ${"'+010889-08-02T05:31:50.657Z'"}
    ${"1969-12-31T23:59:59.999Z"}         | ${"before the Unix epoch"}                            | ${"'1969-12-31T23:59:59.999Z'"}
    ${"1969-12-31T23:59:59.9999999Z"}     | ${"-0.0001 ms floors to -1 ms, not truncated to 0"}   | ${"'1969-12-31T23:59:59.9999999Z'"}
    ${"1970-01-01T00:00:00+01:00"}        | ${"zoned/offset input an hour before the epoch"}      | ${"'1970-01-01T00:00:00+01:00'"}
    ${"-000001-01-01T00:00:00Z"}          | ${"far before the epoch"}                             | ${"'-000001-01-01T00:00:00Z'"}
    ${"+010889-08-02T14:31:50.657+09:00"} | ${"past the exclusive end, expressed with an offset"} | ${"'+010889-08-02T14:31:50.657+09:00'"}
    ${"2024-01-01T00:00:00"}              | ${"no offset"}                                        | ${"'2024-01-01T00:00:00'"}
    ${"invalid"}                          | ${"not a date"}                                       | ${"'invalid'"}
    ${""}                                 | ${"empty"}                                            | ${"''"}
    ${42}                                 | ${"number"}                                           | ${"42"}
    ${undefined}                          | ${"undefined"}                                        | ${"undefined"}
    ${null}                               | ${"null"}                                             | ${"null"}
    ${{}}                                 | ${"object"}                                           | ${"{}"}
  `("returns an empty string for $label ($reason)", ({ input }) => {
    expect(ulidTimestampPrefix(input)).toBe("");
  });

  it.each`
    input                                        | floored
    ${"2024-01-01T00:00:00Z"}                    | ${"2024-01-01T00:00:00Z"}
    ${"2022-02-22T19:22:22.123456789Z"}          | ${"2022-02-22T19:22:22.123Z"}
    ${"2024-01-01T09:00:00.5+09:00[Asia/Tokyo]"} | ${"2024-01-01T00:00:00.5Z"}
    ${"+010889-08-02T05:31:50.655Z"}             | ${"+010889-08-02T05:31:50.655Z"}
  `("round-trips $input through fromUlid as $floored", ({ input, floored }) => {
    const prefix = ulidTimestampPrefix(input);
    expect(fromUlid(prefix + "0000000000000000")).toBe(floored);
  });

  it("orders prefixes like instants, across digit and letter boundaries", () => {
    const a = ulidTimestampPrefix("2024-01-01T00:00:00.009Z");
    const b = ulidTimestampPrefix("2024-01-01T00:00:00.010Z");
    const c = ulidTimestampPrefix("2024-01-01T00:00:00.033Z");
    expect(a < b && b < c).toBe(true);
  });

  it("selects ULIDs minted in [start, end) by text comparison", () => {
    const start = ulidTimestampPrefix("2024-01-01T00:00:00Z");
    const end = ulidTimestampPrefix("2024-01-01T00:00:01Z");
    const inside = "01HK153X0ZZZZZZZZZZZZZZZZZ";
    const atEnd = "01HK153XZ80000000000000000"; // 1000 ms = Z8 in base32
    const before = "01HK153WZZZZZZZZZZZZZZZZZZ";
    expect(end).toBe("01HK153XZ8");
    expect(inside >= start && inside < end).toBe(true);
    expect(atEnd >= start && atEnd < end).toBe(false);
    expect(before >= start && before < end).toBe(false);
  });
});
