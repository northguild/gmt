import { calendarZonedFixtures } from "../../test";
import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones, localNoonBattleCases } from "../../test";
import { mockTemporalZonedDateTimeFromThrow } from "../../test/mocks";
import { intervalFromDurationZoned } from "./intervalFromDurationZoned";

// Local Jan 31 noon in each battle-test timeZone — used for overflow (month-end) tests.
const localJan31NoonBattleCases = battleTestTimeZones.map((timeZone) => ({
  timeZone,
  value: Temporal.ZonedDateTime.from({
    year: 2024,
    month: 1,
    day: 31,
    hour: 12,
    timeZone,
  }).toString(),
}));

describe("intervalFromDurationZoned", () => {
  it.each`
    value                               | duration   | anchor     | expected
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"P1D"}   | ${"start"} | ${{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-02T00:00:00+00:00[UTC]" }}
    ${"2024-01-02T00:00:00+00:00[UTC]"} | ${"P1D"}   | ${"end"}   | ${{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-02T00:00:00+00:00[UTC]" }}
    ${"2024-01-01T12:00:00+00:00[UTC]"} | ${"PT30M"} | ${"start"} | ${{ start: "2024-01-01T12:00:00+00:00[UTC]", end: "2024-01-01T12:30:00+00:00[UTC]" }}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"P0D"}   | ${"start"} | ${{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-01T00:00:00+00:00[UTC]" }}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"PT0S"}  | ${"end"}   | ${{ start: "2024-01-01T00:00:00+00:00[UTC]", end: "2024-01-01T00:00:00+00:00[UTC]" }}
  `(
    "returns $expected for $value with duration $duration anchored at $anchor",
    ({ value, duration, anchor, expected }) => {
      expect(intervalFromDurationZoned(value, duration, anchor)).toEqual(
        expected,
      );
    },
  );

  for (const { timeZone, value } of localNoonBattleCases) {
    it(`preserves battle-test timeZone ${timeZone} for both endpoints`, () => {
      const result = intervalFromDurationZoned(value, "PT1H", "start");
      expect(result).not.toBeNull();
      expect(result?.start.endsWith(`[${timeZone}]`)).toBe(true);
      expect(result?.end.endsWith(`[${timeZone}]`)).toBe(true);
    });
  }

  for (const { timeZone, value } of localJan31NoonBattleCases) {
    it(`clamps out-of-range results with the default overflow (constrain) across battle-test timeZone ${timeZone}`, () => {
      const result = intervalFromDurationZoned(value, "P1M", "start");
      expect(result).not.toBeNull();
      expect(result?.end.startsWith("2024-02-29T12:00:00")).toBe(true);
      expect(result?.end.endsWith(`[${timeZone}]`)).toBe(true);
    });

    it(`returns null when overflow is reject and the result is out of range across battle-test timeZone ${timeZone}`, () => {
      expect(
        intervalFromDurationZoned(value, "P1M", "start", {
          overflow: "reject",
        }),
      ).toBeNull();
    });
  }

  // disambiguation: fall-back overlap (span end lands on an ambiguous local time)
  it.each`
    value                                            | disambiguation  | expectedEnd
    ${"2024-11-02T01:30:00-04:00[America/New_York]"} | ${undefined}    | ${"2024-11-03T01:30:00-04:00[America/New_York]"}
    ${"2024-11-02T01:30:00-04:00[America/New_York]"} | ${"compatible"} | ${"2024-11-03T01:30:00-04:00[America/New_York]"}
    ${"2024-11-02T01:30:00-04:00[America/New_York]"} | ${"earlier"}    | ${"2024-11-03T01:30:00-04:00[America/New_York]"}
    ${"2024-11-02T01:30:00-04:00[America/New_York]"} | ${"later"}      | ${"2024-11-03T01:30:00-05:00[America/New_York]"}
    ${"2024-11-02T01:30:00-04:00[America/New_York]"} | ${"reject"}     | ${null}
  `(
    "resolves fall-back overlap for $value + P1D with disambiguation $disambiguation to $expectedEnd",
    ({ value, disambiguation, expectedEnd }) => {
      const options =
        disambiguation === undefined ? undefined : { disambiguation };
      const result = intervalFromDurationZoned(value, "P1D", "start", options);

      if (expectedEnd === null) {
        expect(result).toBeNull();
      } else {
        expect(result).toEqual({ start: value, end: expectedEnd });
      }
    },
  );

  // spring-forward gap: disambiguation has no effect, arithmetic already advances past it
  it.each`
    value                                            | disambiguation
    ${"2024-03-09T02:30:00-05:00[America/New_York]"} | ${undefined}
    ${"2024-03-09T02:30:00-05:00[America/New_York]"} | ${"compatible"}
    ${"2024-03-09T02:30:00-05:00[America/New_York]"} | ${"earlier"}
    ${"2024-03-09T02:30:00-05:00[America/New_York]"} | ${"later"}
    ${"2024-03-09T02:30:00-05:00[America/New_York]"} | ${"reject"}
  `(
    "spring-forward gap for $value + P1D is unaffected by disambiguation $disambiguation",
    ({ value, disambiguation }) => {
      const options =
        disambiguation === undefined ? undefined : { disambiguation };
      expect(intervalFromDurationZoned(value, "P1D", "start", options)).toEqual(
        {
          start: value,
          end: "2024-03-10T03:30:00-04:00[America/New_York]",
        },
      );
    },
  );

  // offset is accepted but inert: the disambiguation rebuild has no stored offset to act on
  it.each`
    offset
    ${undefined}
    ${"prefer"}
    ${"use"}
    ${"ignore"}
    ${"reject"}
  `(
    "produces identical output regardless of offset $offset (inert on this function)",
    ({ offset }) => {
      const value = "2024-11-02T01:30:00-04:00[America/New_York]";
      const withoutOffset = intervalFromDurationZoned(value, "P1D", "start", {
        disambiguation: "later",
      });
      const withOffset = intervalFromDurationZoned(value, "P1D", "start", {
        disambiguation: "later",
        offset,
      });
      expect(withOffset).toEqual(withoutOffset);
    },
  );

  it.each`
    value                               | duration   | anchor
    ${"2024-01-05T00:00:00+00:00[UTC]"} | ${"-P10D"} | ${"start"}
    ${"2024-01-05T00:00:00+00:00[UTC]"} | ${"-P10D"} | ${"end"}
  `(
    "returns null when $duration anchored at $anchor inverts the span from $value",
    ({ value, duration, anchor }) => {
      expect(intervalFromDurationZoned(value, duration, anchor)).toBeNull();
    },
  );

  it.each`
    value                    | duration | anchor
    ${"invalid"}             | ${"P1D"} | ${"start"}
    ${"2024-01-01T00:00:00"} | ${"P1D"} | ${"start"}
    ${123}                   | ${"P1D"} | ${"start"}
    ${null}                  | ${"P1D"} | ${"start"}
  `("returns null for invalid value $value", ({ value, duration, anchor }) => {
    expect(
      intervalFromDurationZoned(value as never, duration, anchor),
    ).toBeNull();
  });

  it.each`
    value                               | duration       | anchor
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"not-a-dur"} | ${"start"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${""}          | ${"start"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${123}         | ${"start"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${null}        | ${"start"}
  `(
    "returns null for invalid duration $duration",
    ({ value, duration, anchor }) => {
      expect(
        intervalFromDurationZoned(value, duration as never, anchor),
      ).toBeNull();
    },
  );

  it.each`
    value                               | duration | anchor
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"P1D"} | ${"middle"}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"P1D"} | ${""}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"P1D"} | ${null}
    ${"2024-01-01T00:00:00+00:00[UTC]"} | ${"P1D"} | ${undefined}
  `(
    "returns null for invalid anchor $anchor",
    ({ value, duration, anchor }) => {
      expect(
        intervalFromDurationZoned(value, duration, anchor as never),
      ).toBeNull();
    },
  );

  it("returns null when Temporal.ZonedDateTime.from throws", () => {
    mockTemporalZonedDateTimeFromThrow();
    expect(
      intervalFromDurationZoned(
        "2024-01-01T00:00:00+00:00[UTC]",
        "P1D",
        "start",
      ),
    ).toBeNull();
  });
  // E5 (issue #78), decision of record D2 — see isValidZonedDateTime.test.ts for the full
  // rationale: zoned/ rejects any [u-ca=...] calendar annotation outright.
  it("returns null when value carries a calendar annotation", () => {
    expect(
      intervalFromDurationZoned(
        "2024-01-01T00:00:00+00:00[UTC][u-ca=hebrew]",
        "P1M",
        "start",
      ),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// E7 (issue #152). Single calendar-tagged input, so no D5 pair policy applies — but the R1
// rebuild fix does. Every expected value produced by running @js-temporal/polyfill@0.5.1.
// ---------------------------------------------------------------------------------------------
describe("intervalFromDurationZoned with GMT calendar-annotated values", () => {
  const H = calendarZonedFixtures.hebrewLeapMonth;
  const J = calendarZonedFixtures.japaneseEraFold;

  it("anchors at the start and re-derives the end in the same calendar", () => {
    expect(intervalFromDurationZoned(H.adarI15NewYork, "P1M", "start")).toEqual(
      {
        start: H.adarI15NewYork,
        end: H.adar15NewYork,
      },
    );
  });

  it("anchors at the end and re-derives the start in the same calendar", () => {
    expect(intervalFromDurationZoned(H.adar15NewYork, "P1M", "end")).toEqual({
      start: H.adarI15NewYork,
      end: H.adar15NewYork,
    });
  });

  it("re-derives a changed era on the computed endpoint", () => {
    expect(
      intervalFromDurationZoned(J.heisei31_0405Casablanca, "P1M", "start"),
    ).toEqual({
      start: J.heisei31_0405Casablanca,
      end: J.reiwa1_0505CasablancaEarlier,
    });
  });

  // R1 regression: before E7 this function rebuilt through
  // `${zdt.toPlainDateTime()}[${tz}]`, which emits Temporal's forbidden segment ordering once the
  // value carries a calendar — every non-"compatible" disambiguation would return null.
  it.each`
    disambiguation  | expected
    ${"compatible"} | ${"0001-05-05T02:30:00+01:00[u-ca=japanese;era=reiwa][Africa/Casablanca]"}
    ${"earlier"}    | ${"0001-05-05T02:30:00+01:00[u-ca=japanese;era=reiwa][Africa/Casablanca]"}
    ${"later"}      | ${"0001-05-05T02:30:00+00:00[u-ca=japanese;era=reiwa][Africa/Casablanca]"}
  `(
    "resolves the Casablanca fold to $expected with disambiguation $disambiguation",
    ({ disambiguation, expected }) => {
      expect(
        intervalFromDurationZoned(J.heisei31_0405Casablanca, "P1M", "start", {
          disambiguation,
        }),
      ).toEqual({ start: J.heisei31_0405Casablanca, end: expected });
    },
  );

  it('returns null for disambiguation "reject" on the Casablanca fold', () => {
    expect(
      intervalFromDurationZoned(J.heisei31_0405Casablanca, "P1M", "start", {
        disambiguation: "reject",
      }),
    ).toBeNull();
  });

  it.each`
    value                                                         | reason
    ${"5784-06-15T14:30:00-05:00[America/New_York][u-ca=hebrew]"} | ${"GMT digits in Temporal's segment ordering"}
    ${"5785-13-15T14:30:00-05:00[u-ca=hebrew][America/New_York]"} | ${"month 13 in a non-leap Hebrew year"}
  `("returns null for $value ($reason)", ({ value }) => {
    expect(intervalFromDurationZoned(value, "P1D", "start")).toBeNull();
  });
});
