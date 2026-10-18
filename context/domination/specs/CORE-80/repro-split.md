# Slice 3 — Canary-only repros out of shipped bundles

Read with [index.md](./index.md). Story scope part 3. No output changes; `pnpm compat:oracle`
must exit 0 after this slice (story verification: any change under `internal/temporalCompat/`).

## Today

- `internal/temporalCompat/repros.ts` (1,030 lines) holds every repro and exports one table,
  `repros` (line 960), plus `findRepro` (line 1019).
- `capabilities.ts:1` imports that whole table, so every function that reaches a calendar or zone
  workaround carries all of it: 12.0 kB minified in the `businessDaysBetween` and
  `addBusinessDays` bundles (slice 1 baselines).
- The shipped probes read only the defects `isDefectPresent` and the `is…CompatNeeded` gates ask
  about: D1–D8 and D10–D13. Nothing in shipped code reads `zoned.A`, `zoned.B`, `zoned.D`,
  `zoned.E` or `D9` (verified: no `isDefectPresent` call or gate names them). Those groups exist
  for `scripts/temporal-compat.mjs` (`check`, `snapshot`, `oracle`) and
  `capabilities.test.ts`.

## Change

Split by who reads the repro, keeping the file the canary loads where it is:

| File | Holds | Imported by |
| ---- | ----- | ----------- |
| `temporalCompat/probeRepros.ts` (new) | Types `DefectId`, `Repro`; the D1–D8 and D10–D13 groups and every helper they use (`readFields`, `fieldsToIso`, `extremeDateRows`, `readRepro`, `monthTotal`/`monthRound`/`monthUntil`/`monthsUntil`, `zoned`, `zonedRepro`, `thrownErrorName`, `zonedStringEpoch`, `withBoundedOffsetReads`, the D13 constants); exports `probeRepros` | `capabilities.ts` |
| `temporalCompat/repros.ts` (kept) | Types `ZonedDefectId`, `BoundedWorkDefectId`; the `zoned.A`, `zoned.B`, `zoned.D`, `zoned.E` and `D9` groups with their own helpers (`withBoundedIntlReads`, the D9 constants, `SYDNEY_NEAR_MAX`, `SANTIAGO_LAST_TRANSITION`, `MANILA_CROSSING`); exports `repros` (the full table) and `findRepro` | `scripts/temporal-compat.mjs` (via `dist`), `capabilities.test.ts` |

- `repros.ts` imports from `probeRepros.ts`, never the reverse. The full `repros` table keeps
  **exactly today's order** (`d9`, `zoned.A`, `zoned.B`, `zoned.D`, `zoned.E`, `d1`,
  `d1Arithmetic`, `d1RelativeTo`, `d10`, `d12`, `d13`, `d6`, `d7`, `d7LeapMonthEnd`, D2, D3, D4,
  D5, D8): the canary groups results by workaround in table order, and `snapshot --check`
  compares its output. Build it by splicing the probe groups in their old positions, so
  `probeRepros` must export the groups individually (or as a record by group) for `repros.ts` to
  place them.
- `capabilities.ts` reads `probeRepros` wherever it read `repros`. A defect id from the canary-only
  set is not a `DefectId`, so the type system already stops a probe from asking about one.
- `scripts/temporal-compat.mjs` keeps loading `dist/internal/temporalCompat/repros.js`; no path
  changes. Update the retirement hints that say "in repros.ts" for a probe defect (lines 68, 137,
  155 and any other) to name `probeRepros.ts`.
- `temporalCompat/README.md`: update where it says which file holds a defect's repros, and add
  one line on the rule: a repro the shipped probes do not read lives in `repros.ts`, which no
  shipped module imports.
- Comments in `zonedWallClock.ts:34` and `zonedWallClockDifference.ts:90` that cite
  `temporalCompat/repros.ts`: point each at the file that now holds the group it means
  (`zoned.*` stays in `repros.ts`; check each one).

The story's "each probe imports only its own repros" is not taken further than this split:
`isDefectPresent(defect, calendar)` takes the defect as a value, so a per-defect module split
would need one exported gate per defect and buys at most the probe table's own few kB. Record
the probe table's measured share from `pnpm size --files addBusinessDays` in the handoff; slice
6 is expected to remove calendar arithmetic, and with it the whole compat layer, from the
`addBusinessDays` bundle.

## Size gate

Add to `scripts/bundle-size.budgets.json` (slice 1):

```json
"absent": { "addBusinessDays": ["src/internal/temporalCompat/repros.ts"],
            "businessDaysBetween": ["src/internal/temporalCompat/repros.ts"] }
```

## Tests

- `capabilities.test.ts` keeps importing `findRepro` and `repros` from `./repros` and passes
  unchanged: the table is the same table.
- Add one row-based guard in `capabilities.test.ts`: every repro in `repros` whose defect is a
  `DefectId` is in `probeRepros`, and `probeRepros` holds no `zoned.*` or `D9` repro. Expected
  values come from the type definitions, not from running anything.
- `pnpm build && node scripts/temporal-compat.mjs check` prints the same groups, pass counts and
  verdicts as before the split; `snapshot --check` passes; `pnpm compat:oracle` exits 0.

## Done when

- `pnpm size` shows no `repros.ts` input in the `addBusinessDays` or `businessDaysBetween`
  bundles, and the size check enforces it.
- `rg 'from "\./repros"' packages/gmt/src --glob '!*.test.ts'` matches nothing.
- Canary output, snapshot and oracle unchanged.
