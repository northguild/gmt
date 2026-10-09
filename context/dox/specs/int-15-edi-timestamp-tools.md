# Spec: EDI timestamps on the docs site (INT-15)

What `apps/dox` ships for INT-15: two tools, one guide, three scenarios and the pages around
them. `dox-builder` changes them against this spec, and `dox-tester` verifies them against
section G. This is not `packages/gmt` work. Nothing here edits library source, tests, the
READMEs, `packages/gmt/skills/`, `.changeset/` or `context/domination/`. A library problem found
while working on the site is reported to the main session and never built around.

**The library surface the site draws on** is three module barrels and two public patterns. Every
EDI function is small: one per kind of value, typed to only its codes, with no options argument.
A parser returns one house value, and a formatter takes it back.

| Barrel | Functions |
| --- | --- |
| `@northguild/gmt/intermodal/parse` | `parseEdifactDate`, `parseEdifactTime`, `parseEdifactDateTime`, `parseEdifactOffsetDateTime`, `parseEdifactDatePeriod`, `parseEdifactDateTimePeriod`, `parseX12Date`, `parseX12Time`, `parseX12DateTime`, `parseX12DateRange`, `parseX12DateTimeRange`, `parseX12DateAndTime`, `x12TimeCodeOffset`, `x12TimeCodeZone`, `classifyEdifactDtmFormat`, `classifyX12DateTimePeriodFormat`, `classifyX12TimeCode`, `parseEpcisEvent` |
| `@northguild/gmt/intermodal/format` | `formatEdifactDate`, `formatEdifactTime`, `formatEdifactDateTime`, `formatEdifactOffsetDateTime`, `formatEdifactDatePeriod`, `formatEdifactDateTimePeriod`, `formatX12Date`, `formatX12Time`, `formatX12DateTime`, `formatX12DateRange`, `formatX12DateTimeRange`, `formatEpcisEvent` |
| `@northguild/gmt/intermodal/validate` | an `isValid…` for each parser, `isValidEdifactDtmFormat`, `isValidX12DateTimePeriodFormat`, `isValidX12TimeCode`, `isValidEpcisEvent` |
| `@northguild/gmt/regex` | `epcisEventTime`, `epcisTimeZoneOffset` |

| Kind | Classifier kind | Codes | House value |
| --- | --- | --- | --- |
| UN/EDIFACT date | `date` | `102` | `2024-06-15` |
| UN/EDIFACT time | `time` | `401` `402` | `14:30:00` |
| UN/EDIFACT local date-time | `dateTime` | `203` `204` | `2024-06-15T14:30:00` |
| UN/EDIFACT date-time with offset | `offsetDateTime` | `205` `208` `303` `304` | `2024-06-15T14:30:00+02:00` |
| UN/EDIFACT date period | `datePeriod` | `718` | `{ start, end }` |
| UN/EDIFACT date-time period | `dateTimePeriod` | `719` | `{ start, end }` |
| X12 date | `date` | `D8` `DB` | `2024-06-15` |
| X12 time | `time` | `TM` `TS` | `14:30:00` |
| X12 local date-time | `dateTime` | `DT` `RTS` | `2024-06-15T14:30:00` |
| X12 date range | `dateRange` | `RD8` `RD` | `{ start, end }` |
| X12 date-time range | `dateTimeRange` | `RDT` `DTS` | `{ start, end }` |

A period or range formatter takes `(start, end, format)`. The classifiers return
`{ kind, format }` (`{ kind, timeCode }` for a time code) or `null`. `303` and `304` read a signed
hour, `UTC` or `GMT` only, so `CET` is the sentinel. Formatters truncate seconds and fractions to
the mask. The two-digit-year codes (`101 201 202 206 207 301 302 713 717`, `D6 TT TR RD6 TU`) and
the odd codes (`209 404 406 TC EH DDT DTD RTM UN`) are not read by any EDI function; a
two-digit-year value is read with `parseDateWithPattern` or `parseDateTimeWithPattern`, a `yy`
pattern and a `yearWindow`.

The X12 elements are read by different functions. `parseX12DateAndTime(date, time)` reads elements
373 and 337, as `AT7`, `G62` and `DTM-02`/`03`/`04` carry them side by side, and `parseX12Time(value)`
reads every form of element 337. `x12TimeCodeOffset(code)` gives `-05:00` for the 31 offset codes
and `x12TimeCodeZone(code)` gives `{ zone, daylight }` for the 25 named codes. A 1250 qualifier
and an element 1251 value, as a `DTP` and `DTM-05`/`06` carry them, are read by the parser of the
qualifier's kind.

Sources, in order of precedence: the binding rules in section 0, then
`context/domination/issues/INT-15.md`, then the JSDoc of each function under
`packages/gmt/src/intermodal/{parse,format,validate}/` and of `resolveLocal`, `classifyLocal`,
`toOffsetInstant` and `fromOffsetInstant` under `packages/gmt/src/instant/convert/`, then
`context/domination/docs-site.md`, then `context/dox/built.md`. The tool shape follows
`context/dox/specs/int-58-billing-deadlines.md` (one widget) and
`context/dox/specs/tran-57-punctuality.md` (a shared helper module, a shared loader and a shared
sheet).

**Every value in this spec and on the pages is a real call.** A result shown in a page is pasted
from a run against `packages/gmt/src`, never typed. A test runs each preset against the library.

Line anchors in section C are for the tree this spec describes. Re-read each file before editing:
an anchor says where to look, not what is there.

---

## 0. Binding rules

- **Two tools only.** The **DTM Decoder** (`/tools/dtm-decoder/`, kind `dtm`, chat tool
  `showDtmDecoder`) and the **X12 Time Reader** (`/tools/x12-time-reader/`, kind `xtime`, chat tool
  `showX12TimeReader`). There is no EPCIS tool and no cross-format tool. MCP UI widgets are out
  of scope.
- `apps/dox` does not perturb `packages/gmt`. No changeset. **No git operation that changes
  state**: no `add`, `commit`, `stash`, `checkout`, `restore`, `rm`. Leave every change unstaged.
- **Toolchain.** This machine has `fnm`. Prefix every Node command with
  `eval "$(fnm env)" && fnm use &&`.
- **Never rebuild `packages/gmt/dist` while `astro dev` is serving pages.** The dev server
  aliases `@northguild/gmt` to `dist`, so a rebuild breaks every widget on an open page until the
  build ends and the page is reloaded. Vitest in `apps/dox` also resolves `@northguild/gmt` from
  `dist`, so a test run reads whatever `dist` holds.
