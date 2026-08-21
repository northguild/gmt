import { Temporal } from "@js-temporal/polyfill";
import { monthGridWeekRow } from "./monthGridWeekRow";

describe("monthGridWeekRow", () => {
  it.each`
    firstOfMonth     | firstDay | dayInMonth | expected
    ${"2024-02-01"}  | ${7}     | ${1}       | ${1}
    ${"2024-02-01"}  | ${7}     | ${29}      | ${5}
    ${"2024-02-01"}  | ${1}     | ${1}       | ${1}
    ${"2024-02-01"}  | ${1}     | ${29}      | ${5}
    ${"2026-02-01"}  | ${7}     | ${28}      | ${4}
    ${"2026-02-01"}  | ${1}     | ${28}      | ${5}
  `(
    "returns $expected for firstOfMonth $firstOfMonth, firstDay $firstDay, dayInMonth $dayInMonth",
    ({ firstOfMonth, firstDay, dayInMonth, expected }) => {
      const date = Temporal.PlainDate.from(firstOfMonth);
      expect(monthGridWeekRow(date, firstDay, dayInMonth)).toBe(expected);
    },
  );
});
