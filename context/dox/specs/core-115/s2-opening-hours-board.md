# Slice 2: Opening Hours Board

Part of [CORE-115 (Dox)](./index.md). Page: `/tools/opening-hours-board/`. Widget kind `hours`.
Mount `mountOpeningHoursBoard`. Industry `core`. It depends on slice 1's shared pieces.

**The working surface for the six operating functions.** The reader builds a schedule in a
structured editor and sees one local week of open intervals drawn on real-length day columns.
Two handles, "From" and "To", set the readings:

- `isOpenAt` at From.
- `nextOpenAt` and `nextCloseAt` after From.
- `operatingTimeBetween` from From to To.
- `addOperatingTime` of a typed duration from From.

A schedule the library refuses shows "Schedule refused" over every reading, never "closed". The
rows `probeScheduleParts` names are marked, and a link opens the same schedule in the Checker.

## Reuse (slice 1 and existing)

`loadHoursLib`, `probeScheduleParts`, `operatingScheduleTextSchema`, the `schedule` permalink key
and `src/data/operating-schedule-presets.ts` come from slice 1, unchanged. The Board shows only
presets marked for it: a preset gains a `tools` field. The weekday-8 preset is Checker-only,
because the editor has no eighth weekday row.

From the ledger family and the kit: `LedgerCanvas` and `dayCells` (`src/lib/dwell-ledger.ts`),
`ledgerFrame`, `ledgerLane`, `ledgerBar`, `ledgerGate`, `ledgerHandles`, `ledgerAxis`,
`dayColumns`, `handoffLink`, `handle`, `plates`, `verdict`, `hold`, `field`, `textInput`,
`textArea`, `select`, `button`, `codeFrame`, `copy` and `preset`.