- **Import gmt at module granularity only**, through `GMT_MODULES`: `intermodal/parse`,
  `intermodal/format`, `instant/convert`, `zoned/validate` and `utc/calculate`. Nothing else from
  gmt, never the root and never a namespace barrel.
- **The widgets draw the library's results and compute none of them.** Each tool classifies the
  code first, then calls the parser of the kind the classifier named, and prints the real call and
  its real result. Every decoded value, time-code meaning, instant, offset in force, written-back
  value and gap duration is a gmt call. The site-side code does three things only, and each is
  stated on screen: it splits a pasted `DTM` segment into its components (`splitDtm`), it names
  the function a kind maps to (`EDIFACT_FUNCTIONS`, `X12_FUNCTIONS`), and it formats a returned
  ISO 8601 duration as "15 h". `@js-temporal/polyfill` is imported for drawing only: mark
  positions on the gap strip.
- **Nothing guesses.** Nothing derives a zone or an offset from a place, port, partner,
  abbreviation, zone name or time code, and typing a value never fills, suggests or changes a
  zone. A preset is an example, and an example may state its place: it carries its zones as
  literal fields of the preset object, written by hand beside its description, and the
  description says the zone is the example's pick and the reader can change it. Every other zone
  is the reader's. The site holds no table of codes to kinds: a code's kind comes from the
  classifier and its layout from the kind's formatter. The one list of codes the site holds is
  `TWO_DIGIT_YEAR_CODES` in `edi-widgets.ts`, an advisory list for the sentence under `NO SIGNAL`
  (what to use instead of a code the library does not read); a test asserts that every code in it
  is one the classifiers return `null` for. Every "not stated" case renders as those words. A
  blank optional input is left out of the call and never filled from a preset.
- **Every zone is read with `disambiguation: "reject"`**, and the widget says so beside the
  result and in the printed call. Any other policy picks an instant for a repeated or skipped
  time, which is a guess. A stated offset needs no policy: `resolveLocal(local, offset)`.
- **Every sentinel renders through `renderWidgetOutput(out, "NO SIGNAL", "sentinel")`** with a
  reason aside (`renderAside(el, "caution", …)`) of one plain sentence. A state with no library
  call behind it renders through `renderWidgetOutput(out, text, "empty")`, never amber. A `null`
  or `""` the library returned is always the sentinel, and it is told from a legitimately empty
  result: nothing in either tool returns an empty array.
- **Standards are named as data; nothing else is named.** Widget strings, preset labels, chat
  docs and test names may name UN/EDIFACT, UNTDID data elements 2379, 2380 and 2005, the
  UN/EDIFACT syntax rules, UN/ECE Recommendation 7, ANSI X12 and its data elements 373, 337, 623,
  1250 and 1251, GS1 EPCIS 2.0 and ISO/IEC 19987, and the codes themselves (`203`, `RD8`, `ET`).
  The only X12 segments named are `AT7`, `G62`, `DTM` and `DTP`, as carriers of those elements,
  and the only transaction sets named for the three elements are the 214 for `AT7` and the 204
  for `G62`. They name no regulator, statute, agency, court, carrier, partner or business event.
  Each pure module states this rule in its header comment.
- **X12 is called what it is.** Every page that introduces X12 says it is a United States
  standard, and that GMT read its code lists through an X12-licensed dictionary and not the X12
  text.
- **Docs rules** (`context/domination/docs-site.md`): every result shown is the function's real
  output, pasted unelided; justify with standards only, and name no peer library; a two-digit
  year is presented as a legacy form, read with the pattern parsers; no line names
  `bolTimestamp` or `multimodalETA` beyond the one list of the layer's functions in
  `mistakes/intermodal.mdx`.
- **React stays inside `/dox`.** Each tool page is Astro plus a plain-DOM module.
- **The tier stays droppable.** A tool page imports no `dox-tools.ts`, `zod` or `ai`. Deleting the
  chat leaves both pages working.
- **Counts drift.** Page copy holds no function, test, tool or guide count. The counts of codes
  that a page states (the 56 codes of 623, 31 offset and 25 named) are the standard's and the
  library's.
- **Plain English** (`/plain-english`): short sentences, active voice, one idea per sentence, no
  "simply", no "just".

---

## A. Scope and non-goals

**In scope:** two tools with their chat registration; one guide; three scenarios; the intermodal
mistakes; the Standards guide; the home page; Why GMT; three indexes; the intermodal tag
definition and the chat area label; `context/dox/built.md`.

**Not in scope:**

- An EPCIS tool, a cross-format converter, or any tool that reads a whole interchange.
- A custom `UNA` service string. The splitter reads the default service characters only and
  says so.
- Any segment other than `DTM`, and any part of a `DTM` beyond the three components of its
  composite. The function qualifier is shown as sent and never interpreted.
- X12 segment parsing. The X12 tool takes element values, not a segment string.
- A registry of places, ports, partners, abbreviations or zone names.
- A disambiguation control. Both tools resolve with `disambiguation: "reject"` and say so.
- A year-window control, or any code the EDI functions do not read. The sentinel's sentence
  names the pattern parsers and the `yearWindow` instead.
- A check of an X12 daylight flag against the zone the reader picks.
- `packages/gmt`, the READMEs and `context/domination/`.

---

## B. The tools

Both root elements are `<div class="gmt-dtm-decoder gmt-widget not-content">` and
`<div class="gmt-x12-time-reader gmt-widget not-content">`, the first thing in each template, with
no other attribute. Each widget has a pure module (`dtm-decoder.ts`, `x12-time-reader.ts`) holding
state, presets, reading and text, and a mount (`…-mount.ts`) holding the template and the wiring.
The two share `edi-widgets.ts`, `edi-lib.ts`, `edi-picture.ts`, `edi-render.ts` and
`gmt-edi-widgets.css`.

### B0. Shared pieces

#### B0.1 `src/lib/edi-widgets.ts` (pure: no DOM, no gmt import)

- `EdiLib`: the injected library. Its members are the three classifiers, the per-kind parsers and
  formatters, `parseX12DateAndTime`, `x12TimeCodeOffset`, `x12TimeCodeZone`, `resolveLocal`,
  `classifyLocal`, `toOffsetInstant`, `fromOffsetInstant`, `isValidTimeZone`, `minUtc`, `maxUtc`
  and `diffUtcAsDuration`. The types are declared locally: `Interval`, `EdiHouse`,
  `EdifactClass`, `X12Class`, `X12TimeCodeClass`, `X12Zone`.
