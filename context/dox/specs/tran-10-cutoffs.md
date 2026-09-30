# Spec: Cut-off tools on the docs site (TRAN-10)

Execution spec for `dox-builder`, verified by `dox-tester`. This is not `packages/gmt` work.
`cutoffAt`, `cutoffSchedule`, `isPastCutoff` and `timeToCutoff` are final. Nothing here edits
library source, tests, the READMEs or `packages/gmt/skills/`. A library problem found while
building is reported to the main session, never built around.

Sources, in order of precedence: the PR #290 reviewer's specification of three tools, the
JSDoc of `packages/gmt/src/transport/calculate/cutoffAt.ts` and `cutoffSchedule.ts` and
`packages/gmt/src/transport/compare/isPastCutoff.ts` and `timeToCutoff.ts`,
`context/domination/docs-site.md` (§ Purpose-built widgets), then `context/dox/built.md`. The
shape follows `context/dox/specs/tran-9-multi-leg-scheduling.md` (TRAN-9, commit `33b21d5`),
whose four tools are the template: read their `*.ts`, `*-mount.ts`, tests, `.astro` shells,
tool pages and CSS before writing anything.

The guide section, the two scenarios and the mistakes already exist on this branch. This work
adds the three tools and links them in.

Every value in this spec was computed against `packages/gmt/dist` built from the final source,
in `TZ=UTC`, `America/Los_Angeles` and `Asia/Tokyo`. Appendix Z is the script; all 49 rows
pass. Do not type a result that is not in appendix Z. If you need a new value, compute it
against `packages/gmt/dist` first and add a row to the script.

**Build order.** Land and test one piece at a time. Each step ends with
`pnpm --filter @gmt/dox test` green before the next starts.

1. **C0**: the shared cut-off helpers and the library loader, with tests.
2. **C-s**: the Cut-off Stack, with its chat registration (the main tool).
3. **C-r**: the Cut-off Ruler, with its chat registration.
4. **C-c**: the Cut-off Countdown, with its chat registration.
5. **A**: the tool pages' links from the guide, the scenarios and the mistakes page. The
   content-permalink test needs each `WidgetKind` to exist first.
6. **C9**: `built.md`, then the gates in section D.

---

## 0. Binding rules

Everything in the TRAN-9 spec's section 0 binds here. The deltas and the rules that matter
most:

- `apps/dox` must not perturb `packages/gmt`. No changeset. **No git operations of any kind**:
  no `add`, `commit`, `stash`, `worktree add`, `checkout`. Leave every change unstaged.
- **Import gmt at module granularity only.** These widgets load, through `GMT_MODULES`:
  `transport/calculate` (`cutoffAt`, `cutoffSchedule`), `transport/compare` (`isPastCutoff`,
  `timeToCutoff`), `transport/convert` (`etaAtZone`), `calendar/business` (`rollDate`),
  `zoned/validate` (`isValidTimeZone`), `plain/validate` (`isValidDateTime`) and `utc/get`
  (`getUtcNow`). All seven are already registered in `gmt-modules.ts`.
- **The widgets draw the library's results and compute none of them.** Every cut-off instant,
  every rolled or unrolled position, every "moved" flag, every closed day, every hours-before
  figure, every past or not-past verdict and every time-left value comes from a gmt call. The
  polyfill may be imported for drawing only: axis positions, day-column bounds
  (`startOfDay`), tick instants, DST-transition markers, and turning a slider position into
  the `now` string passed to the library. Formatting a returned ISO duration as "20 min" is
  formatting, not computing.
- **Every result shown is real.** Nothing is elided. A sentinel renders `NO SIGNAL` through
  `renderWidgetOutput(out, "NO SIGNAL", "sentinel")`; a correct empty result (`[]` from an
  empty cut-off list) renders as empty, not as a sentinel.
- **Amber is only for the sentinel.** Late, on time, closed, open and moved are words and
  patterns, never amber, success or error colours.
- **Counts drift.** New copy contains no function, tool, test or guide counts.
- **Tests never touch the network or spend AI budget.** Mount tests import the real gmt
  modules, as the TRAN-9 mount tests do. **Every preset's mount test asserts the function's
  real output, copied from appendix Z.**
