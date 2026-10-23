import {
  HUMAN_DURATION_PAIR,
  HUMAN_DURATION_UNITS,
  humanDurationToIso,
} from "./humanDuration";

describe("HUMAN_DURATION_UNITS", () => {
  it("has the 34 spellings of the grammar, one rank per unit", () => {
    expect(HUMAN_DURATION_UNITS.map((unit) => unit.rank)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(HUMAN_DURATION_UNITS.flatMap((unit) => unit.spellings)).toHaveLength(
      34,
    );
  });

  it("allows a fraction on hour, minute and second only", () => {
    expect(
      HUMAN_DURATION_UNITS.filter((unit) => unit.fraction).map(
        (unit) => unit.rank,
      ),
    ).toEqual([5, 6, 7]);
  });

  it("writes y mo w d h m s, and never a millisecond", () => {
    expect(HUMAN_DURATION_UNITS.map((unit) => unit.symbol)).toEqual([
      "y",
      "mo",
      "w",
      "d",
      "h",
      "m",
      "s",
      "",
    ]);
  });
});

describe("HUMAN_DURATION_PAIR", () => {
  it("lists the table's spellings longest first, in the order the table sorts them", () => {
    const sorted = HUMAN_DURATION_UNITS.flatMap((unit) => unit.spellings).sort(
      (a, b) => (a.length !== b.length ? b.length - a.length : a < b ? -1 : 1),
    );
    const literal = /\(\?:\\\.\(\\d\{1,9\}\)\)\? \*\(([a-z|]+)\)/.exec(
      HUMAN_DURATION_PAIR.source,
    );
    expect(literal?.[1]?.split("|")).toEqual(sorted);
  });

  it("is case-insensitive and sticky, with no unicode flag (G7)", () => {
    expect(HUMAN_DURATION_PAIR.flags).toBe("iy");
  });
});

describe("humanDurationToIso", () => {
  it.each`
    text                               | expected
    ${"1s 500ms"}                      | ${"PT1.5S"}
    ${"1.5h"}                          | ${"PT1.5H"}
    ${"-3 days"}                       | ${"-P3D"}
    ${"30m 2h"}                        | ${null}
    ${"2h 30m"}                        | ${"PT2H30M"}
    ${"1mo"}                           | ${"P1M"}
    ${"1m"}                            | ${"PT1M"}
    ${"1ms"}                           | ${"PT0.001S"}
    ${"500ms"}                         | ${"PT0.5S"}
    ${"+1y"}                           | ${"P1Y"}
    ${"1mx"}                           | ${null}
    ${"1ſ"}                            | ${null}
    ${"02h"}                           | ${"PT02H"}
    ${"1.50h"}                         | ${"PT1.50H"}
    ${"1500ms"}                        | ${"PT1.5S"}
    ${"1000ms"}                        | ${"PT1S"}
    ${"5ms"}                           | ${"PT0.005S"}
    ${"0ms"}                           | ${"PT0S"}
    ${"1s 0ms"}                        | ${"PT1S"}
    ${"2h 0m"}                         | ${"PT2H0M"}
    ${"-0s"}                           | ${"-PT0S"}
    ${"1.5ms"}                         | ${null}
    ${"1.5h 30m"}                      | ${null}
    ${"1h 500ms"}                      | ${"PT1H0.5S"}
    ${"1y 2mo 3w 4d 5h 6m 7s 8ms"}     | ${"P1Y2M3W4DT5H6M7.008S"}
    ${"1y 2mo 3w 4d 5h 6m 7s 8ms 9ms"} | ${null}
    ${"9007199254740992000ms"}         | ${"PT9007199254740992S"}
    ${"9007199254740992999ms"}         | ${"PT9007199254740992.999S"}
  `(
    "reads $text as $expected before Temporal sees it",
    ({ text, expected }) => {
      expect(humanDurationToIso(text)).toBe(expected);
    },
  );
});

describe("humanDurationToIso state", () => {
  it("keeps no cursor between calls: accept, refuse, accept gives the same answers", () => {
    expect(humanDurationToIso("2h 30m")).toBe("PT2H30M");
    expect(humanDurationToIso("30m 2h")).toBeNull();
    expect(humanDurationToIso("2h 30m")).toBe("PT2H30M");
    expect(humanDurationToIso("1w\u212A")).toBeNull();
    expect(humanDurationToIso("1wk")).toBe("P1W");
  });
});
