---
name: gmt-workforce
description: >
  Hours-of-work rules over a duty log in @northguild/gmt/workforce —
  evaluateDutyLog and dutyViolations for cumulative caps, rolling and fixed-
  period caps, rest requirements, free periods, quotas and patterns over the
  caller's own status words, dutyDayFor for the operator day, dutyTotals,
  longestRun, qualifyingRests, qualifyingRestPairs, isValidDutyLog. Every limit
  is the caller's; GMT names no regulation. Reads the docs site (llms.txt) and
  the installed package's JSDoc; a routing pointer.
sources:
  - 'northguild/gmt:apps/dox/src/content/docs/guides/industries/workforce-hours-of-work.mdx'
  - 'northguild/gmt:packages/gmt/src/workforce/index.ts'
  - 'northguild/gmt:packages/gmt/src/types/duty.ts'
metadata:
  type: core
  library: '@northguild/gmt'
  library_version: '1.20.0'
---

# GMT Workforce

Use this skill when the task is checking hours of work against rules: driving
or duty caps, rest in every 24 hours, a free day in seven, a monthly record of
violations. The interval and duration rules it builds on are in the
`gmt-arithmetic` skill.

## When to load

- The user checks hours of work against rules: driving or duty caps, rest in
  every 24 hours, a free day in seven, a monthly record of violations.

## Core rules

1. **Hours of work are rules over a duty log, and every number is the
    caller's.** A log is `{ status, start, end }[]` in the caller's own status
    words, ordered and non-overlapping (`isValidDutyLog`). A rule is one of 13
    `DutyRule` kinds (`cumulativeCap`, `elapsedWindow`, `requiredInterruption`,
    `rollingCap`, `fixedPeriodCap`, `restRequirement`, `freePeriod`,
    `restBeforeDuty`, `quota`, `dueBy`, `pattern`, `occurrenceCap`,
    `usageLookback`) with no default limit; GMT names no regulation.
    `evaluateDutyLog(log, at, rules, { timeZone, dayStartTime?, disambiguation? })`
    reports every rule at one instant; `dutyViolations` lists each violation in a
    range once, by its worst window, in the range it began in.

    ```typescript
    evaluateDutyLog(log, "2024-01-01T21:30:00Z", [{ label: "11 driving", kind: "cumulativeCap",
      statuses: ["driving"], cap: "PT11H", since: { statuses: ["off"], consecutive: "PT10H" } }],
      { timeZone: "UTC" }).violations; // [{ label: "11 driving", used: "PT11H30M", limit: "PT11H", … }]
    ```

    - `{ elapsed: "PT24H" }` slides; `{ operatorDays }`, `{ calendarDays }`,
      `{ isoWeeks }`, `{ calendarMonths }`, `{ calendarYears }` are whole local
      periods in `timeZone` (28 calendar days across a fall-back are 673 hours).
    - The operator day is `dutyDayFor(instant, { timeZone, dayStartTime })`,
      never local midnight; a rule counting `operatorDays` needs `dayStartTime`.
    - The log is read up to `at`; unlogged time is neither work nor rest. To
      check a roster, append the plan and set `at` to its end.
    - A paired rest is three floors (`PairSpec`), not two integers:
      `qualifyingRestPairs`.
    - A count of periods is 10,000 at most, alone or times `adjacent`,
      `lookback` or `periods`. `fixedPeriodCap.period` and `occurrenceCap.per`
      are a `LocalPeriod`: a count, never `elapsed`.
    - `dutyViolations` reads only the time the log covers, and each check reads
      the log as it stood then, so a record only grows as the log does.
    - Nested caps are separate rules, reported separately.
2. **Read the docs site.** This skill is a routing pointer. The map of the
   docs is `https://northguild.dev/gmt/llms.txt`, and each page
   has a `.md` twin that holds its text. The JSDoc ships in the installed
   package: `node_modules/@northguild/gmt/dist/**/*.d.ts`.

## Key functions

- **Hours of work**: `evaluateDutyLog`, `dutyViolations`, `dutyDayFor`,
  `dutyTotals`, `longestRun`, `qualifyingRests`, `qualifyingRestPairs`,
  `isValidDutyLog`, types `DutyEntry`, `DutyRule`, `Period`, `LocalPeriod`,
  `DutyReport`

## References

- [workforce reference](https://northguild.dev/gmt/reference/workforce/)
- [Workforce: Hours of Work guide](https://northguild.dev/gmt/guides/industries/workforce-hours-of-work/)
- [Docs map for agents (llms.txt)](https://northguild.dev/gmt/llms.txt)
- [GMT Arithmetic skill](../gmt-arithmetic/SKILL.md)
