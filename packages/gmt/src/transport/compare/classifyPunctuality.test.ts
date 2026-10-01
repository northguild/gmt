import { Temporal } from "@js-temporal/polyfill";
import { battleTestTimeZones } from "../../test";
import {
  mockTemporalDurationFromThrow,
  mockTemporalInstantFromThrow,
} from "../../test/mocks";
import { classifyPunctuality } from "./classifyPunctuality";

/** The plan every row measures against: 10:00Z on Saturday 15 June 2024. */
const planned = "2024-06-15T10:00:00Z";

describe("classifyPunctuality", () => {
  // The deviation d = actual − planned in exact time. Late when d ≥ late; early when `early` is
  // given and d ≤ −early; on time strictly inside. Each deviation is whole minutes or seconds on
  // one UTC day, checked with Temporal.Instant#until and Temporal.Duration.compare.
  it.each`
    actual                               | tolerance                              | expected    | why
    ${"2024-06-15T10:14:59Z"}            | ${{ late: "PT15M" }}                   | ${"onTime"} | ${"15-minute: 14 min 59 s late is strictly inside"}
    ${"2024-06-15T10:15:00Z"}            | ${{ late: "PT15M" }}                   | ${"late"}   | ${"15-minute: exactly 15 minutes is late"}
    ${"2024-06-15T10:14:59.999999999Z"}  | ${{ late: "PT15M" }}                   | ${"onTime"} | ${"15-minute: one nanosecond short of the boundary is inside"}
    ${"2024-06-15T10:00:00Z"}            | ${{ late: "PT15M" }}                   | ${"onTime"} | ${"15-minute: on the plan"}
    ${"2024-06-15T08:00:00Z"}            | ${{ late: "PT15M" }}                   | ${"onTime"} | ${"without early, two hours early is on time"}
    ${"2024-06-15T08:00:00Z"}            | ${{ late: "PT15M", early: undefined }} | ${"onTime"} | ${"early: undefined is the same as no early"}
    ${"2024-06-15T09:49:00Z"}            | ${{ late: "PT15M", early: "PT10M" }}   | ${"early"}  | ${"with early PT10M, 11 minutes early is early"}
    ${"2024-06-15T09:50:00Z"}            | ${{ late: "PT15M", early: "PT10M" }}   | ${"early"}  | ${"exactly 10 minutes early is early"}
    ${"2024-06-15T09:50:00.000000001Z"}  | ${{ late: "PT15M", early: "PT10M" }}   | ${"onTime"} | ${"one nanosecond inside the early boundary"}
    ${"2024-06-15T09:51:00Z"}            | ${{ late: "PT15M", early: "PT10M" }}   | ${"onTime"} | ${"9 minutes early is strictly inside"}
    ${"2024-06-15T10:14:59Z"}            | ${{ late: "PT15M", early: "PT10M" }}   | ${"onTime"} | ${"early changes nothing on the late side"}
    ${"2024-06-15T11:30:00Z"}            | ${{ late: "PT60M" }}                   | ${"late"}   | ${"60-minute: a 90-minute delay is late"}
    ${"2024-06-15T11:30:00Z"}            | ${{ late: "PT120M" }}                  | ${"onTime"} | ${"120-minute: the same delay is on time"}
    ${"2024-06-16T09:59:59Z"}            | ${{ late: "P1D", early: "P1D" }}       | ${"onTime"} | ${"day-based: 23:59:59 late is inside"}
    ${"2024-06-16T10:00:00Z"}            | ${{ late: "P1D", early: "P1D" }}       | ${"late"}   | ${"day-based: a day is 24 hours, so 24 h late is late"}
    ${"2024-06-14T10:00:00Z"}            | ${{ late: "P1D", early: "P1D" }}       | ${"early"}  | ${"day-based: 24 h early is early"}
    ${"2024-06-15T10:00:00Z"}            | ${{ late: "PT0S" }}                    | ${"late"}   | ${"late PT0S: on the plan is late"}
    ${"2024-06-15T09:59:59Z"}            | ${{ late: "PT0S" }}                    | ${"onTime"} | ${"late PT0S without early: an early arrival is still on time"}
    ${"2024-06-15T09:59:59Z"}            | ${{ late: "PT0S", early: "PT0S" }}     | ${"early"}  | ${"both PT0S: nothing is on time (early side)"}
    ${"2024-06-15T10:00:00Z"}            | ${{ late: "PT0S", early: "PT0S" }}     | ${"late"}   | ${"both PT0S: on the plan is late, which is checked first"}
    ${"2024-06-15T10:00:00Z"}            | ${{ late: "PT15M", early: "PT0S" }}    | ${"early"}  | ${"early PT0S: on the plan is on the early boundary, which is outside"}
    ${"2024-06-15T10:00:00Z"}            | ${{ late: "-PT0S" }}                   | ${"late"}   | ${"-PT0S is zero, not negative"}
    ${"2024-06-15T19:15:00+09:00"}       | ${{ late: "PT15M" }}                   | ${"late"}   | ${"an offset instant, 10:15Z"}
    ${"2024-06-15T15:44:59+05:30:15"}    | ${{ late: "PT15M" }}                   | ${"onTime"} | ${"a sub-minute offset instant, 10:14:44Z"}
    ${"2024-06-15T10:15:00Z[Not/AZone]"} | ${{ late: "PT15M" }}                   | ${"late"}   | ${"a bracket is never read"}
  `(
    "classifies $actual under $tolerance as $expected ($why)",
    ({ actual, tolerance, expected }) => {
      expect(classifyPunctuality(planned, actual, tolerance)).toBe(expected);
    },
  );

  // New York fell back at 02:00 EDT on 3 November 2024 and sprang forward on 10 March 2024.
  // The deviation is exact elapsed time: a wall-clock reading would say 0, 23 h 30 min or 2 h.
  it.each`
    plan                                             | actual                                           | tolerance            | expected    | transition
    ${"2024-11-03T01:30:00-04:00[America/New_York]"} | ${"2024-11-03T01:30:00-05:00[America/New_York]"} | ${{ late: "PT15M" }} | ${"late"}   | ${"fall-back: the same wall time an hour later is 60 min late"}
    ${"2024-11-02T12:00:00-04:00[America/New_York]"} | ${"2024-11-03T11:30:00-05:00[America/New_York]"} | ${{ late: "P1D" }}   | ${"late"}   | ${"fall-back: 23 h 30 min on the wall clock is 24 h 30 min elapsed"}
    ${"2024-03-10T01:30:00-05:00[America/New_York]"} | ${"2024-03-10T03:29:00-04:00[America/New_York]"} | ${{ late: "PT60M" }} | ${"onTime"} | ${"spring-forward: 1 h 59 min on the wall clock is 59 min elapsed"}
  `(
    "classifies across the $transition",
    ({ plan, actual, tolerance, expected }) => {
      expect(classifyPunctuality(plan, actual, tolerance)).toBe(expected);
    },
  );

  it.each(battleTestTimeZones)(
    "gives the same class whatever zone the plan is written in (%s)",
    (timeZone) => {
      const plan = Temporal.Instant.from(planned)
        .toZonedDateTimeISO(timeZone)
        .toString();
      expect(
        classifyPunctuality(plan, "2024-06-15T10:15:00Z", { late: "PT15M" }),
      ).toBe("late");
      expect(
        classifyPunctuality(plan, "2024-06-15T10:14:59Z", { late: "PT15M" }),
      ).toBe("onTime");
    },
  );

  // The whole instant range is 4,800,000,000 hours (Temporal.Instant#until confirms it).
  it.each`
    plan                                   | actual                       | late               | expected
    ${"-271821-04-20T00:00:00Z"}           | ${"+275760-09-13T00:00:00Z"} | ${"PT4800000000H"} | ${"late"}
    ${"-271821-04-20T00:00:00Z"}           | ${"+275760-09-13T00:00:00Z"} | ${"PT4800000001H"} | ${"onTime"}
    ${"-271821-04-19T23:59:59.999999999Z"} | ${"+275760-09-13T00:00:00Z"} | ${"PT4800000001H"} | ${null}
  `(
    "classifies the range limits $plan to $actual under late $late as $expected",
    ({ plan, actual, late, expected }) => {
      expect(classifyPunctuality(plan, actual, { late })).toBe(expected);
    },
  );

  it.each`
    tolerance                             | why
    ${{ late: "-PT15M" }}                 | ${"a negative late tolerance"}
    ${{ late: "PT15M", early: "-PT10M" }} | ${"a negative early tolerance"}
    ${{ late: "P1W" }}                    | ${"weeks need a reference point"}
    ${{ late: "P1M" }}                    | ${"months need a reference point"}
    ${{ late: "P1Y" }}                    | ${"years need a reference point"}
    ${{ late: "PT15M", early: "P1M" }}    | ${"a calendar-unit early tolerance"}
    ${{ late: "15 minutes" }}             | ${"not a duration"}
    ${{ early: "PT10M" }}                 | ${"no late tolerance: there is no default"}
    ${{ late: 900 }}                      | ${"a non-string late"}
    ${{ late: "PT15M", early: null }}     | ${"a null early is not absent"}
    ${{ late: "PT15M", early: 600 }}      | ${"a non-string early"}
    ${{}}                                 | ${"an empty tolerance"}
    ${null}                               | ${"a null tolerance"}
    ${"PT15M"}                            | ${"a bare duration string"}
    ${undefined}                          | ${"no tolerance"}
  `("returns null for $why", ({ tolerance }) => {
    expect(
      classifyPunctuality(planned, "2024-06-15T10:14:00Z", tolerance),
    ).toBeNull();
  });

  it.each`
    plan                     | actual                                     | why
    ${"2024-06-15T10:00:00"} | ${"2024-06-15T10:14:00Z"}                  | ${"a zoneless plan"}
    ${planned}               | ${"2024-06-15T10:14:00"}                   | ${"a zoneless actual"}
    ${planned}               | ${"2024-06-15T06:14:00[America/New_York]"} | ${"a zoned wall time without an offset: the bracket is never read"}
    ${"not a date"}          | ${"2024-06-15T10:14:00Z"}                  | ${"a malformed plan"}
    ${planned}               | ${""}                                      | ${"scheduleDeviation's sentinel as the actual"}
    ${planned}               | ${1718446440}                              | ${"a non-string actual"}
  `("returns null for $why", ({ plan, actual }) => {
    expect(classifyPunctuality(plan, actual, { late: "PT15M" })).toBeNull();
  });

  // The tolerance is read property by property, as Temporal reads an options bag (GetOption is a
  // [[Get]]): a null-prototype object and an inherited property are read like a plain object.
  it.each`
    tolerance                                                | why
    ${Object.assign(Object.create(null), { late: "PT15M" })} | ${"a null-prototype tolerance"}
    ${Object.create({ late: "PT15M" })}                      | ${"a late tolerance inherited from the prototype"}
  `("reads $why like a plain object", ({ tolerance }) => {
    expect(
      classifyPunctuality(planned, "2024-06-15T10:15:00Z", tolerance),
    ).toBe("late");
    expect(
      classifyPunctuality(planned, "2024-06-15T10:14:59Z", tolerance),
    ).toBe("onTime");
  });

  it("returns null for a tolerance whose getter throws", () => {
    const tolerance = {
      get late(): string {
        throw new Error("hostile getter");
      },
    };
    expect(
      classifyPunctuality(planned, "2024-06-15T10:14:00Z", tolerance),
    ).toBeNull();
  });

  it("returns null when the duration parse throws", () => {
    mockTemporalDurationFromThrow();
    expect(
      classifyPunctuality(planned, "2024-06-15T10:14:00Z", { late: "PT15M" }),
    ).toBeNull();
  });

  it("returns null when the instant parse throws", () => {
    mockTemporalInstantFromThrow();
    expect(
      classifyPunctuality(planned, "2024-06-15T10:14:00Z", { late: "PT15M" }),
    ).toBeNull();
  });
});
