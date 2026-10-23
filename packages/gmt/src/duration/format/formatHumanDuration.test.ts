import {
  fractionRows,
  limitRows,
  millisecondRows,
  minuteOrMonthRows,
  orderRows,
  separatorRows,
  signRows,
  zeroRows,
} from "../../test/humanDurationRows";
import { parseDuration } from "../parse/parseDuration";
import { parseHumanDuration } from "../parse/parseHumanDuration";
import { formatHumanDuration } from "./formatHumanDuration";

const isoToCompact: readonly (readonly [string, string])[] = [
  ["PT2H30M", "2h 30m"],
  ["P3D", "3d"],
  ["P1M", "1mo"],
  ["PT1M", "1m"],
  ["P1W2D", "1w 2d"],
  ["P1Y2W", "1y 2w"],
  ["P1Y2M3W4DT5H6M7.008009010S", "1y 2mo 3w 4d 5h 6m 7.00800901s"],
  ["PT90M", "90m"],
  ["PT72H", "72h"],
  ["PT1H60M", "1h 60m"],
  ["P1DT25H", "1d 25h"],
  ["PT1.5H", "1h 30m"],
  ["PT0.25M", "15s"],
  ["PT1,5H", "1h 30m"],
  ["pt1h", "1h"],
  ["+PT1H", "1h"],
  ["PT02H", "2h"],
  ["PT1.5S", "1.5s"],
  ["PT1.0005S", "1.0005s"],
  ["PT0.5S", "0.5s"],
  ["PT0.000000001S", "0.000000001s"],
  ["PT1H0.0015S", "1h 0.0015s"],
  ["PT1M0.5S", "1m 0.5s"],
  ["-PT2H30M", "-2h 30m"],
  ["-P1W2D", "-1w 2d"],
  ["-PT0.5S", "-0.5s"],
  ["PT0S", "0s"],
  ["P0D", "0s"],
  ["-PT0S", "0s"],
  ["PT0H0M", "0s"],
  ["P0Y0M0W0DT0H0M0.000000000S", "0s"],
  ["PT2H0M", "2h"],
  ["P4294967295Y", "4294967295y"],
  ["P104249991374D", "104249991374d"],
  ["PT2501999792983H", "2501999792983h"],
  ["PT9007199254740991.999999999S", "9007199254740991.999999999s"],
  ["PT0.001S", "0.001s"],
  ["PT0.000001S", "0.000001s"],
  ["PT0.001002003S", "0.001002003s"],
  ["PT5.001002003S", "5.001002003s"],
  ["-PT0.001002003S", "-0.001002003s"],
  ["-P1Y2M3W4DT5H6M7.008009010S", "-1y 2mo 3w 4d 5h 6m 7.00800901s"],
  ["PT0.000000001H", "0.0000036s"],
  ["PT1.5M", "1m 30s"],
  ["pt1,5s", "1.5s"],
  ["-pt0,5h", "-30m"],
  ["+pt0,25m", "15s"],
  ["p1y2m", "1y 2mo"],
  ["+P1Y", "1y"],
  ["-P4294967295Y", "-4294967295y"],
  ["PT150119987579016M", "150119987579016m"],
  ["PT9007199254740991S", "9007199254740991s"],
  ["PT9007199254740991.000000001S", "9007199254740991.000000001s"],
];

describe("formatHumanDuration", () => {
  for (const [iso, expected] of isoToCompact) {
    it(`${iso} → ${expected}`, () => {
      expect(formatHumanDuration(iso)).toBe(expected);
    });

    it(`${iso} equals parseDuration after a round trip`, () => {
      expect(parseHumanDuration(formatHumanDuration(iso))).toBe(
        parseDuration(iso),
      );
    });
  }

  it.each`
    input
    ${""}
    ${"2h 30m"}
    ${"P"}
    ${"PT"}
    ${"P1.5D"}
    ${"PT1.5H30M"}
    ${" PT1H"}
    ${"PT1H "}
    ${"P4294967296Y"}
    ${"P104249991375D"}
    ${"−PT1H"}
    ${"invalid"}
    ${"PT9007199254740992S"}
    ${"PT150119987579017M"}
    ${"PT2501999792984H"}
    ${"PT150119987579016M59.999999999S"}
    ${undefined}
    ${null}
    ${120}
    ${{}}
  `("returns the sentinel for $input", ({ input }) => {
    expect(formatHumanDuration(input as string)).toBe("");
  });

  describe("round trip", () => {
    const fixtureRows = [
      ...minuteOrMonthRows,
      ...separatorRows,
      ...fractionRows,
      ...millisecondRows,
      ...signRows,
      ...zeroRows,
      ...orderRows,
      ...limitRows,
    ];

    it("never writes ms, whatever the sub-second fields hold", () => {
      for (const { iso } of fixtureRows) {
        expect(formatHumanDuration(iso)).not.toMatch(/ms/);
      }
    });

    it("covers a non-empty fixture", () => {
      expect(fixtureRows.length).toBeGreaterThan(50);
    });

    for (const { text, iso } of fixtureRows) {
      it(`${JSON.stringify(text)} survives formatting and parsing`, () => {
        expect(parseHumanDuration(formatHumanDuration(iso))).toBe(iso);
        expect(
          parseHumanDuration(formatHumanDuration(parseHumanDuration(text))),
        ).toBe(iso);
      });
    }
  });
});