- **Extend, do not copy, `ledgerBar`.** Today the mount places one bar through
  `--gmt-bar-from` / `--gmt-bar-to`. Give `ledgerBar` optional `from` and `to` percents, so that
  several bars can sit on one track. Existing callers keep working unchanged, and the test pins
  both forms. Each open interval is one bar, named in words ("Open Mon 17 Jun 09:00 to 18:00
  local").
- **Lift `dateInput`** to `src/widgets/builders/` with a plain `mv`, export it, and rewrite the
  two imports in `bl-date-stamp-mount.ts` and `free-time-ledger-mount.ts`.
- If `dayCells` or `LedgerCanvas` turn out to carry dwell-specific content, first move the
  neutral part to `src/lib/day-canvas.ts` and keep `dwell-ledger.ts` re-reading it
  ([rule 2](../../built/index.md#reuse-never-reinvent)). Never copy the loop.

## New family piece: the window editor

`src/widgets/families/hours/window-rows.ts` (+ `.module.css`, test) is one piece with two users,
the weekday rows and the override rows. `windowRows({ id, label, windows, refused })` writes
a group named by `label` ("Monday", "Override 2"). Its contents:

- Each window is a pair of `textInput`s ("Monday window 1 from", "… to"), as typed and never
  repaired, plus a "Remove" `button`.
- One "Add window" `button`.
- A refused marker. It is words ("Refused on its own"), and the window or row also gets a full
  bevelled border in the signal tone. It is never a left edge alone.

The list's row count follows the preset, so it carries `data-grow="slot"`
([tier-2-tools](../../built/tier-2-tools.md#rules-for-every-tool), grow rule). It uses native
buttons and inputs only, with no custom widget, so no APG pattern applies beyond the native
controls'. Focus after Remove goes to the next window's "from" field, else to "Add window".

## Feature files

| File | Holds |
| --- | --- |
| `src/lib/opening-hours-editor.ts` (+ test) | Pure, no DOM. `scheduleFromEditor(state): object` builds the schedule from the fields, exactly as typed. A weekday with no windows is left out, a blank holidays area leaves `holidays` out, and no override rows leave `overrides` out. An override with no windows is `windows: []`. `editorFromSchedule(value: unknown): { kind: "fits"; state } \| { kind: "does-not-fit" }` reads the shape only (weekday keys `"1"`–`"7"`, strings, arrays of `{ from, to }`, a date-string list, an override list). It never decides validity. `rowOfPart(path)` maps a probe path to an editor row. |
| `src/lib/opening-hours-board.ts` (+ test) | Pure facts. `boardFacts(lib, input)` returns `BoardFacts` (below). It is the one function the mount and the WebMCP tool call. |
| `src/lib/opening-hours-board-mount.ts` (+ `.test.tsx`) | Template and wiring, under 400 lines. If it grows past that, split the editor wiring into `opening-hours-editor-mount.ts`. |
| `src/widgets/tools/opening-hours-board.module.css` | Layout only, plus forced-colours rules. |
| `src/components/OpeningHoursBoard.astro` | The shell, written as in slice 1. |
| `src/content/docs/tools/opening-hours-board.mdx` | `ToolLayout`. Keypoint: "Closed and refused are different answers." The intro links the six reference pages, the guide and the Checker. |
| `src/lib/webmcp/tools/opening-hours-board.ts` | Page tool; calls `boardFacts`. |

```ts
type Deadline =
  | { kind: "none" }                // duration field blank: addOperatingTime not called
  | { kind: "duration-refused" }    // isValidDuration → false (NO SIGNAL on the field)
  | { kind: "within-refused" }      // isValidDuration(within) → false
  | { kind: "due"; at: string }
  | { kind: "no-result" };          // "" from accepted inputs: past `within`, or a day unit
type BoardFacts =
  | { kind: "zone-refused"; calls: Calls }                  // no canvas can be drawn
  | { kind: "refused"; probe: ScheduleProbe; calls: Calls } // canvas drawn, no bars
  | { kind: "accepted"; intervals: readonly Interval[]; openAtFrom: boolean;
      nextOpen: string; nextClose: string; between: string; deadline: Deadline; calls: Calls };
```

- **Calls are the calls made, printed as made.** Every call passes the `disambiguation` select's
  value. "Library default" passes no options object.
- `operatingIntervals` covers the canvas range: the local Monday–Sunday week, in the schedule's
  zone, that contains the "Week of" date. Day bounds come from `dayCells` (the polyfill used for
  drawing, as the Free Time Ledger does).
- `""` from `nextOpenAt`, `nextCloseAt` or `addOperatingTime` on an accepted schedule is "no
  result" in muted ink, never amber. A 24/7 schedule never closes, and `"reject"` may decline.

## Layout (kit pieces)

1. **Controls**, never wrapped:
   - the `preset` row;
   - "Time zone" (`textInput`, as typed, no zone guessed);
   - seven `windowRows`, Monday to Sunday (ISO weekday order);
   - "Holidays (one date per line, optional)" as a `textArea`, split into lines with the helper
     the ledger tools already use (search for it first). A refused line is named in the field
     error ("Line 3 is refused on its own");
   - override rows, each a date `textInput` (as typed, so an annotated date reaches the library)
     plus `windowRows`, with "Add override" and "Remove";
   - "Disambiguation" `select` with the options Library default, compatible, earlier, later and
     reject;
   - "Week of" (`dateInput`);
   - "Open time to add (optional)" and "Within (optional)" (`textInput`, no placeholder, never
     defaulted).
2. **Status**: a `verdict`, "Schedule accepted" or "Schedule refused" (NO SIGNAL), plus the probe
   line. Below it, `handoffLink` "Open in the Operating Schedule Checker", whose link carries the
   built schedule as `schedule` (`encodeWidgetPermalink`). When `editorFromSchedule` gives
   `does-not-fit` (a seeded or linked schedule), the editor keeps its last state and the status
   says "This schedule does not fit the editor", with the same handoff.
3. **Week lane**: `ledgerFrame` holds `ledgerLane` (label: the zone as typed). Inside it are
   `dayColumns`, the open-interval bars, `ledgerGate` marks for next open, next close and the
   deadline (each mark's chip is words), and `ledgerHandles` with two paired `handle`s, "From"
   and "To". The snap is 15 minutes and the large step one hour. Under `zone-refused` the lane
   keeps its box and shows one NO SIGNAL plate.
4. **Readings**, two rows of `plates` in `hold`s:
   - row one: "At From" (open / closed), "Next open" and "Next close";
   - row two: "Open time From → To" and "Due".

   Paired plates are pinned with `justify-content: space-between`. Values use reserved ghosts
   (the widest instant, `no result` and `NO SIGNAL`), tabular figures and `nowrap`.
5. **Calls**: a `codeFrame` with `copy`.

## Chat and registration

- `showOpeningHoursBoard` input: `{ schedule: operatingScheduleTextSchema, from: instant?,
  to: instant?, weekOf: plainDate?, duration?: string, within?: string, disambiguation?: enum,
  preset?: enum }`. Every field is passed as the reader gave it, and none is defaulted. Wire it in
  `dox-tools.ts`, `dox-tool-schemas.ts` (append to `DOX_TOOL_DOCS`), `worker/tools.ts`
  (`accept("opening-hours-board")`) and `widget-registry.ts`.
- The `Call when` text names "open hours", "SLA in open hours", "when does it open/close" and the
  six function names.
- `CHAT_STARTERS` card, appended, `area: "core"`: "A Tokyo support desk is open 09:00–18:00 on
  weekdays. A ticket arrives on Friday at 17:30. When is an 8-open-hour reply due?" It is seeded
  with preset 1, `from` and `duration: "PT8H"`.
- Permalink kind `hours`, route `/tools/opening-hours-board/`. The keys are `schedule` (the long
  key from slice 1) plus top-level strings.
- Hand-kept lists: [index § Registering](./index.md#registering-each-tool-both-slices). Also
  `TOOLS` in `scripts/readout-still.mjs`, with the WebKit `minutes` measured for this tool.

## Definition of done

- **Pure tests.** `opening-hours-editor` round-trips every preset that fits, and returns
  `does-not-fit` for the weekday-8 and `BusinessCalendar` shapes. It never returns a verdict.
  `opening-hours-board` has one row per `BoardFacts` and `Deadline` kind, using the real library.
  Add a probe-to-row mapping test.
- **Mount tests.** They run `expectNoAxeViolations` and Remove/Add focus order. Dragging From
  across the whole week by keyboard (Home, End, PageUp/PageDown, arrows) leaves the bounding
  box of every plate, the verdict and the lane unchanged (browser test or `readout-still`).
  Each test aborts its signal in `afterEach`, and `leak-guard` passes. The mount starts no
  timers.
- **Hold still.** Switching every preset, and toggling refused ↔ accepted by editing one window,
  never moves the readings row.
- **Chat lists.** `chat-starters`, `widget-registry`, `widget-permalink`, `select-tools` and
  `widget-load-error` pass.
- **Greps.**
  - `scheduleFromEditor` and `probeScheduleParts` are the only builders of schedule objects.
  - No second copy of the window-pair markup.
  - `ledgerBar` has one definition.
  - There is no `isValidOperatingSchedule(` in the Board's mount.
  - No `border-left` / `border-inline-start` accent stands alone in the new CSS.
- **Duplication pass.** Run [rule 10](../../built/index.md#reuse-never-reinvent) and
  `/ui-standards`, then the slice's own lint, `astro check` and visual snapshots of the two
  `dateInput` tools.
