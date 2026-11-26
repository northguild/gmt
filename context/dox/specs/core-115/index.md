---
story: CORE-115
issue: 567
status: approved
---

# CORE-115 (Dox): a refused schedule is not a closed one

The library story adds `isValidOperatingSchedule`
([library spec](../../../domination/specs/CORE-115/index.md)). For the six operating functions,
a closed schedule and a refused one give the same answer: `operatingIntervals` returns `[]` and
`isOpenAt` returns `false`. These slices put the difference on screen and in the guide.

Site work in `apps/dox`. The owner chose two tools and the guide text. All of it lands in this
PR as phases, never as a follow-up story. **The guide text moves here from the library spec's
finalizer list**; the library index's `dox:` field is updated by the main session.

## Phases

| # | Slice | What the reader gets |
| --- | --- | --- |
| 1 | [Operating Schedule Checker](./s1-schedule-checker.md) | Paste a schedule as JSON and get one of three verdicts (refused, closed in the range, open in the range), with refused parts named by asking the library again |
| 2 | [Opening Hours Board](./s2-opening-hours-board.md) | The working surface: edit a schedule, see one local week of open intervals, drag two handles, read all six operating functions |
| 3 | [Guide text](./s3-guide.md) | "A refused schedule is not a closed one" under The rules of the operating-hours guide, linking both tools |

