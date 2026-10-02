import { hostileProxy, revokedProxy } from "../test/noThrow";
import { parsePunctualityTolerance, punctualityOf } from "./punctuality";

/** Nanoseconds in a minute. */
const MINUTE = 60_000_000_000n;

describe("parsePunctualityTolerance", () => {
  // Each bound as non-negative exact nanoseconds: 15 min = 9e11 ns, a day = 24 h.
  it.each`
    tolerance                              | expected                                       | why
    ${{ late: "PT15M" }}                   | ${{ late: 15n * MINUTE, early: null }}         | ${"late only"}
    ${{ late: "PT15M", early: undefined }} | ${{ late: 15n * MINUTE, early: null }}         | ${"early: undefined is absent"}
    ${{ late: "PT15M", early: "PT10M" }}   | ${{ late: 15n * MINUTE, early: 10n * MINUTE }} | ${"both bounds"}
    ${{ late: "P1D", early: "PT0S" }}      | ${{ late: 1440n * MINUTE, early: 0n }}         | ${"a day is 24 hours; zero early"}
    ${{ late: "-PT0S" }}                   | ${{ late: 0n, early: null }}                   | ${"-PT0S is zero"}
  `("reads $tolerance ($why)", ({ tolerance, expected }) => {
    expect(parsePunctualityTolerance(tolerance)).toEqual(expected);
  });

  it.each`
    tolerance                            | why
    ${{ late: "-PT15M" }}                | ${"a negative late"}
    ${{ late: "PT15M", early: "-PT1M" }} | ${"a negative early"}
    ${{ late: "P1W" }}                   | ${"a calendar-unit late"}
    ${{ late: "PT15M", early: "P1M" }}   | ${"a calendar-unit early"}
    ${{ late: "PT15M", early: null }}    | ${"a null early is not absent"}
    ${{ early: "PT10M" }}                | ${"no late"}
    ${null}                              | ${"null"}
    ${"PT15M"}                           | ${"a bare duration"}
  `("returns null for $why", ({ tolerance }) => {
    expect(parsePunctualityTolerance(tolerance)).toBeNull();
  });

  it.each`
    make                    | label
    ${() => hostileProxy()} | ${"a Proxy that throws on any trap"}
    ${() => revokedProxy()} | ${"a revoked Proxy"}
  `("returns null for $label", ({ make }) => {
    expect(parsePunctualityTolerance(make())).toBeNull();
  });

  it("reads each bound once", () => {
    const reads = { late: 0, early: 0 };
    parsePunctualityTolerance({
      get late(): string {
        reads.late += 1;
        return "PT15M";
      },
      get early(): string {
        reads.early += 1;
        return "PT10M";
      },
    });
    expect(reads).toEqual({ late: 1, early: 1 });
  });
});

describe("punctualityOf", () => {
  // Late when d ≥ late; early when early is set and d ≤ −early; on time strictly inside.
  it.each`
    minutes | late   | early   | expected    | why
    ${15n}  | ${15n} | ${null} | ${"late"}   | ${"exactly late is late"}
    ${14n}  | ${15n} | ${null} | ${"onTime"} | ${"inside"}
    ${-60n} | ${15n} | ${null} | ${"onTime"} | ${"without early, early is on time"}
    ${-10n} | ${15n} | ${10n}  | ${"early"}  | ${"exactly early is early"}
    ${-9n}  | ${15n} | ${10n}  | ${"onTime"} | ${"inside the early bound"}
    ${0n}   | ${15n} | ${0n}   | ${"early"}  | ${"early PT0S: the plan itself is early"}
    ${0n}   | ${0n}  | ${0n}   | ${"late"}   | ${"both zero: late is checked first"}
  `(
    "classifies $minutes min under late $late / early $early as $expected ($why)",
    ({ minutes, late, early, expected }) => {
      expect(
        punctualityOf(minutes * MINUTE, {
          late: late * MINUTE,
          early: early === null ? null : early * MINUTE,
        }),
      ).toBe(expected);
    },
  );
});