- **Tests pin "now".** The Countdown's live clock is exercised only with
  `vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] })` and
  `vi.setSystemTime(...)`. Confirm first that `getUtcNow()` (the polyfill's `Temporal.Now`)
  follows the faked `Date`. If it does not, the mount takes an injected clock instead
  (C-c3) — never patch the polyfill or gmt.
- **React stays inside `/dox`.** Every tool page is Astro plus a plain-DOM module. No tool page
  imports `dox-tools.ts`, `zod` or `ai`.
- **Restyle native controls.** Real `<select>`, `<input type="text">`, `<input type="checkbox">`,
  `<input type="range">`, `<button>`, `<fieldset>`. Nothing inside a drawn timeline, ruler or
  axis is focusable.
- **`escapeAttr` / `escapeHtml` on every template interpolation.** Values come from a model or
  a URL.
- **A widget that cannot load says so.** A failed `GMT_MODULES` import throws
  `WidgetLoadError`; each `.astro` shell catches its mount and calls `showUnavailable`.
- **Permalinks seed through `seedFromLocation`**, which keeps only top-level strings of 1–64
  characters and integers 1900–2100. Every permalink here is flat and all strings. Lists
  become numbered keys (`name1`…`atLocalTime4`) or joined strings (`weekend: "6,7"`).
- **Design rules** (`built.md` § Rules, `reference/design-system.md`,
  `reference/style-guide.md`): no rendered text under 12px (`font-floor.test.ts`), body-copy
  contrast ≥ 7:1 in both themes, no horizontal page scroll at 390px, `container-type:
  inline-size` on each tool root with narrow rules as `@container` queries (the `/dox` rail is
  narrow on a wide viewport), tokens only.
- **GMT tracks no law.** No page, widget string, preset, chat doc or test name names a
  statute, standard, regulator or industry body. "VGM", "gate-in" and "documents" are cut-off
  names, used as the library's JSDoc uses them; do not expand VGM into anything that names a
  convention.

---

## A. Content links (build after the three tools exist)

All paths under `apps/dox/src/content/docs/`. Every permalink is `?w=<kind>&wa=` plus
`encodeURIComponent(JSON.stringify(obj))` of the JSON in section P, exactly as the TRAN-9
tool pages write theirs.

### A1. `guides/industries/transport-legs-and-dwell.mdx`

- End of `## Two days before is not 48 hours: \`cutoffAt\`` (after the `PT96H` / `P4D` block,
  before `### The anchor is your event`): "The [Cut-off Ruler](/tools/cutoff-ruler/) draws all
  three readings of \"two days before\" on one axis, across New York's fall-back."
- End of `## The whole stack: \`cutoffSchedule\`` (after the paragraph on sorting and `[]`):
  "The [Cut-off Stack](/tools/cutoff-stack/) draws a sailing's stack on a day timeline, with
  closed days shaded and each rolled cut-off drawn where it landed and where it would have
  been."
- End of `## How long is left: \`timeToCutoff\``: "The [Cut-off Countdown](/tools/cutoff-countdown/)
  compares a cut-off with your clock, or with a time you drag, and shows both calls."
- `## See it break, then work`: insert three bullets at the top of the list, before the Dwell
  Ledger:
  - `[Cut-off Stack: a Monday sailing's weekend cut-offs, rolled back to Friday](/tools/cutoff-stack/)`
  - `[Cut-off Ruler: two days before, three ways, across the fall-back](/tools/cutoff-ruler/)`
  - `[Cut-off Countdown: twenty minutes late for gate-in](/tools/cutoff-countdown/)`

  Each tool opens on that preset by default, so these are plain links.

### A2. `scenarios/two-days-before-is-not-48-hours.mdx`

After the closing paragraph, add one paragraph: "Or open this sailing in the [Cut-off
Ruler](PR2): with no clock change in between, `P2D` and `PT48H` agree at 18:00, and the
pinned reading is 17:00. Across [New York's fall-back](PR1) the three readings land an hour
apart. Across [the spring-forward](PR3), `PT48H` and the pinned 17:00 coincide, and `P2D` is
47 hours."

### A3. `scenarios/filing-anchored-to-the-wrong-event.mdx`

After the closing paragraph: "Open the [Cut-off Countdown](PC3) with the filing made at the
departure-based deadline: against the real cut-off, 24 hours before loading, `timeToCutoff`
is `-PT60H`. Sixty hours late."

### A4. `mistakes/transport.mdx`

Directly under `## Cut-offs`, before the first `<Mistake>`, add: "Each of these has a live
tool: the [Cut-off Stack](/tools/cutoff-stack/), the [Cut-off Ruler](/tools/cutoff-ruler/)
and the [Cut-off Countdown](/tools/cutoff-countdown/)."

---

## C0. Shared cut-off helpers (build first)

### C0.1 `src/lib/cutoff-widgets.ts` (pure: no DOM, no gmt import)

It may import `@js-temporal/polyfill` for drawing only. It reuses, never copies, from
`transport-widgets.ts`: `TRANSPORT_ZONES`, `zoneOptionsHtml`, `minutesText`, `epochMs`. If
you need a helper that exists privately in `transport-widgets.ts` (the zoneless check inside
`diagnose`), export it from there without changing its behaviour, and keep
`transport-widgets.test.ts` green.

- `interface CutoffLib`: `cutoffAt(anchor, offset, options): string`,
  `cutoffSchedule(anchor, cutoffs, options): { name: string; at: string }[]`,
  `isPastCutoff(now, cutoff): boolean`, `timeToCutoff(now, cutoff): string`,
  `etaAtZone(instant, zone): string`, `rollDate(date, roll, calendar): string`,
  `isValidTimeZone(v): boolean`, `isValidDateTime(v): boolean`, `getUtcNow(): string`.
  Every helper below takes it as an argument; tests inject the real library.
- `ROLL_OPTIONS = ["preceding", "following", "modifiedPreceding", "modifiedFollowing", "none"]`.
  `"endOfMonth"` is left out: the `cutoffAt` JSDoc calls it `rollDate`'s schedule tool, not a
  cut-off convention.
- `WEEKDAYS`: `[1…7]` with labels Mon…Sun (ISO numbering, as `BusinessCalendar.weekend`).
- `localParts(zoned)`: `{ date: "2024-06-14", weekday: "Fri", time: "17:00", offset: "+02:00",
  zone: "Europe/Amsterdam" }`, parsed from a zoned string the library returned, never
  recomputed. Seconds and fractions appear in `time` only when non-zero.
- `localLabel(zoned)`: `"Fri 14 Jun 17:00"` from `localParts`.
- `durationText(iso)`: a returned ISO duration as words, sign dropped (the caller words the
  direction). `"PT50M"` → `"50 min"`, `"-PT20M"` → `"20 min"`, `"PT0S"` → `"0 min"`,
  `"PT73H"` → `"73 h"`, `"PT41H30M"` → `"41 h 30 min"`, `"-PT60H"` → `"60 h"`,
  `"PT0.000000001S"` → `"0.000000001 s"`, `"PT1M5.5S"` → `"1 min 5.5 s"`. Hours are never
  folded into days: the library's largest unit is hours, and so is the text. `""` → `""`.
- `isNegative(iso)`: `iso.startsWith("-")`.
- `isZoneless(text, lib)`: `lib.isValidDateTime(text)` and the text has no `Z`, no numeric
  offset and no `[`.
- `callSource(fn, args)`: `[html, plain]` for `renderCallLine`, in the JSDoc spelling
  (`{ name: "gate-in", offset: "P2D", atLocalTime: "17:00" }`, unquoted keys, double-quoted
  strings, numbers and arrays bare). Key order is always the JSDoc order: an entry is `name,
  offset, atLocalTime`; options are `timeZone, atLocalTime, calendar, roll`; a calendar is
  `weekend, holidays, timeZone`. An absent optional key is omitted, never printed as
  `undefined`.
- `formatStack(result)`: `[{ name: "documents", at: "…" },\n  { name: "gate-in", at: "…" }]`;
  replacing each `\n` plus its indent with one space gives the JSDoc result literal. `[]` for
  an empty result.

### C0.2 `src/lib/cutoff-lib.ts`

`loadCutoffLib(): Promise<CutoffLib>` loads the seven `GMT_MODULES` entries in section 0 with
`Promise.all` and returns the functions, cast as `transport-lib.ts` casts them. Each mount
calls it inside its own `try` and throws `new WidgetLoadError(cause)` on failure. Do not extend
`TransportLib` or `loadTransportLib`: the TRAN-9 widgets would then load modules they never
call. It is a heavy module (C-x).

### C0.3 `src/lib/cutoff-widgets.test.ts`

Real gmt modules by module path. Covers `localParts`, `localLabel`, every `durationText` row
above, `isZoneless`, `callSource` (the S1 call's plain text equals the appendix Z call
verbatim; absent keys omitted) and `formatStack` (collapses to the S1 and S4 literals; `[]`).

### C0.4 `src/styles/gmt-cutoff-widgets.css`

Rules the three tools share: the lane grid, day columns, the closed-day pattern (a hatch plus
the word "closed", never colour alone), markers (solid for where a cut-off closes, hollow for
where it would have been), the departure line, the axis tick labels. Reuse the classes of
`gmt-transport-widgets.css` (verdict line, reason aside, fieldset grid) by adding the three
roots to its root selector lists where a rule applies, rather than copying it. Tokens only.
Register it in `astro.config.mjs` `customCss` directly after `gmt-crossing-clock.css`, with
the comment `// Cut-off widgets, shared (TRAN-10)`. Add forced-colors rules to
`gmt-a11y.css` so markers, patterns and the closed region stay distinguishable by border style
and text.

---

## C-s. Cut-off Stack: `cutoffSchedule`, `/tools/cutoff-stack/`, kind `cutoffstack`

Answers: when is each deadline for this sailing? The root is exactly
`<div class="gmt-cutoff-stack gmt-widget">`, the first thing in the template, with no other
attribute (`html-diff.mjs` matches the literal string).

### C-s1. `src/lib/cutoff-stack.ts` (pure)

- `MAX_CUTOFFS = 4`. `CutoffFields = { name, offset, atLocalTime }` (strings).
  `StackState = { anchor, timeZone, cutoffCount: string, cutoffs: CutoffFields[4],
  calendar: boolean, weekend: number[], holidays: string, roll: string }`. `holidays` is the
  comma-separated text the reader typed; `roll` is `""` when not given.
- `CutoffStackArgs`: the chat shape (`anchor`, `timeZone`, `cutoffs` array, `weekend?`
  number array, `holidays?` string array, `roll?`) and the permalink shape (`cutoffCount`,
  `name1…4`, `offset1…4`, `atLocalTime1…4`, `calendar: "on"`, `weekend: "6,7"`,
  `holidays: "2024-05-09,…"`, `roll`), all strings.
- `readArgs(args)`: `cutoffs` (an array) wins over the flat keys. `calendar` is on when the
  chat gives `weekend` or `holidays`, or the permalink gives `calendar: "on"`. A chat call with
  `holidays` and no `weekend` has `weekend: []`, stated in the hint, never guessed as 6,7.
  `roll` is never defaulted.
- `STACK_PRESETS`, in this order (results in appendix Z):

  | id | label | anchor, zone | cut-offs | calendar | roll | result |
  | --- | --- | --- | --- | --- | --- | --- |
  | `rotterdam-weekend` | Monday 18:00 sailing: weekend cut-offs back to Friday | `2024-06-17T18:00:00+02:00[Europe/Amsterdam]`, `Europe/Amsterdam` | gate-in `P2D` `17:00`; documents `P3D` `12:00` | weekend 6, 7 | `preceding` | S1 (gate-in moved from Sat 15 Jun; documents not moved) |
  | `rotterdam-following` | The same sailing, weekend cut-offs on to Monday | same | gate-in, documents, VGM `P1D` `10:00` | weekend 6, 7 | `following` | S2 (gate-in lands 1 h before sailing) |
  | `holiday` | A Thursday holiday: documents back to Wednesday | `2024-05-10T18:00:00+02:00[Europe/Amsterdam]`, `Europe/Amsterdam` | gate-in `PT6H`; documents `P1D` `12:00` | weekend 6, 7; holidays `2024-05-09` | `preceding` | S6 |
  | `no-roll` | A calendar with no roll: there is no default | as `rotterdam-weekend` | gate-in, documents | weekend 6, 7 | not given | S3 `[]` |
  | `no-calendar` | No calendar: sorted earliest first | `2024-06-14T16:00:00Z`, `Europe/Amsterdam` | gate-in `P1D`; document `P2D` `17:00`; VGM `P1D` `10:00` | off | not given | S4 (the JSDoc example) |
  | `skipped-hour` | 02:30 on New York's spring-forward night | `2024-03-11T22:00:00Z`, `America/New_York` | gate-in `P1D`; VGM `P1D` `02:30` | off | not given | S5 `[]` |

  Descriptions, one or two sentences each:
  1. "The ship sails from Rotterdam at 18:00 on Monday 17 June 2024. Gate-in two days before
     lands on Saturday, so the preceding roll moves it back to Friday 17:00. Documents three
     days before is already Friday."
  2. "The same sailing with the following roll. Saturday's gate-in and Sunday's VGM move
     forward to Monday: gate-in now closes one hour before the ship leaves. cutoffAt does not
     check that a cut-off comes before the departure."
  3. "The ship sails on Friday 10 May 2024, and Thursday the 9th is a holiday. Documents a
     day before rolls back to Wednesday. Gate-in six hours before is exact time, on an open
     day, and does not move."
  4. "A business calendar with no roll convention. Every industry answers the closed-day
     question differently, so there is no default: cutoffSchedule returns []."
  5. "No calendar. The stack comes back sorted by instant, earliest first, whatever order the
     entries were given in. Gate-in with no local time keeps the departure's 18:00."
  6. "VGM at 02:30 one day before a Monday departure lands on 10 March 2024, when New York's
     clocks skipped from 02:00 to 03:00. A skipped time is never shifted: one failed entry
     returns [] for the whole stack."
- `optionsOf(state)`: `{ timeZone }`, plus `calendar: { weekend, holidays, timeZone }` when
  `calendar` is on (holidays split on commas and trimmed, blanks dropped; `calendar.timeZone`
  is the state's `timeZone`, and the hint says the library does not read it), plus `roll`
  when not blank. The printed call is always the real call.
- `entriesOf(state)`: the visible rows with a non-blank offset, as `{ name, offset,
  atLocalTime? }`. A blank name stays `""` (the library accepts any string).
- `collectStackFacts(state, lib)`: all from the library.
  - `result = lib.cutoffSchedule(anchor, entries, options)`.
  - For each input entry: `rolled = lib.cutoffAt(anchor, offset, { timeZone, atLocalTime,
    calendar, roll })` and, only when both `calendar` and `roll` are set,
    `unrolled = lib.cutoffAt(anchor, offset, { timeZone, atLocalTime })`. `moved` is
    `unrolled !== rolled` (both are zoned strings in the same zone from the same function, so
    string equality is instant equality).
  - `rows`: `result` in its order, each joined to its input entry: the first unused entry whose
    `name` equals the row's `name` and whose `rolled` equals the row's `at`. Duplicate names
    are kept, as the library keeps them.
  - `beforeDeparture` per row: `lib.timeToCutoff(row.at, anchor)` (`"PT73H"`); a negative
    value means the cut-off is after the departure (`lib.isPastCutoff(row.at, anchor)`), and
    the row says "8 h after the departure: cutoffAt does not check order" (S7).
  - `closedDays`: for each local date on the axis, closed when
    `lib.rollDate(date, "following", calendar) !== date` (SC, SC2). Only when `calendar` is
    on and valid.
  - `departure`: `lib.etaAtZone(anchor, timeZone)`.
- `stackNullReason(state, facts, lib)`: why the result is `[]` when there are entries. Checked
  in this order, each by a library probe:
  1. `!lib.isValidTimeZone(timeZone)` → `invalid-zone`: "The terminal clock is not a time
     zone this browser knows."
  2. `calendar` on and `roll` blank → `calendar-without-roll`: "A business calendar needs a
     roll convention. There is no default, because every industry moves a closed-day
     cut-off its own way: a calendar with no roll returns []."
  3. `roll` set and `calendar` off → `roll-without-calendar`: "A roll convention needs a
     business calendar to say which days are closed. A roll with no calendar returns []."
  4. `calendar` on and `lib.cutoffAt(anchor, "PT0S", { timeZone, calendar, roll }) === ""` →
     `invalid-calendar`: "The calendar is not valid: check the holidays are real ISO dates."
  5. `lib.cutoffAt(anchor, "PT0S", { timeZone }) === ""` → `zoneless-anchor` when
     `isZoneless(anchor)`: "The departure has no offset or zone, so it is not a moment. Write
     its offset, or its zone in brackets." Else `invalid-anchor`: "The departure is not an
     instant or a zoned date-time."
  6. For the first input entry, in input order, whose `rolled` is `""`:
     `lib.cutoffAt(anchor, offset, { timeZone: "UTC" }) === ""` → `invalid-offset`: "Cut-off
     n's offset is not an ISO 8601 duration such as P2D or PT48H, or it leaves the range of
     instants." Else `atLocalTime` not blank and
     `lib.cutoffAt(anchor, "PT0S", { timeZone: "UTC", atLocalTime }) === ""` → `invalid-time`:
     "Cut-off n's local time is not a time of day such as 17:00." Else `skipped-hour`:
     "Cut-off n lands on a local time the clock skipped that day. cutoffAt never shifts a
     skipped time: it returns \"\", and one failed entry makes the whole stack []."
  These are the only reason strings. UTC has no skipped hours, which is why the probes in 6
  use it. With no entries at all, the result `[]` is a correct empty result: render it as
  empty, with the note "An empty list returns []."
- `matchPreset(state)`, `permalinkOf(state)` (strings only, blanks omitted, `weekend` joined
  with commas, `calendar: "on"` only when on).

### C-s2. `src/lib/cutoff-stack.test.ts`

`readArgs` (chat array, flat keys, `calendar` inference, `holidays` without `weekend`, junk
to `""`), `optionsOf` and `entriesOf` (key order, blanks omitted), `matchPreset` (every preset
and custom), `permalinkOf`. `collectStackFacts` for every preset: `rows` in S-row order, the
`moved` flags (S1: gate-in moved from `2024-06-15T17:00…`, documents not; S2: gate-in and VGM
moved, documents not; S6: documents moved from `2024-05-09T12:00…`, gate-in not), the
`beforeDeparture` values (S1x, S1y, S2x, S2y) and `closedDays` (SC, SC2). S7: the
after-departure row. `stackNullReason`: one state per reason, each asserting that the real
`cutoffSchedule` returns `[]` for it (S3, S3b, S9e, S9c, S9d, S9, S9b, S5), and S8 (no
entries) giving the empty state, not a reason. S9f: `roll: "none"` leaves Saturday's
gate-in on Saturday, `moved` false.

### C-s3. `src/lib/cutoff-stack-mount.ts`

`renderCutoffStackTemplate(args = {})` (seeded when `args.anchor` or `args.cutoffs` or
`args.name1` is defined, else the first preset) and `mountCutoffStack(root, args, signal)`.

1. `<h4>1. The sailing and its cut-offs</h4>`: the preset `<select>` (Custom first), the
   description, "Departs" (`anchor`, text), "Terminal clock" (`time-zone`, a select from
   `TRANSPORT_ZONES` through `zoneOptionsHtml`), then four `<fieldset data-role="cutoff-1">`…
   `cutoff-4`, each with "Name", "Offset" and "At local time (optional)". A row with a blank
   offset is left out of the call. Then `<fieldset data-role="closed-days">` with the legend
   "Closed days": a checkbox "Use a business calendar" (`calendar`), seven weekday checkboxes
   (`weekday-1`…`weekday-7`, labelled Mon…Sun), "Holidays" (`holidays`, text, hint "ISO dates,
   separated by commas"), and "Roll a closed-day cut-off" (`roll`, a select: "(not given)"
   with `value=""`, then `ROLL_OPTIONS`). The weekday, holiday and roll controls stay enabled
   when the calendar is off, so a roll with no calendar can be tried. Hint: "There is no
   default: a calendar without a roll, or a roll without a calendar, returns []."
2. `<h4>2. When each cut-off closes</h4>`:
   - The timeline (`data-role="stack-timeline"`, `role="img"`, `aria-labelledby` the summary
     paragraph `stack-summary`). An exact-time axis, one column per local date from the
     earliest of every rolled and unrolled cut-off to the departure's date, each column
     bounded by the polyfill's `startOfDay` so a 23- or 25-hour day is drawn at its length.
     Closed days carry the hatch and the word "closed" in the column header. One lane per
     `rows` entry, in schedule order, labelled with its name. A solid marker at `at`, labelled
     with its local time. A moved cut-off also has a hollow marker at `unrolled` and a
     connector with an arrowhead from the hollow to the solid marker, labelled "moved from
     Sat 15 Jun". A vertical departure line across every lane, labelled with
     `localLabel(departure)`. Axis labels thin out as the span grows; the timeline never
     scrolls the page sideways at 390px.
   - `stack-summary`: one plain sentence per row ("documents closes Fri 14 Jun 12:00, 78 h
     before departure, not moved."), the timeline's text equivalent.
   - A table `data-role="stack-table"`: Cut-off | Rule (`P2D at 17:00`) | Closes (the local
     label, with the full zoned string as a muted second line) | Before departure
     (`durationText`, and the ISO value) | Moved (`from Sat 15 Jun 17:00`, or "no"; "—" when
     no calendar and roll are given).
   - `reason-aside` for `stackNullReason`.
3. `<h4>3. What <code>cutoffSchedule</code> returns</h4>`: a code frame with the call, then
   `stack-output` (`formatStack`, or `NO SIGNAL`, or empty).

Every control re-renders on `input`/`change`. The mount returns a handle whose `destroy` is
idempotent and which stops on `signal` abort.

### C-s4. `src/lib/cutoff-stack-mount.test.tsx` (jsdom, real gmt)

- For each preset: the printed call, the output (appendix Z, verbatim), the table's Closes and
  Moved cells, the number of closed-day columns, and the reason text for S3 and S5.
- The chat seed (the pill args, C-s8) renders S1, with gate-in "moved from Sat 15 Jun 17:00"
  and documents "no".
- Unticking "Use a business calendar" on `rotterdam-weekend` gives `roll-without-calendar`
  and `NO SIGNAL`; choosing "(not given)" in the roll select instead gives
  `calendar-without-roll`.
- Clearing every offset gives the empty state, not `NO SIGNAL`.
- The permalink round-trip, the abort and the double destroy.

### C-s5 to C-s7

- **Shell** `src/components/CutoffStack.astro`, as `ConnectionChecker.astro`, with
  `seedFromLocation("cutoffstack")` and `.gmt-cutoff-stack`.
- **Page** `src/content/docs/tools/cutoff-stack.mdx`. Title "Cut-off Stack". Description:
  "When does each deadline before a sailing close? cutoffSchedule computes the whole stack
  against one departure, earliest first, with weekend and holiday cut-offs rolled the way you
  say, and no default." Intro (two short paragraphs: the stack counts back from one event and
  moves when it moves; a closed day moves a cut-off only by the roll convention you give),
  then `<CutoffStack />`. "Worth trying": PS2 (the calendar with no roll) and PS3 (the
  holiday). A Reference paragraph linking
  [`cutoffSchedule`](/reference/transport/calculate/cutoffSchedule/),
  [`cutoffAt`](/reference/transport/calculate/cutoffAt/),
  [`rollDate`](/reference/calendar/business/rollDate/), the
  [Cut-off Ruler](/tools/cutoff-ruler/) and the guide sections
  `/guides/industries/transport-legs-and-dwell/#the-whole-stack-cutoffschedule` and
  `#closures-roll-the-way-you-say`.
- **CSS** `src/styles/gmt-cutoff-stack.css`, registered after `gmt-cutoff-widgets.css` with
  `// Cut-off Stack widget (TRAN-10)`.

### C-s8. Chat registration

| Item | Value |
| --- | --- |
| Schema | `showCutoffStackInput = z.object({ anchor: dateTimeSchema, timeZone: zoneSchema, cutoffs: z.array(z.object({ name: z.string().min(1).max(24), offset: durationSchema, atLocalTime: z.string().min(4).max(12).optional() })).min(1).max(4), weekend: z.array(z.number().int().min(1).max(7)).max(7).optional(), holidays: z.array(plainDateSchema).max(5).optional(), roll: z.enum(["preceding", "following", "modifiedPreceding", "modifiedFollowing", "none"]).optional() })` |
| `purpose` | "A sailing's whole stack of cut-offs, computed by cutoffSchedule against one departure, earliest first, on a day timeline with closed days shaded and each cut-off a weekend or holiday rolled drawn where it landed and where it would have been." |
| `when` | "the reader asks when each of several deadlines or cut-offs before a sailing, flight or loading closes, or how a weekend or holiday moves them" |
| `args` | "anchor (the event the cut-offs count back from: an ISO date-time with an offset or a bracketed zone), timeZone (IANA id of the terminal's clock), cutoffs (1 to 4, each a name, an offset as an ISO 8601 duration such as P2D or PT48H, and an optional atLocalTime such as 17:00), weekend (optional ISO weekday numbers of closed days, 6 and 7 for Saturday and Sunday), holidays (optional ISO dates, up to 5), roll (preceding, following, modifiedPreceding, modifiedFollowing or none; required whenever weekend or holidays are given: there is no default, so ask which way a cut-off on a closed day moves). Never invent a zone." |
| Worker | `unknownZones([timeZone])` |
| Registry | `cutoffStackEntry`, `title: "Cut-off stack"`, `kind: "cutoffstack"`, `validate` checks `timeZone` |
| Permalink | `cutoffstack: "/tools/cutoff-stack/"` |
| Starter | text "Sails Rotterdam 18:00 17 June 2024: gate-in 2 days before 17:00, docs 3 days before 12:00, weekend to Friday?" (109 characters). args `{ anchor: "2024-06-17T18:00:00+02:00[Europe/Amsterdam]", timeZone: "Europe/Amsterdam", cutoffs: [{ name: "gate-in", offset: "P2D", atLocalTime: "17:00" }, { name: "documents", offset: "P3D", atLocalTime: "12:00" }], weekend: [6, 7], roll: "preceding" }`, with the comment "Rotterdam is on Europe/Amsterdam's clock. 17 June 2024 is a Monday; \"weekend to Friday\" is the preceding roll, which the question names because there is no default." Result: S1. |

---

## C-r. Cut-off Ruler: `cutoffAt`, `/tools/cutoff-ruler/`, kind `cutoffruler`

Answers: is "two days before" the same as 48 hours before? Root:
`<div class="gmt-cutoff-ruler gmt-widget">`.

### C-r1. `src/lib/cutoff-ruler.ts` (pure)

- `RulerState = { anchor, timeZone, days: string, atLocalTime }`. The chat's `days` is a
  number, the permalink's a string. `days` is 1–7.
- `readingsOf(state)`: three calls, in this order, each its own `cutoffAt` call:
  1. `calendar`: `cutoffAt(anchor, "P{n}D", { timeZone })`, labelled "{n} calendar days
     (P{n}D)";
  2. `exact`: `cutoffAt(anchor, "PT{24n}H", { timeZone })`, labelled "{24n} exact hours
     (PT{24n}H)";
  3. `pinned`: `cutoffAt(anchor, "P{n}D", { timeZone, atLocalTime })`, labelled "{n} days
     before at {atLocalTime}".
  Building `"PT48H"` from `days` constructs an input; it computes no result.
- `collectRulerFacts(state, lib)`: per reading, `at` (the string, or `""`), `hoursBefore =
  lib.timeToCutoff(at, anchor)`; plus `departure = lib.etaAtZone(anchor, timeZone)`. Each
  reading stands alone: one `""` does not blank the others (R5).
- `rulerNullReason(reading, state, lib)`: for a `""` reading, the same probe order as
  `stackNullReason` steps 1, 5 and 6 (zone, anchor, offset, local time, skipped hour), worded
  for one cut-off.
- `transitionBetween(state, facts)`: the polyfill's `getTimeZoneTransition("next")` from the
  earliest reading to the departure, for drawing: `{ instant, before: "-04:00", after:
  "-05:00", wallBefore: "02:00", wallAfter: "01:00" }` or `null`. Its label is "Clocks go back
  1 h: Sun 3 Nov, 02:00 → 01:00" (or "go forward").
- `RULER_PRESETS`, in this order:

  | id | label | anchor | zone | days | at | result |
  | --- | --- | --- | --- | --- | --- | --- |
  | `new-york-fall-back` | New York, Monday 4 November 2024: the clocks go back in between | `2024-11-04T18:00:00-05:00[America/New_York]` | `America/New_York` | 2 | `17:00` | R1: 18:00, 19:00, 17:00 on Saturday; 49 h, 48 h, 50 h |
  | `amsterdam-june` | Amsterdam, Friday 14 June 2024: no clock change | `2024-06-14T16:00:00Z` | `Europe/Amsterdam` | 2 | `17:00` | R2: P2D and PT48H agree at 18:00 |
  | `new-york-spring-forward` | New York, Monday 11 March 2024: the clocks go forward in between | `2024-03-11T22:00:00Z` | `America/New_York` | 2 | `17:00` | R3: PT48H and 17:00 coincide; P2D is 47 h |
  | `repeated-hour` | 1 day before at 01:30, on New York's fall-back night | `2024-11-04T23:00:00Z` | `America/New_York` | 1 | `01:30` | R4: the first 01:30, `-04:00` |
  | `skipped-hour` | 1 day before at 02:30, on New York's spring-forward night | `2024-03-11T22:00:00Z` | `America/New_York` | 1 | `02:30` | R5: the pinned reading is `""` |

  Descriptions: (1) "A ship leaves New York at 18:00 on Monday 4 November 2024. The clocks
  went back on Sunday, so two calendar days is 49 hours, 48 hours lands at 19:00, and two
  days at 17:00 is 50 hours: three answers an hour apart." (2) "With no clock change in
  between, two calendar days and 48 hours land on the same 18:00. Only the pinned reading
  differs, at 17:00." (3) "The clocks went forward on Sunday 10 March, so two calendar days
  is only 47 hours, and 48 hours lands at 17:00, the same instant as the pinned reading: an
  agreement by accident." (4) "01:30 happened twice on 3 November 2024. The pinned reading
  takes the first pass, 01:30 EDT." (5) "02:30 never showed on a New York clock on 10 March
  2024. The pinned reading returns \"\"; the other two still resolve."
- `readArgs`, `matchPreset`, `permalinkOf` (strings only; `days` as a string).

### C-r2. `src/lib/cutoff-ruler.test.ts`

`readingsOf` (the three calls for `days` 1, 2 and 7), `collectRulerFacts` for every preset
(R1–R5, both `at` and `hoursBefore`), `transitionBetween` (fall-back on R1, spring-forward on
R3, `null` on R2), `rulerNullReason` on R5's pinned reading, `readArgs` (number or string
`days`), `matchPreset`, `permalinkOf`.

### C-r3. `src/lib/cutoff-ruler-mount.ts`

`renderCutoffRulerTemplate(args = {})` and `mountCutoffRuler(root, args, signal)`.

1. `<h4>1. The departure and the rule</h4>`: preset, description, "Departs" (`anchor`, text),
   "Terminal clock" (`time-zone`, select), "Days before" (`days`, a select 1–7), "At local
   time" (`at-local-time`, text).
2. `<h4>2. Three readings of "{n} days before"</h4>`:
   - The overview ruler (`data-role="ruler-overview"`, `role="img"`, labelled by
     `ruler-summary`): an exact-time axis from the local midnight before the earliest reading
     to the departure, with day and 6-hour ticks in local time. Three lanes, one per reading,
     each a bar from its cut-off to the departure, labelled at the cut-off end with its
     `localLabel` and on the bar with `durationText(hoursBefore)` ("49 h"). A dashed vertical
     marker where `transitionBetween` falls, with its label. A `""` reading's lane shows
     `NO SIGNAL` and no bar.
   - The close-up (`data-role="ruler-closeup"`, `role="img"`, also labelled by
     `ruler-summary`): an hour ruler from 2 h before the earliest resolved reading to 2 h after
     the latest, with every local hour labelled, and the three readings as markers on it, their
     labels stacked so none overlaps. This is where "an hour apart" is visible.
   - `ruler-summary`: one sentence per reading.
   - A list `data-role="readings"`: per reading, its label, the local label, the full zoned
     string, `hoursBefore` (words and ISO), and a one-line gloss (calendar days keep the
     departure's time of day; exact hours are elapsed time; the pinned reading keeps
     `atLocalTime` and lets the elapsed time move). Under it, a static caption: "Date
     arithmetic that subtracts {n} × 86,400,000 ms is the exact-hours row."
   - `reason-aside` for a `""` reading.
3. `<h4>3. What <code>cutoffAt</code> returns</h4>`: one code frame with the three call lines,
   each followed by its output (`renderWidgetOutput`, `NO SIGNAL` for `""`). Nothing hidden
   behind a picker.

### C-r4. `src/lib/cutoff-ruler-mount.test.tsx` (jsdom, real gmt)

- For each preset: the three printed calls, the three outputs and the three hours-before
  values (appendix Z), the transition label (R1 "go back", R3 "go forward", none on R2), and
  on R5 one `NO SIGNAL` row with its reason while the other two resolve.
- The chat seed (the pill args) renders R1.
- Changing "Days before" to 1 on `new-york-fall-back` re-renders all three calls with `P1D`
  and `PT24H`.
- The permalink round-trip, the abort and the double destroy.

### C-r5 to C-r7

- **Shell** `src/components/CutoffRuler.astro`, `seedFromLocation("cutoffruler")`,
  `.gmt-cutoff-ruler`.
- **Page** `tools/cutoff-ruler.mdx`. Title "Cut-off Ruler". Description: "Is two days before
  the same as 48 hours before? cutoffAt reads one departure's \"two days before\" three
  ways, as calendar days, exact hours and a pinned local time, on one axis, with the clock
  change between them marked." Intro, then `<CutoffRuler />`. "Worth trying": PR2 (no clock
  change) and PR3 (the spring-forward, where two readings coincide). Reference:
  [`cutoffAt`](/reference/transport/calculate/cutoffAt/), the guide section
  `/guides/industries/transport-legs-and-dwell/#two-days-before-is-not-48-hours-cutoffat`,
  the scenario [Two Days Before Is Not 48 Hours](/scenarios/two-days-before-is-not-48-hours/),
  and the [DST Inspector](/tools/dst-inspector/) for the general DST rule.
