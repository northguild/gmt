import {
  BASE62_ALPHABET,
  CROCKFORD_ALPHABET,
  crockfordDigits,
  digitsValue,
  hexValue,
  ksuidText,
  objectIdText,
  ulidText,
  unsignedDecimalText,
  timeUuidText,
} from "./identifierText";

const UUID = "c232ab00-9414-11ec-b3c8-9f6bdeced846";

describe("timeUuidText", () => {
  it.each`
    name                      | input                                     | expected
    ${"lower-case canonical"} | ${UUID}                                   | ${true}
    ${"upper-case canonical"} | ${UUID.toUpperCase()}                     | ${true}
    ${"braced"}               | ${`{${UUID}}`}                            | ${false}
    ${"urn:uuid: prefix"}     | ${`urn:uuid:${UUID}`}                     | ${false}
    ${"32 bare hex digits"}   | ${UUID.replaceAll("-", "")}               | ${false}
    ${"leading space"}        | ${` ${UUID}`}                             | ${false}
    ${"trailing newline"}     | ${`${UUID}\n`}                            | ${false}
    ${"non-hex digit g"}      | ${"c232ab00-9414-11ec-b3c8-9f6bdeced84g"} | ${false}
    ${"short last group"}     | ${"c232ab00-9414-11ec-b3c8-9f6bdeced84"}  | ${false}
    ${"hyphens misplaced"}    | ${"c232ab009-414-11ec-b3c8-9f6bdeced846"} | ${false}
    ${"version 6"}            | ${"1ec9414c-232a-6b00-b3c8-9f6bdeced846"} | ${true}
    ${"version 7"}            | ${"017f22e2-79b0-7cc3-98c4-dc0c0c07398f"} | ${true}
    ${"variant digit 8"}      | ${"c232ab00-9414-11ec-83c8-9f6bdeced846"} | ${true}
    ${"variant digit B"}      | ${"C232AB00-9414-11EC-B3C8-9F6BDECED846"} | ${true}
    ${"version 4"}            | ${"919108f7-52d1-4320-9bac-f847db4148a8"} | ${false}
    ${"version 2"}            | ${"c232ab00-9414-21ec-b3c8-9f6bdeced846"} | ${false}
    ${"version 8"}            | ${"c232ab00-9414-81ec-b3c8-9f6bdeced846"} | ${false}
    ${"NCS variant 7"}        | ${"c232ab00-9414-11ec-73c8-9f6bdeced846"} | ${false}
    ${"Microsoft variant c"}  | ${"c232ab00-9414-11ec-c3c8-9f6bdeced846"} | ${false}
    ${"Nil UUID"}             | ${"00000000-0000-0000-0000-000000000000"} | ${false}
    ${"Max UUID"}             | ${"ffffffff-ffff-ffff-ffff-ffffffffffff"} | ${false}
    ${"empty"}                | ${""}                                     | ${false}
  `("$name -> $expected", ({ input, expected }) => {
    expect(timeUuidText.test(input)).toBe(expected);
  });
});

describe("timeUuidText by version and variant digit", () => {
  it.each`
    version | expected
    ${"0"}  | ${false}
    ${"1"}  | ${true}
    ${"2"}  | ${false}
    ${"3"}  | ${false}
    ${"4"}  | ${false}
    ${"5"}  | ${false}
    ${"6"}  | ${true}
    ${"7"}  | ${true}
    ${"8"}  | ${false}
    ${"9"}  | ${false}
    ${"a"}  | ${false}
    ${"A"}  | ${false}
    ${"b"}  | ${false}
    ${"c"}  | ${false}
    ${"d"}  | ${false}
    ${"e"}  | ${false}
    ${"f"}  | ${false}
    ${"F"}  | ${false}
  `("version digit $version -> $expected", ({ version, expected }) => {
    expect(
      timeUuidText.test(`c232ab00-9414-${version}1ec-b3c8-9f6bdeced846`),
    ).toBe(expected);
  });

  // RFC 9562 §4.1: the RFC variant is bits 10xx, so 8, 9, a and b in either case.
  it.each`
    variant | expected
    ${"0"}  | ${false}
    ${"1"}  | ${false}
    ${"2"}  | ${false}
    ${"3"}  | ${false}
    ${"4"}  | ${false}
    ${"5"}  | ${false}
    ${"6"}  | ${false}
    ${"7"}  | ${false}
    ${"8"}  | ${true}
    ${"9"}  | ${true}
    ${"a"}  | ${true}
    ${"A"}  | ${true}
    ${"b"}  | ${true}
    ${"B"}  | ${true}
    ${"c"}  | ${false}
    ${"C"}  | ${false}
    ${"d"}  | ${false}
    ${"D"}  | ${false}
    ${"e"}  | ${false}
    ${"E"}  | ${false}
    ${"f"}  | ${false}
    ${"F"}  | ${false}
  `("variant digit $variant -> $expected", ({ variant, expected }) => {
    expect(
      timeUuidText.test(`c232ab00-9414-11ec-${variant}3c8-9f6bdeced846`),
    ).toBe(expected);
  });
});

