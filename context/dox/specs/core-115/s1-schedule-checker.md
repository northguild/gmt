# Slice 1: Operating Schedule Checker

Part of [CORE-115 (Dox)](./index.md). Page: `/tools/operating-schedule-checker/`. Widget kind
`schedule`. Mount `mountScheduleChecker`. Industry `core`.

**The question it answers: is this schedule valid, closed or open?** The reader pastes an
`OperatingSchedule` as JSON and types an interval. The tool shows four things. The verdict. The
two calls that look the same for a closed schedule and a refused one, side by side. The
schedule's open time. And, when the library refuses the schedule, which parts it refuses on
their own. It has no timeline, handles or editor; those belong to the Board.

## Shared pieces this slice adds (the Board reuses them unchanged)

### `src/lib/hours-lib.ts` (+ `hours-lib.test.ts`)

`loadHoursLib(): Promise<HoursLib>` follows `rail-lib.ts`. It reads the modules from
`GMT_MODULES`, picks each name with `pickTyped` against `typeof import("@northguild/gmt/<module>")`,
and turns a failed import or a missing name into `WidgetLoadError`. Names:
`operatingIntervals`, `isOpenAt`, `nextOpenAt`, `nextCloseAt`, `operatingTimeBetween` and
`addOperatingTime` from `calendar/hours`; `isValidOperatingSchedule` from `calendar/validate`;
`isValidInterval` from `interval/validate`; `isValidDuration` from `duration/validate`. Import
it only from mounts, facts tests and WebMCP tools (`load-lib.ts` pattern). Never import it from
the chat island's static graph.

### Refused parts

`src/lib/schedule-probe.ts` (pure, + test) exports
`probeScheduleParts(value: unknown, isValid: (v: unknown) => boolean): ScheduleProbe`:

```ts
type ScheduleProbe =
  | { kind: "accepted" }
  | { kind: "zone-refused" }                      // nothing else is probed without a zone
  | { kind: "parts-refused"; parts: readonly string[] } // JSON paths, e.g. 'weekly["8"]', 'holidays[2]'
  | { kind: "refused-together" }                 // no part is refused alone
  | { kind: "not-an-object" };                    // null, a number, a string or a list: no parts to read
```

