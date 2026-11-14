# CORE-112 slice 6 — tests and expected values

Read with [index.md](./index.md). House rules: [testing standards](../../../testing-standards/references/index.md).

## Rules for these tests

1. **Expected years come from Temporal**, never from the engine or the guard:
   `Temporal.PlainDate.from(iso).withCalendar(cal)`, `eraYear` when the pattern has an era (japanese,
   roc, buddhist, `era` option), else `year`; written in the numbering system's digits
   (`Intl.NumberFormat(…, { numberingSystem, useGrouping: false })`). Each row cites
   ECMA-402 FormatDateTimePattern (`numeric` / `2-digit`) as its authority.
2. **No test process calls a parts or range-parts method on a native formatter that might hold
   `Y`.** On an unfixed V8 that kills the whole Vitest worker. Tests call public GMT functions
   (guarded), or native `format` / `formatRange` only.
3. **Abort repros run only in a child process** (`spawnSync(process.execPath, ["--input-type=module",
   "-e", src])`, importing the built-from-source module through the test's own resolver, or
   asserting on the native call alone). Assert exit status 133 or 0 as the row says.
4. Rows whose *native* text is quoted are engine-data facts of Node 26.12.1 / CLDR 48.0: assert
   GMT's output only. Do not assert the native wrong text (it changes when CLDR is fixed, and the
   expected value does not).
5. Browser legs run the same files: rows hold on every engine because the expected value is
   ECMA-402's, not the engine's.

## Single-date matrix (`formatDate`-family and `…ToParts`; UTC)

| Locale | Options | Date | Native today (Node 26.12.1) | Expected from GMT |
| --- | --- | --- | --- | --- |
| gd | `{ year: "numeric", month: "short" }` | 2024-12-30 | `Dùbh 2025` | `Dùbh 2024` |
| gd | same | 2027-01-01 | `Faoi 2026` | `Faoi 2027` |
| gd | same (control) | 2025-07-01 | `Iuch 2025` | `Iuch 2025` |
| ksh | `{ year: "numeric", month: "numeric" }` | 2024-12-30 | `2025-12` | `2024-12` |
| ksh | same | 2027-01-01 | `2026-01` | `2027-01` |
| ksh | `{ year: "2-digit", month: "2-digit" }` | 2024-12-30 | `25-12` | `24-12` |
| sc | `{ year: "numeric", month: "numeric" }` | 2024-12-30 | `12/2025` | `12/2024` |
| sc | same | 2027-01-01 | `01/2026` | `01/2027` |
| te-u-ca-buddhist | `{ year: "numeric", month: "long" }` | 2026-07-01 | `జులై 2026` | `జులై 2569` |
| te-u-ca-buddhist | same | 2026-12-31 | `డిసెంబర్ 2027` | `డిసెంబర్ 2569` |
| my-u-ca-japanese | `{ year, month, day: "numeric" }` | 2026-07-01 | `R ၀၁/၀၇/၂၀၂၆` | `R ၀၁/၀၇/၈` |
| my-u-ca-japanese | `{ year, month, day: "2-digit" }` | 2026-07-01 | `R ၀၁/၀၇/၂၆` | `R ၀၁/၀၇/၀၈` |
| my-u-ca-japanese | `{ year, month, day: "numeric" }` | 2024-12-30 | `R ၃၀/၁၂/၂၀၂၅` | `R ၃၀/၁၂/၆` |
| my-u-ca-buddhist | `{ year, month, day: "numeric" }` | 2026-07-01 | `BE ၀၁/၀၇/၂၀၂၆` | `BE ၀၁/၀၇/၂၅၆၉` |
| de-CH | `{ era: "short", year, month, day: "numeric", weekday: "short" }` | 2024-12-30 | `Mo., 12.30.2025 n. Chr.` | `Mo., 12.30.2024 n. Chr.` (only the year changes) |
| gl-u-ca-hebrew | `{ dateStyle: "full" }` | 2026-09-12 | `sábado, 1 de Tishri de 5786 AM` | `sábado, 1 de Tishri de 5787 AM` |
| gl-u-ca-hebrew | same | 2026-09-13 | `domingo, 2 de Tishri de 5786 AM` | `domingo, 2 de Tishri de 5787 AM` |
| gl-u-ca-roc | `{ dateStyle: "full" }` | 2026-07-01 | `mércores, 1 de xullo de 2026 ROC` | `mércores, 1 de xullo de 115 ROC` (unpadded) |
| gd | `{ year: "numeric", month: "short", hour: "numeric", minute: "numeric" }` | 2024-12-30T14:05 | `Dùbh 2025, 14:05` | `Dùbh 2024, 14:05` |