- **CSS** `gmt-cutoff-ruler.css`, `// Cut-off Ruler widget (TRAN-10)`.

### C-r8. Chat registration

| Item | Value |
| --- | --- |
| Schema | `showCutoffRulerInput = z.object({ anchor: dateTimeSchema, timeZone: zoneSchema, days: z.number().int().min(1).max(7), atLocalTime: z.string().min(4).max(12) })` |
| `purpose` | "One departure's \"N days before\" read three ways by cutoffAt on one exact-time axis: N calendar days (P2D), N × 24 exact hours (PT48H), and N days before at a fixed local time, with any DST change between them marked." |
| `when` | "the reader asks whether N days before an event is the same as N × 24 hours before, or where a days-before cut-off lands across a DST change" |
| `args` | "anchor (ISO date-time with an offset or a bracketed zone), timeZone (IANA id of the clock the cut-off is read on), days (whole days, 1 to 7), atLocalTime (the local time of day for the pinned reading, e.g. 17:00)" |
| Worker | `unknownZones([timeZone])` |
| Registry | `cutoffRulerEntry`, `title: "Cut-off ruler"`, `kind: "cutoffruler"`, `validate` checks `timeZone` |
| Permalink | `cutoffruler: "/tools/cutoff-ruler/"` |
| Starter | text "Ship leaves New York 18:00, 4 Nov 2024. When is 2 days before, 48 hours before, and 2 days before at 17:00?" (107 characters). args `{ anchor: "2024-11-04T18:00:00-05:00[America/New_York]", timeZone: "America/New_York", days: 2, atLocalTime: "17:00" }`, with the comment "New York fell back on Sunday 3 November 2024, so the three readings land an hour apart. A spring-forward date would make PT48H and 17:00 coincide." Result: R1. |