This is the PTP tool's rule, "ask the library again"
([tier-2-tools § Rail and IoT](../../built/tier-2-tools.md#rail-and-iot-tools-gtfs-ptp)). Every
probe is `isValid` on a schedule of one part, built from the reader's own values. The site states
no rule of its own.

1. `isValid(value)` is true: `accepted`.
2. `value` is `null` or not an object, so no part can be read: `not-an-object`. It has its own
   sentence, "A schedule is an object with a `timeZone` and a `weekly`.", shown by `refusedLines` in
   the page and in the chat tool.
3. `isValid({ timeZone: value.timeZone, weekly: {} })` is false: `zone-refused`. (`weekly: {}` is
   a valid schedule that is closed every day; decision 1 of the library spec.)
4. For `weekly`, when it is not a plain object, probe `{ timeZone, weekly: value.weekly }`, and a
   refusal names `weekly`. Otherwise, for each own key `k`, probe
   `{ timeZone, weekly: { [k]: [] } }`; a refusal names `weekly["k"]`. When the key is accepted
   and its value is an array, probe each window `i` alone as `{ [k]: [w] }`; a refusal names
   `weekly["k"][i]`. When the value is not an array, probe `{ [k]: value }`.
5. For `holidays` (when present): an array is probed one date at a time
   (`{ timeZone, weekly: {}, holidays: [d] }` names `holidays[i]`). Anything else, a
   `BusinessCalendar` included, is probed whole and names `holidays`.
6. For `overrides` (when present): an array is probed one entry at a time (names `overrides[i]`).
   Anything else is probed whole.
7. No part is refused: `refused-together`. Two overrides for one date are the known case. The
   wording says so as an example, and never as the cause.

The probe reads only `timeZone`, `weekly`, `holidays` and `overrides`, the fields of the
`OperatingSchedule` type. Keys the library ignores are never probed. Input is capped by
`SCHEDULE_TEXT_MAX`, so the number of probes is bounded. Tests run against the real library
through `loadHoursLib`. For every preset and for the probe's own rows, `kind === "accepted"`
holds exactly when the validator returns `true`. Each named part's one-part probe is refused.
For the London weekday-8 preset, the named part is `weekly["8"]` and nothing else.

### Schema, permalink key, presets

- `src/lib/dox-tool-schemas.ts`: `SCHEDULE_TEXT_MAX = 8000` and `operatingScheduleTextSchema`,
  exported for slice 2. `showScheduleCheckerInput = z.object({ schedule:
  operatingScheduleTextSchema, start: z.string().max(64).optional(), end: …optional(),
  preset: z.enum(PRESET_IDS).optional() })`. The start and end of the interval are never
  defaulted.
- `src/lib/widget-permalink.ts`: `LONG_STRING_KEYS.schedule = SCHEDULE_TEXT_MAX` (imported), plus
  a `widget-permalink.test.ts` regression test: an 8,000-character schedule survives, and 8,001
  is dropped. Add the kind `schedule` with the route `/tools/operating-schedule-checker/`.
- `src/data/operating-schedule-presets.ts`: content only, read by both tools. Each preset carries
  its zone and dates with their years, and its JSON text exactly as the reader would paste it:
  1. Tokyo support desk, weekdays 09:00–18:00, a 2024 week (open).
  2. Johannesburg office, a week of holidays (valid, closed in the interval).
  3. London desk with a weekday key `"8"` (refused, one part).
  4. Kolkata office with an annotated holiday `"2024-08-15[u-ca=iso8601]"` (refused since CORE-113).
  5. São Paulo counter with two overrides for one date (refused, no part alone).
  6. Sydney night curfew `23:00`–`06:00` across the April 2024 fall-back night (open).

  A label describes the schedule, never the verdict ("Weekday key 8", not "Broken").

### Lift `textArea` into the kit

Move `src/widgets/families/ledger/text-area.{ts,module.css,test.ts}` to
`src/widgets/builders/` with a plain `mv` (nothing staged). Export it from `builders/index.ts`.
Rewrite the imports in `gtfs-trip-board-mount.ts`, `free-time-ledger-mount.ts`,
`stored-time-audit-mount.ts` and `tai64n-log-reader-mount.ts`. Rewrite its header: it is a
kit builder now. Its CSS Module name becomes `gmt-text-area__*`, so check that the four tools'
visual snapshots differ by class name only. No other change.

## Feature files

| File | Holds |
| --- | --- |
| `src/lib/schedule-checker.ts` (+ test) | Pure facts. `checkSchedule(lib, { schedule, start, end })` returns `CheckerFacts` (below). It is the one function the mount and the WebMCP tool call. |
| `src/lib/schedule-checker-mount.ts` (+ `.test.tsx`) | `renderScheduleCheckerTemplate(id, args)` and `mountScheduleChecker(root, args, signal)`; under 400 lines |
| `src/widgets/tools/schedule-checker.module.css` | Layout only, with forced-colours rules |
| `src/components/ScheduleChecker.astro` | Shell, following `FhirDateChecker.astro`: server-renders the template, mounts, `showUnavailable` on `WidgetLoadError`, `seedFromLocation`, `offerPageTool` |
| `src/content/docs/tools/operating-schedule-checker.mdx` | `ToolLayout`. Keypoint: "`[]` from `operatingIntervals` can mean closed or refused." Intro links the reference pages of `isValidOperatingSchedule` and `operatingIntervals`, and the guide. |
| `src/lib/webmcp/tools/operating-schedule-checker.ts` | Page tool, calls `checkSchedule` |

```ts
type CheckerFacts =
  | { kind: "not-json" }                                     // the text area's own error; no call made
  | { kind: "refused"; probe: ScheduleProbe; calls: Calls }  // isValidOperatingSchedule → false
  | { kind: "no-interval"; calls: Calls }                    // start or end blank: operatingIntervals not called
  | { kind: "interval-refused"; calls: Calls }               // isValidInterval → false
  | { kind: "closed"; calls: Calls }                         // valid, operatingIntervals → []
  | { kind: "open"; intervals: readonly Interval[]; openTime: string; calls: Calls };
```

`calls` is the list of calls made, printed exactly as made, each with its result:
`isValidOperatingSchedule(schedule)` always. `operatingIntervals(schedule, { start, end })`
whenever both interval fields are filled, **including when the schedule is refused**. Its `[]`
next to `false` is what the tool teaches. `operatingTimeBetween(start, end, schedule)` only for
`open`. Facts compute nothing beyond these calls.

## Layout (kit pieces)

1. **Controls** (never wrapped in grow): a `preset` row, then `field` + `textArea` "Schedule
   (JSON)" with its own field error "Not JSON" (reserved, made visible). Then a pair of
   `field` + `textInput` boxes, "Interval start" and "Interval end": no placeholder, never
   filled except by a preset or a link.
2. **Verdict** in `<gmt-readout>`: `verdict` with title "Refused", "Closed in this interval" or
   "Open in this interval", and a detail line. "Refused" is the one NO SIGNAL tone.
   "Closed" is a plain word, never amber. For `no-interval`, the title answers valid or refused
   and the detail says to type an interval.
3. **Plates** (`plates`, three, in a `hold`): `isValidOperatingSchedule` (`true` / `false`),
   `operatingIntervals` (`[]` or "3 intervals"), "Open time" (`PT45H` or "no result"). Use reserved
   ghosts, tabular figures and `nowrap`.
4. **Refused parts** (`gmt-grow`): a list in which each row has a full bevelled border:
   "`weekly["8"]` is refused on its own." / "The zone is refused. The other parts are checked once
   it is accepted." / "Every part is accepted on its own. Together they are refused, for example
   two overrides for one date." Hidden for every state except `refused`.
5. **Calls**: `codeFrame` with `copy`, using `frameCallArgs`.

## Chat and registration

- `showScheduleChecker` in `dox-tools.ts`, `dox-tool-schemas.ts` (type union, docs entry appended
  to `DOX_TOOL_DOCS`, name in `ENABLED_TOOL_NAMES`), `worker/tools.ts`
  (`accept("operating-schedule-checker")`), `widget-registry.ts` (`defineWidget<ScheduleCheckerArgs>`,
  literal `import()` of the mount, re-validates at mount).
- The `Call when` text names "closed or broken", "returns no hours", `operatingIntervals returns
  []` and `isValidOperatingSchedule`.
- `CHAT_STARTERS` card, appended, `area: "core"`. Its question: "Our Kolkata office schedule
  gives no open hours at all. Is it closed, or is the schedule broken?" Its seed is preset 4.
  `select-tools.test.ts` must offer the widget for that question.
- Hand-kept lists: [index § Registering](./index.md#registering-each-tool-both-slices).

## Definition of done

- Tests: `hours-lib`, `schedule-probe`, `schedule-checker` (one row per `CheckerFacts` kind, and
  every preset against the real library) and the mount (`expectNoAxeViolations`; each state
  renders; switching between states never changes the plates' or the verdict's bounding box,
  measured with `getBoundingClientRect` in the browser test or the `readout-still` gate; the abort
  removes every listener, checked by `leak-guard`). Chat: `chat-starters.test.ts`,
  `widget-registry.test.ts`, `widget-permalink.test.ts`, `select-tools.test.ts` and
  `widget-load-error.test.tsx` all pass.
- Grep: no `JSON.parse` outside `schedule-checker.ts`. No call to `isValidOperatingSchedule`
  outside `hours-lib.ts`, `schedule-probe.ts` and `schedule-checker.ts`. No second text-area
  markup.
- The four tools that use `textArea` pass their own tests unchanged.
- No left-border-only accent anywhere in `schedule-checker.module.css`.
- Own lint, `astro check` and the four affected tools' visual snapshots.
