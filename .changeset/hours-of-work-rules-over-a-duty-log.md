---
"@northguild/gmt": minor
---

Add the `duty` namespace: hours-of-work rules evaluated over a duty log (Story CORE-76). A log is a list of `{ status, start, end }` entries in your own status words. A rule is one of 13 shapes, and every number in it is yours: GMT names no regulation and has no default limit. A regime is the array of rules you assemble and label.

- `evaluateDutyLog(log, at, rules, options)` reports every rule at one instant, whether or not it binds: `used`, `limit`, `remaining`, the `window` measured, `dueBy` and `resetAt`. A failed rule is listed again under `violations`, or under `advisories` when its `severity` is `"advisory"`.
- `dutyViolations(log, range, rules, options)` lists every violation in a range, for a monthly record. Each is listed once, by the window that failed worst, in the range it began in, so two adjacent months never list one twice.
- `dutyDayFor(instant, day)` returns the operator-designated day an instant falls in: from `dayStartTime` in the reference zone, never local midnight.
- `dutyTotals`, `longestRun`, `qualifyingRests` and `qualifyingRestPairs` measure a log directly. `isValidDutyLog` checks one.

```typescript
import { evaluateDutyLog } from "@northguild/gmt";

const log = [
  { status: "off", start: "2024-01-01T00:00:00Z", end: "2024-01-01T10:00:00Z" },
  { status: "driving", start: "2024-01-01T10:00:00Z", end: "2024-01-01T21:30:00Z" },
];

const report = evaluateDutyLog(
  log,
  "2024-01-01T21:30:00Z",
  [
    {
      label: "11 driving",
      kind: "cumulativeCap",
      statuses: ["driving"],
      cap: "PT11H",
      since: { statuses: ["off"], consecutive: "PT10H" },
    },
    {
      label: "14 window",
      kind: "elapsedWindow",
      startStatuses: ["driving"],
      length: "PT14H",
      restrictedStatuses: ["driving"],
      since: { statuses: ["off"], consecutive: "PT10H" },
    },
  ],
  { timeZone: "UTC" },
);

report.violations.map((rule) => [rule.label, rule.used, rule.limit]);
// [["11 driving", "PT11H30M", "PT11H"]]
report.outcomes[1].dueBy; // "2024-01-02T00:00:00Z" (the 14-hour window closes then)
```

The rule kinds are `cumulativeCap`, `elapsedWindow`, `requiredInterruption`, `rollingCap`, `fixedPeriodCap`, `restRequirement`, `freePeriod`, `restBeforeDuty`, `quota`, `dueBy`, `pattern`, `occurrenceCap` and `usageLookback`. Each type's documentation states exactly what it measures.

- **A duration slides; a count of local periods does not.** `{ elapsed: "PT24H" }` is every 24-hour window ending at the instant evaluated. `{ operatorDays: 7 }`, `{ calendarDays: 28 }`, `{ isoWeeks: 1 }`, `{ calendarMonths: 1 }` and `{ calendarYears: 1 }` are whole periods in the reference zone. A calendar day with a clock change is 23 or 25 hours long, so 28 calendar days across a fall-back are 673 hours. Each outcome names its `periodBasis`.
- **The log is read as it stands at `at`.** Later entries are ignored, and an entry that crosses `at` is cut there. Time no entry covers is neither work nor rest. To check a planned roster, append the plan and set `at` to its end.
- **A shift that crosses a period boundary is split there**, and each part counts in its own day, week or month.
- **A paired rest is three floors, not two numbers.** With 2 hours each, 7 for the longer and 10 together, 7.5 + 2.5 qualifies and 6 + 4 does not.
- **A day start that a clock change repeats or skips** resolves as `resolveLocal` resolves it, `"compatible"` unless you pass `disambiguation`. `"reject"` returns the sentinel rather than guess.
- Invalid input returns the sentinel: `null` for `evaluateDutyLog`, `dutyViolations`, `dutyDayFor` and `longestRun`, `""` for `dutyTotals`, `[]` for `qualifyingRests` and `qualifyingRestPairs`, and `false` for `isValidDutyLog`.
