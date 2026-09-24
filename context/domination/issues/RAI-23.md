# RAI-23 — Rail: Dwell, running time, blocking time and shunting windows

**Scope:** Station dwell, minimum technical stops, blocking-time occupation and marshalling-yard scheduling.

## Gap

Rail operations distinguish running time between stations, dwell while stopped, and technical stops required for operational reasons regardless of passenger demand. Capacity analysis adds a fourth quantity: the **blocking time** during which a block section is occupied by one train and unavailable to any other — the sum of several named components that begin before the train enters the section and end after it has cleared it — and the headway between two trains is the requirement that their blocking-time intervals on shared sections do not overlap. Yard operations need to know whether a sequence of shunting moves fits an available window.

## Scope

- `packages/gmt/src/rail/calculate/stationDwell.ts`:
  - `stationDwell(arrival: string, departure: string, options?: { minimumDwell?: string }): { dwell: string, dwellMinutes: number, meetsMinimum: boolean } | null` — Dwell at a station, optionally checked against a minimum technical stop.
- `packages/gmt/src/rail/calculate/blockingTime.ts`:
  - `blockingTime(occupationStart: string, components: { name: string, duration: string }[]): { interval: Interval, total: string, byComponent: { name: string, interval: Interval }[] } | null` — The occupation interval of a block section from an entry reference instant and the caller's named components in order (set-up, sighting, approach, running, clearing, release — whatever the caller's capacity method names them).
  - `blockingConflicts(occupations: { train: string, section: string, interval: Interval }[]): { section: string, trains: [string, string], overlap: Interval }[]` — Every pair of trains whose blocking times on the same section overlap; empty when the timetable is conflict-free.
  - `minimumHeadway(leading: { section: string, interval: Interval }[], following: { section: string, interval: Interval }[]): string` — The smallest shift of the following train that removes every overlap.
- `packages/gmt/src/rail/calculate/shuntingWindow.ts`:
  - `shuntingWindow(available: Interval, operations: { name: string, duration: string }[]): { earliestStart: string, latestStart: string, feasible: boolean, slack: string } | null` — Whether a sequence of moves fits, and how much slack remains.

## Design notes

- **Dwell is returned as both an ISO duration and whole minutes.** Timetables are published in minutes; operational analysis needs the exact duration. Returning only minutes, as the original spec did, discards information that the caller cannot recover.
- **`minimumDwell` is a parameter, not bundled data.** Minimum dwell depends on rolling stock, platform, boarding mode and operator, and no per-station table would be correct.
- **Blocking-time components are the caller's, named by the caller.** The blocking-time model is the UIC's capacity method (UIC Leaflet 406, *Capacity*, 2nd edition, 2013, 56 pp.), which is a paid publication; its text was not available to this spec, and GMT does not paraphrase a standard it cannot quote. The arithmetic — a sequence of named durations from a reference instant, then interval overlap between trains — is generic, and the caller who holds the leaflet supplies the component names and values. The JSDoc cites the leaflet by title and edition and says exactly this.
- **Conflicts are interval intersections and nothing more.** `blockingConflicts` composes CORE-6's `intersectIntervals` per section; it does not schedule, re-time or choose — that is the timetabling tool's job. `minimumHeadway` is the one derived number, because "how far apart must these two trains be" is the question every conflict raises and is pure interval arithmetic.
- `shuntingWindow` assumes operations are sequential and non-overlapping. Parallel moves are a routing problem, not a time-math problem, and are out of scope — consistent with the epic's rule that GMT does time, not optimisation.
- `slack` is returned rather than only a boolean, because "fits with four minutes to spare" and "fits with two hours to spare" are operationally different answers.

## Corrections

The original RAI-2 specced `uicDwellTime(arrival, departure, station): number` and cited **"UIC 9602 — Rail running time and dwell time"** as its authority, with a `## UIC 9602` section describing running time, dwell time and technical stops.

**That citation does not verify.** Repeated searching found no UIC leaflet 9602, and the number does not fit UIC's scheme, which uses three digits with optional sub-numbers (`406`, `451`, `920-9`, `912-3`). It appears to have been invented. The function has been renamed to `stationDwell` to remove the false authority, and the `station` parameter dropped — it was unused, since dwell is arrival to departure regardless of where.

The verifiable UIC reference in this area is the **UIC 406 capacity leaflet** ([UIC shop listing, 2nd edition, 2013](https://shop.uic.org/en/40-general-organisation-of-operations/492-capacity.html)). A previous revision of this spec listed its blocking-time components from secondary papers; that list is removed, because the leaflet's own text was not reached and a paraphrase from secondary sources is not a citation. The components are now the caller's input.

Do not reintroduce a "UIC 9602" citation, or a UIC 406 component list, without the primary text.

## What gmt provides (do not re-implement)

- `spanMs` from CORE-2 — dwell duration
- `dwellTime` from TRAN-8 — the general dwell shape
- `sumIntervals` / `clampInterval` / `intersectIntervals` / `mergeIntervals` from CORE-6 — fitting operations into a window and finding blocking-time overlaps
- `addDuration` — sequencing moves and components

## Verification

- `stationDwell` returns matching ISO duration and whole minutes for a known arrival/departure pair
- Sub-minute dwell returns a non-zero duration and `dwellMinutes: 0`
- `meetsMinimum` is `false` when dwell is shorter than `minimumDwell`
- `blockingTime` with five named components returns an interval whose length is their sum and `byComponent` intervals that abut in order
- `blockingConflicts` on two trains whose occupations of the same section overlap by 40 seconds returns one conflict with that overlap; on different sections it returns none
- `minimumHeadway` returns the shift that makes the following train's first conflicting occupation start exactly at the leading train's release, and `PT0S` when there is no conflict
- `shuntingWindow` returns `feasible: true` with correct slack when operations fit exactly
- Operations exceeding the window return `feasible: false`
- An empty operations list returns the full window as slack
- Inverted arrival/departure, or a component with a negative duration, returns the sentinel
- `pnpm run validate` stays green
