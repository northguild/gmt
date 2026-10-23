import {
  base62Value,
  crockfordDigits,
  crockfordValue,
  hexValue,
  ksuidText,
  objectIdText,
  ulidText,
  unsignedDecimalText,
  uuidText,
} from "./identifierText";

const UUID = "c232ab00-9414-11ec-b3c8-9f6bdeced846";

describe("uuidText", () => {
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
    ${"empty"}                | ${""}                                     | ${false}
  `("$name -> $expected", ({ input, expected }) => {
    expect(uuidText.test(input)).toBe(expected);
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
    name                             | actual                                        | expected
    ${"hexValue ff"}                 | ${hexValue("ff")}                             | ${255n}
    ${"hexValue upper-case"}         | ${hexValue("FF")}                             | ${255n}
    ${"hexValue UUID time_low"}      | ${hexValue("c232ab00")}                       | ${3258100480n}
    ${"hexValue 24 f's"}             | ${hexValue("f".repeat(24))}                   | ${2n ** 96n - 1n}
    ${"crockfordValue max"}          | ${crockfordValue("7ZZZZZZZZZ")}               | ${2n ** 48n - 1n}
    ${"crockfordValue zero"}         | ${crockfordValue("0000000000")}               | ${0n}
    ${"crockfordValue lower-case"}   | ${crockfordValue("7zzzzzzzzz")}               | ${2n ** 48n - 1n}
    ${"crockfordValue 01HK153X00"}   | ${crockfordValue("01HK153X00")}               | ${1704067200000n}
    ${"crockfordValue 26-digit max"} | ${crockfordValue("7" + "Z".repeat(25))}       | ${2n ** 128n - 1n}
    ${"crockfordDigits 2024-01-01"}  | ${crockfordDigits(1704067200000n, 10)}        | ${"01HK153X00"}
    ${"crockfordDigits zero"}        | ${crockfordDigits(0n, 10)}                    | ${"0000000000"}
    ${"crockfordDigits max"}         | ${crockfordDigits(2n ** 48n - 1n, 10)}        | ${"7ZZZZZZZZZ"}
    ${"crockfordDigits 16 wide"}     | ${crockfordDigits(2n ** 80n - 1n, 16)}        | ${"ZZZZZZZZZZZZZZZZ"}
    ${"base62Value zero"}            | ${base62Value("0".repeat(27))}                | ${0n}
    ${"base62Value z"}               | ${base62Value("z")}                           | ${61n}
    ${"base62Value 10"}              | ${base62Value("10")}                          | ${62n}
    ${"base62Value max"}             | ${base62Value("aWgEPTl1tmebfsQzFP4bxwgy80V")} | ${2n ** 160n - 1n}
    ${"base62Value KSUID sample"}    | ${base62Value("0ujtsYcgvSTl8PAuAdqWYSMnLOv")} | ${0x0669f7efb5a1cd34b5f99d1154fb6853345c9735n}
  `("$name -> $expected", ({ actual, expected }) => {
    expect(actual).toBe(expected);
  });
});
