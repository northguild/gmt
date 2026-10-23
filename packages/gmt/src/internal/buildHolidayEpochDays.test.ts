import { MAX_EPOCH_DAY, MIN_EPOCH_DAY } from "./epochDay";
import {
  buildHolidayEpochDays,
  parseHolidayRule,
  type ResolvedHolidayRule,
} from "./holidayRules";

const WEEKEND = new Set([6, 7]);

function resolve(rule: unknown): ResolvedHolidayRule {
  const resolved = parseHolidayRule(rule);

  if (resolved === null) {
    throw new Error("expected a valid rule");
  }

  return resolved;
}

const NEW_YEAR = { name: "x", kind: "fixed", month: 1, day: 1 };
const SATURDAY_TO_FRIDAY = {
  name: "x",
  kind: "fixed",
  month: 1,
  day: 1,
  observed: { 6: { previous: 5 } },
};

// Epoch days are days since 1970-01-01, computed independently with Date.UTC / 86400000:
// 2026-01-01 = 20454, 2027-01-01 = 20819, 2027-12-31 = 21183, 2028-01-01 = 21184 (a Saturday, so
// it is observed on 2027-12-31).
const JAN_1_2026 = 20454;
const JAN_1_2027 = 20819;
const DEC_31_2027 = 21183;
describe("buildHolidayEpochDays", () => {
  it.each`
    label                                       | rule                  | from    | to      | expected
    ${"one plain year"}                         | ${NEW_YEAR}           | ${2027} | ${2027} | ${[JAN_1_2027]}
    ${"two years"}                              | ${NEW_YEAR}           | ${2026} | ${2027} | ${[JAN_1_2026, JAN_1_2027]}
    ${"the next year's Saturday shift enters"}  | ${SATURDAY_TO_FRIDAY} | ${2027} | ${2027} | ${[JAN_1_2027, DEC_31_2027]}
    ${"the shift out of the window is clipped"} | ${SATURDAY_TO_FRIDAY} | ${2028} | ${2028} | ${[]}
  `("$label", ({ rule, from, to, expected }) => {
    const days = buildHolidayEpochDays([resolve(rule)], WEEKEND, from, to);

    expect(days && Array.from(days)).toEqual(expected);
  });

  // 2022-12-31 is a Saturday: observed Monday 2023-01-02 = 19359, inside a 2023-only window.
  it("keeps a date observed inside the window from the year before it", () => {
    const rule = resolve({
      name: "x",
      kind: "fixed",
      month: 12,
      day: 31,
      observed: { 6: { next: 1 } },
    });
    const days = buildHolidayEpochDays([rule], WEEKEND, 2023, 2023);

    expect(Array.from(days!)).toEqual([19359, 19722]);
  });

  it("lists a date once when two different rules hit it", () => {
    const rules = [
      resolve(NEW_YEAR),
      resolve({ name: "y", kind: "dates", dates: ["2026-01-01"] }),
    ];

    expect(
      Array.from(buildHolidayEpochDays(rules, WEEKEND, 2026, 2026)!),
    ).toEqual([JAN_1_2026]);
  });

  // Saturday 2026-12-26 over a closed run: 2027-01-25 closed lands on 01-26 (31 days), 01-26
  // closed lands on 01-27 (32 days).
  it.each`
    lastClosedDay | isNull
    ${25}         | ${false}
    ${26}         | ${true}
  `(
    "a shift over a run closed to 2027-01-$lastClosedDay is null: $isNull",
    ({ lastClosedDay, isNull }) => {
      const closed = [27, 28, 29, 30, 31].map((day) => `2026-12-${day}`);

      for (let day = 1; day <= lastClosedDay; day++) {
        closed.push(`2027-01-${String(day).padStart(2, "0")}`);
      }

      const rules = [
        resolve({ name: "closed", kind: "dates", dates: closed }),
        resolve({
          name: "a",
          kind: "fixed",
          month: 12,
          day: 26,
          observed: { 6: "nextWorkingDay" },
        }),
      ];

      expect(buildHolidayEpochDays(rules, WEEKEND, 2026, 2027) === null).toBe(
        isNull,
      );
    },
  );

  // Every order of four rules that move onto each other's days, over 30 years of weekdays.
  it("gives the same days whatever the order of the rules", () => {
    const nextWorking = { 6: "nextWorkingDay", 7: "nextWorkingDay" };
    const rules = [
      { name: "a", kind: "fixed", month: 12, day: 25, observed: nextWorking },
      { name: "b", kind: "fixed", month: 12, day: 26, observed: nextWorking },
      {
        name: "c",
        kind: "fixed",
        month: 12,
        day: 27,
        observed: { 6: { next: 1 }, 7: { next: 1 } },
      },
      { name: "d", kind: "fixed", month: 12, day: 28 },
    ].map(resolve);
    const orders = (list: ResolvedHolidayRule[]): ResolvedHolidayRule[][] =>
      list.length <= 1
        ? [list]
        : list.flatMap((rule, index) =>
            orders(list.filter((_, other) => other !== index)).map((rest) => [
              rule,
              ...rest,
            ]),
          );
    const results = orders(rules).map((order) =>
      Array.from(buildHolidayEpochDays(order, WEEKEND, 2000, 2029)!),
    );

    expect(results).toHaveLength(24);
    expect(new Set(results.map(String)).size).toBe(1);
  });

  it("returns an empty array for no rules", () => {
    expect(buildHolidayEpochDays([], WEEKEND, 2026, 2026)).toEqual(
      new Int32Array(0),
    );
  });

  it("is sorted without repeats when rules overlap", () => {
    const rules = [resolve(NEW_YEAR), resolve(NEW_YEAR)];
    const days = buildHolidayEpochDays(rules, WEEKEND, 2026, 2026);

    expect(Array.from(days!)).toEqual([JAN_1_2026]);
  });

  it("returns null when a shift is longer than 31 days", () => {
    expect(
      buildHolidayEpochDays(
        [
          resolve({
            name: "closed 2026-12-28 to 2027-02-09",
            kind: "dates",
            dates: [
              ...[28, 29, 30, 31].map((day) => `2026-12-${day}`),
              ...Array.from(
                { length: 40 },
                (_, i) =>
                  `2027-${i < 31 ? "01" : "02"}-${String((i % 31) + 1).padStart(2, "0")}`,
              ),
            ],
          }),
          resolve({
            name: "a",
            kind: "fixed",
            month: 12,
            day: 26,
            observed: { 6: "nextWorkingDay" },
          }),
        ],
        WEEKEND,
        2026,
        2026,
      ),
    ).toBeNull();
  });

  it.each`
    label           | from       | to
    ${"first year"} | ${-271821} | ${-271821}
    ${"last year"}  | ${275760}  | ${275760}
  `("keeps every day within Temporal's range, $label", ({ from, to }) => {
    const days = buildHolidayEpochDays(
      [resolve({ name: "x", kind: "fixed", month: 6, day: 15 })],
      WEEKEND,
      from,
      to,
    );

    expect(days).not.toBeNull();
    expect(days!.length).toBe(1);
    expect(days![0] >= MIN_EPOCH_DAY && days![0] <= MAX_EPOCH_DAY).toBe(true);
  });
});