Order: 2 reuses 1's shared pieces; 3 links 1 and 2. Each slice is landed by `dox-builder`. Per
slice it runs only its own tests, lint and `astro check`. The full gates
([Run the gates](../../built/tier-6-runbooks.md#run-the-gates)), `pnpm run validate` and
`dox-tester` run once, after slice 3.

**Sequencing with the library.** Dox tests and the dev server resolve `@northguild/gmt` to
`packages/gmt/dist`. Slice 1 starts only after library slice 1 (the validator) is in the working
tree. Then build `packages/gmt` once, after the main session has warned the owner that a
rebuild breaks his open dev tools. Build no more times during the Dox slices.

## The two tools stay distinct

- **Checker: "is this schedule valid, closed or open?"** The reader pastes JSON and types an
  interval. No timeline, no handles, no editor. It shows the verdict, the two calls side by side
  (`isValidOperatingSchedule` and `operatingIntervals`) and the refused parts.
- **Board: the working surface for all six operating functions.** It has a structured editor, one
  local week drawn on day columns, and two handles. It shows `isOpenAt`, `nextOpenAt`,
  `nextCloseAt`, `operatingTimeBetween` and `addOperatingTime` as readouts, with
  `operatingIntervals` as the drawn bars. A refused schedule shows "Schedule refused" across
  every readout, marks the refused rows, and links to the Checker with the same schedule.
- `recurringWindows` takes no schedule and is in neither tool.

## Reuse

**Existing pieces, by path** (search first, [rule 1](../../built/index.md#reuse-never-reinvent)):

| Piece | Path | Used by |
| --- | --- | --- |
| Tool page frame | `src/components/ToolLayout.astro` | 1, 2 |
| Loader pattern (`GMT_MODULES`, `pickTyped`, `WidgetLoadError`) | `src/lib/rail-lib.ts`, `gmt-pick.ts`, `widget-mount.ts` | 1, 2 |
| Verdict, plates, hold, field, select, text input, code frame, tool links | `src/widgets/builders/{verdict,plates,hold,layout,select,text-input,code-frame,tool-links}.ts` | 1, 2 |
| Preset, copy, readout, grow, handle | `src/widgets/primitives/{preset,copy,readout,grow,handle}/` | 1, 2 |
| Ledger canvas: `dayCells`, `LedgerCanvas` | `src/lib/dwell-ledger.ts` | 2 |
| Ledger frame, lane, bar, handles, gate; `dayColumns` | `src/widgets/families/ledger/{ledger-lane,day-columns}.ts` | 2 |
| Handoff to another tool | `src/widgets/families/ledger/handoff-link.ts` | 2 |
| Permalinks | `src/lib/widget-permalink.ts` (`seedFromLocation`, `encodeWidgetPermalink`, `LONG_STRING_KEYS`) | 1, 2 |
| Page tool offer | `src/lib/webmcp/{offer,page-tool}.ts` | 1, 2 |

**New shared pieces**. Each goes in the shared layer and holds no content:

| Piece | Home | Interface | Slice |
| --- | --- | --- | --- |
| `loadHoursLib` | `src/lib/hours-lib.ts` | `() => Promise<HoursLib>`: the six operating functions from `calendar/hours`, `isValidOperatingSchedule` from `calendar/validate`, `isValidInterval`, `isValidDuration`, each `pickTyped` | 1 |
| `probeScheduleParts` | `src/lib/schedule-probe.ts` (pure) | `(value: unknown, isValid: (v: unknown) => boolean) => ScheduleProbe` (narrow union, see slice 1) | 1 |
| `textArea` (lifted) | `src/widgets/builders/text-area.ts` (+ `.module.css`, test), moved from `families/ledger/` | unchanged; its header already says "another widget that needs one can lift it"; the four mounts that import it change only the path | 1 |
| `dateInput` (lifted) | `src/widgets/builders/date-input.ts` (+ css, test), moved from `families/ledger/` | unchanged; `bl-date-stamp-mount.ts` and `free-time-ledger-mount.ts` use it and the Board is its third user, so it leaves the family | 2 |
| `operatingScheduleTextSchema` | `src/lib/dox-tool-schemas.ts` | `z.string().min(1).max(SCHEDULE_TEXT_MAX)`, shared by both chat tools | 1 |
| `schedule` permalink key | `LONG_STRING_KEYS` in `widget-permalink.ts` | cap `SCHEDULE_TEXT_MAX` (8,000), imported, never a second literal | 1 |

**Layer of every new file.** Shared: the six rows above. Each feature's own files are its
component, its pure facts module, its mount, its CSS Module in `src/widgets/tools/`, its WebMCP
tool, its presets file and its MDX page. The slices list them.

**Second-instance test.** Suppose a third tool reads an `OperatingSchedule`, such as a
one-instant answer to "is the desk open at…". It adds its own component, facts, mount and
presets, plus one registry row in each chat list. It reuses `loadHoursLib`,
`probeScheduleParts`, `operatingScheduleTextSchema` and the `schedule` key unchanged. If it
needs anything else from the shared layer, the design is wrong.

## Design rules for both tools

- **No second validator.** Every verdict about a schedule is `isValidOperatingSchedule` on the
  value, or on a one-part schedule built from it ([slice 1](./s1-schedule-checker.md#refused-parts)).
  The site holds no list of weekday keys, time patterns, date limits or zone rules.
- **The library's sentinel stays the library's.** NO SIGNAL (amber) appears only when a
  validator refuses typed text: the schedule, the interval, the duration or `within`. A valid
  schedule whose answer is `[]`, `false` or `""` shows "closed" or "no result" in plain words.
- **Text is passed as typed.** The schedule's JSON is parsed with `JSON.parse` and nothing else.
  Text that is not JSON is the text area's own field error ("Not JSON"). It is never a schedule
  verdict, because the library never saw it. Windows, dates and zones are never trimmed or
  repaired. A `within` field is never defaulted and has no placeholder.
- **Zones** come only from the schedule the reader typed. Presets rotate `Europe/London`,
  `Asia/Tokyo`, `Australia/Sydney`, `America/Sao_Paulo`, `Africa/Johannesburg` and
  `Asia/Kolkata`. Use Sydney where a preset needs a DST night. Never use `America/New_York`.
- **Cards:** builder panels only, each with a full bevelled border or a bottom-edge accent
  (`verdict` already draws one). No card, row or result block has a left-edge-only accent.
- **Readouts hold still** ([tier-2-tools § Rules](../../built/tier-2-tools.md#rules-for-every-tool)).
  Paired plates are pinned with `justify-content: space-between`. Values use `hold` ghosts sized to
  the widest text, tabular figures and `white-space: nowrap`.
- **Industry tag** `core`. The facts modules are pure and import no mount, so the WebMCP tool
  calls the same facts function the mount calls ([rule](../../built/index.md#rules-that-bind-every-change)).
- **Async lifetimes.** Each mount takes an `AbortSignal`. Neither tool starts a timer, interval,
  observer or live clock. Its only pending work is the `loadHoursLib()` promise and the listeners
  that the handle and inputs add. Every test awaits the mount's ready state and aborts its signal
  in `afterEach` (the abort runs even when an assertion fails). Use no fake or real sleeps.

## Registering each tool (both slices)

Follow [Registering a new tool](../../built/tier-2-tools.md#registering-a-new-tool) in full.
Append, never insert, to `DOX_TOOL_DOCS`, `CHAT_STARTERS` and `ENABLED_TOOL_NAMES`. Neither new
starter goes in the first five (`CORE_TOOL_COUNT`). The hand-kept lists are `MOUNTS`, the `heavy`
list, `PAGES` in the three scripts, `TOOLS` in `readout-still.mjs` (Board only), the
forced-colours rules and, after a build, the `mdx-jsx.ts` dropped-components list.

## Definition of done (story)

- Every slice's own definition of done holds.
- **Duplication pass, each slice:** follow
  [rule 10](../../built/index.md#reuse-never-reinvent) and run `/ui-standards`. The tester greps:
  `JSON.parse` (only in the two facts modules), `isValidOperatingSchedule(` (only in `hours-lib`,
  `schedule-probe` and the two facts modules), and the keys `timeZone`, `weekly`, `holidays` and
  `overrides` (built into objects only in `schedule-probe.ts` and the Board's editor mapping).
  It also greps for a second copy of the text-area or date-input markup.
- After slice 3: the full Dox gates, `pnpm run validate` and `dox-tester` once.
- Close-out: `context/dox/built/tier-2-tools.md` gains one section, "Operating-hours tools
  (Checker, Board)". It covers the probe rule, the shared `schedule` key and the refused-versus-closed
  wording, in present tense. `tier-2-platform.md` notes that `textArea` and `dateInput` are now
  kit builders. Then delete this folder and its line in [`../index.md`](../index.md) at finalize.

## Decisions

1. **Refused parts are named by asking the library again.** `probeScheduleParts` calls
   `isValidOperatingSchedule` on one-part schedules built from the reader's values. The site
   adds no rule of its own, and no library diagnostic function is added
   ([slice 1](./s1-schedule-checker.md#refused-parts)).
2. **The Board takes a structured editor, not JSON text.** A schedule whose shape the editor
   cannot hold is handed to the Checker.
3. **Neither tool has a live clock.** Presets, links and handles set every time, so no mount
   starts a timer.
4. **Names:** "Operating Schedule Checker" (`/tools/operating-schedule-checker/`) and "Opening
   Hours Board" (`/tools/opening-hours-board/`).
