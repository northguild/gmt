# Slice 3 — zone-argument harness row

Index: [index.md](index.md). Depends on slice 1 (the export from `../index`).

`isValidOperatingSchedule` takes a zone inside its argument (`schedule.timeZone`) and its result
names no zone, so it joins the functions `src/test/zoneArgument.test.ts` runs by name, beside
`operatingIntervals`. Its zone rule is `zoneFrame`'s, shared with the six operating functions
(Authority table row "`timeZone` is a time zone identifier or a stored offset"). The harness is
what proves that for every spelling, including the ones the slice 1 tables do not list.

## `src/test/zoneArgumentCalls.ts`

After the `// calendar/hours` block and before `// intermodal`, add:

```ts
    // calendar/validate
    isValidOperatingSchedule: flag(POINT, (zone) =>
      lib.isValidOperatingSchedule(businessHours(zone)),
    ),
```

`POINT`: the answer reads no instant and no span. `flag` gives sentinel `false`, and
`sentinelIsAnswer` stays unset: an accepted zone gives `true`, so acceptance is visible.

## `src/test/zoneArgument.test.ts`

- `ZONELESS_RESULT_FUNCTIONS`: after `"operatingIntervals"`/`"operatingTimeBetween"` in the
  `// calendar/hours` group, add `// calendar/validate` and `"isValidOperatingSchedule"`.
- Every count of the zoneless functions moves from 85 to 86:

| Where | Before | After |
| ----- | ------ | ----- |
| File header ("There are 85") | 85 | 86 |
| List doc comment ("The 85 functions…") | 85 | 86 |
| "runs each of the 85 functions…": title, `toHaveLength`, `Set` size | 85 | 86 |
| Recorded-result rows: comment and `toHaveLength(85 * 47)` | 85 × 47 | 86 × 47 |
| Oracle A: "has two rows for each of the 85 functions", `toHaveLength(170)` | 85, 170 | 86, 172 |
| Oracle B: comment "How many of the 85…" | 85 | 86 |
| Oracle B: `reaches.map(perReach)` | `[51, 5, 14, 11, 2, 2]` | `[52, 5, 14, 11, 2, 2]` |
| Oracle B: `19 * 85 - 2 - 2 - 4 - 4 - 34` and `1569` | 1569 | `19 * 86 - …` = 1588 |
| Stored-offset candidates: `toHaveLength(83 * 30)` | 83 × 30 | 84 × 30 |

The Oracle B subtractions do not change: a `POINT` function is never left out of a zone-year
(only spans that reach a gap are), and `34` counts the functions reading beyond the instant,
which this one does not. `unobservable` stays `["getDstTransitions", "hasDaylightSaving"]`.

Search the file for `85`, `83 ` and `1569` after the edit; no stale count may remain.

## `src/test/zoneArgumentBaseline.json`

Under `"functions"`, add `"isValidOperatingSchedule"` after `"operatingTimeBetween"`, one key per
label in the same order as that entry's 47 labels. The values are derived from the rule, not
recorded from the code under test: the result is `true` exactly when the label is a zone
`isValidTimeZone` or `isValidUtcOffset` accepts, and the entry has no `more` calls, so each value
is a one-element array.

- `[true]` for the 37 accepted labels: the 20 battle-test zones, then `utc`,
  `america/new_york`, `Etc/GMT+5`, `Africa/Monrovia`, `+05:30`, `+0530`, `+05`, `-08:00`,
  `-0800`, `-08`, `+00:00`, `-00:00`, `+14:00`, `-12`, `+23:59`, `-23:59`, `Japan`.
- `[false]` for the 10 refused labels: `Invalid/Zone`, `""` (label `''` in titles), `Z`,
  `+24:00`, `+5:30`, `UTC+05:00`, `+05:30:00.5`, `-0400:30`, `(5)`, `(null)`.

Cross-check before writing: `operatingIntervals`' entry already in the file is `[]` for exactly
those 10 labels and non-empty for the other 37. If it differs, stop and report it; do not edit
the operatingIntervals entry.

## Not needed

- `noThrow`: it walks every export's `@example` corpus, so the new examples are covered without
  an edit.
- `functionObjects`, `storedOffsetValues`: the slice 1 rows hold a function-object schedule and
  the `-00:44:30` zone; no harness list there names the validators.
- Canary tags: none name an `operatingIntervals` or validator test.

## Done when

`pnpm --filter @northguild/gmt exec vitest run src/test/zoneArgument.test.ts` passes, and the
validator appears in every block of that file's verbose output (recorded results, Oracle A,
Oracle B, stored-offset candidates).
