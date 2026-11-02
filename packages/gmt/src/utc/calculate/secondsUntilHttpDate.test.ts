import { hostileProxy } from "../../test/hostileValues";
import { setFakeSystemTime } from "../../test/setFakeSystemTime";
import { secondsUntilHttpDate } from "./secondsUntilHttpDate";

// The fake clock is 2027-06-15T12:00:00Z (really 12:00:00.0008Z).
const NOW = "2027-06-15T12:00:00Z";

describe("secondsUntilHttpDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setFakeSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 15 Jun 2027 is a Tuesday and 18 Jun a Friday. RFC 9110 §5.6.7: a recipient accepts all three
  // formats. An rfc850 two-digit year more than 50 years ahead reads as the past century.
  it.each`
    value                                  | expected        | why
    ${"Fri, 18 Jun 2027 12:00:00 GMT"}     | ${259200}       | ${"IMF-fixdate, 3 days"}
    ${"Friday, 18-Jun-27 12:00:00 GMT"}    | ${259200}       | ${"rfc850"}
    ${"Fri Jun 18 12:00:00 2027"}          | ${259200}       | ${"asctime"}
    ${"Tue, 15 Jun 2027 12:00:00 GMT"}     | ${0}            | ${"now, 0.8 ms ago"}
    ${"Tue, 15 Jun 2027 11:59:00 GMT"}     | ${-60}          | ${"a minute past"}
    ${"Tue, 15 Jun 2027 12:00:01 GMT"}     | ${1}            | ${"one second on"}
    ${"Tuesday, 15-Jun-77 12:00:00 GMT"}   | ${1577923200}   | ${"exactly 50 years on stays 2077"}
    ${"Wednesday, 15-Jun-77 12:00:01 GMT"} | ${-1577836799}  | ${"past 50 years reads as 1977"}
    ${"Tuesday, 15-Jun-99 12:00:00 GMT"}   | ${-883612800}   | ${"rfc850 99 reads as 1999"}
    ${"Fri Jun  4 12:00:00 2027"}          | ${-950400}      | ${"asctime pads a one-digit day with a space (11 days past)"}
    ${"Tue, 29 Feb 2028 12:00:00 GMT"}     | ${22377600}     | ${"a real leap day"}
    ${"Tue, 15 Jun 2027 23:59:59 GMT"}     | ${43199}        | ${"11 h 59 min 59 s on, rounded up from 43198.9992"}
    ${"Tue, 15 Jun 2027 00:00:00 GMT"}     | ${-43200}       | ${"12 h past, rounded toward zero from -43200.0008"}
    ${"Fri, 31 Dec 9999 23:59:59 GMT"}     | ${251589239999} | ${"the last second IMF-fixdate can write"}
  `("returns $expected for $value ($why)", ({ value, expected }) => {
    expect(secondsUntilHttpDate(value)).toBe(expected);
  });

  it.each`
    value                                 | why
    ${""}                                 | ${"empty"}
    ${"tomorrow"}                         | ${"not a date"}
    ${"120"}                              | ${"delay-seconds is not an HTTP-date"}
    ${"2027-06-18T12:00:00Z"}             | ${"ISO, not HTTP-date"}
    ${"Sat, 18 Jun 2027 12:00:00 GMT"}    | ${"wrong weekday"}
    ${"Tuesday, 15-Jun-77 12:00:01 GMT"}  | ${"resolves to 1977, a Wednesday"}
    ${"Saturday, 18-Jun-27 12:00:00 GMT"} | ${"rfc850 with the wrong weekday"}
    ${"Sat Jun 18 12:00:00 2027"}         | ${"asctime with the wrong weekday"}
    ${"Wed, 31 Jun 2027 12:00:00 GMT"}    | ${"a day June does not have"}
    ${"Mon, 29 Feb 2027 12:00:00 GMT"}    | ${"29 Feb in a common year"}
    ${"fri, 18 jun 2027 12:00:00 gmt"}    | ${"lower-case day name, month and zone"}
    ${" Fri, 18 Jun 2027 12:00:00 GMT"}   | ${"a leading space"}
    ${"Fri, 18 Jun 2027 12:00:00 GMT "}   | ${"a trailing space"}
    ${null}                               | ${"null"}
    ${undefined}                          | ${"undefined"}
    ${1813060800}                         | ${"a number"}
  `("returns null for $why", ({ value }) => {
    expect(secondsUntilHttpDate(value)).toBeNull();
  });

  it("returns null for a hostile value", () => {
    expect(secondsUntilHttpDate(hostileProxy() as never)).toBeNull();
  });

  it("follows the clock: the same date is shorter a minute later", () => {
    expect(secondsUntilHttpDate("Fri, 18 Jun 2027 12:00:00 GMT")).toBe(259200);
    setFakeSystemTime("2027-06-15T12:01:00Z");
    expect(secondsUntilHttpDate("Fri, 18 Jun 2027 12:00:00 GMT")).toBe(259140);
  });
});
