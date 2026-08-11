import { closestDateTo } from "./closestDateTo";

describe("closestDateTo", () => {
  describe("target before all candidates", () => {
    it.each`
      target          | candidates                                    | expected
      ${"2024-01-01"} | ${["2024-03-01", "2024-06-15", "2024-09-30"]} | ${"2024-03-01"}
      ${"2024-02-01"} | ${["2024-03-10", "2024-04-20"]}               | ${"2024-03-10"}
    `(
      "returns $expected when target=$target is before all candidates",
      ({ target, candidates, expected }) => {
        expect(closestDateTo(target, candidates)).toBe(expected);
      },
    );
  });

  describe("target after all candidates", () => {
    it.each`
      target          | candidates                                    | expected
      ${"2024-12-31"} | ${["2024-03-01", "2024-06-15", "2024-09-30"]} | ${"2024-09-30"}
      ${"2024-08-01"} | ${["2024-03-10", "2024-04-20"]}               | ${"2024-04-20"}
    `(
      "returns $expected when target=$target is after all candidates",
      ({ target, candidates, expected }) => {
        expect(closestDateTo(target, candidates)).toBe(expected);
      },
    );
  });

  describe("target between candidates", () => {
    it.each`
      target          | candidates                                    | expected
      ${"2024-03-15"} | ${["2024-03-01", "2024-03-20", "2024-03-18"]} | ${"2024-03-18"}
      ${"2024-06-15"} | ${["2024-05-01", "2024-07-01", "2024-06-01"]} | ${"2024-06-01"}
      ${"2024-02-15"} | ${["2024-01-01", "2024-03-01", "2024-02-28"]} | ${"2024-02-28"}
    `(
      "returns $expected when target=$target is between candidates",
      ({ target, candidates, expected }) => {
        expect(closestDateTo(target, candidates)).toBe(expected);
      },
    );
  });

  describe("tie-breaking (equidistant candidates)", () => {
    it.each`
      target          | candidates                      | expected
      ${"2024-03-15"} | ${["2024-03-01", "2024-03-29"]} | ${"2024-03-01"}
      ${"2024-06-15"} | ${["2024-05-16", "2024-07-15"]} | ${"2024-05-16"}
    `(
      "returns first candidate ($expected) on tie (target=$target)",
      ({ target, candidates, expected }) => {
        expect(closestDateTo(target, candidates)).toBe(expected);
      },
    );
  });

  describe("single candidate", () => {
    it.each`
      target          | candidates        | expected
      ${"2024-03-15"} | ${["2024-06-01"]} | ${"2024-06-01"}
      ${"2024-12-31"} | ${["2024-01-01"]} | ${"2024-01-01"}
    `(
      "returns $expected when there is a single candidate",
      ({ target, candidates, expected }) => {
        expect(closestDateTo(target, candidates)).toBe(expected);
      },
    );
  });

  describe("empty array", () => {
    it.each`
      target          | expected
      ${"2024-03-15"} | ${null}
      ${"2024-01-01"} | ${null}
    `(
      "returns null when candidates is empty (target=$target)",
      ({ target, expected }) => {
        expect(closestDateTo(target, [])).toBe(expected);
      },
    );
  });

  describe("invalid target", () => {
    it.each`
      target          | candidates        | expected
      ${"invalid"}    | ${["2024-03-01"]} | ${null}
      ${""}           | ${["2024-03-01"]} | ${null}
      ${"2024-02-30"} | ${["2024-03-01"]} | ${null}
    `(
      "returns null when target is invalid ($target)",
      ({ target, candidates, expected }) => {
        expect(closestDateTo(target, candidates)).toBe(expected);
      },
    );
  });

  describe("all-invalid candidates", () => {
    it.each`
      target          | candidates                   | expected
      ${"2024-03-15"} | ${["invalid", "2024-02-30"]} | ${null}
      ${"2024-03-15"} | ${["", "not-a-date"]}        | ${null}
    `(
      "returns null when all candidates are invalid",
      ({ target, candidates, expected }) => {
        expect(closestDateTo(target, candidates)).toBe(expected);
      },
    );
  });

  describe("mixed valid/invalid candidates", () => {
    it.each`
      target          | candidates                                 | expected
      ${"2024-03-15"} | ${["invalid", "2024-03-20", "2024-02-30"]} | ${"2024-03-20"}
      ${"2024-03-15"} | ${["2024-01-01", "", "2024-06-01"]}        | ${"2024-01-01"}
    `(
      "ignores invalid candidates and returns closest valid ($expected)",
      ({ target, candidates, expected }) => {
        expect(closestDateTo(target, candidates)).toBe(expected);
      },
    );
  });
  describe("cross-year boundaries", () => {
    it.each`
      target          | candidates                      | expected
      ${"2024-12-31"} | ${["2025-01-01", "2024-06-15"]} | ${"2025-01-01"}
      ${"2025-01-01"} | ${["2024-12-31", "2024-06-15"]} | ${"2024-12-31"}
      ${"2024-06-30"} | ${["2024-01-01", "2025-01-01"]} | ${"2024-01-01"}
    `(
      "returns $expected across year boundary (target=$target)",
      ({ target, candidates, expected }) => {
        expect(closestDateTo(target, candidates)).toBe(expected);
      },
    );
  });

  describe("leap year dates", () => {
    it.each`
      target          | candidates                      | expected
      ${"2024-02-29"} | ${["2024-02-28", "2024-03-01"]} | ${"2024-02-28"}
      ${"2024-02-28"} | ${["2024-02-29", "2024-03-01"]} | ${"2024-02-29"}
      ${"2024-03-01"} | ${["2024-02-28", "2024-02-29"]} | ${"2024-02-29"}
    `(
      "returns $expected for leap year edge (target=$target)",
      ({ target, candidates, expected }) => {
        expect(closestDateTo(target, candidates)).toBe(expected);
      },
    );
  });

  describe("very far apart dates", () => {
    it.each`
      target          | candidates                      | expected
      ${"2024-06-15"} | ${["0001-01-01", "9999-12-31"]} | ${"0001-01-01"}
      ${"0001-01-01"} | ${["2024-06-15", "9999-12-31"]} | ${"2024-06-15"}
    `(
      "returns $expected for extreme date range (target=$target)",
      ({ target, candidates, expected }) => {
        expect(closestDateTo(target, candidates)).toBe(expected);
      },
    );
  });

  describe("duplicate candidates", () => {
    it.each`
      target          | candidates                                    | expected
      ${"2024-03-15"} | ${["2024-03-10", "2024-03-10", "2024-03-20"]} | ${"2024-03-10"}
      ${"2024-03-15"} | ${["2024-03-20", "2024-03-20"]}               | ${"2024-03-20"}
    `(
      "returns $expected when candidates contain duplicates",
      ({ target, candidates, expected }) => {
        expect(closestDateTo(target, candidates)).toBe(expected);
      },
    );
  });

  describe("single valid among invalid", () => {
    it.each`
      target          | candidates                                   | expected
      ${"2024-03-15"} | ${["invalid", "2024-03-20", "also invalid"]} | ${"2024-03-20"}
      ${"2024-03-15"} | ${["2024-03-20", "invalid", "invalid"]}      | ${"2024-03-20"}
    `(
      "returns $expected when only one candidate is valid",
      ({ target, candidates, expected }) => {
        expect(closestDateTo(target, candidates)).toBe(expected);
      },
    );
  });

  describe("target equals a candidate", () => {
    it.each`
      target          | candidates                                    | expected
      ${"2024-03-15"} | ${["2024-03-01", "2024-03-15", "2024-03-20"]} | ${"2024-03-15"}
      ${"2024-06-15"} | ${["2024-06-15", "2024-07-01"]}               | ${"2024-06-15"}
    `(
      "returns $expected when target matches a candidate exactly",
      ({ target, candidates, expected }) => {
        expect(closestDateTo(target, candidates)).toBe(expected);
      },
    );
  });

  describe("non-consecutive candidates", () => {
    it.each`
      target          | candidates                                    | expected
      ${"2024-06-15"} | ${["2024-01-01", "2024-04-01", "2024-09-01"]} | ${"2024-04-01"}
      ${"2024-03-15"} | ${["2024-01-01", "2024-06-01", "2024-12-01"]} | ${"2024-01-01"}
    `(
      "returns $expected for widely spaced candidates (target=$target)",
      ({ target, candidates, expected }) => {
        expect(closestDateTo(target, candidates)).toBe(expected);
      },
    );
  });
});
