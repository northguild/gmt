# IOT-32 — IoT: Ingest time model

**Scope:** Separating when an observation happened from when it arrived, classifying late data, and assigning observations to event-time windows.

## Gap

Devices buffer while offline and upload in bulk when connectivity returns. A single timestamp field cannot represent that: it either records when the reading was taken, in which case the pipeline cannot tell fresh data from a three-day backfill, or it records when the data arrived, in which case the reading is timestamped wrongly.

Every mature telemetry system separates the two, and GMT has no primitive for it. Downstream, "is this observation late" is a question about a watermark, and "which window does this observation belong to" is a question about event-time windowing — both temporal calculations nothing in the library supports. The governing text for both is the Dataflow Model: watermarks as a lower bound on the event times still to arrive, and three window families — fixed, sliding and session — defined over event time.

([Akidau et al., *The Dataflow Model*, PVLDB 8(12), 2015, §1.2 windowing ("Fixed windows are really a special case of sliding windows where size equals period"; sessions "defined by a timeout gap"), §1.3 watermarks ("a lower bound (often heuristically established) on event times that have been processed"), §2.2 window assignment and merging](https://www.vldb.org/pvldb/vol8/p1792-Akidau.pdf), [Apache Beam `Sessions`: "windows values into sessions separated by periods with no input for at least the duration specified by getGapDuration()"](https://beam.apache.org/releases/javadoc/current/org/apache/beam/sdk/transforms/windowing/Sessions.html))

## Scope

- `packages/gmt/src/iot/get/observation.ts`:
  - `observation(value: { observedAt: string, receivedAt: string }): { observedAt: string, receivedAt: string, lagMs: number, backfilled: boolean } | null` — The two-field pair with derived lag. `backfilled` is `true` beyond a documented threshold.
- `packages/gmt/src/iot/calculate/watermark.ts`:
  - `watermark(observations: { observedAt: string }[], options: { allowedLatenessMs: number }): string | null` — The watermark instant: everything at or before it is considered complete.
  - `classifyArrival(observedAt: string, watermark: string): 'onTime' | 'late' | 'future'` — `'future'` catches observations timestamped ahead of the watermark, which indicates a device clock error rather than early data.
- `packages/gmt/src/iot/calculate/reorderWindow.ts`:
  - `maxOutOfOrderness(observations: { observedAt: string, receivedAt: string }[]): number` — Largest observed reordering, in milliseconds, for sizing `allowedLatenessMs` empirically.
- `packages/gmt/src/iot/calculate/eventWindows.ts`:
  - `slidingWindowsFor(observedAt: string, options: { size: string, period: string, origin?: string }): Interval[]` — Every sliding window an observation belongs to (`size / period` of them). Fixed windows are the `size === period` case and are `bucketRange` (CORE-5).
  - `sessionWindows(observations: { observedAt: string }[], options: { gap: string }): { window: Interval, count: number }[]` — Gap-based sessions: each observation opens a window of length `gap`, overlapping windows merge.
  - `detectGaps(observations: { observedAt: string }[], options: { period: string, tolerance: string }): { from: string, to: string, missed: number }[]` — Runs of missing samples in a series that should tick every `period`.

## Design notes

- **`observedAt` and `receivedAt` are both required.** Deriving one from the other is what this story exists to prevent. `lagMs` is derived and may legitimately be large.
- **`'future'` is a distinct classification, not a variety of late.** An observation timestamped after the watermark is almost always a device clock problem — the failure IOT-30 and IOT-31 exist to diagnose — and collapsing it into "on time" hides a real fault.
- **A watermark is a completeness heuristic, not a guarantee.** Data can always arrive later than allowed lateness. The JSDoc must say so; treating a watermark as a correctness boundary is the standard downstream mistake.
- **Window assignment is time math; aggregation is not.** Which windows an observation falls in is deterministic from its `observedAt` and the window definition, and consumers get it wrong by hand (an observation at a period boundary belongs to `size / period` sliding windows, not one). What happens to the values inside a window stays with the consumer.
- **Session merging is `mergeIntervals` with a gap.** It composes with CORE-6 rather than re-implementing overlap, so a session boundary cannot disagree with every other interval in the library.
- **`detectGaps` reports, never fills.** A missed sample is a fact about the series; interpolating it would be an invented quantity.
- `receivedAt` should come from a trusted clock, typically the ingest server's. Documented, not enforced.

## What gmt provides (do not re-implement)

- `spanMs` from CORE-2 — lag calculation
- `bucketRange` / `floorToZone` from CORE-5 — fixed windows and zone-aware day buckets
- `clockOffset` from IOT-30 — correcting `observedAt` from a known-skewed device
- `intervalContains` / `mergeIntervals` from CORE-6 — window membership and session merging

## Verification

- `observation` computes `lagMs` as `receivedAt − observedAt`
- A three-day buffered upload returns `backfilled: true`
- `lagMs` is negative when a device clock runs ahead, and this does not throw
- `watermark` over an empty list returns the sentinel
- `classifyArrival` returns `'late'` for an observation before the watermark and `'onTime'` for one after
- An observation timestamped after the watermark returns `'future'`, not `'onTime'`
- `maxOutOfOrderness` returns `0` for a strictly ordered stream
- `slidingWindowsFor` with `size: 'PT1M', period: 'PT20S'` returns three windows, each containing the observation, and returns one window when `size === period`
- `sessionWindows` merges two observations 4 minutes apart under a 5-minute gap into one session and keeps them apart under a 3-minute gap
- `detectGaps` on a one-per-minute series with one missing sample returns one gap with `missed: 1`; a sample 10 seconds late inside the tolerance is not a gap
- `pnpm run validate` stays green