- `runCall(lib, fn, ...args)` returns `{ fn, args, result }`, so what is printed is the call made.
  `isSentinel` is true for `""` and `null`; `isInterval` tells a period from a value.
- `EDIFACT_FUNCTIONS` and `X12_FUNCTIONS` map a classifier kind to its parser, its formatter and
  whether it is a period. `parseClassified` calls the parser with `(value, format)` (the narrowed
  `TM` or `TS` too, for `parseX12Time`); `formatClassified` calls the formatter with a period's
  start and end as two arguments. `KIND_WORDS` names a kind for the Kind row.
- `unreadCodeText(code, standard)` is the one sentence for a code the classifier returns `null`
  for: a two-digit-year code (with the pattern, where the guide gives one, and a `yearWindow`) or a
  code the library does not read. `TWO_DIGIT_YEAR_CODES` is the advisory list behind it.
- `EDI_ZONES`: `[...CURATED_TIMEZONES, "Europe/Amsterdam", "Asia/Singapore", "America/Atikokan"]`.
  Zone `<select>`s are built with `zoneOptionsHtml(EDI_ZONES, selected, "No zone")`.
- `readoutOf`, `readoutRowsHtml`: a member row is a value, `not stated` (the read does not hold
  it) or `no result` (a refused or blank read). A flag shows its meaning, never `null`.
- `resolveReason(local, zone, lib)`: why `resolveLocal` returned `""`, by `classifyLocal`.
  `resolveInZone`, `widestGap`, `durationText`, `GAP_PROMPT`.
- `callArgs` and `formatValue` are re-exported from `punctuality-widgets.ts`, so the printed call
  and result are the library's literal output.

`src/lib/edi-widgets.test.ts` and `src/test/edi-lib.ts`: the latter exports `lib`, the real
functions imported by module path and typed as an `EdiLib`, so no unit test needs the mount's
dynamic imports.

#### B0.3 `src/lib/edi-lib.ts`

`loadEdiLib(): Promise<EdiLib>`: one `Promise.all` over the five `GMT_MODULES` keys. A failed
import rejects, and the mount turns it into a `WidgetLoadError`.

#### B0.4 `src/styles/gmt-edi-widgets.css`

Registered in `astro.config.mjs` `customCss`. It places the controls, the panes and the pictures
both tools share and adds no control CSS. Its header states the principle: pictures on the left,
values on the right, one seam through the sections, every region present in every state.

- **Roots and queries.** `.gmt-dtm-decoder, .gmt-x12-time-reader { container-type: inline-size; }`.
  Each section is a container named `gmt-edi-section` (the controls line and the band) and each
  pane is one named `gmt-edi-pane` (everything inside a pane). Every query is by name, because the
  field grids inside are containers too. Every section of both tools carries
  `gmt-widget-section--wide`, so each takes the card's full width instead of the four-track roles.
- **The split.** Sections 2 and 3 of both tools (and X12 section 6) each hold one
  `.gmt-edi-split` of two `.gmt-edi-pane`s in reading order, picture first. Stacked it is a column.
  From the band it is a grid on `--edi-cols`, one custom property on the widget root, so the seam
  of section 2 and the seam of section 3 are one vertical line (a gap, never a drawn edge).
  `--edi-cols: minmax(28rem, 1fr) minmax(R, 1fr)`. The panes stretch to the taller one, and the
  picture's box (`.gmt-edi-panel`) takes the difference; the taller pane's height is fixed by what
  it reserves, so the stretch moves nothing.

  What each column holds (rem of 16px; the mono face at 12.8px has a 7.7px character, at 13.6px
  8.2px):

  | Column | Minimum | Arithmetic |
  | --- | --- | --- |
  | Right, DTM Decoder | 38.75rem (620px) | the zone table's wide row: 28px badge + 200px zone select (the width of `America/Los_Angeles` in the select's face with its padding) + 154px instant (20 characters) + 46px offset (6) + 131px value written as a `205` (17) + four 8px gaps + the table's 12px padding and 1px border = 617px |
  | Right, X12 Time Reader | 45.5rem (728px) | the same row with a 23-character instant (177px, hundredths) and a 28-character local time with its offset (216px): 28 + 200 + 177 + 46 + 216 + 32 + 26 = 725px |
  | Left | 28rem (448px) | the value taken apart: the widest single value (a 208) is 280px, the segment's parts row 413px (it wraps under 30rem); the floor is legibility |
  | Gap | 1rem | |

  The band starts at the narrowest section holding both minima and the gap: DTM Decoder
  28 + 1 + 38.75 = **67.75rem** (1084px of section content), X12 Time Reader 28 + 1 + 45.5 =
  **74.5rem** (1192px). Section content widths by viewport (Chromium): 2560 is 1830px, 2000 is
  1291px, 1920 is 1228px, 1800 is 1100px, 1700 is 1005px, 1440 is 746px, 1024 is 651px, 768 is
  695px and 390 is 320px. **The DTM Decoder is two panes at 1800 and every wider viewport (2560,
  2000 and 1920 included); the X12 Time Reader from 1920 up** (its 1228px clears 1192px by 36px).
  Under the band a pane is the section's width and the layout is one column at every width down
  to 390px.
- **The controls line (section 1, and X12 section 5).** One compact line where it fits. The preset
  shares the line only where its longest label shows whole: the longest labels measure 303.0px
  (DTM `203: local time, no offset`), 270.2px (X12 `Code 24: the other end of the run`)
  and about 290px (DTP `D6: a two-digit year, not read`) in the 13.6px face, plus the
  select's 8px + 28px padding and 2px border, so the preset's column is `22rem`. There are no
  year-window fields, so the rows reflow to what is left: the line is one row from 48rem (DTM:
  22 + 15 segment + 9.5 format code + two 0.75rem gaps), 54.25rem (X12 main: 22 + three 10rem
  fields + three gaps) and 44.5rem (DTP: 22 + 9 + 12 + two gaps). Under that the preset takes its
  own row and the rest share the next while they hold their own minima (25.25rem, 31.5rem,
  21.75rem), and under that the field grid's own 11rem tracks. No row leaves a gap.