describe("objectIdText", () => {
  it.each`
    name                  | input                           | expected
    ${"24 lower hex"}     | ${"507f1f77bcf86cd799439011"}   | ${true}
    ${"24 upper hex"}     | ${"507F1F77BCF86CD799439011"}   | ${true}
    ${"23 digits"}        | ${"507f1f77bcf86cd79943901"}    | ${false}
    ${"25 digits"}        | ${"507f1f77bcf86cd7994390111"}  | ${false}
    ${"non-hex letter"}   | ${"507f1f77bcf86cd79943901g"}   | ${false}
    ${"trailing newline"} | ${"507f1f77bcf86cd799439011\n"} | ${false}
    ${"empty"}            | ${""}                           | ${false}
  `("$name -> $expected", ({ input, expected }) => {
    expect(objectIdText.test(input)).toBe(expected);
  });
});

describe("ulidText", () => {
  it.each`
    name                             | input                             | expected
    ${"upper-case"}                  | ${"01HK153X000000000000000000"}   | ${true}
    ${"lower-case"}                  | ${"01hk153x000000000000000000"}   | ${true}
    ${"maximum 7ZZZ..."}             | ${"7ZZZZZZZZZZZZZZZZZZZZZZZZZ"}   | ${true}
    ${"overflow leading 8"}          | ${"8ZZZZZZZZZZZZZZZZZZZZZZZZZ"}   | ${false}
    ${"excluded I"}                  | ${"01HK153X0000000000000000IL"}   | ${false}
    ${"excluded O then U"}           | ${"01HK153X0000000000000000OU"}   | ${false}
    ${"excluded lower-case o and l"} | ${"01HK153X0000000000000000ol"}   | ${false}
    ${"excluded lower-case i and u"} | ${"01HK153X0000000000000000iu"}   | ${false}
    ${"25 characters"}               | ${"01HK153X00000000000000000"}    | ${false}
    ${"27 characters"}               | ${"01HK153X0000000000000000000"}  | ${false}
    ${"hyphen inside"}               | ${"01HK153X0000000000000000-0"}   | ${false}
    ${"trailing newline"}            | ${"01HK153X000000000000000000\n"} | ${false}
    ${"leading 7 then lower z"}      | ${"7zzzzzzzzzzzzzzzzzzzzzzzzz"}   | ${true}
  `("$name -> $expected", ({ input, expected }) => {
    expect(ulidText.test(input)).toBe(expected);
  });
});

describe("ksuidText", () => {
  it.each`
    name                  | input                              | expected
    ${"27 base62"}        | ${"0ujtsYcgvSTl8PAuAdqWYSMnLOv"}   | ${true}
    ${"maximum"}          | ${"aWgEPTl1tmebfsQzFP4bxwgy80V"}   | ${true}
    ${"26 characters"}    | ${"0ujtsYcgvSTl8PAuAdqWYSMnLO"}    | ${false}
    ${"28 characters"}    | ${"0ujtsYcgvSTl8PAuAdqWYSMnLOvv"}  | ${false}
    ${"non-alphanumeric"} | ${"0ujtsYcgvSTl8PAuAdqWYSMnLO-"}   | ${false}
    ${"trailing newline"} | ${"0ujtsYcgvSTl8PAuAdqWYSMnLOv\n"} | ${false}
  `("$name -> $expected", ({ input, expected }) => {
    expect(ksuidText.test(input)).toBe(expected);
  });

  it("has no i flag: base62 is case-sensitive", () => {
    expect(ksuidText.flags).not.toContain("i");
  });
});

