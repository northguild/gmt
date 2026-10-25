import { Temporal } from "../../internal/temporal";
import { observedDate } from "./observedDate";

const UTC = (holidays: string[], weekend = [6, 7]) => ({
  weekend,
  holidays,
  timeZone: "UTC",
});

const SIX = [1, 2, 3, 4, 5, 6];
const day = (offset: number) =>
  Temporal.PlainDate.from("2024-06-30").add({ days: offset }).toString();
// 2024-07-01 .. 2024-08-09 (a Monday to a Friday), 40 days.
const RUN = Array.from({ length: 40 }, (_, index) => day(1 + index));
// Every Sunday from 2024-06-30 to 2572-01-26: all those within 200,000 days of 2024-06-29.
const SUNDAYS = Array.from({ length: 28_572 }, (_, index) => day(7 * index));

// Weekdays checked against PlainDate#dayOfWeek: 2027-12-25 Sat, 2022-12-25 Sun, 2026-12-25 Fri,
// 2021-12-25 Sat, 2021-12-26 Sun, 2026-12-23 Wed, 2026-04-03 Fri, 2026-06-17 Wed, 2026-06-18 Thu.
describe("observedDate", () => {
  it.each`
    isoDate            | policy                                        | calendar                                           | expected           | why
    ${"2027-12-25"}    | ${{ 6: { previous: 5 }, 7: { next: 1 } }}     | ${undefined}                                       | ${"2027-12-24"}    | ${"Saturday to the previous Friday"}
    ${"2022-12-25"}    | ${{ 6: { previous: 5 }, 7: { next: 1 } }}     | ${undefined}                                       | ${"2022-12-26"}    | ${"Sunday to the next Monday"}
    ${"2026-12-25"}    | ${{ 6: { previous: 5 }, 7: { next: 1 } }}     | ${undefined}                                       | ${"2026-12-25"}    | ${"Friday has no entry, unchanged"}
    ${"2022-12-25"}    | ${{ 7: { next: 2 } }}                         | ${undefined}                                       | ${"2022-12-27"}    | ${"Sunday to the next Tuesday"}
    ${"2027-12-25"}    | ${{}}                                         | ${undefined}                                       | ${"2027-12-25"}    | ${"empty policy shifts nothing"}
    ${"2021-12-26"}    | ${{ 7: "nextWorkingDay" }}                    | ${UTC(["2021-12-27"])}                             | ${"2021-12-28"}    | ${"Monday 27 is already closed"}
    ${"2021-12-26"}    | ${{ 7: "nextWorkingDay" }}                    | ${UTC(["2021-12-26"])}                             | ${"2021-12-27"}    | ${"the holiday itself is closed, Monday is open"}
    ${"2021-12-25"}    | ${{ 6: "nextWorkingDay" }}                    | ${UTC([])}                                         | ${"2021-12-27"}    | ${"Sunday is weekend, Monday is open"}
    ${"2027-12-25"}    | ${{ 6: "nextWorkingDay" }}                    | ${undefined}                                       | ${""}              | ${"nextWorkingDay with no calendar"}
    ${"2026-12-23"}    | ${{ 6: "nextWorkingDay" }}                    | ${undefined}                                       | ${""}              | ${"policy needs a calendar though a Wednesday is not shifted"}
    ${"2026-04-03"}    | ${{ 5: "nextWorkingDay" }}                    | ${UTC([], [5, 6])}                                 | ${"2026-04-05"}    | ${"Friday-Saturday weekend, Sunday is open"}
    ${"2026-06-17"}    | ${{ 2: { previous: 1 }, 3: { previous: 1 } }} | ${undefined}                                       | ${"2026-06-15"}    | ${"Wednesday to the previous Monday"}
    ${"2026-06-18"}    | ${{ 4: { next: 1 }, 5: { next: 1 } }}         | ${undefined}                                       | ${"2026-06-22"}    | ${"Thursday to the next Monday"}
    ${"2027-12-25"}    | ${{ 6: { next: 5 } }}                         | ${undefined}                                       | ${"2027-12-31"}    | ${"six days later is the longest next move"}
    ${"2027-12-25"}    | ${{ 6: { previous: 7 } }}                     | ${undefined}                                       | ${"2027-12-19"}    | ${"six days earlier is the longest previous move"}
    ${"+275760-09-13"} | ${{ 6: { next: 1 } }}                         | ${undefined}                                       | ${""}              | ${"the move leaves the maximum"}
    ${"-271821-04-19"} | ${{ 1: { previous: 5 } }}                     | ${undefined}                                       | ${""}              | ${"the move leaves the minimum"}
    ${"+275760-09-13"} | ${{ 6: "nextWorkingDay" }}                    | ${UTC([])}                                         | ${""}              | ${"the nextWorkingDay walk leaves the range"}
    ${"-271821-04-19"} | ${{}}                                         | ${undefined}                                       | ${"-271821-04-19"} | ${"the minimum itself is valid when not moved"}
    ${"+275760-09-13"} | ${{}}                                         | ${undefined}                                       | ${"+275760-09-13"} | ${"the maximum itself is valid when not moved"}
    ${"-271821-04-20"} | ${{ 2: { previous: 1 } }}                     | ${undefined}                                       | ${"-271821-04-19"} | ${"a move that lands exactly on the minimum"}
    ${"+275760-09-12"} | ${{ 5: { next: 6 } }}                         | ${undefined}                                       | ${"+275760-09-13"} | ${"a move that lands exactly on the maximum"}
    ${"2027-12-25"}    | ${{ 6: { previous: 5 } }}                     | ${{ weekend: [], holidays: "x", timeZone: "UTC" }} | ${""}              | ${"invalid calendar rejected though unused"}
    ${"2027-12-25"}    | ${{ 6: { next: 5 } }}                         | ${UTC([], [5, 6])}                                 | ${"2027-12-31"}    | ${"next ignores the weekend: lands on a closed Friday"}
    ${"2022-12-25"}    | ${{ 7: { next: 1 } }}                         | ${UTC(["2022-12-26"])}                             | ${"2022-12-26"}    | ${"next ignores holidays: lands on a closed Monday"}
    ${"2021-12-24"}    | ${{ 5: "nextWorkingDay" }}                    | ${UTC(["2021-12-27", "2021-12-28"])}               | ${"2021-12-29"}    | ${"weekend then two chained holidays, Wednesday is open"}
    ${"2021-12-25"}    | ${{ 6: "nextWorkingDay" }}                    | ${UTC([], [1, 2, 3, 4, 5, 6])}                     | ${"2021-12-26"}    | ${"six-day weekend: only Sunday is open"}
    ${"2021-12-26"}    | ${{ 7: "nextWorkingDay" }}                    | ${UTC(["2022-01-02"], [1, 2, 3, 4, 5, 6])}         | ${"2022-01-09"}    | ${"six-day weekend: next Sunday closed, the one after opens"}
    ${"2024-06-29"}    | ${{ 6: "nextWorkingDay" }}                    | ${UTC(RUN)}                                        | ${"2024-08-12"}    | ${"40 chained holidays and a weekend"}
    ${"2024-06-29"}    | ${{ 6: "nextWorkingDay" }}                    | ${UTC(SUNDAYS, SIX)}                               | ${""}              | ${"every Sunday inside the step bound is closed"}
    ${"2024-06-29"}    | ${{ 6: "nextWorkingDay" }}                    | ${UTC(SUNDAYS.slice(0, -1), SIX)}                  | ${"2572-01-26"}    | ${"the last Sunday inside the step bound still counts"}
    ${"2026-12-23"}    | ${{ 3: "nextWorkingDay" }}                    | ${UTC([])}                                         | ${"2026-12-24"}    | ${"an open weekday still moves one working day"}
    ${"+275760-09-12"} | ${{ 5: "nextWorkingDay" }}                    | ${UTC([], [])}                                     | ${"+275760-09-13"} | ${"the maximum is itself the first open day"}
    ${"+275760-09-12"} | ${{ 5: "nextWorkingDay" }}                    | ${UTC([])}                                         | ${""}              | ${"the maximum is a weekend: the walk passes the range"}
  `(
    "($isoDate, $policy) gives '$expected': $why",
    ({ isoDate, policy, calendar, expected }) => {
      expect(observedDate(isoDate, policy, calendar)).toBe(expected);
    },
  );

  it.each`
    isoDate               | why             | label
    ${"2027-02-30"}       | ${"not a date"} | ${"'2027-02-30'"}
    ${"2027-12-25T00:00"} | ${"datetime"}   | ${"'2027-12-25T00:00'"}
    ${""}                 | ${"empty"}      | ${"''"}
    ${20_271_225}         | ${"number"}     | ${"20271225"}
  `("invalid date $label gives an empty string: $why", ({ isoDate }) => {
    expect(observedDate(isoDate, { 6: { next: 1 } })).toBe("");
  });

  it.each`
    policy                             | why
    ${undefined}                       | ${"missing"}
    ${null}                            | ${"null"}
    ${[]}                              | ${"array"}
    ${"nextMonday"}                    | ${"string"}
    ${{ saturday: "previousFriday" }}  | ${"story-style key"}
    ${{ 0: { next: 1 } }}              | ${"weekday 0"}
    ${{ 8: { next: 1 } }}              | ${"weekday 8"}
    ${{ 6: "none" }}                   | ${"unknown shift string"}
    ${{ 6: { next: 6 } }}              | ${"target equals the weekday"}
    ${{ 6: { next: 1, previous: 5 } }} | ${"two keys"}
    ${{ 6: { next: 1.5 } }}            | ${"fractional target"}
    ${{ 6: undefined }}                | ${"undefined shift"}
    ${{ 6: ["nextWorkingDay"] }}       | ${"array shift"}
    ${{ 6: 5 }}                        | ${"number shift"}
    ${{ 6: { previous: 0 } }}          | ${"target 0"}
    ${{ 6: { next: Number.NaN } }}     | ${"NaN target"}
    ${{ 6: {} }}                       | ${"no key"}
    ${{ 6: null }}                     | ${"null shift"}
    ${{ 6: { sideways: 1 } }}          | ${"unknown key"}
  `("invalid policy $policy gives an empty string: $why", ({ policy }) => {
    expect(observedDate("2027-12-25", policy)).toBe("");
  });

  it.each`
    calendar                                                             | why
    ${null}                                                              | ${"null"}
    ${[]}                                                                | ${"an array"}
    ${{ weekend: [6, 7], holidays: [], timeZone: "Nowhere/Zone" }}       | ${"an unknown time zone"}
    ${{ weekend: [1, 2, 3, 4, 5, 6, 7], holidays: [], timeZone: "UTC" }} | ${"a weekend of all seven days"}
  `("invalid calendar ($why) gives an empty string", ({ calendar }) => {
    expect(observedDate("2027-12-25", {}, calendar)).toBe("");
  });

  it("treats an explicit undefined calendar as omitted", () => {
    expect(observedDate("2027-12-25", { 6: { previous: 5 } }, undefined)).toBe(
      "2027-12-24",
    );
  });

  const hostile = () => {
    throw new Error("hostile");
  };

  it.each`
    policy                                      | calendar                                                                   | why
    ${{ get 6() {
    return hostile();
  } }} | ${undefined} | ${"policy getter throws"}
    ${new Proxy({}, { ownKeys: hostile })}      | ${undefined}                                                               | ${"policy proxy throws on ownKeys"}
    ${{ 6: { get next() {
      return hostile();
    } } }} | ${undefined} | ${"shift getter throws"}
    ${JSON.parse('{"__proto__": {"next": 1}}')} | ${undefined}                                                               | ${"own __proto__ key"}
    ${{ 6: "nextWorkingDay" }} | ${{ weekend: [6, 7], get holidays() {
    return hostile();
  }, timeZone: "UTC" }} | ${"calendar getter throws"}
    ${{ 6: "nextWorkingDay" }}                  | ${new Proxy({}, { get: hostile })}                                         | ${"calendar proxy throws"}
    ${{ 6: "nextWorkingDay" }}                  | ${{ weekend: [6, 7], holidays: [{ toString: hostile }], timeZone: "UTC" }} | ${"holiday entry not a string"}
  `(
    "hostile input gives an empty string, never throws: $why",
    ({ policy, calendar }) => {
      expect(observedDate("2027-12-25", policy, calendar)).toBe("");
    },
  );

  // isObject / GetOptionsObject: functions pass, and only the policy's own enumerable keys count.
  it.each`
    policy                                            | expected        | why
    ${() => 0}                                        | ${"2027-12-25"} | ${"bare function has no keys: unshifted"}
    ${new Temporal.PlainDate(2024, 1, 1)}             | ${"2027-12-25"} | ${"class instance without own keys: unshifted"}
    ${new Map([[6, { previous: 5 }]])}                | ${"2027-12-25"} | ${"Map entries are not own keys: unshifted"}
    ${Object.create({ 6: { next: 1 } })}              | ${"2027-12-25"} | ${"inherited keys are ignored: unshifted"}
    ${Object.assign(() => 0, { 6: { previous: 5 } })} | ${"2027-12-24"} | ${"function with own keys: shifts Saturday to Friday"}
    ${{ 6: Object.create({ previous: 5 }) }}          | ${""}           | ${"inherited shift key: no own key, invalid"}
  `("odd policy object gives '$expected': $why", ({ policy, expected }) => {
    expect(observedDate("2027-12-25", policy)).toBe(expected);
  });
});