- **The value taken apart** (`.gmt-edi-panel` > `.gmt-edi-figure`, `role="img"`). The parts row
  (`.gmt-edi-parts`: a box and a caption under it, with the service characters as sent between
  boxes; the segment tag and the function qualifier have a dashed edge, which says they are not
  read), then the fields (`.gmt-edi-taken`): each half of the value a row of groups, each group
  its fields' boxes (`.gmt-edi-box`, `n` characters wide where `n` is the longer of its text and
  its mask, in the mono face) with the mask letters under them (`.gmt-edi-mask`) and a bracket
  under that (`.gmt-edi-bracket`, three sides drawn by a pseudo-element, with its label). The marks
  are `--gmt-series-1` (date), `-2` (time) and `-3` (offset or zone), drawn as the box's bottom
  edge and the bracket; no text takes a series colour. A refused value is neutral (the
  `--gmt-border-strong` edge, cut along the code's layout when the code is one the classifier knows and the length fits, else one box), and a code that carries no offset closes with a dashed ghost box
  saying `no offset`.
  The picture is drawn at a 0.9375rem face (12px masks); a single value (one half) at 1.375rem
  (`data-scale="lg"` on the figure and its sizer), so it fills the box it reserves, and is centred
  vertically in it. Its sizers include the widest time code the field takes (8 characters), so a
  typed code never wraps the row. A call frame holds one line a call: the classifier's, the
  kind's parser's and, for an offset date-time, `toOffsetInstant`'s; the output beside it holds
  one result a line, in the same order (`.gmt-edi-out` is `white-space: pre-wrap`).
- **The member grid** (`.gmt-edi-readouts`): a `<dl>` of small bordered cells (`.gmt-edi-row`:
  `dt` label, `dd` value), the same cells in the same places in every state. Its columns are
  `repeat(auto-fill, minmax(--edi-cell, 1fr))`, so they follow the pane's width alone;
  `--edi-cell` is 11.5rem (DTM: the 20-character instant, 154px, with 24px of padding and 2px of
  border) or 13.5rem (X12: 23 characters, 177px). A value never breaks inside itself. The DTM
  Decoder's rows are Kind, Value, Period end, Instant and Offset; the X12 Time Reader's are Kind,
  Value, Time code, Offset, Zone name, Daylight and Instant; the `DTP` section's are Kind, Value
  and Range end.
- **The verdict plate and the detail line** (`.gmt-edi-verdict`, `.gmt-edi-detail`): a full
  bevelled plate in mono, and a line in `--gmt-ice-dim`. Their heights, and those of every
  region whose text changes, come from a hold.
- **Holds.** A region whose text changes with the preset or the typed value (the preset
  description, the split line, the notes, the verdict, the detail, the gap line, the picture, the
  reason and refusal asides, the outputs and the call frames) is wrapped in `.gmt-edi-hold`, a
  one-cell grid that also holds a hidden sizer for every text the region can show
  (`holdHtml`, `textSizers`, `callSizer`, `outputSizer`, `asideSizer`, `figureSizer` in
  `edi-picture.ts`; the text lists are `dtmTexts()` and `x12Texts()`, built by running the pure
  text functions over results of each shape). The cell is as tall as the tallest, at any width,
  with no table of widths. A sizer is `aria-hidden`, `visibility: hidden`, takes no focus and
  carries `data-pagefind-ignore`. A call frame with no call keeps its box: `.gmt-edi-call[hidden]`
  is `display: block; visibility: hidden`.
- No `transition` or `animation` on any value or mark.

#### B0.5 The zone table and the shared UTC timeline (`src/styles/gmt-edi-widgets.css`)

The same local value read in up to four zones the reader chose. Both tools use the same markup
and classes. `widestGap`, `resolveInZone` and the gap prompt live in `edi-widgets.ts`, so neither
tool imports from the other.

- **The zone table** (right pane): `<div class="gmt-dtm-strip" data-role="gap-strip" role="group"
  aria-label="The same local time in up to four zones">` holds a header row (`.gmt-dtm-head`,
  `aria-hidden`) and four rows, always rendered. Row `n` (`.gmt-dtm-row`, `data-series="n"`,
  `data-role="strip-row-n"`) holds a number badge (its bottom edge in the row's series colour), a
  `<select class="gmt-select" data-role="zone-n" aria-label="Zone n">`, and three value cells:
  `instant-n`, `offset-n`, and a third: `as205-n` in the DTM Decoder (the same value written as a
  `205`, or the period's end instant, whose label and header read `end`) and `withoffset-n` in the X12 Time Reader (`fromOffsetInstant` of the instant and the
  offset in force). Each cell is mono, `tabular-nums`, `nowrap`, with a reserved width (the
  custom properties `--gmt-strip-instant` 20ch or 23ch and `--gmt-strip-third` 17ch or 28ch, and
  `7ch` for the offset). Layouts by pane width: narrow, badge and select, then the three values
  stacked with small labels; medium (27rem DTM, 34rem X12), the values on one line under the
  select; wide (38.5rem DTM, 45.5rem X12), one line a row with the labels in the header.
- A blank slot reads `no zone chosen`. When the table does not apply, the four selects are
  `disabled` and the cells blank. The rows stay.
- **The timeline** (left pane, `.gmt-edi-timeline.gmt-edi-panel`, `data-role="timeline"`,
  `role="img"` with a generated `aria-label`): one UTC axis, a tick on every whole hour and a label
  on every n-th (n is the smallest of 1, 2, 3, 4, 6, 12 that leaves at most eight labels, and a
  midnight tick is always labelled, with its `MM-DD`), a numbered pin per chosen zone (a bevelled
  pin on a stem, its number as text in `--gmt-ice` and the row's series colour on the pin's edge
  and stem), and the widest gap as a bracket between the outermost pins with its label (`15 h`,
  from `durationText`). Pins that fall within 8% of the axis share a lane, four lanes in all. The
  axis runs from the whole hour before the earliest instant to the whole hour after the latest,
  padded by `ceil(hours / 10)` hours (three each side for one instant). Positions are drawing
  only, from the polyfill's epoch milliseconds (`timelineLayout`). The box is `15rem` tall in
  every state. States, set by `drawTimeline` in `edi-render.ts` (`data-state`): `marks` (the zones);
  `stated` (a value that states its offset: one pin with no number and the caption `Stated by the
  value: …`; the zone selects are disabled); `empty` (a date alone, a time alone, a period, an
  offset alone or a refused value: words in the same box, `timelineEmptyText`, never amber).
- `widestGap(rows, lib)`: `null` with fewer than two resolved rows. Otherwise `minUtc`, `maxUtc`
  and `diffUtcAsDuration(min, max, "hours")`, shown in `gap` as
  `Widest gap: 15 h, between Asia/Shanghai and America/Los_Angeles`. With fewer than two resolved
  rows the line reads "Choose two zones to see how far apart the answers are."
- A visually hidden `strip-summary` (`aria-live="polite"`) says the rows as one sentence. A refused
  row's reason goes in `strip-aside`, as a caution aside.

#### B0.6 The layout and the pictures (`edi-picture.ts`, `edi-render.ts`)

- `shapeOf(write, family)` finds a code's layout by reading what the kind's own formatter writes.
  The caller passes a closure over the formatter and the code; the probe values are one family per
  kind (`probeFamily`): a date, a time, a local date-time or a date-time with an offset, whose
  every field differs (1987-03-14T15:26:48, an offset of +07:30 then +07:00, and for a period an
  end of 1991-05-22T08:11:37). The digits written are read back into fields (`CCYY`, `MM`, `DD`,
  `HH`, the minute, `SS`, a signed offset as `ZHHMM` of 5 characters or `ZZZ` of 3), with a
  period's separator and second half. The field order is what the formatter wrote, so `DB`'s
  `MMDDCCYY` and a hyphenated range each get their own. The site holds no table of codes, and an
  unsupported code writes nothing.
- `cutValue(value, shape)` cuts a real value along a shape, or `null` when its length is not the
  shape's.
- `edi-picture.ts` builds the strings (`takenApartHtml`, `partsHtml`, `figureAria`,
  `timelineLayout`, `timelineHtml`, `timelineAria` and the hold builders); `edi-render.ts` writes
  them into `[data-role="figure"]` and `[data-role="timeline"]` (`drawFigure`, `drawTimeline`) and
  the calls into a call frame (`renderCalls`, `callResultsText`). A region is never removed: an
  empty state is words in the same box.
- The picture's spoken line says what each field holds: `202406151430 under code 203: year 2024,
  month 06, day 15, hour 14, minute 30; no offset`; a segment is led by `Segment with function
  qualifier 137, shown as sent.`

### B1. DTM Decoder: `/tools/dtm-decoder/`, kind `dtm`

**Inputs** (`DtmState`, all strings): the segment-or-value field (`input`, at most 64
characters), the 2379 format code (`format`, disabled and mirroring the segment's code while a
segment is pasted) and four zone selects. There is no year-window control. `splitDtm` applies the
default service characters `:+.? '`: only a string that starts with `DTM+` is a segment, its
release character is taken out, and a bare value reaches the library as typed.

**Reading** (`readDtm`): with a format code, call `classifyEdifactDtmFormat(format)`. If it returns
a class, call the parser `EDIFACT_FUNCTIONS[kind].parse` with `(value, format)`. For an
`offsetDateTime` result also call `toOffsetInstant(house)`, which gives the instant and the offset.
The call frame prints every call made, one per line, and the output beside it prints each result.
A blank form (nothing typed in the segment field or the code) makes no call and shows the empty
state; a value with no code makes no call and shows the sentinel with its reason.

**The verdict has two forms.** The offset is stated (an offset date-time: `Offset: stated
(+02:00)` and the instant on the timeline), or it is not (a date, a time, a local date-time or a
period: `Offset: not stated`). The strip applies to a local date-time and a period of local
date-times; it reads each in the four zones the reader picked, a period at both ends (the third
column then reads `end`). A date, a time and a period of dates name no instant, so the zone
selects are disabled and the timeline says so in words.

**Readouts:** Kind, Value, Period end, Instant, Offset.

**Why `NO SIGNAL`.** One plain sentence (`sentinelText`), decided from the calls made:
a blank value, a missing code, a code the classifier does not know (`unreadCodeText`: for a
two-digit-year code the pattern parser and a `yearWindow`; for `209`, `602` and the rest that the
code is not read), a release character left in a bare value, a signed-hour field holding a zone
abbreviation (`CET` under `303`: the field holds a signed hour such as +01, `UTC` or `GMT`), or a
value that does not fit its code.

**Written back:** the kind's formatter called with what the parser returned (a period's start and
end as two arguments) and the classifier's code. UTC and GMT come back as `+00`; a period is
written with no hyphen; a value with `+` carries the note that an interchange sends `?+`.

**Presets** (each returns a value except the last two). Presets whose result states no offset and
has an instant carry the four example zones as literal fields:

| Id | Input | Returns |
| --- | --- | --- |
| `local-203` | `DTM+137:202406151430:203'` | `"2024-06-15T14:30:00"`, strip in four zones |
| `released-303` | `DTM+137:202406151430?+00:303'` | `"2024-06-15T14:30:00+00:00"` |
| `utc-303` | `…UTC:303'` | `"2024-06-15T14:30:00+00:00"` |
| `gmt-303` | `…GMT:303'` | `"2024-06-15T14:30:00+00:00"` |
| `offset-205` | `…?+0200:205'` | `"2024-06-15T14:30:00+02:00"` |
| `offset-208` | `DTM+137:20240615143045?+0200:208'` | `"2024-06-15T14:30:45+02:00"` |
| `date-102` | `20240615`, `102` | `"2024-06-15"` |
| `time-402` | `143045`, `402` | `"14:30:45"` |
| `period-718` | `2024061520240620`, `718` | `{ start: "2024-06-15", end: "2024-06-20" }` |
| `period-719` | `202406151430202406201600`, `719` | a period of local date-times, strip at both ends |
| `cet-303` | `…CET:303'` | `NO SIGNAL`: the field holds a signed hour, `UTC` or `GMT` |
| `two-digit-101` | `240615`, `101` | `NO SIGNAL`: no EDI function reads a two-digit year |

**Template and mount.** Four numbered sections: 1 the paste line, the preset description and the
split line; 2 the value taken apart (left) and the verdict, detail, readouts and output (right); 3
the strip (the zone table and the timeline); 4 the written-back value and its call. `mountDtmDecoder`
loads `loadEdiLib()` (a failure is a `WidgetLoadError`), wires delegated listeners on the root and
returns `onceDestroy` with `getPermalinkState`.

**Tests.** `dtm-decoder.test.ts` (pure: splitter, every preset against the library, the calls
made, the sentences, the strip, the write-back, the picture), `dtm-decoder-mount.test.tsx` (the
template's roles, every preset's printed calls and results, the strip, bare values and segments,
seeding including an old link that carries a `yearWindow`, permalinks, naming, lifecycle, on-screen
words).

**Shell and page.** `components/DtmDecoder.astro` renders `renderDtmDecoderTemplate()` and mounts
after seeding from `seedFromLocation("dtm")`; `content/docs/tools/dtm-decoder.mdx` carries the
`ToolLayout`.

**Chat copy.** `showDtmDecoder({ input, format?, zone1?, … zone4? })`: `input` is a whole `DTM`
segment or a bare value, and `format` is needed with a bare value. A zone is passed only when the
reader named it. There is no `yearWindow`.

### B2. X12 Time Reader: `/tools/x12-time-reader/`, kind `xtime`

**Inputs:** a date (373), a time (337) and a time code (623), each optional, four zone selects, and
a `DTP` qualifier (1250) and value (1251). There are no year-window controls.

**The date, time and time code section** (`readX12`): `parseX12DateAndTime(date, time)` when both
are sent; `parseX12Date(date, "D8")` or `parseX12Time(time)` when only one is; and, when a code is
sent with no time, `parseX12DateAndTime(date, "")`, which returns the sentinel (a time code
qualifies a time). The code is classified with `classifyX12TimeCode`, then asked with
`x12TimeCodeOffset` (an offset code) or `x12TimeCodeZone` (a named code). When the code states an
offset and a local date-time was read, the instant is `resolveLocal(local, offset)`; when it does
not, the instant comes from the zones the reader picked. The call frame prints each call made and
the output prints each result. The date and the time are also read alone (`parseX12Date`,
`parseX12Time`) for the written-back lines.

**The verdict has two forms:** `Offset: stated (-05:00)` and `Offset: not stated`; the detail line
says what the code names (a zone and its daylight flag, local to the event, no code, a date alone,
a time alone).

**Readouts:** Kind, Value, Time code, Offset, Zone name, Daylight, Instant.

**Written back:** `formatX12Date(date, "D8")` and `formatX12Time(time, "TM" | "TS")`, `TM` when
the time was typed as four characters. A fraction is cut and the note says so.

**The `DTP` section:** `classifyX12DateTimePeriodFormat(format)`, then the parser of the kind
(for a `time` kind, `parseX12Time(value, format)` with the narrowed `TM` or `TS`, so a `TM` value
with seconds is the sentinel), written back with the kind's formatter (a range's start and end as
two arguments). Readouts: Kind, Value, Range end. A two-digit-year or odd qualifier shows the
sentinel with `unreadCodeText`.

