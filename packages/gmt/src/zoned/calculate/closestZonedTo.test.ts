import { Temporal } from "@js-temporal/polyfill";
import { localNoonBattleCases } from "../../test";
import { closestZonedTo } from "./closestZonedTo";

describe("closestZonedTo", () => {
  describe("target before all candidates", () => {
    it.each`
      target                                     | candidates                                                                                                                     | expected
      ${"2024-01-01T12:00:00[America/New_York]"} | ${["2024-03-01T00:00:00[America/New_York]", "2024-06-15T00:00:00[America/New_York]", "2024-09-30T00:00:00[America/New_York]"]} | ${"2024-03-01T00:00:00-05:00[America/New_York]"}
      ${"2024-02-01T12:00:00[America/New_York]"} | ${["2024-03-10T00:00:00[America/New_York]", "2024-04-20T00:00:00[America/New_York]"]}                                          | ${"2024-03-10T00:00:00-05:00[America/New_York]"}
    `(
      "returns $expected when target=$target is before all candidates",
      ({ target, candidates, expected }) => {
        expect(closestZonedTo(target, candidates)).toBe(expected);
      },
    );
  });

  describe("target after all candidates", () => {
    it.each`
      target                                     | candidates                                                                                                                     | expected
      ${"2024-12-31T12:00:00[America/New_York]"} | ${["2024-03-01T00:00:00[America/New_York]", "2024-06-15T00:00:00[America/New_York]", "2024-09-30T00:00:00[America/New_York]"]} | ${"2024-09-30T00:00:00-04:00[America/New_York]"}
      ${"2024-08-01T12:00:00[America/New_York]"} | ${["2024-03-10T00:00:00[America/New_York]", "2024-04-20T00:00:00[America/New_York]"]}                                          | ${"2024-04-20T00:00:00-04:00[America/New_York]"}
    `(
      "returns $expected when target=$target is after all candidates",
      ({ target, candidates, expected }) => {
        expect(closestZonedTo(target, candidates)).toBe(expected);
      },
    );
  });

  describe("target between candidates", () => {
    it.each`
      target                                     | candidates                                                                                                                     | expected
      ${"2024-03-15T12:00:00[America/New_York]"} | ${["2024-03-01T00:00:00[America/New_York]", "2024-03-20T00:00:00[America/New_York]", "2024-03-18T00:00:00[America/New_York]"]} | ${"2024-03-18T00:00:00-04:00[America/New_York]"}
      ${"2024-06-15T12:00:00[America/New_York]"} | ${["2024-05-01T00:00:00[America/New_York]", "2024-07-01T00:00:00[America/New_York]", "2024-06-01T00:00:00[America/New_York]"]} | ${"2024-06-01T00:00:00-04:00[America/New_York]"}
      ${"2024-02-15T12:00:00[America/New_York]"} | ${["2024-01-01T00:00:00[America/New_York]", "2024-03-01T00:00:00[America/New_York]", "2024-02-28T00:00:00[America/New_York]"]} | ${"2024-02-28T00:00:00-05:00[America/New_York]"}
    `(
      "returns $expected when target=$target is between candidates",
      ({ target, candidates, expected }) => {
        expect(closestZonedTo(target, candidates)).toBe(expected);
      },
    );
  });

  describe("tie-breaking (equidistant candidates)", () => {
    it.each`
      target                                     | candidates                                                                            | expected
      ${"2024-03-15T12:00:00[America/New_York]"} | ${["2024-03-01T00:00:00[America/New_York]", "2024-03-29T00:00:00[America/New_York]"]} | ${"2024-03-29T00:00:00-04:00[America/New_York]"}
      ${"2024-06-15T12:00:00[America/New_York]"} | ${["2024-05-16T00:00:00[America/New_York]", "2024-07-15T00:00:00[America/New_York]"]} | ${"2024-07-15T00:00:00-04:00[America/New_York]"}
    `(
      "returns first candidate ($expected) on tie (target=$target)",
      ({ target, candidates, expected }) => {
        expect(closestZonedTo(target, candidates)).toBe(expected);
      },
    );
  });

  describe("single candidate", () => {
    it.each`
      target                                     | candidates                                   | expected
      ${"2024-03-15T12:00:00[America/New_York]"} | ${["2024-06-01T00:00:00[America/New_York]"]} | ${"2024-06-01T00:00:00-04:00[America/New_York]"}
      ${"2024-12-31T12:00:00[America/New_York]"} | ${["2024-01-01T00:00:00[America/New_York]"]} | ${"2024-01-01T00:00:00-05:00[America/New_York]"}
    `(
      "returns $expected when there is a single candidate",
      ({ target, candidates, expected }) => {
        expect(closestZonedTo(target, candidates)).toBe(expected);
      },
    );
  });

  describe("empty array", () => {
    it.each`
      target                                     | expected
      ${"2024-03-15T12:00:00[America/New_York]"} | ${null}
      ${"2024-01-01T12:00:00[America/New_York]"} | ${null}
    `(
      "returns null when candidates is empty (target=$target)",
      ({ target, expected }) => {
        expect(closestZonedTo(target, [])).toBe(expected);
      },
    );
  });

  describe("invalid target", () => {
    it.each`
      target                                     | candidates                                   | expected
      ${"invalid"}                               | ${["2024-03-01T00:00:00[America/New_York]"]} | ${null}
      ${""}                                      | ${["2024-03-01T00:00:00[America/New_York]"]} | ${null}
      ${"2024-02-30T12:00:00[America/New_York]"} | ${["2024-03-01T00:00:00[America/New_York]"]} | ${null}
    `(
      "returns null when target is invalid ($target)",
      ({ target, candidates, expected }) => {
        expect(closestZonedTo(target, candidates)).toBe(expected);
      },
    );
  });

  describe("all-invalid candidates", () => {
    it.each`
      target                                     | candidates                                              | expected
      ${"2024-03-15T12:00:00[America/New_York]"} | ${["invalid", "2024-02-30T00:00:00[America/New_York]"]} | ${null}
      ${"2024-03-15T12:00:00[America/New_York]"} | ${["", "not-a-date[America/New_York]"]}                 | ${null}
    `(
      "returns null when all candidates are invalid",
      ({ target, candidates, expected }) => {
        expect(closestZonedTo(target, candidates)).toBe(expected);
      },
    );
  });

  describe("mixed valid/invalid candidates", () => {
    it.each`
      target                                     | candidates                                                                                       | expected
      ${"2024-03-15T12:00:00[America/New_York]"} | ${["invalid", "2024-03-20T00:00:00[America/New_York]", "2024-02-30T00:00:00[America/New_York]"]} | ${"2024-03-20T00:00:00-04:00[America/New_York]"}
      ${"2024-03-15T12:00:00[America/New_York]"} | ${["2024-01-01T00:00:00[America/New_York]", "", "2024-06-01T00:00:00[America/New_York]"]}        | ${"2024-01-01T00:00:00-05:00[America/New_York]"}
    `(
      "ignores invalid candidates and returns closest valid ($expected)",
      ({ target, candidates, expected }) => {
        expect(closestZonedTo(target, candidates)).toBe(expected);
      },
    );
  });

  describe("cross-year boundaries", () => {
    it.each`
      target                                     | candidates                                                                            | expected
      ${"2024-12-31T12:00:00[America/New_York]"} | ${["2025-01-01T00:00:00[America/New_York]", "2024-06-15T00:00:00[America/New_York]"]} | ${"2025-01-01T00:00:00-05:00[America/New_York]"}
      ${"2025-01-01T12:00:00[America/New_York]"} | ${["2024-12-31T00:00:00[America/New_York]", "2024-06-15T00:00:00[America/New_York]"]} | ${"2024-12-31T00:00:00-05:00[America/New_York]"}
      ${"2024-06-30T12:00:00[America/New_York]"} | ${["2024-01-01T00:00:00[America/New_York]", "2025-01-01T00:00:00[America/New_York]"]} | ${"2024-01-01T00:00:00-05:00[America/New_York]"}
    `(
      "returns $expected across year boundary (target=$target)",
      ({ target, candidates, expected }) => {
        expect(closestZonedTo(target, candidates)).toBe(expected);
      },
    );
  });

  describe("leap year dates", () => {
    it.each`
      target                                     | candidates                                                                            | expected
      ${"2024-02-29T12:00:00[America/New_York]"} | ${["2024-02-28T00:00:00[America/New_York]", "2024-03-01T00:00:00[America/New_York]"]} | ${"2024-03-01T00:00:00-05:00[America/New_York]"}
      ${"2024-02-28T12:00:00[America/New_York]"} | ${["2024-02-29T00:00:00[America/New_York]", "2024-03-01T00:00:00[America/New_York]"]} | ${"2024-02-29T00:00:00-05:00[America/New_York]"}
      ${"2024-03-01T12:00:00[America/New_York]"} | ${["2024-02-28T00:00:00[America/New_York]", "2024-02-29T00:00:00[America/New_York]"]} | ${"2024-02-29T00:00:00-05:00[America/New_York]"}
    `(
      "returns $expected for leap year edge (target=$target)",
      ({ target, candidates, expected }) => {
        expect(closestZonedTo(target, candidates)).toBe(expected);
      },
    );
  });

  describe("very far apart dates", () => {
    it.each`
      target                                     | candidates                                                                            | expected
      ${"2024-06-15T12:00:00[America/New_York]"} | ${["0001-01-01T00:00:00[America/New_York]", "9999-12-31T23:59:59[America/New_York]"]} | ${"0001-01-01T00:00:00-04:56[America/New_York]"}
      ${"0001-01-01T12:00:00[America/New_York]"} | ${["2024-06-15T00:00:00[America/New_York]", "9999-12-31T23:59:59[America/New_York]"]} | ${"2024-06-15T00:00:00-04:00[America/New_York]"}
    `(
      "returns $expected for extreme date range (target=$target)",
      ({ target, candidates, expected }) => {
        expect(closestZonedTo(target, candidates)).toBe(expected);
      },
    );
  });

  describe("duplicate candidates", () => {
    it.each`
      target                                     | candidates                                                                                                                     | expected
      ${"2024-03-15T12:00:00[America/New_York]"} | ${["2024-03-10T00:00:00[America/New_York]", "2024-03-10T00:00:00[America/New_York]", "2024-03-20T00:00:00[America/New_York]"]} | ${"2024-03-20T00:00:00-04:00[America/New_York]"}
      ${"2024-03-15T12:00:00[America/New_York]"} | ${["2024-03-20T00:00:00[America/New_York]", "2024-03-20T00:00:00[America/New_York]"]}                                          | ${"2024-03-20T00:00:00-04:00[America/New_York]"}
    `(
      "returns $expected when candidates contain duplicates",
      ({ target, candidates, expected }) => {
        expect(closestZonedTo(target, candidates)).toBe(expected);
      },
    );
  });

  describe("single valid among invalid", () => {
    it.each`
      target                                     | candidates                                                              | expected
      ${"2024-03-15T12:00:00[America/New_York]"} | ${["invalid", "2024-03-20T00:00:00[America/New_York]", "also invalid"]} | ${"2024-03-20T00:00:00-04:00[America/New_York]"}
      ${"2024-03-15T12:00:00[America/New_York]"} | ${["2024-03-20T00:00:00[America/New_York]", "invalid", "invalid"]}      | ${"2024-03-20T00:00:00-04:00[America/New_York]"}
    `(
      "returns $expected when only one candidate is valid",
      ({ target, candidates, expected }) => {
        expect(closestZonedTo(target, candidates)).toBe(expected);
      },
    );
  });

  describe("target equals a candidate", () => {
    it.each`
      target                                     | candidates                                                                                                                     | expected
      ${"2024-03-15T12:00:00[America/New_York]"} | ${["2024-03-01T00:00:00[America/New_York]", "2024-03-15T00:00:00[America/New_York]", "2024-03-20T00:00:00[America/New_York]"]} | ${"2024-03-15T00:00:00-04:00[America/New_York]"}
      ${"2024-06-15T12:00:00[America/New_York]"} | ${["2024-06-15T00:00:00[America/New_York]", "2024-07-01T00:00:00[America/New_York]"]}                                          | ${"2024-06-15T00:00:00-04:00[America/New_York]"}
    `(
      "returns $expected when target matches a candidate exactly",
      ({ target, candidates, expected }) => {
        expect(closestZonedTo(target, candidates)).toBe(expected);
      },
    );
  });

  describe("non-consecutive candidates", () => {
    it.each`
      target                                     | candidates                                                                                                                     | expected
      ${"2024-06-15T12:00:00[America/New_York]"} | ${["2024-01-01T00:00:00[America/New_York]", "2024-04-01T00:00:00[America/New_York]", "2024-09-01T00:00:00[America/New_York]"]} | ${"2024-04-01T00:00:00-04:00[America/New_York]"}
      ${"2024-03-15T12:00:00[America/New_York]"} | ${["2024-01-01T00:00:00[America/New_York]", "2024-06-01T00:00:00[America/New_York]", "2024-12-01T00:00:00[America/New_York]"]} | ${"2024-01-01T00:00:00-05:00[America/New_York]"}
    `(
      "returns $expected for widely spaced candidates (target=$target)",
      ({ target, candidates, expected }) => {
        expect(closestZonedTo(target, candidates)).toBe(expected);
      },
    );
  });

  describe("DST transitions", () => {
    it.each`
      target                                     | candidates                                                                            | expected
      ${"2024-03-10T12:00:00[America/New_York]"} | ${["2024-03-09T00:00:00[America/New_York]", "2024-03-11T00:00:00[America/New_York]"]} | ${"2024-03-11T00:00:00-04:00[America/New_York]"}
      ${"2024-11-03T12:00:00[America/New_York]"} | ${["2024-11-02T00:00:00[America/New_York]", "2024-11-04T00:00:00[America/New_York]"]} | ${"2024-11-04T00:00:00-05:00[America/New_York]"}
    `(
      "returns $expected across DST boundary (target=$target)",
      ({ target, candidates, expected }) => {
        expect(closestZonedTo(target, candidates)).toBe(expected);
      },
    );
  });

  describe("different timezones", () => {
    it.each`
      target                                     | candidates                                                                         | expected
      ${"2024-03-15T12:00:00[America/New_York]"} | ${["2024-03-15T12:00:00[Europe/London]", "2024-03-15T00:00:00[America/New_York]"]} | ${"2024-03-15T12:00:00+00:00[Europe/London]"}
      ${"2024-03-15T12:00:00[Europe/London]"}    | ${["2024-03-15T12:00:00[America/New_York]", "2024-03-15T00:00:00[Europe/London]"]} | ${"2024-03-15T12:00:00-04:00[America/New_York]"}
    `(
      "returns $expected across timezones (target=$target)",
      ({ target, candidates, expected }) => {
        expect(closestZonedTo(target, candidates)).toBe(expected);
      },
    );
  });

  describe("battle-test timezones", () => {
    for (const { timeZone, value } of localNoonBattleCases) {
      it(`returns the target itself when it is a candidate for ${timeZone}`, () => {
        expect(closestZonedTo(value, [value])).toBe(value);
      });

      it(`returns the nearer candidate for ${timeZone}`, () => {
        const candidates = [
          value,
          Temporal.ZonedDateTime.from({
            year: 2024,
            month: 2,
            day: 27,
            hour: 12,
            minute: 0,
            second: 0,
            timeZone,
          }).toString(),
        ];
        expect(closestZonedTo(value, candidates)).toBe(value);
      });
    }
  });
});