---

## C-c. Cut-off Countdown: `isPastCutoff` and `timeToCutoff`, `/tools/cutoff-countdown/`, kind `cutoffcountdown`

Answers: am I late, and by how much? Root: `<div class="gmt-cutoff-countdown gmt-widget">`.

### C-c1. `src/lib/cutoff-countdown.ts` (pure)

- `CountdownState = { cutoff, now, timeZone, mode: "pinned" | "live" }`. In `live` mode
  `now` is the last clock reading.
- `readArgs(args)`: `now` present → `pinned`; absent → `live`. The tool page with no args is
  the first preset, `pinned` (C-c3 says why).
- `collectCountdownFacts(state, lib)`: `past = lib.isPastCutoff(now, cutoff)`, `left =
  lib.timeToCutoff(now, cutoff)`, `nowLocal = lib.etaAtZone(now, timeZone)`, `cutoffLocal =
  lib.etaAtZone(cutoff, timeZone)`. `left === ""` means the inputs are invalid, so `past` is
  the sentinel `false`, not "on time": both outputs render `NO SIGNAL`.
- `verdict(facts)`, from the library only:
  - `left === ""` → no verdict; the reason aside explains.
  - `!past` → "On time: {durationText(left)} left."
  - `past && left === "PT0S"` → "Closed: now is the cut-off itself. The window to meet a
    cut-off is half-open, so at {cutoff's local time} it has already closed."
  - `past` and `isNegative(left)` → "Late by {durationText(left)}."
- `countdownNullReason(state, lib)`: `cutoff` blank → "No cut-off. cutoffAt's \"\" sentinel
  reads as not past: isPastCutoff returns false and timeToCutoff returns \"\". Check the
  cut-off is not \"\" before trusting a false." `isZoneless(now)` → "Now has no offset or
  zone, so it is not a moment. isPastCutoff's false here means invalid input, not on time."
  `isZoneless(cutoff)` → the same wording for the cut-off. `!isValidTimeZone(timeZone)` →
  "The clock is not a time zone this browser knows." Otherwise "Now or the cut-off is not an
  instant or a zoned date-time."
- `axisWindow(cutoff, now)`: for drawing, with the polyfill: `[min − pad, max + pad]` where
  `pad = max(30 min, 25% of |now − cutoff|)`, rounded outward to whole minutes. Recomputed on a
  preset, a typed value, a seed, "Use my clock", "Now = the cut-off", and when a live reading
  leaves the window; never while dragging, so the slider never rescales under the pointer.
- `nowFromSlider(cutoff, minutes, timeZone)`: the polyfill's
  `Instant.from(cutoff).add({ minutes }).toZonedDateTimeISO(timeZone).toString()`. This builds
  the input the library is then asked about.
- `COUNTDOWN_PRESETS`, in this order:

  | id | label | cutoff | now | zone | result |
  | --- | --- | --- | --- | --- | --- |
  | `late` | Gate-in closed at 17:00; you arrive at 17:20 | `2024-06-12T17:00:00+02:00[Europe/Amsterdam]` | `2024-06-12T17:20:00+02:00` | `Europe/Amsterdam` | C1: `true`, `"-PT20M"` |
  | `on-time` | You arrive at 16:10: 50 minutes to spare | same | `2024-06-12T16:10:00+02:00` | same | C2: `false`, `"PT50M"` |
  | `at-cutoff` | You arrive at 17:00 exactly: already closed | same | `2024-06-12T17:00:00+02:00` | same | C3: `true`, `"PT0S"` |
  | `other-clock` | Now read on a New York clock: 11:00 | same | `2024-06-12T11:00:00-04:00[America/New_York]` | same | C4: `true`, `"PT0S"` |
  | `repeated-hour` | Two 01:30s on New York's fall-back night | `2024-11-03T01:30:00-04:00[America/New_York]` | `2024-11-03T01:30:00-05:00[America/New_York]` | `America/New_York` | C5: `true`, `"-PT1H"` |
  | `zoneless-now` | Now with no offset: not a moment | as `late` | `2024-06-12T17:20:00` | `Europe/Amsterdam` | C6: `false`, `""` → `NO SIGNAL` |

  Descriptions: (1) "Gate-in at the Rotterdam terminal closed at 17:00 on 12 June 2024. You arrive
  at 17:20: twenty minutes late, and timeToCutoff says so with a negative duration." (2)
  "Fifty minutes before the cut-off: not past, PT50M left." (3) "At 17:00:00 exactly the
  window has closed. The window to meet a cut-off is half-open, so isPastCutoff is true and
  timeToCutoff is PT0S." (4) "The same instant written on a New York clock. Both are compared
  as instants, so the zone each is written in does not matter." (5) "The cut-off is the first
  01:30, EDT. Now is the second 01:30, EST, an hour later. The offsets tell them apart." (6)
  "A wall time with no offset is not a moment. isPastCutoff returns false, which here means
  invalid input, not on time."
- `matchPreset`, `permalinkOf` (strings only; `now` omitted in live mode).

### C-c2. `src/lib/cutoff-countdown.test.ts`

`readArgs` (with and without `now`), `collectCountdownFacts` and `verdict` for every preset
(C1–C6) plus C3b (one minute before: `false`, `"PT1M"`, "On time: 1 min left.") and C7 (blank
cut-off), `countdownNullReason` for each branch, `axisWindow` (C1's window contains both
instants with at least 30 min either side; C8's 60-hour gap gets 15 h of padding),
`nowFromSlider` (`+20` from the gate-in cut-off in Amsterdam gives
`2024-06-12T17:20:00+02:00[Europe/Amsterdam]`), `matchPreset`, `permalinkOf`.

### C-c3. `src/lib/cutoff-countdown-mount.ts`

`renderCutoffCountdownTemplate(args = {})` and
`mountCutoffCountdown(root, args, signal, options?: { clock?: () => string })`. `clock`
defaults to `lib.getUtcNow`; it exists only if the fake-timer check in section 0 fails.

**The template never reads the clock.** In `live` mode it renders a placeholder ("Reading your
clock…") in the now, verdict and output slots, and the mount fills them. This keeps the
server-rendered page and the jsdom template deterministic, and follows `built.md`'s rule that
dates render after mount only.

**Why the page opens pinned.** The reviewer asked for the viewer's clock by default. A chat
call with no `now`, and a permalink with no `now`, do open on the viewer's clock, live. The
tool page with no arguments opens on the `late` preset, pinned, because every preset's
cut-off is fixed in 2024 and against today's clock it is always "late by" thousands of hours,
which teaches nothing. "Use my clock" is one click away.

1. `<h4>1. The cut-off and now</h4>`: preset, description, "Cut-off" (`cutoff`, text),
   "Clock" (`time-zone`, select), "Now" (`now`, text), a `<button data-role="use-clock">Use my
   clock</button>`, a `<button data-role="snap">Now = the cut-off</button>`, and a status line
   `now-mode` ("Now is pinned." or "Now is your clock, live.").
2. `<h4>2. Late or on time</h4>`:
   - `verdict` (`aria-live="polite"`).
   - The axis (`data-role="countdown-axis"`, `role="img"`, labelled by `countdown-summary`):
     the `axisWindow`, ticks in local time with units that fit the span (hours, then days,
     then months), the cut-off as a solid vertical line labelled with its local time, the
     region from the cut-off (inclusive) to the right edge hatched and labelled "closed", the
     region before it labelled "open", and the now marker labelled with its local time.
   - Under the axis, `<label>Drag now <input type="range" data-role="now-slider" step="1"></label>`,
     its min and max the window's edges in whole minutes relative to the cut-off, and
     `<output data-role="now-value">` showing now's local time. Arrow keys move one minute;
     Page Up and Page Down use the native jump. Dragging or typing switches to `pinned`. The
     slider is disabled when the cut-off is invalid.
   - A rule box (`data-role="rule"`, always visible): "The window to meet a cut-off is
     half-open: [ … , {cut-off local time} ). At {cut-off local time} exactly it has closed:
     isPastCutoff is true and timeToCutoff is PT0S."
   - `countdown-summary`, then `reason-aside`.
3. `<h4>3. What the calls return</h4>`: one code frame with
   `isPastCutoff("{now}", "{cutoff}")` and `timeToCutoff("{now}", "{cutoff}")`, each followed
   by its output.

**Live mode.** On mount in `live` mode, and on "Use my clock", read `clock()` and re-render,
then re-read every 1000 ms with `setInterval`. The interval is cleared on `signal` abort, on
`destroy`, and as soon as the reader drags, types, snaps or picks a preset. Nothing animates;
the text updates. When a live reading leaves the axis window, the window is recomputed.

### C-c4. `src/lib/cutoff-countdown-mount.test.tsx` (jsdom, real gmt)

- For each preset: the two printed calls, both outputs (appendix Z: `true`/`false` and the
  duration, or `NO SIGNAL` twice for C6), the verdict text, and the rule box's local time.
- The chat seed (the pill args) renders C1 and "Late by 20 min.".
- Setting the slider on `late` to `-1` gives C3b; to `0` gives C3. "Now = the cut-off" gives
  C3.
- Live mode, with fake timers: `vi.setSystemTime(new Date("2024-06-12T15:20:00Z"))`, mount
  with `{ cutoff: "2024-06-12T17:00:00+02:00[Europe/Amsterdam]", timeZone: "Europe/Amsterdam" }`
  (no `now`): the output is `"-PT20M"` and `now-mode` says live. Advance 60 s: `"-PT21M"`.
  Drag the slider: `now-mode` says pinned, and advancing the timers changes nothing. Abort the
  signal in live mode: no further re-render and no pending interval
  (`vi.getTimerCount() === 0`).
- The template for args with no `now` contains no date read from the clock.
- The permalink round-trip, the abort and the double destroy.

### C-c5 to C-c7

- **Shell** `src/components/CutoffCountdown.astro`, `seedFromLocation("cutoffcountdown")`,
  `.gmt-cutoff-countdown`.
- **Page** `tools/cutoff-countdown.mdx`. Title "Cut-off Countdown". Description: "Am I late,
  and by how much? isPastCutoff and timeToCutoff compare a cut-off with your clock or a time
  you drag: the time left, or a negative duration once it has passed, and passed at the
  deadline itself." Intro, then `<CutoffCountdown />`. "Worth trying": PC2 (at the cut-off
  exactly) and PC3 (a filing sixty hours late). Reference:
  [`isPastCutoff`](/reference/transport/compare/isPastCutoff/),
  [`timeToCutoff`](/reference/transport/compare/timeToCutoff/), the guide sections
  `#has-it-passed-ispastcutoff` and `#how-long-is-left-timetocutoff` of
  `/guides/industries/transport-legs-and-dwell/`, and the [Cut-off Stack](/tools/cutoff-stack/).
- **CSS** `gmt-cutoff-countdown.css`, `// Cut-off Countdown widget (TRAN-10)`. The closed
  region is a hatch plus the word "closed", never a colour alone.

### C-c8. Chat registration

| Item | Value |
| --- | --- |
| Schema | `showCutoffCountdownInput = z.object({ cutoff: dateTimeSchema, now: dateTimeSchema.optional(), timeZone: zoneSchema })` |
| `purpose` | "A cut-off compared with a moment by isPastCutoff and timeToCutoff: the time left, or how late as a negative duration, with the cut-off counted as passed at the deadline itself." |
| `when` | "the reader asks whether a cut-off or deadline has passed at a given time, or how much time is left or how late they are" |
| `args` | "cutoff (ISO date-time with an offset or a bracketed zone), now (optional ISO date-time with an offset or zone; omit it to use the reader's own clock), timeZone (IANA id of the clock both are shown on)" |
| Worker | `unknownZones([timeZone])` |
| Registry | `cutoffCountdownEntry`, `title: "Cut-off countdown"`, `kind: "cutoffcountdown"`, `validate` checks `timeZone` |
| Permalink | `cutoffcountdown: "/tools/cutoff-countdown/"` |
| Starter | text "Gate-in closed at 17:00 on 12 June 2024 in Rotterdam. I arrive at 17:20. Am I late, and by how much?" (100 characters). args `{ cutoff: "2024-06-12T17:00:00+02:00[Europe/Amsterdam]", now: "2024-06-12T17:20:00+02:00", timeZone: "Europe/Amsterdam" }`, with the comment "Rotterdam is on Europe/Amsterdam's clock. The pill pins now, so the seed is reproducible." Result: C1. |

---

## C-x. Registration common to all three

Each item is guarded by the named test.

- `dox-tools.ts`: the three schemas, three `DoxToolName` members, `DOX_TOOL_INPUTS`, three
  `DOX_TOOL_DOCS` entries after `showCrossingClock`, `DOX_TOOLS`, and `ENABLED_TOOL_NAMES`.
  (`widget-registry.test.ts`, `chat-handler.test.ts`)
- `worker/tools.ts`: three tools with a trivial `execute`, as `showCrossingClock`.
  (`tools.test.ts`)
- `components/ask/widget-registry.ts`: three `import type` lines (never a value import) and
  three entries. (`widget-registry.test.ts`, `widget-graph.test.ts`)
- `widget-permalink.ts`: three `WidgetKind` members and paths. (`widget-permalink.test.ts`,
  whose content test checks every permalink in section P)
- `chat-constants.ts`: three `CHAT_STARTERS`, after the Crossing Clock's.
  (`chat-starters.test.ts`: under 110 characters, a digit, no tool name, the seed passes the
  schema and `validate`)
- **Manual lists, which fail nothing when forgotten:**
  - `lib/widget-load-error.test.tsx` `MOUNTS`: the three mounts.
  - `components/ask/widget-graph.test.ts` heavy list: `lib/cutoff-widgets.ts`,
    `lib/cutoff-lib.ts`, `lib/cutoff-stack.ts`, `lib/cutoff-ruler.ts` and
    `lib/cutoff-countdown.ts`.
- `scripts/html-diff.mjs` `PAGES`: `{ path: "tools/cutoff-stack", widget: "gmt-cutoff-stack gmt-widget" }`,
  and the same for `cutoff-ruler` and `cutoff-countdown`, after the Crossing Clock.
- `scripts/visual-snapshot.mjs` `PAGES`: `tool-cutoff-stack`, `tool-cutoff-ruler` and
  `tool-cutoff-countdown`, after `tool-crossing-clock`.
- `astro.config.mjs` `customCss`: `gmt-cutoff-widgets.css` then the three tool sheets, after
  `gmt-crossing-clock.css`. `optimizeDeps.entries` already globs `src/lib/**/*.ts`; confirm, no
  change.

## P. Permalinks (strings only; `?w=<kind>&wa=` + `encodeURIComponent(JSON.stringify(obj))`)

| id | kind | JSON | shows |
| --- | --- | --- | --- |
| PS1 | cutoffstack | `{"anchor":"2024-06-17T18:00:00+02:00[Europe/Amsterdam]","timeZone":"Europe/Amsterdam","cutoffCount":"2","name1":"gate-in","offset1":"P2D","atLocalTime1":"17:00","name2":"documents","offset2":"P3D","atLocalTime2":"12:00","calendar":"on","weekend":"6,7","roll":"preceding"}` | S1 |
| PS2 | cutoffstack | PS1 without `roll` | S3 `[]`, calendar-without-roll |
| PS3 | cutoffstack | `{"anchor":"2024-05-10T18:00:00+02:00[Europe/Amsterdam]","timeZone":"Europe/Amsterdam","cutoffCount":"2","name1":"gate-in","offset1":"PT6H","name2":"documents","offset2":"P1D","atLocalTime2":"12:00","calendar":"on","weekend":"6,7","holidays":"2024-05-09","roll":"preceding"}` | S6 |
| PR1 | cutoffruler | `{"anchor":"2024-11-04T18:00:00-05:00[America/New_York]","timeZone":"America/New_York","days":"2","atLocalTime":"17:00"}` | R1 |
| PR2 | cutoffruler | `{"anchor":"2024-06-14T16:00:00Z","timeZone":"Europe/Amsterdam","days":"2","atLocalTime":"17:00"}` | R2 |
| PR3 | cutoffruler | `{"anchor":"2024-03-11T22:00:00Z","timeZone":"America/New_York","days":"2","atLocalTime":"17:00"}` | R3 |
| PC1 | cutoffcountdown | `{"cutoff":"2024-06-12T17:00:00+02:00[Europe/Amsterdam]","now":"2024-06-12T17:20:00+02:00","timeZone":"Europe/Amsterdam"}` | C1 |
| PC2 | cutoffcountdown | PC1 with `"now":"2024-06-12T17:00:00+02:00"` | C3 |
| PC3 | cutoffcountdown | `{"cutoff":"2024-06-09T16:00:00+08:00[Asia/Shanghai]","now":"2024-06-12T04:00:00+08:00[Asia/Shanghai]","timeZone":"Asia/Shanghai"}` | C8: `true`, `"-PT60H"` |

`Asia/Shanghai` is not in `TRANSPORT_ZONES`; `zoneOptionsHtml` appends a selected value the
list lacks. Every value is at most 64 characters.

---

## C9. `context/dox/built.md`

Present tense, no history.

- **Tier 2, teaching widgets.** After the TRAN-9 clause, append the three TRAN-10 tools, one
  clause each: the Cut-off Stack, a sailing's cut-offs from `cutoffSchedule` on a day
  timeline, closed days shaded, each rolled cut-off drawn where it landed with a line back to
  where `cutoffAt` without a calendar puts it; the Cut-off Ruler, one departure's "N days
  before" read three ways by `cutoffAt` (calendar days, exact hours, a pinned local time) with
  the DST change between them marked; the Cut-off Countdown, `isPastCutoff` and
  `timeToCutoff` against the viewer's clock or a dragged time, with the half-open rule shown.
  Add the rule they share: they import `cutoff-widgets.ts` and load through `cutoff-lib.ts`;
  closed days come from `rollDate`, hours before a departure from `timeToCutoff`, and a moved
  cut-off from comparing `cutoffAt` with and without the calendar, never from arithmetic. The
  Countdown reads the clock only after mount and only in live mode; presets, permalinks with a
  `now` and the page's default are pinned.
- **Tier 2, tool pages.** Add `/tools/cutoff-stack/`, `/tools/cutoff-ruler/` and
  `/tools/cutoff-countdown/`.
- **Tier 2, `seedFromLocation` bullet.** Add the Cut-off Stack to the widgets that flatten
  lists into numbered keys (`name1`…`atLocalTime4`) and joined strings (`weekend`,
  `holidays`).
- **Tier 6, Widget tools.** Three bullets after `showTimetableReader`:
  - `showCutoffStack({ anchor, timeZone, cutoffs, weekend?, holidays?, roll? })` (TRAN-10):
    `roll` is never defaulted; a calendar with no roll shows the library's `[]`;
  - `showCutoffRuler({ anchor, timeZone, days, atLocalTime })` (TRAN-10);
  - `showCutoffCountdown({ cutoff, now?, timeZone })` (TRAN-10): no `now` means the reader's
    clock, live.

Do not add a row to `context/dox/tracker.md`.

---

## D. Definition of done (`dox-tester`: run each line literally)

`$WT` is `/Users/baldur/Development/northguild/gmt/gmt.worktrees/feature/191-tran-10-cutoffat-cutoffschedule-ispastcutoff`.
`$SP` is `/private/tmp/claude-501/-Users-baldur-Development-northguild-gmt-gmt-worktrees-feature-191-tran-10-cutoffat-cutoffschedule-ispastcutoff/7621eb75-c193-4aa3-b09c-70cca14e9061/scratchpad`.
This machine has no `fnm`; the Node on `PATH` (Homebrew `node@24`) matches `.nvmrc`. Use it
directly.

1. `pnpm -C $WT --filter @northguild/gmt build`, then `pnpm -C $WT --filter @gmt/dox test`
   passes, including the seven new test files and `widget-registry`, `chat-starters`,
   `widget-permalink` (with the content-permalink test), `widget-graph`, `client-graph`,
   `widget-load-error`, `font-floor`, `chat-handler` and `tools.test.ts`.
2. `pnpm -C $WT --filter @gmt/dox check` reports 0 errors. Then
   `pnpm -C $WT --filter @gmt/dox lint` passes.
3. `node $WT/scripts/api-surface.mjs check` exits 0.
4. **Every value against dist.** `DIST=$WT/packages/gmt/dist node $SP/tran10-values.mjs`
   prints `all ok`, and again with `TZ=America/Los_Angeles` and `TZ=Asia/Tokyo`. Then list
   every expected literal in the seven new test files and confirm each matches an appendix Z
   row. A result not in appendix Z fails. If a row fails, stop and report; never edit the
   script to match.
5. `pnpm -C $WT --filter @gmt/dox build` succeeds.
6. **Internal links.** From `$WT/apps/dox` after the build, run the
   `context/dox/specs/int-58-billing-deadlines.md` section 10 script with
   `tools/cutoff-stack tools/cutoff-ruler tools/cutoff-countdown
   guides/industries/transport-legs-and-dwell scenarios/two-days-before-is-not-48-hours
   scenarios/filing-anchored-to-the-wrong-event mistakes/transport`. It prints nothing and exits
   0. Check `id="the-whole-stack-cutoffschedule"`, `id="closures-roll-the-way-you-say"`,
   `id="two-days-before-is-not-48-hours-cutoffat"`, `id="has-it-passed-ispastcutoff"` and
   `id="how-long-is-left-timetocutoff"` exist in the built guide.
7. **Structural and pixel gates.** The baseline is already captured from a clean build of
   the committed branch (`cb6cf312`, before any of this work): `$SP/html-baseline` for
   `html-diff`, and `$WT/apps/dox/.visual/before` for `visual:diff`. Do not recapture it.

   ```sh
   lsof -iTCP:48173 -sTCP:LISTEN   # must print nothing
   (cd $WT/apps/dox && node scripts/html-diff.mjs compare $SP/html-baseline; pnpm visual:after; pnpm visual:diff)
   ```

   - **Expected `html-diff`:** `+` for the three new tool pages; `~` or `✓` for every other
     page. `✗` anywhere is a regression.
   - **Expected `visual:diff`:** `MISSING (no before)` for the three new tool shots. `✗`
     allowed only where the before and after PNGs show nothing else changed: every `tool-*`
     page and any page with the Tools sidebar group open at desktop (three new rows), `dox`
     (three new pills), and the changed guide, scenario and mistakes pages. Any other `✗` is a
     regression.
8. **Keyboard-only pass** on each tool page and in the `/dox` rail through each new pill:
   Tab reaches every control in visual order and nothing inside a timeline, ruler or axis;
   arrow keys change each preset and move the now slider one minute; the focus ring is
   visible in both themes. Stack: unticking the calendar shows the roll-without-calendar
   reason. Ruler: `skipped-hour` shows one `NO SIGNAL` row. Countdown: sliding from −1 to 0
   turns "On time" into "Closed".
9. **`prefers-reduced-motion: reduce`:** nothing animates. **`forced-colors: active`:**
   markers, closed-day hatches, the closed region and connectors stay distinguishable.
10. **Contrast** ≥ 7:1 for labels, verdicts, table text, axis labels and outputs, both themes.
11. **Phone width.** At 390×844 no tool page scrolls sideways, and `/dox`'s empty screen with
    its pills fits.
12. **Droppability.** No tool page's scripts pull in a `zod`, `ai` or `dox-tools` chunk.
13. **Law grep** prints nothing:
    `grep -rniE "IATA|GTFS|ICAO|\bIMO\b|SOLAS|CFR|statut|regulation|docket|Incoterm" $WT/apps/dox/src/content/docs/tools/cutoff-*.mdx $WT/apps/dox/src/lib/cutoff-*.ts`.
14. `git -C $WT status --short` shows only the files in section 11, and nothing staged.

Items 8–11 need a browser. Run what can be driven with Playwright; report any that cannot run.
The main session runs `pnpm stats:sync` and `pnpm run validate`; do not run them.

---

## E. Risks and plan corrections

- **R1. The reviewer's first two pill texts break the pill length rule.** They are 150 and
  121 characters; `chat-starters.test.ts` requires under 110. *Resolution:* shortened to 109
  and 107 characters, keeping every fact and the roll direction ("weekend to Friday"). The
  Countdown's pill is used as written (100).
- **R2. "The viewer's clock by default" versus reproducibility.** *Resolution:* C-c3. A chat
  call or permalink without `now` is live; the bare page opens pinned on the pill preset; the
  template never reads the clock.
- **R3. `getUtcNow` may not follow `vi.setSystemTime`.** *Resolution:* check first; fall back
  to the injected `clock` option. Never patch the polyfill.
- **R4. Mapping `cutoffSchedule` rows back to entries.** Rows are sorted, and names may repeat.
  *Resolution:* the first unused entry with the same name and the same per-entry `cutoffAt`
  result (C-s1). The library's contract says each row is that `cutoffAt` call.
- **R5. Closed-day shading must not re-implement the calendar.** *Resolution:*
  `rollDate(date, "following", calendar) === date`, a library call that never moves a
  business day (SC, SC2).
- **R6. `cutoffAt` does not check order.** `following` can put a cut-off after the
  departure. *Resolution:* the row says so, from `isPastCutoff(at, anchor)` (S7). It is the
  rule's answer, not an error, and is not drawn as one.
- **R7. Fourteen starter pills on `/dox`.** *Resolution:* D11 checks phone width. Trimming
  pills is an owner decision.
- **R8. Chat tool overlap.** `showCutoffRuler` sits near `showDstInspector`, and
  `showCutoffCountdown` near `showBillingDeadlines`. *Resolution:* the `when` lines name
  "days before versus hours before" and "has a cut-off passed". Probing brains spends quota;
  offer `scripts/probe-brains.ts` to the owner after merge.
- **R9. `html-diff` matches roots by literal string.** *Resolution:* each root exactly as
  written.
- **R10. Documentation drift found while planning.** `built.md` and the Dox agent personas say
  the shell uses `fnm`; this machine has none, and the Node on `PATH` matches `.nvmrc`. The
  main session corrects `built.md`'s toolchain line at close-out.

## Blocked on the library pipeline

Nothing. Every value in appendix Z passes against the final source.

---

## 11. Files

**Create** (under `apps/dox/`):

- Shared: `src/lib/cutoff-widgets.ts`, `src/lib/cutoff-widgets.test.ts`, `src/lib/cutoff-lib.ts`,
  `src/styles/gmt-cutoff-widgets.css`.
- For each of `cutoff-stack`, `cutoff-ruler` and `cutoff-countdown`:
  `src/lib/<name>.ts`, `src/lib/<name>.test.ts`, `src/lib/<name>-mount.ts`,
  `src/lib/<name>-mount.test.tsx`, `src/components/<Name>.astro`,
  `src/content/docs/tools/<name>.mdx`, `src/styles/gmt-<name>.css`.

**Modify:**

- Content (under `src/content/docs/`): `guides/industries/transport-legs-and-dwell.mdx`,
  `scenarios/two-days-before-is-not-48-hours.mdx`,
  `scenarios/filing-anchored-to-the-wrong-event.mdx`, `mistakes/transport.mdx`.
- `src/lib/dox-tools.ts`, `src/lib/chat-constants.ts`, `src/lib/widget-permalink.ts`,
  `src/lib/widget-load-error.test.tsx`, and `src/lib/transport-widgets.ts` only if a private
  helper is exported (C0.1).
- `src/components/ask/widget-registry.ts`, `src/components/ask/widget-graph.test.ts`,
  `worker/tools.ts`.
- `src/styles/gmt-a11y.css`, `src/styles/gmt-transport-widgets.css` (root selector lists
  only), `astro.config.mjs`.
- `scripts/html-diff.mjs`, `scripts/visual-snapshot.mjs`.
- Context: `context/dox/built.md`, this spec.

**Close-out for the main session:** `pnpm stats:sync`, `pnpm run validate`, the `fnm` line in
`built.md` (R10), and a `probe-brains.ts` offer (R8).

---

## Appendix Z. The values script (`$SP/tran10-values.mjs`)

Run: `DIST=$WT/packages/gmt/dist node $SP/tran10-values.mjs`. It prints `ok <id>` per row
and `all ok`, or exits 1 on any `FAIL`. The script is saved at that path; this is its content.

```js
// tran10-values.mjs — every value the TRAN-10 dox tools and page links show.
// Run: DIST=<path to packages/gmt/dist> node tran10-values.mjs   (prints `ok <id>` per row; exit 1 on any FAIL)
const DIST = process.env.DIST;
const { cutoffAt, cutoffSchedule } = await import(`${DIST}/transport/calculate/index.js`);
const { isPastCutoff, timeToCutoff } = await import(`${DIST}/transport/compare/index.js`);
const { etaAtZone } = await import(`${DIST}/transport/convert/index.js`);
const { rollDate } = await import(`${DIST}/calendar/business/index.js`);
let failed = 0;
const eq = (id, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) console.log(`ok ${id}`); else { failed++; console.log(`FAIL ${id}\n  got  ${g}\n  want ${w}`); }
};
const AMS = "Europe/Amsterdam", NY = "America/New_York";
const WK = { weekend: [6, 7], holidays: [], timeZone: AMS };
const HOL = { weekend: [6, 7], holidays: ["2024-05-09"], timeZone: AMS };
const z = (s) => `${s}[${AMS}]`;

// --- Cut-off Stack (cutoffSchedule; unrolled positions from cutoffAt with no calendar/roll)
const SAIL = "2024-06-17T18:00:00+02:00[Europe/Amsterdam]"; // Monday 17 June 2024, 18:00 Rotterdam
const GATE = { name: "gate-in", offset: "P2D", atLocalTime: "17:00" };
const DOCS = { name: "documents", offset: "P3D", atLocalTime: "12:00" };
const VGM = { name: "VGM", offset: "P1D", atLocalTime: "10:00" };
eq("S1 pill, preceding", cutoffSchedule(SAIL, [GATE, DOCS], { timeZone: AMS, calendar: WK, roll: "preceding" }),
  [{ name: "documents", at: z("2024-06-14T12:00:00+02:00") }, { name: "gate-in", at: z("2024-06-14T17:00:00+02:00") }]);
eq("S1u gate-in unrolled", cutoffAt(SAIL, "P2D", { timeZone: AMS, atLocalTime: "17:00" }), z("2024-06-15T17:00:00+02:00"));
eq("S1v documents unrolled", cutoffAt(SAIL, "P3D", { timeZone: AMS, atLocalTime: "12:00" }), z("2024-06-14T12:00:00+02:00"));
eq("S1w gate-in rolled", cutoffAt(SAIL, "P2D", { timeZone: AMS, atLocalTime: "17:00", calendar: WK, roll: "preceding" }), z("2024-06-14T17:00:00+02:00"));
eq("S1x documents before sailing", timeToCutoff(z("2024-06-14T12:00:00+02:00"), SAIL), "PT78H");
eq("S1y gate-in before sailing", timeToCutoff(z("2024-06-14T17:00:00+02:00"), SAIL), "PT73H");
eq("S2 following + VGM", cutoffSchedule(SAIL, [GATE, DOCS, VGM], { timeZone: AMS, calendar: WK, roll: "following" }),
  [{ name: "documents", at: z("2024-06-14T12:00:00+02:00") }, { name: "VGM", at: z("2024-06-17T10:00:00+02:00") }, { name: "gate-in", at: z("2024-06-17T17:00:00+02:00") }]);
eq("S2u VGM unrolled", cutoffAt(SAIL, "P1D", { timeZone: AMS, atLocalTime: "10:00" }), z("2024-06-16T10:00:00+02:00"));
eq("S2x gate-in 1 h before sailing", timeToCutoff(z("2024-06-17T17:00:00+02:00"), SAIL), "PT1H");
eq("S2y VGM before sailing", timeToCutoff(z("2024-06-17T10:00:00+02:00"), SAIL), "PT8H");
eq("S3 calendar, no roll", cutoffSchedule(SAIL, [GATE, DOCS], { timeZone: AMS, calendar: WK }), []);
eq("S3b roll, no calendar", cutoffSchedule(SAIL, [GATE, DOCS], { timeZone: AMS, roll: "preceding" }), []);
eq("S3c no calendar at all", cutoffSchedule(SAIL, [GATE, DOCS], { timeZone: AMS }),
  [{ name: "documents", at: z("2024-06-14T12:00:00+02:00") }, { name: "gate-in", at: z("2024-06-15T17:00:00+02:00") }]);
eq("S4 JSDoc stack", cutoffSchedule("2024-06-14T16:00:00Z", [{ name: "gate-in", offset: "P1D" }, { name: "document", offset: "P2D", atLocalTime: "17:00" }, { name: "VGM", offset: "P1D", atLocalTime: "10:00" }], { timeZone: AMS }),
  [{ name: "document", at: z("2024-06-12T17:00:00+02:00") }, { name: "VGM", at: z("2024-06-13T10:00:00+02:00") }, { name: "gate-in", at: z("2024-06-13T18:00:00+02:00") }]);
eq("S5 skipped hour", cutoffSchedule("2024-03-11T22:00:00Z", [{ name: "gate-in", offset: "P1D" }, { name: "VGM", offset: "P1D", atLocalTime: "02:30" }], { timeZone: NY }), []);
eq("S5b the entry that fails", cutoffAt("2024-03-11T22:00:00Z", "P1D", { timeZone: NY, atLocalTime: "02:30" }), "");
eq("S5c the entry that works", cutoffAt("2024-03-11T22:00:00Z", "P1D", { timeZone: NY }), "2024-03-10T18:00:00-04:00[America/New_York]");
const HSAIL = "2024-05-10T18:00:00+02:00[Europe/Amsterdam]"; // Friday 10 May 2024; Thursday 9 May a holiday
eq("S6 holiday", cutoffSchedule(HSAIL, [{ name: "gate-in", offset: "PT6H" }, { name: "documents", offset: "P1D", atLocalTime: "12:00" }], { timeZone: AMS, calendar: HOL, roll: "preceding" }),
  [{ name: "documents", at: z("2024-05-08T12:00:00+02:00") }, { name: "gate-in", at: z("2024-05-10T12:00:00+02:00") }]);
eq("S6u documents unrolled", cutoffAt(HSAIL, "P1D", { timeZone: AMS, atLocalTime: "12:00" }), z("2024-05-09T12:00:00+02:00"));
eq("S6v gate-in unrolled", cutoffAt(HSAIL, "PT6H", { timeZone: AMS }), z("2024-05-10T12:00:00+02:00"));
const EARLY = "2024-06-17T09:00:00+02:00[Europe/Amsterdam]";
eq("S7 following lands after an 09:00 sailing", cutoffSchedule(EARLY, [{ name: "gate-in", offset: "P1D", atLocalTime: "17:00" }, DOCS], { timeZone: AMS, calendar: WK, roll: "following" }),
  [{ name: "documents", at: z("2024-06-14T12:00:00+02:00") }, { name: "gate-in", at: z("2024-06-17T17:00:00+02:00") }]);
eq("S7x after the sailing", [isPastCutoff(z("2024-06-17T17:00:00+02:00"), EARLY), timeToCutoff(z("2024-06-17T17:00:00+02:00"), EARLY)], [true, "-PT8H"]);
eq("S8 empty list", cutoffSchedule(SAIL, [], { timeZone: AMS }), []);
eq("S9 bad offset", cutoffSchedule(SAIL, [{ name: "gate-in", offset: "2 days" }], { timeZone: AMS }), []);
eq("S9b bad time", cutoffSchedule(SAIL, [{ name: "gate-in", offset: "P2D", atLocalTime: "25:00" }], { timeZone: AMS }), []);
eq("S9c zoneless anchor", cutoffSchedule("2024-06-17T18:00:00", [{ name: "gate-in", offset: "P2D" }], { timeZone: AMS }), []);
eq("S9d unknown zone", cutoffSchedule(SAIL, [{ name: "gate-in", offset: "P2D" }], { timeZone: "Mars/Olympus_Mons" }), []);
eq("S9e bad holiday", cutoffSchedule(SAIL, [GATE], { timeZone: AMS, calendar: { weekend: [6, 7], holidays: ["2024-02-30"], timeZone: AMS }, roll: "preceding" }), []);
eq("S9f roll none stays on Saturday", cutoffAt(SAIL, "P2D", { timeZone: AMS, atLocalTime: "17:00", calendar: WK, roll: "none" }), z("2024-06-15T17:00:00+02:00"));
eq("SC closed days (rollDate following === date)", ["2024-06-13", "2024-06-14", "2024-06-15", "2024-06-16", "2024-06-17"].map((d) => rollDate(d, "following", WK) === d), [true, true, false, false, true]);
eq("SC2 holiday closed", ["2024-05-08", "2024-05-09", "2024-05-10"].map((d) => rollDate(d, "following", HOL) === d), [true, false, true]);

// --- Cut-off Ruler (cutoffAt three ways; hours before departure from timeToCutoff(cutoff, anchor))
const ruler = (anchor, tz, days, at) => [
  cutoffAt(anchor, `P${days}D`, { timeZone: tz }),
  cutoffAt(anchor, `PT${days * 24}H`, { timeZone: tz }),
  cutoffAt(anchor, `P${days}D`, { timeZone: tz, atLocalTime: at }),
].map((c) => [c, timeToCutoff(c, anchor)]);
const NYDEP = "2024-11-04T18:00:00-05:00[America/New_York]";
eq("R1 pill, New York fall-back", ruler(NYDEP, NY, 2, "17:00"), [
  ["2024-11-02T18:00:00-04:00[America/New_York]", "PT49H"],
  ["2024-11-02T19:00:00-04:00[America/New_York]", "PT48H"],
  ["2024-11-02T17:00:00-04:00[America/New_York]", "PT50H"]]);
eq("R2 Amsterdam, no transition (JSDoc anchor)", ruler("2024-06-14T16:00:00Z", AMS, 2, "17:00"), [
  [z("2024-06-12T18:00:00+02:00"), "PT48H"], [z("2024-06-12T18:00:00+02:00"), "PT48H"], [z("2024-06-12T17:00:00+02:00"), "PT49H"]]);
eq("R3 New York spring-forward", ruler("2024-03-11T22:00:00Z", NY, 2, "17:00"), [
  ["2024-03-09T18:00:00-05:00[America/New_York]", "PT47H"],
  ["2024-03-09T17:00:00-05:00[America/New_York]", "PT48H"],
  ["2024-03-09T17:00:00-05:00[America/New_York]", "PT48H"]]);
eq("R4 repeated hour, 01:30", ruler("2024-11-04T23:00:00Z", NY, 1, "01:30"), [
  ["2024-11-03T18:00:00-05:00[America/New_York]", "PT24H"],
  ["2024-11-03T18:00:00-05:00[America/New_York]", "PT24H"],
  ["2024-11-03T01:30:00-04:00[America/New_York]", "PT41H30M"]]);
eq("R5 skipped hour, 02:30", ruler("2024-03-11T22:00:00Z", NY, 1, "02:30"), [
  ["2024-03-10T18:00:00-04:00[America/New_York]", "PT24H"],
  ["2024-03-10T18:00:00-04:00[America/New_York]", "PT24H"],
  ["", ""]]);
eq("RA departures rendered", [etaAtZone(NYDEP, NY), etaAtZone("2024-06-14T16:00:00Z", AMS), etaAtZone("2024-03-11T22:00:00Z", NY), etaAtZone("2024-11-04T23:00:00Z", NY)],
  ["2024-11-04T18:00:00-05:00[America/New_York]", z("2024-06-14T18:00:00+02:00"), "2024-03-11T18:00:00-04:00[America/New_York]", "2024-11-04T18:00:00-05:00[America/New_York]"]);

// --- Cut-off Countdown (isPastCutoff, timeToCutoff; now rendered with etaAtZone)
const GATEIN = "2024-06-12T17:00:00+02:00[Europe/Amsterdam]";
const cd = (now, cut, tz) => [isPastCutoff(now, cut), timeToCutoff(now, cut), etaAtZone(now, tz)];
eq("C1 pill, 17:20 late", cd("2024-06-12T17:20:00+02:00", GATEIN, AMS), [true, "-PT20M", z("2024-06-12T17:20:00+02:00")]);
eq("C2 16:10 early", cd("2024-06-12T16:10:00+02:00", GATEIN, AMS), [false, "PT50M", z("2024-06-12T16:10:00+02:00")]);
eq("C3 at the cut-off", cd("2024-06-12T17:00:00+02:00", GATEIN, AMS), [true, "PT0S", z("2024-06-12T17:00:00+02:00")]);
eq("C3b a minute before", cd("2024-06-12T16:59:00+02:00", GATEIN, AMS), [false, "PT1M", z("2024-06-12T16:59:00+02:00")]);
eq("C4 a New York clock, same instant", cd("2024-06-12T11:00:00-04:00[America/New_York]", GATEIN, AMS), [true, "PT0S", z("2024-06-12T17:00:00+02:00")]);
eq("C5 repeated hour, second 01:30", cd("2024-11-03T01:30:00-05:00[America/New_York]", "2024-11-03T01:30:00-04:00[America/New_York]", NY), [true, "-PT1H", "2024-11-03T01:30:00-05:00[America/New_York]"]);
eq("C6 zoneless now", cd("2024-06-12T17:20:00", GATEIN, AMS), [false, "", ""]);
eq("C7 cutoffAt's sentinel as the cut-off", [isPastCutoff("2024-06-12T17:20:00+02:00", ""), timeToCutoff("2024-06-12T17:20:00+02:00", "")], [false, ""]);
eq("C8 filing at the departure-based deadline", cd("2024-06-12T04:00:00+08:00[Asia/Shanghai]", "2024-06-09T16:00:00+08:00[Asia/Shanghai]", "Asia/Shanghai"), [true, "-PT60H", "2024-06-12T04:00:00+08:00[Asia/Shanghai]"]);
eq("C9 JSDoc across the fall-back", timeToCutoff("2024-11-02T17:00:00-04:00[America/New_York]", "2024-11-03T17:00:00-05:00[America/New_York]"), "PT25H");
eq("C10 JSDoc one ns ahead", timeToCutoff("2024-06-12T14:59:59.999999999Z", GATEIN), "PT0.000000001S");
eq("C11 live tick, one minute on from C1", [isPastCutoff("2024-06-12T15:21:00Z", GATEIN), timeToCutoff("2024-06-12T15:21:00Z", GATEIN)], [true, "-PT21M"]);

if (failed) { console.log(`${failed} FAILED`); process.exit(1); }
console.log("all ok");
```