**Main presets** (every one returns a value): `status-et` (ET, with `America/New_York` and
`America/Atikokan`), `status-ed`, `status-es`, `status-ut`, `code-13`, `code-24`, `hundredths`,
`no-code`, `local-lt`, `date-only`, `time-only`. Those that state no offset and have a date-time
carry example zones. **`DTP` presets:** `range-rd8`, `range-dts`, `date-db`, and `d6-two-digit`
(the one that returns `NO SIGNAL`).

**Template and mount.** Six numbered sections: 1 the three elements; 2 the elements taken apart
and what the calls return; 3 the instant and the strip; 4 the written-back date and time; 5 the
`DTP` line; 6 what the `DTP` calls return. Tests: `x12-time-reader.test.ts` and
`x12-time-reader-mount.test.tsx`, as for the DTM Decoder.

**Chat copy.** `showX12TimeReader({ date?, time?, timeCode?, zone?, zone2?, zone3?, zone4?,
format?, value? })`: one of `date`, `time` or `value` is required. A zone is passed only when the
reader named it, never chosen from the time code.

### B3. States, for both tools

| State | Where | Rendering |
| --- | --- | --- |
| Live | any output with a library result | `renderWidgetOutput(out, formatValue(r), "live")`; several results, one a line, through `callResultsText` |
| Sentinel | a `null` or `""` the library returned | `renderWidgetOutput(out, "NO SIGNAL", "sentinel")` plus `renderAside(el, "caution", "No result", sentence)` |
| Empty | no library call behind it | `renderWidgetOutput(out, text, "empty")`; the frame is `hidden` |
| Load error | `loadEdiLib()` rejects | the mount throws `WidgetLoadError`; the shell calls `showUnavailable(root, error)` |
| No JS | — | the server-rendered template: controls with the first preset's values and blank, height-reserved readouts |

