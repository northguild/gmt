import { intervalAbutsDate } from "./intervalAbutsDate";

describe("intervalAbutsDate", () => {
  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-02"} | ${"2024-01-02"} | ${true}
    ${"2024-01-01"} | ${"2024-01-01"} | ${"2023-12-31"} | ${"2023-12-31"} | ${true}
    ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-01"} | ${false}
  `(
    "returns $expected for zero-length A=$aStart..$aEnd abutting B=$bStart..$bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalAbutsDate(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-07-01"} | ${"2024-12-31"} | ${true}
    ${"2024-07-01"} | ${"2024-12-31"} | ${"2024-01-01"} | ${"2024-06-30"} | ${true}
    ${"2024-01-01"} | ${"2024-01-01"} | ${"2024-01-02"} | ${"2024-01-02"} | ${true}
    ${"2024-01-02"} | ${"2024-01-02"} | ${"2024-01-01"} | ${"2024-01-01"} | ${true}
  `(
    "returns $expected when A=$aStart..$aEnd and B=$bStart..$bEnd",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalAbutsDate(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-07-02"} | ${"2024-12-31"} | ${false}
    ${"2024-01-01"} | ${"2024-07-01"} | ${"2024-06-30"} | ${"2024-12-31"} | ${false}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-08-01"} | ${false}
  `(
    "returns $expected for non-adjacent intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalAbutsDate(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd            | expected
    ${"2024-12-31"} | ${"2024-01-01"} | ${"2024-04-01"} | ${"2024-12-31"} | ${false}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-06-15"} | ${"2024-06-10"} | ${false}
  `(
    "returns $expected for reversed intervals",
    ({ aStart, aEnd, bStart, bEnd, expected }) => {
      expect(intervalAbutsDate(aStart, aEnd, bStart, bEnd)).toBe(expected);
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd
    ${"invalid"}    | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-12-31"}
    ${""}           | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-12-31"}
    ${"2024-13-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-12-31"}
    ${"2024-01-01"} | ${"invalid"}    | ${"2024-04-01"} | ${"2024-12-31"}
    ${"2024-01-01"} | ${""}           | ${"2024-04-01"} | ${"2024-12-31"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"invalid"}    | ${"2024-12-31"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${""}           | ${"2024-12-31"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${"invalid"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${""}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-13-01"}
  `(
    "returns false for malformed date: $aStart, $aEnd, $bStart, $bEnd",
    ({ aStart, aEnd, bStart, bEnd }) => {
      expect(intervalAbutsDate(aStart, aEnd, bStart, bEnd)).toBe(false);
    },
  );

  it.each`
    aStart          | aEnd            | bStart          | bEnd
    ${null}         | ${"2024-06-30"} | ${"2024-04-01"} | ${"2024-12-31"}
    ${"2024-01-01"} | ${undefined}    | ${"2024-04-01"} | ${"2024-12-31"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${null}         | ${"2024-12-31"}
    ${"2024-01-01"} | ${"2024-06-30"} | ${"2024-04-01"} | ${undefined}
  `("returns false for non-string input", ({ aStart, aEnd, bStart, bEnd }) => {
    expect(intervalAbutsDate(aStart, aEnd, bStart, bEnd)).toBe(false);
  });
  // E5 (issue #78): accepts GMT calendar-annotated PlainDate strings; ordering is calendar-
  // independent so mixed calendars are accepted (D4). Golden verified directly against
  // @js-temporal/polyfill: 2024-10-02 + 1 day = 2024-10-03 = Hebrew 5785-01-01.
  it("accepts mixed calendars since abutting is an ordering check, not a value", () => {
    expect(
      intervalAbutsDate(
        "2024-09-01",
        "2024-10-02",
        "5785-01-01[u-ca=hebrew]",
        "2024-10-10",
      ),
    ).toBe(true);
  });
});
