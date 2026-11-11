import { countIntlConstructions } from "../../test/countIntlConstructions";
import { mockTemporalPlainDateFromThrow } from "../../test/mocks";
import { NON_STRINGS } from "../../test/nonStrings";
import {
  SWIFT_SENTINEL_ROWS,
  SWIFT_VALID_ROWS,
} from "../../test/swiftDateRows";
import { parseSwiftDate } from "./parseSwiftDate";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Every expected value is read off SWIFT _Message Format Validation Rules_ (Nov 2006) Part II
 * §4.1 (`<DATE2>` `YYMMDD`) and §4.1.1 (century, 1980 to 2060), never off the code under test.
 */
describe("parseSwiftDate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(SWIFT_VALID_ROWS)(
    "reads '$value' as $expected",
    ({ value, expected }) => {
      expect(parseSwiftDate(value)).toBe(expected);
    },
  );

  it.each(SWIFT_SENTINEL_ROWS)(
    "returns '' for '$value': $reason",
    ({ value }) => {
      expect(parseSwiftDate(value)).toBe("");
    },
  );

  it("places every YY by the §4.1.1 rule: 80-99 in 19YY, 00-60 in 20YY, 61-79 refused", () => {
    for (let yy = 0; yy <= 99; yy += 1) {
      // §4.1.1: IF YY > 79 THEN "19"||YY ELSE "20"||YY; IF year > 2060 THEN T50.
      const year = yy > 79 ? 1900 + yy : 2000 + yy;
      const expected = year > 2060 ? "" : `${year}-01-01`;
      expect(parseSwiftDate(`${pad2(yy)}0101`), `yy ${yy}`).toBe(expected);
    }
  });

  // Days from 1980-01-01 to 2060-12-31 by the tens digit of YY (81 years x 365 + 21 leap days
  // = 29,586; 2000 and 2060 are leap years). Counted with a plain Temporal until(); one test per
  // decade keeps each under the 0.3 s test cost.
  it.each`
    tens | days
    ${0} | ${3653}
    ${1} | ${3652}
    ${2} | ${3653}
    ${3} | ${3652}
    ${4} | ${3653}
    ${5} | ${3652}
    ${6} | ${366}
    ${7} | ${0}
    ${8} | ${3653}
    ${9} | ${3652}
  `(
    "parses $days distinct days for YY with tens digit $tens",
    ({ tens, days }) => {
      const seen = new Set<string>();
      let parsed = 0;
      let outOfRange = 0;
      for (let yy = tens * 10; yy < tens * 10 + 10; yy += 1) {
        for (let mm = 0; mm <= 13; mm += 1) {
          for (let dd = 0; dd <= 32; dd += 1) {
            const out = parseSwiftDate(`${pad2(yy)}${pad2(mm)}${pad2(dd)}`);
            if (out !== "") {
              parsed += 1;
              seen.add(out);
              if (out < "1980-01-01" || out > "2060-12-31") {
                outOfRange += 1;
              }
            }
          }
        }
      }
      expect({ parsed, distinct: seen.size, outOfRange }).toStrictEqual({
        parsed: days,
        distinct: days,
        outOfRange: 0,
      });
    },
  );

  describe("arguments", () => {
    it("returns '' for every non-string value", () => {
      for (const [kind, make] of NON_STRINGS) {
        expect(parseSwiftDate(make() as string), kind).toBe("");
      }
    });

    it("returns '' when Temporal.PlainDate.from throws", () => {
      mockTemporalPlainDateFromThrow();
      expect(parseSwiftDate("240615")).toBe("");
    });
  });

  it("constructs no Intl formatter", () => {
    const run = (): void => {
      for (const { value } of SWIFT_VALID_ROWS) {
        parseSwiftDate(value);
      }
    };
    expect(
      countIntlConstructions(["DateTimeFormat", "NumberFormat"], run, run),
    ).toBe(0);
  });
});