describe("unsignedDecimalText", () => {
  it.each`
    name                    | input                      | expected
    ${"one digit"}          | ${"0"}                     | ${true}
    ${"20 digits"}          | ${"18446744073709551615"}  | ${true}
    ${"21 digits"}          | ${"184467440737095516150"} | ${false}
    ${"minus sign"}         | ${"-1"}                    | ${false}
    ${"plus sign"}          | ${"+1"}                    | ${false}
    ${"exponent"}           | ${"1e3"}                   | ${false}
    ${"empty"}              | ${""}                      | ${false}
    ${"decimal point"}      | ${"1.5"}                   | ${false}
    ${"Arabic-Indic digit"} | ${"\u0661"}                | ${false}
    ${"surrounding space"}  | ${" 1"}                    | ${false}
  `("$name -> $expected", ({ input, expected }) => {
    expect(unsignedDecimalText.test(input)).toBe(expected);
  });
});

describe("decoders", () => {
  it.each`
    name                                    | actual                                                         | expected
    ${"hexValue ff"}                        | ${hexValue("ff")}                                              | ${255n}
    ${"hexValue upper-case"}                | ${hexValue("FF")}                                              | ${255n}
    ${"hexValue UUID time_low"}             | ${hexValue("c232ab00")}                                        | ${3258100480n}
    ${"hexValue 24 f's"}                    | ${hexValue("f".repeat(24))}                                    | ${2n ** 96n - 1n}
    ${"digitsValue crockford max"}          | ${digitsValue("7ZZZZZZZZZ", CROCKFORD_ALPHABET)}               | ${2n ** 48n - 1n}
    ${"digitsValue crockford zero"}         | ${digitsValue("0000000000", CROCKFORD_ALPHABET)}               | ${0n}
    ${"digitsValue crockford 01HK153X00"}   | ${digitsValue("01HK153X00", CROCKFORD_ALPHABET)}               | ${1704067200000n}
    ${"digitsValue crockford 26-digit max"} | ${digitsValue("7" + "Z".repeat(25), CROCKFORD_ALPHABET)}       | ${2n ** 128n - 1n}
    ${"crockfordDigits 2024-01-01"}         | ${crockfordDigits(1704067200000n, 10)}                         | ${"01HK153X00"}
    ${"crockfordDigits zero"}               | ${crockfordDigits(0n, 10)}                                     | ${"0000000000"}
    ${"crockfordDigits max"}                | ${crockfordDigits(2n ** 48n - 1n, 10)}                         | ${"7ZZZZZZZZZ"}
    ${"crockfordDigits 16 wide"}            | ${crockfordDigits(2n ** 80n - 1n, 16)}                         | ${"ZZZZZZZZZZZZZZZZ"}
    ${"digitsValue base62 zero"}            | ${digitsValue("0".repeat(27), BASE62_ALPHABET)}                | ${0n}
    ${"digitsValue base62 z"}               | ${digitsValue("z", BASE62_ALPHABET)}                           | ${61n}
    ${"digitsValue base62 10"}              | ${digitsValue("10", BASE62_ALPHABET)}                          | ${62n}
    ${"digitsValue base62 max"}             | ${digitsValue("aWgEPTl1tmebfsQzFP4bxwgy80V", BASE62_ALPHABET)} | ${2n ** 160n - 1n}
    ${"digitsValue base62 KSUID sample"}    | ${digitsValue("0ujtsYcgvSTl8PAuAdqWYSMnLOv", BASE62_ALPHABET)} | ${0x0669f7efb5a1cd34b5f99d1154fb6853345c9735n}
  `("$name -> $expected", ({ actual, expected }) => {
    expect(actual).toBe(expected);
  });
});