Each section of both tools makes no call when all of its inputs are blank and shows the empty
state. Anything typed is partial input and gets the library's sentinel with its sentence.

### B4. Permalinks

Flat strings, each 1 to 64 characters, read by `seedFromLocation`. **Generate every link with
`encodeWidgetPermalink`, never `encodeURIComponent` and never by hand:** a `DTM` segment holds
`'`, `+`, `?` and `:`. `encodeURIComponent` leaves `'` raw, which ends the match of the
content-permalink test (`widget-permalink.test.ts`, `/\?w=([a-z]+)&wa=([^)"'\s]+)/`) and breaks
the link; a raw `+` in a query string decodes as a space. The DTM Decoder's keys are `input`,
`format` (a bare value only) and `zone1` to `zone4`; the X12 Time Reader's are `date`, `time`,
`timeCode`, `zone`, `zone2` to `zone4`, `format` and `value`. A link that still carries a
`yearWindow` loads without error and the key is ignored. The pages link: a `203` value read in four
zones, a `CET` value, a two-digit year, a period of local date-times (DTM Decoder), and `ET` with and
without a zone, code `13` and `ED` (X12 Time Reader). Each link round-trips through
`seedFromLocation` with every key kept and matches the content-test pattern whole.

---

## C. Registration checklist (both tools at every step)

Each item names the test that guards it, or says that nothing does.

