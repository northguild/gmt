import { hostileProxy, revokedProxy } from "../test/hostileValues";
import {
  formatTai64nLabel,
  parseTai64Label,
  TAI64_SECONDS_OFFSET,
  tai64LabelText,
} from "./index";

describe("constants", () => {
  it("TAI64_SECONDS_OFFSET is 2^62", () => {
    expect(TAI64_SECONDS_OFFSET).toBe(2n ** 62n);
  });
});

describe("tai64LabelText", () => {
  it.each`
    name                  | input                                          | expected
    ${"16 digits, no @"}  | ${"400000002a2b2c2d"}                          | ${true}
    ${"24 digits with @"} | ${"@400000002a2b2c2d00000000"}                 | ${true}
    ${"32 digits with @"} | ${"@400000002a2b2c2d0000000000000000"}         | ${true}
    ${"40 digits"}        | ${"@400000002a2b2c2d000000000000000000000000"} | ${false}
  `("$name: matches is $expected", ({ input, expected }) => {
    expect(tai64LabelText.test(input)).toBe(expected);
  });
});

describe("parseTai64Label", () => {
  it.each`
    input                                  | expected                                     | why
    ${"@400000002a2b2c2d00000000"}         | ${707472429000000000n}                       | ${"Bernstein example"}
    ${"400000002a2b2c2d"}                  | ${707472429000000000n}                       | ${"TAI64, no @"}
    ${"@400000002a2b2c2d"}                 | ${707472429000000000n}                       | ${"TAI64 with @"}
    ${"@400000002A2B2C2D00000000"}         | ${707472429000000000n}                       | ${"upper case"}
    ${"@4000000037c219bf2ef02e94"}         | ${935467455787492500n}                       | ${"daemontools example"}
    ${"4000000037c219bf2ef02e943b9ac9ff"}  | ${935467455787492500n}                       | ${"max attoseconds dropped"}
    ${"@4000000000000000"}                 | ${0n}                                        | ${"first second of 1970 TAI"}
    ${"@4000000000000001"}                 | ${1000000000n}                               | ${"the following second"}
    ${"@7fffffffffffffff3b9ac9ff"}         | ${(2n ** 62n - 1n) * 10n ** 9n + 999999999n} | ${"last non-reserved label"}
    ${"@3fffffffffffffff"}                 | ${null}                                      | ${"second ending 1969 TAI"}
    ${"@8000000000000000"}                 | ${null}                                      | ${"2^63 reserved"}
    ${"@ffffffffffffffff"}                 | ${null}                                      | ${"reserved"}
    ${"@4000000037c219bf3b9aca00"}         | ${null}                                      | ${"nanoseconds 10^9"}
    ${"@4000000037c219bf2ef02e943b9aca00"} | ${null}                                      | ${"attoseconds 10^9"}
    ${"@4000000037c219bfffffffff"}         | ${null}                                      | ${"nanoseconds 0xffffffff"}
  `("'$input' is $expected ($why)", ({ input, expected }) => {
    expect(parseTai64Label(input)).toBe(expected);
  });

  it.each`
    name                  | input
    ${"empty"}            | ${""}
    ${"only @"}           | ${"@"}
    ${"double @"}         | ${"@@400000002a2b2c2d"}
    ${"15 digits"}        | ${"400000002a2b2c2"}
    ${"17 digits"}        | ${"400000002a2b2c2d0"}
    ${"23 digits"}        | ${"400000002a2b2c2d0000000"}
    ${"25 digits"}        | ${"400000002a2b2c2d000000000"}
    ${"31 digits"}        | ${"400000002a2b2c2d000000000000000"}
    ${"33 digits"}        | ${"400000002a2b2c2d000000000000000000"}
    ${"non-hex g"}        | ${"@400000002a2b2c2g"}
    ${"0x prefix"}        | ${"0x400000002a2b2c2d"}
    ${"leading space"}    | ${" @400000002a2b2c2d00000000"}
    ${"trailing space"}   | ${"@400000002a2b2c2d00000000 "}
    ${"whole log line"}   | ${"@400000002a2b2c2d00000000 mark"}
    ${"inner spaces"}     | ${"@4000 0000 2a2b 2c2d"}
    ${"full-width digit"} | ${"@40000000２a2b2c2d"}
    ${"trailing newline"} | ${"@400000002a2b2c2d\n"}
  `("malformed $name is null", ({ input }) => {
    expect(parseTai64Label(input)).toBeNull();
  });

  it.each`
    name               | input
    ${"number"}        | ${4611686018427387904}
    ${"bigint"}        | ${4611686018427387904n}
    ${"null"}          | ${null}
    ${"undefined"}     | ${undefined}
    ${"object"}        | ${{}}
    ${"function"}      | ${() => "@400000002a2b2c2d"}
    ${"symbol"}        | ${Symbol("x")}
    ${"hostile proxy"} | ${hostileProxy()}
    ${"revoked proxy"} | ${revokedProxy()}
  `("non-string $name is null", ({ input }) => {
    expect(parseTai64Label(input)).toBeNull();
  });
});

describe("formatTai64nLabel", () => {
  it.each`
    tai                     | expected
    ${707472429000000000n}  | ${"@400000002a2b2c2d00000000"}
    ${935467455787492500n}  | ${"@4000000037c219bf2ef02e94"}
    ${0n}                   | ${"@400000000000000000000000"}
    ${-1n}                  | ${"@3fffffffffffffff3b9ac9ff"}
    ${1483228836500000000n} | ${"@40000000586846a41dcd6500"}
  `("$tai writes '$expected'", ({ tai, expected }) => {
    expect(formatTai64nLabel(tai)).toBe(expected);
  });

  it("round-trips 1000 seeded values through parseTai64Label", () => {
    let state = 123456789n;
    const limit = TAI64_SECONDS_OFFSET * 1_000_000_000n;
    for (let index = 0; index < 1000; index++) {
      // 64-bit LCG (Knuth MMIX), widened to cover [0, 2^62 * 10^9).
      state = (state * 6364136223846793005n + 1442695040888963407n) % 2n ** 64n;
      const value = (state * 2n ** 64n + state * 40503n) % limit;
      expect(parseTai64Label(formatTai64nLabel(value))).toBe(value);
    }
  });
});
