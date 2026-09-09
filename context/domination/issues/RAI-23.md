# RAI-23 — Rail: Dwell, running time and shunting windows

**Scope:** Station dwell, minimum technical stops and marshalling-yard scheduling.

## Gap

Rail operations distinguish running time between stations, dwell while stopped, and technical stops required for operational reasons regardless of passenger demand. Yard operations need to know whether a sequence of shunting moves fits an available window.

## Scope

- `packages/gmt/src/rail/calculate/stationDwell.ts`:
  - `stationDwell(arrival: string, departure: string, options?: { minimumDwell?: string }): { dwell: string, dwellMinutes: number, meetsMinimum: boolean } | null` — Dwell at a station, optionally checked against a minimum technical stop.
- `packages/gmt/src/rail/calculate/shuntingWindow.ts`:
  - `shuntingWindow(available: Interval, operations: { name: string, duration: string }[]): { earliestStart: string, latestStart: string, feasible: boolean, slack: string } | null` — Whether a sequence of moves fits, and how much slack remains.

## Design notes

- **Dwell is returned as both an ISO duration and whole minutes.** Timetables are published in minutes; operational analysis needs the exact duration. Returning only minutes, as the original spec did, discards information that the caller cannot recover.
- **`minimumDwell` is a parameter, not bundled data.** Minimum dwell depends on rolling stock, platform, boarding mode and operator, and no per-station table would be correct.
- `shuntingWindow` assumes operations are sequential and non-overlapping. Parallel moves are a routing problem, not a time-math problem, and are out of scope — consistent with the epic's rule that GMT does time, not optimisation.
- `slack` is returned rather than only a boolean, because "fits with four minutes to spare" and "fits with two hours to spare" are operationally different answers.

## Corrections

The original RAI-2 specced `uicDwellTime(arrival, departure, station): number` and cited **"UIC 9602 — Rail running time and dwell time"** as its authority, with a `## UIC 9602` section describing running time, dwell time and technical stops.

**That citation does not verify.** Repeated searching found no UIC leaflet 9602, and the number does not fit UIC's scheme, which uses three digits with optional sub-numbers (`406`, `451`, `920-9`, `912-3`). It appears to have been invented. The function has been renamed to `stationDwell` to remove the false authority, and the `station` parameter dropped — it was unused, since dwell is arrival to departure regardless of where.

The verifiable UIC reference in this area is the **UIC 406 capacity leaflet**, which covers blocking time, dwell and capacity consumption via timetable compression.
([UIC 406 method](https://www.witpress.com/Secure/elibrary/papers/CR08/CR08006FU1.pdf))

Do not reintroduce a "UIC 9602" citation without a primary source.

## What gmt provides (do not re-implement)

- `spanMs` from CORE-2 — dwell duration
- `dwellTime` from TRAN-8 — the general dwell shape
- `sumIntervals` / `clampInterval` from CORE-6 — fitting operations into a window
- `addDuration` — sequencing moves

## Verification

- `stationDwell` returns matching ISO duration and whole minutes for a known arrival/departure pair
- Sub-minute dwell returns a non-zero duration and `dwellMinutes: 0`
- `meetsMinimum` is `false` when dwell is shorter than `minimumDwell`
- `shuntingWindow` returns `feasible: true` with correct slack when operations fit exactly
- Operations exceeding the window return `feasible: false`
- An empty operations list returns the full window as slack
- Inverted arrival/departure returns the sentinel
- `pnpm run validate` stays green
