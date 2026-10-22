import { parseBusinessCalendar } from "./businessCalendar";
import { epochDayOf, MAX_EPOCH_DAY } from "./epochDay";
import {
  observedEpochDay,
  parseObservancePolicy,
  policyNeedsCalendar,
} from "./observance";

// 2027-12-25 is a Saturday, 2022-12-25 a Sunday (checked against PlainDate#dayOfWeek).
const SATURDAY = epochDayOf(2027, 12, 25);
const SUNDAY = epochDayOf(2022, 12, 25);

describe("parseObservancePolicy", () => {
  it("resolves entries by weekday index and leaves the rest undefined", () => {
    const resolved = parseObservancePolicy({
      6: { previous: 5 },
      7: "nextWorkingDay",
    });

    expect(resolved?.[6]).toEqual({ previous: 5 });
    expect(resolved?.[7]).toBe("nextWorkingDay");
    expect(resolved?.[1]).toBeUndefined();
  });

  it.each`
    policy                                     | expected
    ${{}}                                      | ${false}
    ${{ 6: { next: 1 } }}                      | ${false}
    ${{ 6: "nextWorkingDay" }}                 | ${true}
    ${{ 1: { next: 2 }, 7: "nextWorkingDay" }} | ${true}
  `("policyNeedsCalendar($policy) is $expected", ({ policy, expected }) => {
    expect(policyNeedsCalendar(parseObservancePolicy(policy)!)).toBe(expected);
  });

  it.each`
    policy
    ${{ "06": { next: 1 } }}
    ${{ "6.0": { next: 1 } }}
    ${{ 6: { next: 6 } }}
    ${{ 6: { previous: 6 } }}
    ${{ 6: { next: "1" } }}
  `("rejects $policy", ({ policy }) => {
    expect(parseObservancePolicy(policy)).toBeNull();
  });
});

describe("observedEpochDay", () => {
  const none = parseObservancePolicy({})!;

  it.each`
    day         | policy                    | delta
    ${SATURDAY} | ${{ 6: { next: 5 } }}     | ${6}
    ${SATURDAY} | ${{ 6: { next: 7 } }}     | ${1}
    ${SATURDAY} | ${{ 6: { previous: 7 } }} | ${-6}
    ${SATURDAY} | ${{ 6: { previous: 5 } }} | ${-1}
    ${SUNDAY}   | ${{ 7: { next: 1 } }}     | ${1}
    ${SUNDAY}   | ${{ 7: { previous: 1 } }} | ${-6}
  `("moves day $day by $delta under $policy", ({ day, policy, delta }) => {
    expect(observedEpochDay(day, parseObservancePolicy(policy)!, null)).toBe(
      day + delta,
    );
  });

  it("returns the day when no shift applies", () => {
    expect(observedEpochDay(SATURDAY, none, null)).toBe(SATURDAY);
  });

  it("returns null for nextWorkingDay without a calendar", () => {
    expect(
      observedEpochDay(
        SATURDAY,
        parseObservancePolicy({ 6: "nextWorkingDay" })!,
        null,
      ),
    ).toBeNull();
  });

  it("walks to the first business day strictly after", () => {
    const calendar = parseBusinessCalendar({
      weekend: [6, 7],
      holidays: ["2027-12-27"],
      timeZone: "UTC",
    });

    expect(
      observedEpochDay(
        SATURDAY,
        parseObservancePolicy({ 6: "nextWorkingDay" })!,
        calendar,
      ),
    ).toBe(SATURDAY + 3);
  });

  it("returns null when a move leaves Temporal's range", () => {
    // MAX_EPOCH_DAY is a Saturday (+275760-09-13).
    expect(
      observedEpochDay(
        MAX_EPOCH_DAY,
        parseObservancePolicy({ 6: { next: 1 } })!,
        null,
      ),
    ).toBeNull();
  });

  it("leaves a day the policy does not shift alone even with a calendar", () => {
    const calendar = parseBusinessCalendar({
      weekend: [6, 7],
      holidays: [],
      timeZone: "UTC",
    });

    expect(
      observedEpochDay(
        SATURDAY - 3,
        parseObservancePolicy({ 6: "nextWorkingDay" })!,
        calendar,
      ),
    ).toBe(SATURDAY - 3);
  });

  it.each`
    day                  | why
    ${MAX_EPOCH_DAY}     | ${"the maximum itself"}
    ${MAX_EPOCH_DAY - 1} | ${"a Friday before a closed Saturday maximum"}
  `(
    "a nextWorkingDay walk past the range throws RangeError: $why",
    ({ day }) => {
      const calendar = parseBusinessCalendar({
        weekend: [6, 7],
        holidays: [],
        timeZone: "UTC",
      });

      expect(() =>
        observedEpochDay(
          day,
          parseObservancePolicy({ 5: "nextWorkingDay", 6: "nextWorkingDay" })!,
          calendar,
        ),
      ).toThrow(RangeError);
    },
  );
});