| # | File (under `apps/dox/`) | Where | What is registered | Guard |
| --- | --- | --- | --- | --- |
| C1 | `src/lib/dox-tools.ts` | 333–384 | `ediCodeSchema`, `showDtmDecoderInput`, `showX12TimeReaderInput` (neither takes a `yearWindow`) | `widget-registry.test.ts` |
| C2 | same | `DoxToolName` (400; 419–420) | both names | typecheck |
| C3 | same | `DOX_TOOL_INPUTS` (422; 441–442) | both | typecheck |
| C4 | same | `DOX_TOOL_DOCS` (446; 579, 586) | both, **appended** after `showZonePlanner`: indices 18 and 19 | see the trap below |
| C5 | same | `DOX_TOOLS` (599; 672–679) | both, in the docs' order, with `DOX_TOOL_DOCS[18].purpose` and `DOX_TOOL_DOCS[19].purpose` | `chat-handler.test.ts` |
| C6 | same | `ENABLED_TOOL_NAMES` (702; 721–722) | both | `widget-registry.test.ts`, `chat-starters.test.ts` |
| C7 | `worker/tools.ts` | imports (55–56); tools (334, 351) | both tools with a trivial `execute` | `tools.test.ts` |
| C8 | `src/components/ask/widget-registry.ts` | type imports (64–65); schema imports (78, 86); `dtmEntry` (558), `x12TimeEntry` (582); `WIDGET_REGISTRY` (651; 670–671) | `import type` only, never a value import; each entry has a literal `import("~/lib/…-mount")` | `widget-registry.test.ts`, `widget-graph.test.ts` |
| C9 | `src/lib/widget-permalink.ts` | `WidgetKind` (35; 54–55); `WIDGET_PAGE_PATHS` (71; 90–91) | `"dtm"`, `"xtime"` and their paths | `widget-permalink.test.ts` (each path is a real content file; every content link keeps every key) |
| C10 | `src/lib/chat-constants.ts` | `EXAMPLE_AREAS` (360; 364); `CHAT_STARTERS` (396; 492–507) | two starters after `showBillingDeadlines`'s, so they sit with the other intermodal ones; the area label | `chat-starters.test.ts` (the text is 21 to 109 characters and holds a digit or a known place; the seed passes its schema and `validate`) |
| C11 | `src/lib/widget-load-error.test.tsx` | imports (58–62); `MOUNTS` (84; 165–174) | `["dtm decoder", …]` and `["x12 time reader", …]` | **manual: nothing fails if forgotten** |
| C12 | `src/components/ask/widget-graph.test.ts` | `heavy` (128; 153–156) | `lib/edi-widgets.ts`, `lib/edi-lib.ts`, `lib/dtm-decoder.ts`, `lib/x12-time-reader.ts` | **manual** |
| C13 | `astro.config.mjs` | `customCss` (234; 264–265) | `gmt-edi-widgets.css` | **manual**; an unregistered sheet shows as an unstyled widget in the browser pass (G5) |
| C14 | `src/lib/mdx-jsx.ts` | the dropped-components list (334; 350, 358) | `"DtmDecoder"` and `"X12TimeReader"` | `scripts/llms.test.ts` ("no built text surface carries a raw component tag"), **only after a build** |
| C15 | `scripts/html-diff.mjs` | `PAGES` (32; 97–104) | `tools/dtm-decoder` and `tools/x12-time-reader`, each with its root class string | **manual** |
| C16 | `scripts/visual-snapshot.mjs` | `PAGES` (86; 121–122) | `tool-dtm-decoder`, `tool-x12-time-reader` | **manual** |
| C17 | `scripts/grow-measure.mjs` | `PAGES` (79; 177–188) | `dtm-decoder` and `x12-time-reader`: `root: ".gmt-widget"`, `preset: '[data-role="preset"]'`, `drag: null` | **manual** |
| C18 | `src/styles/gmt-a11y.css` | the `@media (forced-colors: active)` block at 113; rules at 317–336 | the picture's boxes, brackets and pins and the timeline's axis, ticks and stems keep a system colour, and the panels, member cells and verdict plates take `border-color: CanvasText` | **manual**; checked in the browser pass (G5) |
| C19 | `src/lib/gmt-modules.ts` | 59–60 | the `intermodal/parse` and `intermodal/format` keys | the mounts' tests |
| C20 | `src/lib/industry-tags.ts` | 50–51 | the intermodal `definition` | `industry-tags.test.ts` |
| C21 | `src/styles/dox.css` | 232–243; 330–339 | the home grid's card-colour comment and the odd-last-card rule | the browser pass (G5) |

`scripts/readout-still.mjs` (`TOOLS`, 101) lists the tools with a drag handle. These two have
none, so they are not in it, and the browser pass (G5) checks stillness instead. `astro.config.mjs`
`optimizeDeps.entries` (58) already globs `src/lib/**/*.ts`.

**Trap: `DOX_TOOLS` reads `DOX_TOOL_DOCS` by position.** Each `DOX_TOOLS` entry's description is
`DOX_TOOL_DOCS[n].purpose` with a literal `n`. Inserting a doc anywhere but the end shifts every
later index, and each tool then carries its neighbour's description with no test failing.
**Append**, and after editing confirm `DOX_TOOL_DOCS[n].name` equals the key for every entry.

**The forced-colours rules, and why the pictures have them.** The picture's marks are edges, a
pseudo-element bracket and an axis, ticks and stems drawn as backgrounds, which forced colours
drops or recolours. The fields and zones are told apart by text (the mask letters, the bracket
labels, the numbers on the pins), so each of those is `forced-color-adjust: none` with a system
colour (`CanvasText` edges and lines, a `Canvas` fill). The panels, member cells and plates hold
text and never opt out.

---

## D. Content pages

All paths are under `apps/dox/src/content/docs/`. Every fenced block and every `rightCode` or
`gmtCode` that shows a `call // result` imports the function it calls from a module path
(`@northguild/gmt/intermodal/parse`), and every result is pasted from a run against
`packages/gmt/src`.

`fixedSpecId` and `rightSpecId` are keys of `LIVE_PLAYGROUND_TEMPLATES`. The reference routes under
`/reference/intermodal/{parse,format,validate}/` and the type pages come from the generator. A
page that names a function not in that record fails the build.

- **`guides/industries/intermodal-edi-timestamps.mdx`** is organised by kind: one section for
  UN/EDIFACT and one for X12, each with a table of kind, functions, codes and house value; the
  codes that carry an offset; the freight read as three calls (`parseX12DateAndTime`,
  `x12TimeCodeOffset`, `resolveLocal`); a code that arrives as data and a classifier; a table that
  maps each two-digit-year mask to its pattern (`101`/`D6` to `yyMMdd`, `TT` to `MMddyy`, `201` to
  `yyMMddHHmm`, `202` to `yyMMddHHmmss`, `TR` to `ddMMyyHHmm`) with a `yearWindow`; the codes that
  are not read; EPCIS; and the local-to-instant step.
- **Scenarios** (`scenarios/`): `a-203-read-as-utc.mdx` (`fixedSpecId` `parseEdifactDateTime`),
  `et-is-not-an-offset.mdx` (`fixedSpecId` `x12TimeCodeZone`, whose playground shows the name and
  the daylight flag for a code) and `the-epcis-offset-nobody-kept.mdx` (`parseEpcisEvent`). A code
  sample in a `naiveCode`, `wrongCode`, `gmtCode` or `rightCode` prop builds strings with `+`, never
  with `${…}`: the prop is itself a template literal. `scenarios/index.mdx` is generated.
- **`mistakes/intermodal.mdx`**: the intro names the layer's functions in groups and holds no
  count; the EDI mistakes use the per-kind functions, and the two-digit-year mistake reads with the
  pattern parser.