For each row, through the matching `…ToParts` function: the joined values equal the expected
text, exactly one part has `type: "year"`, its value is the expected year, and no part has type
`unknown`. gd row 1 parts: `[{ month, "Dùbh" }, { literal, " " }, { year, "2024" }]`.

Dormant controls (the guard returns the native formatter; assert identity in a unit test of
`guardDateTimeFormat`, and unchanged output through the public function): `en`, `de`, `fr`,
`ja-u-ca-japanese`, `zh-u-ca-chinese` with `{ year: "numeric", month: "long" }`; `en` with
`{ dateStyle: "full" }`; any locale with `{ hour, minute }` or `{ month, day }`.

## Abort rows (child process, Node only; skip on browser legs)

| Call | Today | After |
| --- | --- | --- |
| `formatZonedRange("2026-07-01T09:30:00+06:30[Asia/Yangon]", "2026-07-04T09:30:00+06:30[Asia/Yangon]", "my-u-ca-buddhist", { hour: "numeric", minute: "numeric", timeZoneName: "long" })` | exit 133 | exit 0, a non-empty string whose two zone names are the `long` ones from `formatZonedToParts` at each end |
| `formatCalendar("2026-07-01T10:00:00", "gl-u-ca-hebrew", { reference: "2026-07-01T09:00:00" })` | exit 133 | exit 0, non-empty |
| same with `gl-u-ca-buddhist`, `gl-u-ca-roc` | exit 133 | exit 0 |
| `formatDateToParts` over all single-matrix rows | exit 133 (unfixed V8) | exit 0 |
| native `new Intl.DateTimeFormat("gd", { year: "numeric", month: "short", timeZone: "UTC" }).formatToParts(0)` | exit 133 | exit 133 while V8 is unfixed (this row is the D23 repro's confirmation; it flips on a fixed V8, and the canary, not the test, reports that) |

## D16 string repair (`repairRangeText.test.ts`, pure)

- `ca !== cb`: `"28 Mar 2026, 12:00 GMT – 30 Mar 2026, 12:00 BST"`, carrier `[GMT, BST]`, wanted
  `[Greenwich Mean Time, British Summer Time]` → each replaced on its own side.
- `ca === cb`, two hits → first `wa`, second `wb`; one hit → `wa`; zero or three hits → `null`.
- Containment: carrier `["GMT", "GMT+1"]` in `"… GMT – … GMT+1"` → `GMT+1` matched as a whole.
- `ca` or `cb` undefined → `null`.
- Every existing `formatZonedRange` row passes unchanged (the 379,200-case equivalence is the
  reason; the rows are the guard).
- With both D16 and D17 gates stubbed on, the parts merge handles both (range.md 3b).

## Guard units (`weekYearGuard.test.ts`)

From [guard.md](./guard.md) § Edge cases: step-0 short-circuit (spy), one verdict per key across
default-locale constructions, cache cleared when `Intl.DateTimeFormat` is replaced, crash-signal
truth table on stubbed `resolvedOptions` (`year` undefined + gregory → on; + chinese → off;
`dateStyle` → off), guarded `resolvedOptions().year` filled for component options, guarded
`formatRangeToParts` throws `TypeError`.

## Synthesis units (`weekYearSynth.test.ts`)

- The tie-break: a stub where two twins give the same text for two field types at the first
  template date and different texts at the second → the second date's template is used.
- No answer at any template date → `null` → the public `…ToParts` returns `[]`.
- Parts join to the repaired text for every single-matrix row.

## Source rule

`weekYearSource.test.ts` as in [call-sites.md](./call-sites.md).

## Bench rows

The verdict is per formatter key, not per call. Add to `packages/gmt/bench/formatDate.bench.ts`:
`formatDate gd first call` (verdict + format) and `formatDate gd cached` (guarded format only),
plus `formatDate en cached` to show the dormant path unchanged. Target: dormant path within noise
of today; guarded cached `format` under 2× native `format`.
