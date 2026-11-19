---
story: DOX-G13
issue: 535
status: approved
dox: none
---

# DOX-G13 · PTP Clock Converter: a preset inside the 2016 leap second

Add one read preset to `/tools/ptp-clock-converter/`: the PTP count stamped at the start of the
second inserted at the end of 2016-12-31. Read with offset 36 it is 2017-01-01T00:00:00Z, where
the table says 37; read with 37 it is 2016-12-31T23:59:59Z, where the table says 36. Either way the
check says the offset is 1 s out. This shows the page's note "it can be one second out within a
second of a step" on the page itself, not only in prose.

Site work in `apps/dox` only: no `packages/gmt` change, no changeset, no new Dox tool, no new
WebMCP argument, no new kit piece. Raised in review of #532.

## Decisions (verified in the slice)

- **The count is `{ seconds: 1483228836n, nanoseconds: 0 }`**, the record the IoT PTP guide
  already uses ("A record stamped during the inserted second of 2016-12-31, read with the correct
  offset of `36`, shows it") and that `ptpToUtc.test.ts` pins as "inserted second on the new
  offset, no :60". One record across the guide, the library tests and the tool.
- **It is inside the inserted second, not after it.** The issue says "just after". A count at or
  after the step (`seconds ≥ 1483228837`) does not show the note: read with 37 it matches the
  table, and read with 36 it is correctly 1 s out. Only a count in `[1483228836, 1483228837)`
  makes the table disagree with both 36 and 37. The arithmetic is in the slice.
- **One preset, offset 36.** The tool already reads the same count with the table's offset: at
  offset 36 the "Table reading" plate is `ptpToUtc(record, 37)` = `2016-12-31T23:59:59Z`. So one
  preset puts both readings on screen. The mirror case, offset 37 with the table saying 36, is a
  text permalink in the page's prose, not a second preset. A second preset would add an option
  that only repeats the first one's plates in reverse. 36 is also the offset the guide calls
  correct here.
- **The preset is appended last.** `webmcp/parity-readers.test.ts` reads `READ_PRESETS` by
  position (indexes 0, 4, 5), so inserting a preset earlier would quietly change what that test
  checks.

## Scope

| Surface | Change |
| --- | --- |
| `ptp-clock-presets.ts` | One `ReadPreset`, `leap-2016`, appended |
| Tool page prose (`tools/ptp-clock-converter.mdx`) | Two sentences in **The check**, two links in **Worth trying** |
| IoT PTP guide (`guides/industries/iot-ptp-time.mdx`) | The words "shows it" link to the preset; no other change |
| Pure test, prose test, holds test | Cover the preset (the slice says how) |
| WebMCP tool `convert_ptp_timestamp` | **None.** Its input has no `preset` key and its example is `READ_PRESETS[0]` |
| Dox chat (`showPtpClockConverter`, `CHAT_STARTERS`) | **None.** No `preset` argument, and the starter is the page's own default example |
| Mount (`ptp-clock-converter-mount.ts`) | **None.** `presetOptions(READ_PRESETS)` lists the new option |
| `readout-still` row (`scripts/readout-still.mjs`) | **None.** `presets` there are the two base states the typed values start from |

## Files

Modify (all under `apps/dox/`):

- `src/lib/ptp-clock-presets.ts`
- `src/lib/ptp-clock-converter.test.ts`
- `src/lib/ptp-clock-converter-prose.test.ts`
- `scripts/ptp-clock-converter-holds.browser.test.ts`
- `src/content/docs/tools/ptp-clock-converter.mdx`
- `src/content/docs/guides/industries/iot-ptp-time.mdx`

Create: none. Delete: none.

## Slices

One PR, one slice.

| # | Slice | What the reader sees |
| --- | --- | --- |
| 1 | [The leap-second preset](./s1-leap-preset.md) | "Inside a leap second" in the Preset list. Picking it shows the offset at 36, the table at 37, the table reading `2016-12-31T23:59:59Z` and "Offset differs from the table by 1 s". The prose and its links show the mirror reading at 37. |

## Conflicts and dependencies

- **DOX-G11 (sound, #515):** no conflict. Its tool cues live in kit pieces (`readout`, `handle`,
  `widget-mount.ts`, the combobox and listbox step); the PTP tool's own files have no sound code,
  and the slice adds none. Picking a preset fills the boxes by script, and G11 keeps
  script-set values silent. The new preset reads without a refusal, so the `readout` NO SIGNAL
  `error` cue never fires for it. Re-check this only if G11 lands an edit to a PTP file first.
- **Tracker drift (record only, do not fix here):** `tracker.md` row 28 says DOX-G11 `Todo`, but
  #549 (`458860e7`) merged the sound work, and the G11 slice-6 hooks are already in
  `readout.ts`, `handle.ts` and `widget-mount.ts`. Whoever closes G11 should reconcile the row.
- **Blocked by:** nothing.

## Close-out

- `context/dox/built/tier-2-tools.md`: no rule changes, so no edit unless the tester finds a
  sentence that no longer holds. The new preset is a value, not a rule.
- `tracker.md`: row 30 → `Done` when merged, then `pnpm deps:sync`. That is the finalizer's job,
  not the builder's.
