import { fromUlid } from "./fromUlid";
import { ulidTimestampPrefix } from "./ulidTimestampPrefix";

const ZEROS16 = "0000000000000000";

describe("fromUlid", () => {
  it.each`
    ulid                            | expected                         | reason
    ${"01ARZ3NDEKTSV4RRFFQ69G5FAV"} | ${"2016-07-30T23:54:10.259Z"}    | ${"spec README example, 1469922850259 ms"}
    ${"01HK153X000000000000000000"} | ${"2024-01-01T00:00:00Z"}        | ${"1704067200000 ms"}
    ${"01hk153x000000000000000000"} | ${"2024-01-01T00:00:00Z"}        | ${"case-insensitive"}
    ${"01HK153x000000000000000000"} | ${"2024-01-01T00:00:00Z"}        | ${"mixed case"}
    ${"00000000100000000000000000"} | ${"1970-01-01T00:00:00.032Z"}    | ${"second digit from the right is worth 32 ms"}
    ${"00000000Z70000000000000000"} | ${"1970-01-01T00:00:00.999Z"}    | ${"999 ms = Z7, three fraction digits kept"}
    ${"70000000000000000000000000"} | ${"9774-08-21T16:50:21.824Z"}    | ${"7 followed by zeros is 7 * 32^9 ms"}
    ${"01FWHE4YDG0000000000000000"} | ${"2022-02-22T19:22:22Z"}        | ${"same ms as RFC 9562 A.6"}
    ${"00000000000000000000000000"} | ${"1970-01-01T00:00:00Z"}        | ${"Unix epoch"}
    ${"7ZZZZZZZZZZZZZZZZZZZZZZZZZ"} | ${"+010889-08-02T05:31:50.655Z"} | ${"largest valid ULID, 2^48 - 1 ms"}
    ${"01HK153X00ZZZZZZZZZZZZZZZZ"} | ${"2024-01-01T00:00:00Z"}        | ${"randomness is not read"}
  `("returns $expected for $ulid ($reason)", ({ ulid, expected }) => {
    expect(fromUlid(ulid)).toBe(expected);
  });

  it.each`
    ulid                              | reason                                       | label
    ${"80000000000000000000000000"}   | ${"overflow: first character 8"}             | ${"'80000000000000000000000000'"}
    ${"ZZZZZZZZZZZZZZZZZZZZZZZZZZ"}   | ${"overflow"}                                | ${"'ZZZZZZZZZZZZZZZZZZZZZZZZZZ'"}
    ${"01HK153X00000000000000000I"}   | ${"excluded I"}                              | ${"'01HK153X00000000000000000I'"}
    ${"01HK153X00000000000000000L"}   | ${"excluded L"}                              | ${"'01HK153X00000000000000000L'"}
    ${"01HK153X00000000000000000O"}   | ${"excluded O"}                              | ${"'01HK153X00000000000000000O'"}
    ${"01HK153X00000000000000000U"}   | ${"excluded U"}                              | ${"'01HK153X00000000000000000U'"}
    ${"01HK153X00000000000000000i"}   | ${"excluded i, lower case"}                  | ${"'01HK153X00000000000000000i'"}
    ${"01HK153X00000000000000000l"}   | ${"excluded l, lower case"}                  | ${"'01HK153X00000000000000000l'"}
    ${"01HK153X00000000000000000o"}   | ${"excluded o, lower case"}                  | ${"'01HK153X00000000000000000o'"}
    ${"01HK153X00000000000000000u"}   | ${"excluded u, lower case"}                  | ${"'01HK153X00000000000000000u'"}
    ${"0IHK153X000000000000000000"}   | ${"excluded I inside the timestamp"}         | ${"'0IHK153X000000000000000000'"}
    ${"01HK153X0000000000000L0000"}   | ${"excluded L inside the randomness"}        | ${"'01HK153X0000000000000L0000'"}
    ${"O1HK153X000000000000000000"}   | ${"O not folded to 0 at the start"}          | ${"'O1HK153X000000000000000000'"}
    ${"90000000000000000000000000"}   | ${"overflow: first character 9"}             | ${"'90000000000000000000000000'"}
    ${"A0000000000000000000000000"}   | ${"overflow: first character A"}             | ${"'A0000000000000000000000000'"}
    ${"a0000000000000000000000000"}   | ${"overflow: first character a, lower case"} | ${"'a0000000000000000000000000'"}
    ${"87ZZZZZZZZZZZZZZZZZZZZZZZZ"}   | ${"overflow: 8 then max digits"}             | ${"'87ZZZZZZZZZZZZZZZZZZZZZZZZ'"}
    ${"01HK153X00000000000000000"}    | ${"25 characters"}                           | ${"'01HK153X00000000000000000'"}
    ${"01HK153X0000000000000000000"}  | ${"27 characters"}                           | ${"'01HK153X0000000000000000000'"}
    ${" 01HK153X000000000000000000"}  | ${"leading space"}                           | ${"' 01HK153X000000000000000000'"}
    ${"01HK153X000000000000000000 "}  | ${"trailing space"}                          | ${"'01HK153X000000000000000000 '"}
    ${"01HK153X00000000000000000-"}   | ${"hyphen"}                                  | ${"'01HK153X00000000000000000-'"}
    ${""}                             | ${"empty"}                                   | ${"''"}
    ${42}                             | ${"number"}                                  | ${"42"}
    ${undefined}                      | ${"undefined"}                               | ${"undefined"}
    ${null}                           | ${"null"}                                    | ${"null"}
    ${{}}                             | ${"object"}                                  | ${"{}"}
    ${["01HK153X000000000000000000"]} | ${"array holding a valid ULID"}              | ${'["01HK153X000000000000000000"]'}
    ${2704067200000}                  | ${"number of milliseconds"}                  | ${"2704067200000"}
  `("returns an empty string for $label ($reason)", ({ ulid }) => {
    expect(fromUlid(ulid)).toBe("");
  });

  it.each`
    ulid
    ${"01ARZ3NDEKTSV4RRFFQ69G5FAV"}
    ${"01HK153X000000000000000000"}
    ${"01hk153x000000000000000000"}
    ${"01FWHE4YDG0000000000000000"}
    ${"00000000000000000000000000"}
    ${"7ZZZZZZZZZZZZZZZZZZZZZZZZZ"}
  `("round-trips $ulid through ulidTimestampPrefix", ({ ulid }) => {
    expect(ulidTimestampPrefix(fromUlid(ulid))).toBe(
      ulid.slice(0, 10).toUpperCase(),
    );
  });

  it("never returns more than three fraction digits", () => {
    expect(fromUlid("01ARZ3NDEK" + ZEROS16)).toMatch(/\.\d{3}Z$/);
  });
});