- **`guides/concepts/standards.mdx`**: the UN/EDIFACT and X12 entries name the per-kind functions
  and the classifiers.
- **`tools/dtm-decoder.mdx`, `tools/x12-time-reader.mdx`**: the two verdicts, the unread codes and
  the functions each tool calls. `tools/index.mdx` is generated.
- The indexes, the home page, Why GMT and the intermodal tag carry no function names that were
  removed.

---

## E. Design constraints

1. **No left-border-only accent, anywhere.** No card, callout, row, plate or result block in
   either tool carries a coloured left edge as its only accent: no `border-left`, no
   `border-inline-start`, no left `inset` shadow, no left `::before` bar. The owner rejects it
   as the tell-tale of AI design. Every plate has a full bevelled border; a plate that needs an
   accent edge takes a bottom border.
2. **Every region is present in every state, and holds still.** Every readout value is
   `tabular-nums` and `nowrap`, and no value breaks inside itself. Every member cell, zone row,
   picture and timeline is always rendered; a region that does not apply shows its empty state in
   the same box at the same size. A region whose text varies reserves its tallest text with a hold
   (B0.4), at every width. A new value, a new preset or a new zone never moves or resizes any
   region. The browser pass (G5) tests it by bounding box across every preset.
3. **Amber is the sentinel's alone.** `NO SIGNAL` and the caution aside's own styling. No
   verdict, mark, badge or note is amber, and no verdict uses a success or error colour: the
   verdicts are words.
4. **Text is at least 12px** (`font-floor.test.ts`), and measures **at least 7:1** in both themes
   against the worst pixel behind its glyph box (`design-system.md` § Verifying).
5. **Tokens only.** No colour literal, and no `[data-theme="light"]` colour block. A series
   colour goes on a mark, never on text.
6. **Compose `gmt-form-controls.css` through `widget-ui.ts`**: `.gmt-field-grid`,
   `labelTextHtml()` (with `{ optional: true }` for the chip, never "(optional)" in the text),
   `.gmt-input`, `.gmt-select`, `setControlValue`. **Add no control CSS.** Real `<select>` and
   `<input>` elements.
7. **Every root carries `not-content`** and `container-type: inline-size`; every section carries
   `gmt-widget-section--wide`; narrow rules are named `@container` queries on the section or the
   pane, because the `/dox` rail is narrow on a wide viewport. Space comes from
   `gap`, never sibling margins. No horizontal page scroll at 390px.
8. **No motion on a value.** No `transition` or `animation` on a readout, a verdict, a mark or a
   plate. Section heights ease through `.gmt-grow`, which the page attaches itself; a variable
   slot is marked `data-grow="slot"`, and never a control.
9. **No class containing `card`** other than the `.gmt-widget-card` wrapper. **No
   `backdrop-filter` inside a tool**: the wrapper is the one layer of glass. **No `clip-path`.**
10. **Nothing in the zone table or the pictures is focusable** but the four zone selects. The
    pictures carry a generated `aria-label` and the timeline's pins are inside it; the summary
    sentence says what they show. No on-screen text, `aria-label` or note names the library as
    `GMT`: it is "the library", because `GMT` is also a zone literal that resolves to +00:00. No
    member cell shows a raw `null`: a flag shows its meaning.
11. **`escapeAttr` or `escapeHtml` on every template interpolation.** The input is text a model
    or a stranger's URL wrote.
12. **An element with an author `display` gets its own `[hidden]` rule.** A call frame that has no
    call keeps its box (`visibility: hidden`), so nothing below it moves.
13. **A pane never takes a drawn edge.** The seam is a gap. A bracket is three sides and a group's
    mark a bottom edge; no box, cell, plate or panel carries a one-sided accent.

---

## F. `context/dox/built.md`

`built.md` holds the as-built record, in the present tense: § Tier 2 has the two widgets in the
teaching-widget list, the registration lists, the tool pages and the traps (the permalink of a
`DTM` segment, the `core` Standards guide, the pattern chips of the Converter Bench); § Tier 6 has
the two widget tools, the tool and starter counts and the area list; § Runbooks has the `dist`
alias trap and the baseline rule. `docs-site.md` allows a function on the site only when its story
is `Done`.

---

## G. Definition of done (`dox-tester`: run each line literally)

1. `pnpm --filter @gmt/dox exec vitest run` is green, and the whole suite is green at the end.
2. `DOX_VITE_CACHE_DIR=<private folder> pnpm --filter @gmt/dox check` reports 0 errors, and
   `pnpm --filter @gmt/dox lint` reports nothing.
3. `pnpm dox:generate` and `pnpm dox:docs-check` report 0 gaps. Every code parameter of every EDI
   function is an `enum` with exactly its codes, and each function's first example returns a value;
   so does each choice with its example.
4. `grep` for the removed function names (`parseEdifactDtm`, `formatEdifactDtm`,
   `isValidEdifactDtm`, `parseX12DateTimePeriod`, `formatX12DateTimePeriod`,
   `isValidX12DateTimePeriod`, the three-argument `parseX12DateTime`, `x12TimeCode`, `EdiDateTime`,
   `EdiPeriodEnd`, `X12TimeCodeMeaning`) and for `yearWindow` across `apps/dox/src` (outside
   `generated/` and the generated reference pages) and `apps/dox/worker` finds only the pattern
   parsers' own `yearWindow` and the sentence that points at them.
5. After `dist` is rebuilt: `pnpm dox:build`, then a browser pass of both tools at 2000×1135, light
   and dark: two panes, one seam, stacked under the derived boundary; every preset moves no region
   (bounding box); no left-border-only accent; 7:1 contrast on text; the keyboard path through
   every control; forced colours; the two reference playgrounds `formatX12Date` and
   `formatX12DateTime`.
6. The chat tools, `CHAT_STARTERS` cards and widget registrations pass `widget-registry.test.ts`,
   `chat-starters.test.ts`, `widget-permalink.test.ts` and `client-graph.test.ts`.

---

## H. Files

`src/lib/`: `edi-widgets.ts`, `edi-lib.ts`, `edi-picture.ts`, `edi-render.ts`, `dtm-decoder.ts`,
`dtm-decoder-mount.ts`, `x12-time-reader.ts`, `x12-time-reader-mount.ts` and their tests.
`src/test/edi-lib.ts`. `src/styles/gmt-edi-widgets.css`. `src/components/DtmDecoder.astro` and
`X12TimeReader.astro`. The content pages of section D. `scripts/build-utils/build-utils.ts`
renders a parameter typed with one string literal as a select with that one choice.
