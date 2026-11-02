import { hostileProxy } from "../../test/hostileValues";
import { setFakeSystemTime } from "../../test/setFakeSystemTime";
import { secondsUntilRetryAfter } from "./secondsUntilRetryAfter";

// The fake clock is 2027-06-15T12:00:00Z (really 12:00:00.0008Z).
const NOW = "2027-06-15T12:00:00Z";

describe("secondsUntilRetryAfter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setFakeSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // RFC 9110 §10.2.3: Retry-After = HTTP-date / delay-seconds, delay-seconds = 1*DIGIT.
  it.each`
    value                                  | expected            | why
    ${"120"}                               | ${120}              | ${"delay-seconds"}
    ${"0"}                                 | ${0}                | ${"zero delay"}
    ${"0120"}                              | ${120}              | ${"1*DIGIT allows leading zeros"}
    ${"9007199254740991"}                  | ${9007199254740991} | ${"largest safe integer"}
    ${"Fri, 18 Jun 2027 12:00:00 GMT"}     | ${259200}           | ${"IMF-fixdate, 3 days"}
    ${"Tue, 15 Jun 2027 11:59:00 GMT"}     | ${-60}              | ${"a past date is negative"}
    ${"Friday, 18-Jun-27 12:00:00 GMT"}    | ${259200}           | ${"rfc850"}
    ${"Fri Jun 18 12:00:00 2027"}          | ${259200}           | ${"asctime"}
    ${"Fri Jun  4 12:00:00 2027"}          | ${-950400}          | ${"asctime pads a one-digit day with a space (11 days past)"}
    ${"Tue, 29 Feb 2028 12:00:00 GMT"}     | ${22377600}         | ${"a real leap day"}
    ${"Tuesday, 15-Jun-77 12:00:00 GMT"}   | ${1577923200}       | ${"rfc850 year exactly 50 years on stays 2077"}
    ${"Wednesday, 15-Jun-77 12:00:01 GMT"} | ${-1577836799}      | ${"rfc850 year past 50 years reads as 1977"}
    ${"Tuesday, 15-Jun-99 12:00:00 GMT"}   | ${-883612800}       | ${"rfc850 99 reads as 1999"}
    ${"00"}                                | ${0}                | ${"1*DIGIT: two zeros"}
    ${"007"}                               | ${7}                | ${"leading zeros are not octal"}
    ${"000000000000000000000120"}          | ${120}              | ${"many leading zeros still fit"}
    ${"1813060800"}                        | ${1813060800}       | ${"digits that look like an epoch are still seconds"}
  `("returns $expected for $value ($why)", ({ value, expected }) => {
    expect(secondsUntilRetryAfter(value)).toBe(expected);
  });

  it.each`
    value                                   | label
    ${"9007199254740992"}                   | ${"'9007199254740992' (past the safe integers)"}
    ${"-5"}                                 | ${"'-5'"}
    ${"+5"}                                 | ${"'+5'"}
    ${"1.5"}                                | ${"'1.5'"}
    ${" 120"}                               | ${"' 120'"}
    ${"120 "}                               | ${"'120 '"}
    ${"120\n"}                              | ${"'120\\n'"}
    ${"١٢٠"}                                | ${"non-ASCII digits"}
    ${"１２０"}                             | ${"full-width digits"}
    ${"\t120"}                              | ${"a leading tab"}
    ${"120\t"}                              | ${"a trailing tab"}
    ${"\n120"}                              | ${"a leading newline"}
    ${"120\r\n"}                            | ${"a trailing CRLF"}
    ${"-0"}                                 | ${"'-0'"}
    ${"+0"}                                 | ${"'+0'"}
    ${"1e3"}                                | ${"'1e3'"}
    ${"0x10"}                               | ${"'0x10'"}
    ${"1_000"}                              | ${"'1_000'"}
    ${"1,000"}                              | ${"'1,000'"}
    ${"Infinity"}                           | ${"'Infinity'"}
    ${"99999999999999999999"}               | ${"twenty nines (past the safe integers)"}
    ${"9".repeat(400)}                      | ${"400 nines (Number() gives Infinity)"}
    ${"0".repeat(400) + "9007199254740992"} | ${"leading zeros before an unsafe value"}
    ${"Sat, 18 Jun 2027 12:00:00 GMT"}      | ${"IMF-fixdate with the wrong weekday"}
    ${"Saturday, 18-Jun-27 12:00:00 GMT"}   | ${"rfc850 with the wrong weekday"}
    ${"Sat Jun 18 12:00:00 2027"}           | ${"asctime with the wrong weekday"}
    ${"Tuesday, 15-Jun-77 12:00:01 GMT"}    | ${"rfc850 that resolves to 1977, a Wednesday"}
    ${"Wed, 31 Jun 2027 12:00:00 GMT"}      | ${"a day June does not have"}
    ${"Mon, 29 Feb 2027 12:00:00 GMT"}      | ${"29 Feb in a common year"}
    ${"fri, 18 jun 2027 12:00:00 gmt"}      | ${"lower-case day name, month and zone"}
    ${" Fri, 18 Jun 2027 12:00:00 GMT"}     | ${"a date with a leading space"}
    ${"Fri, 18 Jun 2027 12:00:00 GMT "}     | ${"a date with a trailing space"}
    ${"2027-06-18T12:00:00Z"}               | ${"an ISO string"}
    ${""}                                   | ${"''"}
    ${"soon"}                               | ${"'soon'"}
    ${120}                                  | ${"120 (a number)"}
    ${null}                                 | ${"null"}
    ${undefined}                            | ${"undefined"}
  `("returns null for $label", ({ value }) => {
    expect(secondsUntilRetryAfter(value)).toBeNull();
  });

  it("returns null for a hostile value", () => {
    expect(secondsUntilRetryAfter(hostileProxy() as never)).toBeNull();
  });

  it("reads no clock for delay-seconds: the same value at two times", () => {
    expect(secondsUntilRetryAfter("120")).toBe(120);
    setFakeSystemTime("2030-01-01T00:00:00Z");
    expect(secondsUntilRetryAfter("120")).toBe(120);
  });

  it("follows the clock for a date: shorter a minute later", () => {
    expect(secondsUntilRetryAfter("Fri, 18 Jun 2027 12:00:00 GMT")).toBe(
      259200,
    );
    setFakeSystemTime("2027-06-15T12:01:00Z");
    expect(secondsUntilRetryAfter("Fri, 18 Jun 2027 12:00:00 GMT")).toBe(
      259140,
    );
  });
});
