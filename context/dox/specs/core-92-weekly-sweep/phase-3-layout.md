---
story: CORE-92
status: draft
---

# Phase 3 — product fixes P6–P8: load growth, jumps, table fit (M)

Same rules as [Phase 2](./phase-2-product.md): red first, Firefox through the Phase 0 route,
and the frame repro command given there.

## P6 — observance-comparator's matrix grows about 6,000 px at load (M)

- **`families/holiday/compare-matrix.ts`.** When there is no model, `compareMatrix` lays out
  `bodyRows` × `holidays` placeholder blocks at the loaded block's size.
  - The placeholders are `aria-hidden`, and the region is `aria-busy="true"` until loaded.
  - Use the kit `loading` builder for the visible status if its options fit. If they do not,
    raise it as a kit addition.
  - The GNSS checker's server skeleton is the precedent ([built.md](../../built.md)).
- **`lib/observance-comparator-mount.ts`.**
  - The server render (line 431) passes the default holiday list and `MAX_YEARS`, so the
    skeleton has the loaded default's row count.
  - Line 594 replaces it inside `grow()`, as it does now.
- **Test, `compare-matrix.test.ts`.** The skeleton's row and block counts equal those of the
  default model built from the real holiday list. Derive the counts; do not type them in.
- **Red-first:** run the frame repro with `<slug> observance-comparator`, `<w> 390`, and `<b>` set
  to `chromium`, then `firefox`, then `webkit`. Before the fix, the jumps are 1834, 2703 and 2032.

## P7 — 56–100 px load and interaction jumps (M; may split)

Run the frame repro for each row below. Before any change, record the frame, the element and
`document.fonts.status`.

| Page | Engine | Width | Was |
|---|---|---|---|
| connection-checker | chromium, firefox, webkit | 390 | 58, 77, 58 ("The handoff") |
| demurrage-clock | firefox | 390 | 100 (`<main>`) and 61 |
| timetable-reader | firefox | 390 | 79, frame 3 |
| x12-time-reader | firefox, webkit | 390, 1440 | 59 (frame 2), 65 |
| elapsed-vs-clock-difference | firefox | 1440, 390 | 64, 62 |
| bl-date-stamp, free-time-ledger, id-timestamp-decoder | firefox | 390 | 59, 59, 56 |
| duration-parser-bench | webkit | 390 | 59 |
| holiday-rule-builder | webkit | 1440, 390 | 64 ("Rules", interaction) |
| cutoff-countdown | chromium | 390 | 58 ("Late or on time", interaction) |
| check/morocco-2026-clock-change | firefox | 390 | 80, frame 3 (measure again after Canada) |

- **A late writer outside `grow()`.** Wrap the write in `grow()`, or reserve its box with
  `hold`.
- **A font swap, where `fonts.status` is `loading`.** Follow `built.md`'s font rules for the
  face named. If they do not cover the case, preload it. If it still jumps, stop and report to the
  architect. Do not raise the 48 px limit.
- **The Morocco page.** If Canada already fixed it, close it with the green run. Otherwise fix it
  here.

## P8 — tables scroll sideways in WebKit at 1440 (S)

- **`widgets/tools/timetable-reader.module.css:79` `.chip`.** Inside a table cell, the chip wraps
  at spaces: `white-space: normal; overflow-wrap: normal`. It never breaks mid-word.
- **`migrate/date-fns`.** The fix is layout only (owner question 2).
  - Change `migrate-table.css` so the note column fits the 240 px token
    `ZonedDateTime.prototype.equals` within 770 px.
  - The token never breaks at a `.` ([`code-break.ts`](../../../../apps/dox/src/lib/code-break.ts)
    rule). The note text does not change.
- **Red-first:**

  ```bash
  pnpm --filter dox gates --only table-fit --browsers webkit,chromium,firefox --pages /tools/timetable-reader/,/migrate/date-fns/
  ```
