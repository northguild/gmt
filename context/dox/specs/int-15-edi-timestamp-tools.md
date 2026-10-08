# Spec: EDI timestamps on the docs site (INT-15)

What `apps/dox` ships for INT-15: two tools, one guide, three scenarios and the pages around
them. `dox-builder` builds and changes them against this spec, and `dox-tester` verifies them
against section G. This is not `packages/gmt` work. Nothing here edits library source, tests, the
READMEs, `packages/gmt/skills/`, `.changeset/` or `context/domination/`. A library problem found
while working on the site is reported to the main session and never built around.

**The library surface the site draws on** is three module barrels and two public patterns:

| Barrel | Functions |
| --- | --- |
| `@northguild/gmt/intermodal/parse` | `parseEdifactDtm`, `parseX12DateTime`, `parseX12DateTimePeriod`, `x12TimeCode`, `parseEpcisEvent` |
| `@northguild/gmt/intermodal/format` | `formatEdifactDtm`, `formatX12DateTimePeriod`, `formatEpcisEvent` |
| `@northguild/gmt/intermodal/validate` | `isValidEdifactDtm`, `isValidEdifactDtmFormat`, `isValidX12DateTime`, `isValidX12DateTimePeriod`, `isValidX12DateTimePeriodFormat`, `isValidX12TimeCode`, `isValidEpcisEvent` |
| `@northguild/gmt/regex` | `epcisEventTime`, `epcisTimeZoneOffset` |

The two X12 readers read different elements. `parseX12DateTime(date?, time?, timeCode?)` reads
elements 373, 337 and 623, as `AT7`, `G62` and `DTM-02`/`03`/`04` carry them.
`parseX12DateTimePeriod(value, formatQualifier, options?)` reads an element 1251 value against its
1250 qualifier, as a `DTP` and `DTM-05`/`06` carry them. There is no X12 formatter for the three
elements: `formatX12DateTimePeriod` writes a date with `D8` and a time with `TM` or `TS`.

Sources, in order of precedence: the binding rules in section 0, then
`context/domination/issues/INT-15.md` (the result-shape table, the code tables, the time-code
section, EPCIS, Design notes, the Authority table, Verification), then the JSDoc of each function
under `packages/gmt/src/intermodal/{parse,format,validate}/` and of `resolveLocal`,
`classifyLocal`, `toOffsetInstant` and `fromOffsetInstant` under
`packages/gmt/src/instant/convert/`, then `context/domination/docs-site.md`, then
`context/dox/built.md`. The tool shape follows `context/dox/specs/int-58-billing-deadlines.md`
(one widget) and `context/dox/specs/tran-57-punctuality.md` (a shared helper module, a shared
loader and a shared sheet).

**Every value in this spec is a row of appendix Z or a JSDoc `@example`.** Appendix Z is a
script. Every row passes against `packages/gmt/dist` in `TZ=UTC`, `America/Los_Angeles` and
`Asia/Tokyo`. Do not type a result that is in neither place: add a row and run it first. If a row
fails against `dist`, stop and report. Never edit the script to match.

Line anchors are for the tree this spec describes. Re-read each file before editing: an anchor
says where to look, not what is there.

---

## 0. Binding rules

- **Two tools only.** The **DTM Decoder** (`/tools/dtm-decoder/`, kind `dtm`, chat tool
  `showDtmDecoder`) and the **X12 Time Reader** (`/tools/x12-time-reader/`, kind `xtime`, chat tool
  `showX12TimeReader`). There is no EPCIS tool and no cross-format tool. MCP UI widgets are out
  of scope.
- `apps/dox` must not perturb `packages/gmt`. No changeset. **No git operation that changes
  state**: no `add`, `commit`, `stash`, `checkout`, `restore`. Leave every change unstaged. The
  baseline worktree in G7 is the tester's, not the builder's.
- **Toolchain.** This machine has `fnm`. Prefix every Node command with
  `eval "$(fnm env)" && fnm use &&`.
- **Never rebuild `packages/gmt/dist` while `astro dev` is serving pages.** The dev server
  aliases `@northguild/gmt` to `dist` (`astro.config.mjs:16` and `:70`), so a rebuild breaks
  every widget on an open page until the build ends and the page is reloaded.
  `pnpm --filter @northguild/gmt build` and `pnpm run validate` both rebuild it.
- **Import gmt at module granularity only**, through `GMT_MODULES`: `intermodal/parse`,
  `intermodal/format`, `intermodal/validate`, `instant/convert`, `zoned/validate` and
  `utc/calculate` (`src/lib/gmt-modules.ts` lines 59, 58, 60, 38, 75, 88). Nothing else from gmt,
  never the root and never a namespace barrel.
- **The widgets draw the library's results and compute none of them.** Every decoded member,
  time-code meaning, instant, offset in force, written-back value, validity answer and gap
  duration is a gmt call. The site-side code does four things only, and each is stated on
  screen: it splits a pasted `DTM` segment into its components (`splitDtm`), it builds the
  argument list of the `parseX12DateTime` call it prints (`parseArgs`), it builds the ISO string a
  formatter takes from the members a parser returned (`isoOf`), and it formats a returned ISO 8601
  duration as "15 h". `@js-temporal/polyfill` is imported for drawing only: mark positions on
  the gap strip.
- **Nothing guesses.** Nothing derives a zone or an offset from a place, port, partner,
  abbreviation, zone name or time code, and typing a value never fills, suggests or changes a
  zone. A preset is an example, and an example may state its place: it carries its zones as
  literal fields of the preset object, written by hand beside its description, and the
  description says the zone is the example's pick and the reader can change it. Every other
  zone is the reader's. The site
  holds no list of codes: a code's support and its two-digit year are found by asking the
  library. Every "not stated" case renders as those words. A blank optional input is left out of
  the call and never filled from a preset.
- **Every zone is read with `disambiguation: "reject"`**, and the widget says so beside the
  result and in the printed call. Any other policy picks an instant for a repeated or skipped
  time, which is a guess.
- **Every sentinel renders through `renderWidgetOutput(out, "NO SIGNAL", "sentinel")`** with a
  reason aside (`renderAside(el, "caution", …)`). A state with no library call behind it renders
  through `renderWidgetOutput(out, text, "empty")`, never amber. A `null` or `""` the library
  returned is always the sentinel.
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
  year is presented as a legacy form; no new line names `bolTimestamp` or `multimodalETA` beyond
  the one list of the layer's functions in `mistakes/intermodal.mdx`.
- **React stays inside `/dox`.** Each tool page is Astro plus a plain-DOM module.
- **The tier stays droppable.** A tool page imports no `dox-tools.ts`, `zod` or `ai`. Deleting the
  chat leaves both pages working.
- **Counts drift.** Page copy holds no function, test, tool or guide count. The counts of codes
  that a page states (23 codes of 2379, 56 codes of 623) are the standard's and the library's,
  and appendix Z checks the 2379 set.
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
- A check of an X12 daylight flag against the zone the reader picks.
- `packages/gmt`, the READMEs and `context/domination/`.

---

## B. The tools

Paths are under `apps/dox/`. The roots are exactly
`<div class="gmt-dtm-decoder gmt-widget not-content">` and
`<div class="gmt-x12-time-reader gmt-widget not-content">`, the first thing in each template, with
no other attribute, because `scripts/html-diff.mjs` matches the class string. Inside each root is
the standard `<div class="gmt-widget-card">` wrapper holding numbered
`<div class="gmt-widget-section">` blocks. No other class contains the substring `card`.

### B0. Shared pieces

#### B0.1 `src/lib/edi-widgets.ts` (pure: no DOM, no gmt import)

Its header comment says what the module is, that every function calling the library takes an
`EdiLib`, and the naming rule of section 0.

- `EdiLib`: the injected library. Its members are `parseEdifactDtm`, `formatEdifactDtm`,
  `isValidEdifactDtm`, `isValidEdifactDtmFormat`, `parseX12DateTime(date?, time?, timeCode?)`,
  `parseX12DateTimePeriod`, `formatX12DateTimePeriod`, `isValidX12DateTimePeriod`,
  `isValidX12DateTimePeriodFormat`, `x12TimeCode`, `resolveLocal`, `classifyLocal`,
  `toOffsetInstant`, `fromOffsetInstant`, `isValidTimeZone`, `minUtc`, `maxUtc` and
  `diffUtcAsDuration`. The types are declared locally: `YearWindowOptions`, `EdiPeriodEndResult`,
  `X12TimeMeaning`, and `EdiResult`, which mirrors `EdiDateTime` with every member optional
  (`date`, `time`, `local`, `instant`, `offset`, `zone`, `daylight`, `dayOfYear`, `yearDigit`,
  `periodEnd`). No type is imported from gmt's root.
- `REJECT = { disambiguation: "reject" }`: the one policy both widgets pass and print.
- `EDI_ZONES`: `[...CURATED_TIMEZONES, "Europe/Amsterdam", "Asia/Singapore"]`. Zone `<select>`s
  are built with `zoneOptionsHtml(EDI_ZONES, selected, "No zone")`, re-exported from
  `transport-widgets.ts`, so a seeded zone outside the list is appended and never dropped.
- `YEAR_WINDOW_NONE = "none"`. `yearWindowOptions(text)`: `""` or `"none"` gives `undefined`, so
  the call is made and printed with no third argument; `"rolling"` gives
  `{ yearWindow: "rolling" }`; anything else gives `{ yearWindow: Number(text.trim()) }`, passed
  and printed as read (`NaN`, `9901`), so the printed call is the real call.
  `yearWindowControls(yearWindow)` and `yearWindowFromControls(mode, start)` map the state's one
  string (`""`, `"rolling"` or a year as text) to the two controls and back.
- `yearWindowFieldsHtml(yearWindow, disabled)`: the two controls, always rendered.
  "Year window" is `<select class="gmt-select" data-role="year-window">` with `none` "No window",
  `rolling` "Rolling" and `fixed` "From a start year". "Window starts in" is
  `<input class="gmt-input" data-role="year-start" type="number" min="0" max="9900" step="1" inputmode="numeric">`,
  enabled only with `fixed`, with **no placeholder**: a placeholder year reads as a default.
- `needsYearWindow(format, code)`: a probe of the formatter, so the site holds no list of
  two-digit-year codes. With the eleven `SAMPLES` (a date, a date-time, a date-time with an
  offset, a time, a time with an offset, an offset, and five periods), a code needs a window when
  every sample returns `""` with no options and at least one returns a value with
  `{ yearWindow: 2000 }`. It is true for exactly `101`, `201`, `202`, `206`, `207`, `301`, `302`,
  `713`, `717` (`formatEdifactDtm`, row `Dneeds`) and `D6`, `TT`, `TR`, `RD6`, `TU`
  (`formatX12DateTimePeriod`, row `Xneeds`).
- `isoOf(result, lib)`: the one ISO 8601 string a formatter takes, built from the members a
  parser returned. The order of the branches matters, because a date-time with an offset holds
  `local`, `offset` and `instant` together:
  1. a `periodEnd`: `${start}/${end}`, where each half is its `local`, else `date`, else `time`;
  2. `instant` and `offset`: `lib.fromOffsetInstant({ instant, offset })`;
  3. `time` and `offset` (a `404` or `209` value): `${time}${offset}`;
  4. `local` (with or without `zone`): `local`;
  5. a `dayOfYear` or `yearDigit` with no `date` (`TC`, `EH`): `null`. Nothing can be written back;
  6. `date`, else `time`, else `offset`. A `TU` result holds `date` and `dayOfYear`, and the date
     is the whole value.
- `isoNote(result)`: one sentence saying how `isoOf` built the string, so the site-side step is
  stated on screen. Blank when the result's own string is passed unchanged.
- `durationText(iso)`: `PT15H` as `15 h`, `PT9H30M` as `9 h 30 min`, `PT0S` as `0 h`. A regular
  expression over the returned string; no arithmetic.
- `readoutRowsHtml(rows)`, `readoutOf(text, hasResult)`, `ABSENT_MEMBER_TEXT`
  (`not stated`), `NO_RESULT_TEXT` (`no result`): the member grid. Every cell is always rendered,
  and each `<dd>` carries `data-state="value" | "absent" | "none"`. A member that is a flag shows
  its meaning, never `null`: X12's `daylight` reads `daylight`, `standard` or `not said`, while the
  printed call and result keep the literal `daylight: null`.
- `yearWindowWords(yearWindow)` (`rolling window`, `window starting in 2000`, or `""`),
  `yearWindowNote(yearWindow, read)` (the sentence saying which window read a two-digit year, or
  that none was given), `figureTail(closing, note)` (the clauses after a picture's fields in its
  spoken line) and `LONGEST_ZONE` (a 30-character stand-in, not a zone, for the hidden sizers).
- `resolveReason(local, zone, lib)`: when
  `resolveLocal(local, zone, { disambiguation: "reject" })` returns `""`, `classifyLocal` decides
  the text. `ambiguous`: "The `${time}` time happens twice in `${zone}` on that date. With
  disambiguation: "reject", resolveLocal does not pick one." `nonexistent`: "… never happens in
  `${zone}` on that date: the clock skipped it. …" `null`: "`${zone}` is not a time zone this
  browser knows."
- `NO_RESULT_TITLE = "No result"`: the title of every `NO SIGNAL` aside.
- `formatValue` and `callArgs` are re-exported from `punctuality-widgets.ts`. Its key table holds
  none of the EDI keys, so a result prints in the library's own key order, which is the JSDoc's.
  The mount tests assert the printed text equals the JSDoc literal, so a reorder fails.

#### B0.2 `src/lib/edi-widgets.test.ts` and `src/test/edi-lib.ts`

`src/test/edi-lib.ts` exports `lib`, the real functions imported by module path and typed as an
`EdiLib`, so no unit test needs the mount's dynamic imports. The test covers `yearWindowOptions`,
the year-window controls, `needsYearWindow` (both sets, exactly, over every supported code plus
`602` and `CM`), `isoOf` (one row per branch), `durationText`, `resolveReason`, `readoutOf` and
`EDI_ZONES` (each a real zone).

#### B0.3 `src/lib/edi-lib.ts`

`loadEdiLib(): Promise<EdiLib>`: one `Promise.all` over the six `GMT_MODULES` keys of section 0.
A heavy module, reached only from the two mounts, each inside its own `try`.

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
  (DTM `101: two-digit year, window from 2000`), 270.2px (X12 `Code 24: the other end of the run`)
  and 311.1px (DTP `D6: a two-digit year, window from 2000`) in the 13.6px face, plus the
  select's 8px + 28px padding and 2px border: 341px, 308px, 349px, so the preset's column is
  `22rem`. The line is one row from 69.5rem (DTM: 22 + 15 segment + 9.5 format code + 11.5 year
  window + 8.5 window start + four 0.75rem gaps), 54.25rem (X12 main: 22 + three 10rem fields +
  three gaps) and 66rem (DTP: 22 + 9 + 12 + 11.5 + 8.5 + four gaps). Under that the preset takes
  its own row and the rest share the next while they hold their own minima (46.75rem, 31.5rem,
  43.25rem), and under that the field grid's own 11rem tracks.
- **The value taken apart** (`.gmt-edi-panel` > `.gmt-edi-figure`, `role="img"`). The parts row
  (`.gmt-edi-parts`: a box and a caption under it, with the service characters as sent between
  boxes; the segment tag and the function qualifier have a dashed edge, which says they are not
  read), then the fields (`.gmt-edi-taken`): each half of the value a row of groups, each group
  its fields' boxes (`.gmt-edi-box`, `n` characters wide where `n` is the longer of its text and
  its mask, in the mono face) with the mask letters under them (`.gmt-edi-mask`) and a bracket
  under that (`.gmt-edi-bracket`, three sides drawn by a pseudo-element, with its label). The marks
  are `--gmt-series-1` (date), `-2` (time) and `-3` (offset or zone), drawn as the box's bottom
  edge and the bracket; no text takes a series colour. A refused value is neutral (the
  `--gmt-border-strong` edge), and a code that carries no offset closes with a dashed ghost box
  saying `no offset`.
  The picture is drawn at a 0.9375rem face (12px masks); a single value (one half) at 1.375rem
  (`data-scale="lg"` on the figure and its sizer), so it fills the box it reserves, and is centred
  vertically in it. Its sizers include the widest time code the field takes (8 characters), so a
  typed code never wraps the row.
- **The member grid** (`.gmt-edi-readouts`): a `<dl>` of small bordered cells (`.gmt-edi-row`:
  `dt` label, `dd` value), the same cells in the same places in every state. Its columns are
  `repeat(auto-fill, minmax(--edi-cell, 1fr))`, so they follow the pane's width alone;
  `--edi-cell` is 11.5rem (DTM: the 20-character instant, 154px, with 24px of padding and 2px of
  border) or 13.5rem (X12: 23 characters, 177px). A value never breaks inside itself.
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
  `205`) and `withoffset-n` in the X12 Time Reader (`fromOffsetInstant` of the instant and the
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

#### B0.6 The probe and the pictures (`edi-shape.ts`, `edi-picture.ts`, `edi-render.ts`)

- `shapeOf(formatter, code)` finds a format code's shape by probing the public formatter, as
  `needsYearWindow` does: it formats probe values whose every field differs (the date 1987-03-14,
  the time 15:26:48, an offset of +07:30, and for a period an end of 1991-05-22T08:11:37), from the
  richest (a local date-time with seconds and an offset) to the plainest (a time, an offset alone,
  the period forms), first with no options and then with `{ yearWindow: 1900 }`, until one is
  written. It then reads the digits back into fields by where each distinct probe field lands: the
  year as `CCYY` (4), `YY` (2) or `Y` (1), `MM`, `DD`, `DDD` (day of the year), `HH`, `MM` (the
  minute), `SS`, a signed offset as `ZHHMM` (5) or `ZZZ` (3), and a period's separator and second
  half. The field order is what the formatter wrote, so 1250's `MMDDCCYY`, `DDMMYYHHMM`, `YYDDD`
  and hyphenated ranges each get their own. The site holds no table of codes. An unsupported code
  writes nothing, and its shape is `null`. A shape is cached per formatter and code.
- `cutValue(value, shape)` cuts a real value along a shape, or `null` when its length is not the
  shape's. `edi-shape.test.ts` finds every code the two validators accept by probing candidate
  texts and checks that each has a shape fitting the values written under it, plus the shape of
  representative codes (203, 205, 208, 303, 101, 406, 718, 719, DB, TT, TR, TU, EH, TC, RD, DDT,
  RTM) and an unsupported one.
- `edi-picture.ts` builds the strings (`takenApartHtml`, `partsHtml`, `figureAria`,
  `timelineLayout`, `timelineHtml`, `timelineAria` and the hold builders); `edi-render.ts` writes
  them into `[data-role="figure"]` and `[data-role="timeline"]` (`drawFigure`, `drawTimeline`).
  A region is never removed: an empty state is words in the same box.
- The picture's spoken line says what each field holds: `202406151430 under code 203: year 2024,
  month 06, day 15, hour 14, minute 30; no offset`; a segment is led by `Segment with function
  qualifier 137, shown as sent.` A two-digit year's note says which window read it
  (`Two-digit year, read as 2024 by the window starting in 2000.`) or that none was given.

### B1. DTM Decoder: `/tools/dtm-decoder/`, kind `dtm`

#### B1.1 Inputs and how they are read (`src/lib/dtm-decoder.ts`, pure)

- `DtmDecoderArgs`: `input?: string`, `format?: string`, `yearWindow?: string | number`,
  `zone1?`, `zone2?`, `zone3?`, `zone4?: string`.
- `DtmState`: `{ input, format, yearWindow, zones: [string, string, string, string] }`, all
  strings, which is what the DOM holds.
- `splitDtm(input): DtmSplit`, the site-side segment splitter. It applies the UN/EDIFACT default
  service characters `:+.? '`: component separator `:`, data element separator `+`, decimal
  mark `.`, release character `?`, a reserved space, segment terminator `'`.

  ```ts
  export type DtmSplit =
    | { kind: "segment"; qualifier: string; value: string; format: string; extra: boolean }
    | { kind: "value"; value: string };
  ```

  1. Trim the input.
  2. It is a segment only when it starts with `DTM+` (exact case). Anything else is
     `{ kind: "value", value }`, **passed on unchanged**: a bare value is the element value, and
     a `?` left in it is the caller's mistake for the library to refuse (row D9raw).
  3. Walk the characters once. `?x` adds the literal `x` and never separates (`?+` → `+`,
     `?:` → `:`, `?'` → `'`, `??` → `?`); a `?` at the very end is kept. An unreleased `'` ends
     the segment. An unreleased `+` starts the next data element. An unreleased `:` starts the
     next component.
  4. Element 0 is the tag. Element 1 is the composite: component 0 is the function qualifier
     (data element 2005), component 1 the value (2380), component 2 the format code (2379). A
     missing component is `""`.
  5. `extra` is true when there is a fourth component, a third element, or non-blank text after
     the terminator. The widget then says "Text after the first composite is not read."
- `effective(state)`: `{ value, format, split }`. In segment form the value and the format come
  from the segment and `state.format` is ignored. In value form the format is
  `state.format.trim()`.
- `readArgs(args)`: seeded when `args.input !== undefined`. A string is kept as typed; a
  `yearWindow` number becomes its text; an absent key is `""`. **Nothing falls back to a
  preset.**
- `permalinkOf(state)`: strings only, and only non-blank fields: `input`, `format` (value form
  only: a segment holds its own), `yearWindow`, `zone1`…`zone4`. The input's `maxlength` is 64.
- The year window applies when `needsYearWindow(lib.formatEdifactDtm, format)` is true
  (`windowApplies`). When it is false the two controls are `disabled`, no third argument is
  passed, and for a code the library reads the line under the fields says "Code `203` carries a
  four-digit year. The window is not read."

#### B1.2 Presets

`DTM_PRESETS`, in this order. A preset whose input is a segment holds no `format`.

| id | label | input | format | yearWindow | zones 1–4 |
| --- | --- | --- | --- | --- | --- |
| `local-203` | 203: local time, no offset | `DTM+137:202406151430:203'` | (segment) | — | `America/New_York`, `Europe/Berlin`, `Asia/Shanghai`, `America/Los_Angeles` |
| `released-303` | 303 with ?+00: offset stated | `DTM+137:202406151430?+00:303'` | (segment) | — | none |
| `utc-303` | 303 with UTC: offset stated | `DTM+137:202406151430UTC:303'` | (segment) | — | none |
| `gmt-303` | 303 with GMT: offset stated | `DTM+137:202406151430GMT:303'` | (segment) | — | none |
| `cet-303` | 303 with CET: zone text | `DTM+137:202406151430CET:303'` | (segment) | — | `America/New_York`, `Europe/Berlin`, `Asia/Shanghai`, `America/Los_Angeles` |
| `offset-205` | 205: a signed HHMM offset | `DTM+137:202406151430?+0200:205'` | (segment) | — | none |
| `offset-208` | 208: seconds and an offset | `DTM+137:20240615143045?+0200:208'` | (segment) | — | none |
| `period-718` | 718: a period, no hyphen | `2024061520240620` | `718` | — | none |
| `two-digit-no-window` | 101: two-digit year, no window | `240615` | `101` | none | none |
| `two-digit-window` | 101: two-digit year, window from 2000 | `240615` | `101` | `2000` | none |

- Labels name what the format code shows. None implies a meaning for the function qualifier
  `137`, which the tool shows as sent and never interprets.
- Descriptions are one or two sentences, say what the numbers show, and name no place for the
  value.
- A preset whose result states no offset and whose strip applies carries its example's zones:
  `local-203` and `cet-303` carry the same four, the set a freight reader weighs for one
  shipment (two US offices, a European port, an Asian origin). Each description says the zones
  are the example's picks. `cet-303` says they are not a reading of `CET`: the library returns `CET`
  unread and the value names no zone. A preset that states its offset, or holds a date, a time
  or a period alone, carries none, because its zone selects are disabled.
- `gmt-303` is a preset because `GMT` resolves to `+00:00` as `UTC` does, and a reader who sees
  only `UTC` and `CET` would expect `GMT` to be zone text.
- `offset-208` is a preset because `208` is the code to ask a partner for: a four-digit year,
  seconds and an offset.
- `CUSTOM_PRESET_ID = "custom"`. `matchPreset(state)` compares every field, trimmed. Typing sets
  the preset select from it. Choosing a preset writes every field and blanks the others.

**What each preset calls and shows.** `L` is `"2024-06-15T14:30:00"`. A date-time result that
states an offset holds `local`, `offset` and `instant`, in that order.

| Preset | `parseEdifactDtm` call → result | Verdict | Written back |
| --- | --- | --- | --- |
| `local-203` | `("202406151430", "203")` → `{ local: L }` (D1) | `Offset: not stated` | `formatEdifactDtm(L, "203")` → `"202406151430"` (D1w) |
| `released-303` | `("202406151430+00", "303")` → `{ local: L, offset: "+00:00", instant: "2024-06-15T14:30:00Z" }` (D2) | `Offset: stated (+00:00)` | `fromOffsetInstant` → `"2024-06-15T14:30:00+00:00"` (D2l), then `formatEdifactDtm(…, "303")` → `"202406151430+00"` (D2w) |
| `utc-303` | `("202406151430UTC", "303")` → the same result (D3) | `Offset: stated (+00:00)` | `"202406151430+00"` (D2w), with the note that the formatter never writes `UTC` or `GMT` |
| `gmt-303` | `("202406151430GMT", "303")` → the same result (D3g) | `Offset: stated (+00:00)` | `"202406151430+00"` (D2w), with the same note |
| `cet-303` | `("202406151430CET", "303")` → `{ local: L, zone: "CET" }` (D4) | `Offset: not stated. "CET" is zone text, not an offset.` | `formatEdifactDtm(L, "303")` → `""` (D4w): `NO SIGNAL`, with the zone-text note |
| `offset-205` | `("202406151430+0200", "205")` → `{ local: L, offset: "+02:00", instant: "2024-06-15T12:30:00Z" }` (D5) | `Offset: stated (+02:00)` | `"2024-06-15T14:30:00+02:00"` (D5l) → `"202406151430+0200"` (D5w) |
| `offset-208` | `("20240615143045+0200", "208")` → `{ local: "2024-06-15T14:30:45", offset: "+02:00", instant: "2024-06-15T12:30:45Z" }` (D5s) | `Offset: stated (+02:00)` | `"2024-06-15T14:30:45+02:00"` (D5s-l) → `"20240615143045+0200"` (D5s-w) |
| `period-718` | `("2024061520240620", "718")` → `{ date: "2024-06-15", periodEnd: { date: "2024-06-20" } }` (D6) | `Offset: not stated` | `formatEdifactDtm("2024-06-15/2024-06-20", "718")` → `"2024061520240620"` (D6w) |
| `two-digit-no-window` | `("240615", "101")` → `null` (D7) | (blank) | none: `no value to write back` |
| `two-digit-window` | `("240615", "101", { yearWindow: 2000 })` → `{ date: "2024-06-15" }` (D8) | `Offset: not stated` | `formatEdifactDtm("2024-06-15", "101", { yearWindow: 2000 })` → `"240615"` (D8w) |

**`local-203`'s strip.** Each row is `resolveLocal(local, zone, { disambiguation: "reject" })`,
then `toOffsetInstant(instant, zone).offset`, then
`formatEdifactDtm(fromOffsetInstant({ instant, offset }), "205")`.

| Zone | Instant | Offset in force | Written as `205` | Rows |
| --- | --- | --- | --- | --- |
| `America/New_York` | `2024-06-15T18:30:00Z` | `-04:00` | `202406151430-0400` | D1a, D1a-o, D1a-l, D1a-5 |
| `Europe/Berlin` | `2024-06-15T12:30:00Z` | `+02:00` | `202406151430+0200` | D1b, D1b-o, D1b-l, D1b-5 |
| `Asia/Shanghai` | `2024-06-15T06:30:00Z` | `+08:00` | `202406151430+0800` | D1c, D1c-o, D1c-l, D1c-5 |
| `America/Los_Angeles` | `2024-06-15T21:30:00Z` | `-07:00` | `202406151430-0700` | D1d, D1d-o, D1d-l, D1d-5 |

Widest gap: `minUtc` → `2024-06-15T06:30:00Z` (D1min), `maxUtc` → `2024-06-15T21:30:00Z` (D1max),
`diffUtcAsDuration(min, max, "hours")` → `"PT15H"` (D1gap), shown as
`Widest gap: 15 h, between Asia/Shanghai and America/Los_Angeles`.

#### B1.3 Readouts, verdict and strip

- `MEMBER_ROWS`, seven rows: `date`, `time`, `local`, `instant`, `offset`, `zone`, `periodEnd`,
  labelled "Date", "Time", "Local date-time", "Instant", "Offset", "Zone text", "Period end",
  with roles `member-date`, `member-time`, `member-local`, `member-instant`, `member-offset`,
  `member-zone`, `member-period-end`. `memberText(result, key)` is the member's string; for
  `periodEnd`, its `local`, else `date`, else `time`. A value that states its offset fills the
  `local`, `instant` and `offset` rows.
- `offsetVerdict(result)`: `"stated"` when the result holds `offset`; `"zone-text"` when it holds
  `zone`; otherwise `"not-stated"`. `verdictText`: `Offset: stated (${offset})`,
  `Offset: not stated`, `Offset: not stated. "${zone}" is zone text, not an offset.`.
- `detailText(result)`, one line, by the first branch that matches:
  - `zone`: "No UN/EDIFACT text defines these three characters, so the library returns them unread."
  - `periodEnd`: "A period: a start and an end. The code states no offset, so neither end names
    an instant."
  - `instant` and `offset`: "The value names one instant."
  - `time` and `offset`: "A time and an offset, but no date, so no instant."
  - `offset` alone: "The value is an offset and nothing else."
  - `local`: "A local time at a place the value does not name. It is not UTC."
  - `date`: "A date. A date alone names no instant in any zone."
  - `time` alone: "A time of day with no date and no offset."
- `stripApplies(result)`: the result holds `local`, holds no `instant` and holds no `periodEnd`.
  So the strip applies to a `203` value and to zone text, and not to a value that states its
  offset, although that value holds `local` too.
- `stripNote(result)`: when the strip applies, "The value states no offset. Each zone below is
  one you chose: the same digits, read there. Every row uses resolveLocal with disambiguation:
  "reject", so a time the clock shows twice or never is not resolved." Otherwise one of: "The
  value states its offset, so there is nothing to choose.", "A period: each end is a local time.
  Resolve each with resolveLocal.", "A date or a time alone names no instant in any zone.", or
  "No value."
- `gapRows(local, zones, lib)`: per slot `{ zone, instant, offset, as205, reason }`, by the three
  calls above. A blank slot is `{ zone: "" }`. A refused time carries `resolveReason`'s text and
  shows `NO SIGNAL` in its instant cell.
- Under the zone table, `resolve-block` shows the first chosen zone's `resolveLocal` call and its
  result. It is `hidden` when the table does not apply or no zone is chosen, and keeps its box
  (a hold with the longest call and result), so nothing below it moves.
- `timelineEmptyText(result)`: the words the timeline shows when there is no instant: "No value,
  so no instant to place.", "A period is two local times, not one instant: nothing to place.",
  "An offset alone names no instant: nothing to place." or "A date or a time alone names no
  instant: nothing to place."
- `segmentSpans(raw)`, `dtmParts(state)` and `dtmFigure(state, result, lib)`: the segment's
  parts as sent (the tag `DTM`, the qualifier, the value with its release character, the format
  code, and the service characters `+`, `:`, `:` and `'`), and the value taken apart by the
  probed shape (B0.6). `no offset` closes a read value whose code carries no offset field.
- **The four strip zones are the only zone inputs.** There is no separate "read in zone"
  control: one picker cannot disagree with another, and every instant on screen is a row the
  reader can see.

#### B1.4 Why `NO SIGNAL`

`explainNull(state, lib)` decides the reason by probing the library, in this order.
`NULL_REASON_TEXT` holds the words.

| Reason | Test | Text |
| --- | --- | --- |
| `blank-value` | the value is `""` | "Paste a DTM segment or a value." |
| `no-format` | the format is `""` | "A value means nothing without its 2379 format code. The segment carries none." (segment form) or "… Type the code." (value form) |
| `unsupported-format` | `!lib.isValidEdifactDtmFormat(format)` | "`${format}` is not a format code GMT reads. A partial value, a weekday period or a quantity is not a date, time or period, and an unsupported code is never guessed." |
| `needs-year-window` | the code needs a window and none is given | "Code `${format}` has a two-digit year. No standard says which century it belongs to, so choose a window: rolling, or a start year. A two-digit year is a legacy form: where a partner can send a four-digit code, ask for it." |
| `bad-year-window` | the code needs a window, one is given, and `lib.isValidEdifactDtm(value, format, { yearWindow: 2000 })` is true | "The window is rolling or a whole year from 0 to 9900." |
| `released-character` | value form and the value contains `?` | "The value still carries the release character ?. +02 is transmitted as ?+02: paste the whole segment, or remove the ?." |
| `bad-value` | otherwise | "The value does not fit this code, names a date or time that does not exist, is a period written with a hyphen (UN/EDIFACT sends none), or is a period whose end is before its start." |

**With the value field and the format code both blank no call is made** (`dtmBlank`). The parse
frame is `hidden`, the output reads `nothing to read` in the empty style, never amber, and the
members read `no result`. Nothing typed is nothing to read, not a refused value; the X12 Time
Reader follows the same rule. Anything typed is a call: a value with no format code shows the
sentinel with the "no format code" reason, and a format code with no value shows it with the
`blank-value` reason.

#### B1.5 Written back

`writeBack(state, result, lib)` is `formatEdifactDtm` of `isoOf(result)`, with the same format
and, for a code that reads one, the same window. With no result, or with nothing `isoOf` can
build, the frame is `hidden` and the output is
`renderWidgetOutput(out, "no value to write back", "empty")`. The write-back never reads the
strip: for zone text it stays `NO SIGNAL` whichever zones are chosen, and the offset form of each
chosen zone is in that row's "As 205" cell.

Notes under the output, joined in this order:

- `isoNote`'s sentence, when `isoOf` joined members;
- for `""` from a zone-text value: "A zone text has no offset to write. Resolve the local time
  in a zone first, then write it with its offset."; for any other `""`: "formatEdifactDtm
  returned the sentinel for this value and code.";
- when the input value ends in `UTC` or `GMT`: "formatEdifactDtm writes a zone as ±HH and never
  as UTC or GMT.";
- for a period: "A period is written without a hyphen.";
- when the output holds `+`: "This is the element value. In an interchange, + is sent as ?+."

#### B1.6 Template and mount (`src/lib/dtm-decoder-mount.ts`)

`renderDtmDecoderTemplate(args = {})` is seeded when `args.input !== undefined`, else it shows
the first preset. Every interpolation goes through `escapeAttr` or `escapeHtml`. **In sections 2
and 3 the fixed-size readouts come first; the call line, the raw output and any aside come after
them**, so nothing above a readout changes height. The server-rendered template holds no result.

1. `<h4>1. Paste a segment or a value</h4>`: one `.gmt-field-grid.gmt-edi-top` line with the
   preset `<select data-role="preset">` (Custom first), "Segment or value" (`data-role="input"`,
   `maxlength="64"`), "Format code (2379)" (`data-role="format"`, `maxlength="8"`; in segment form
   it is `disabled` and shows the segment's code, and the typed code comes back when the segment
   goes) and the two year controls; then `preset-description` and `split`
   (both `data-grow="slot"`, each in a hold): "Read as a segment: function qualifier 137, shown
   as sent and not interpreted; value 202406151430; format code 203." or "Read as a bare value.",
   and the four-digit-year line.
2. `<h4>2. What the value states</h4>`: a split. Left pane, one `.gmt-edi-panel`: `figure` (the
   value taken apart), `figure-note` and `reason-aside`, each in a hold, and under the panel
   `parse-block` with `codeFrameHtml("parse")`. Right pane: `verdict` (`aria-live="polite"`),
   `verdict-detail`, the `<dl data-role="readouts">` (seven cells) and `parse-output`.
3. `<h4>3. Where an offsetless value lands</h4>`: `strip-note`, then a split. Left pane: the
   `timeline` panel and `gap` (`.gmt-edi-verdict--long`). Right pane: the zone table (B0.5),
   `strip-summary`, `strip-aside`, and `resolve-block` with `codeFrameHtml("resolve")` and
   `resolve-output` (it keeps its box when hidden).
4. `<h4>4. Written back by <code>formatEdifactDtm</code></h4>`: one line (`.gmt-edi-written`)
   of `format-output` and `format-block` with `codeFrameHtml("format")`; then `format-note`.

`mountDtmDecoder: MountFn<DtmDecoderArgs>`: `loadEdiLib()` inside `try`, and on failure
`throw new WidgetLoadError(cause)`. After the await, a `signal.aborted` mount returns
`onceDestroy(() => {})`. Listeners are delegated `input` and `change` handlers on the root, so
the host dropping the subtree is a complete teardown. Every select is written with
`setControlValue`. `onceDestroy`'s second argument returns `permalinkOf(state)`. The clock is
read only by the library and only after mount (`yearWindow: "rolling"`).

#### B1.7 Tests

- `src/lib/dtm-decoder.test.ts`: `splitDtm` (the segment presets; `??`, `?:` and `?'` as
  literals; a trailing `?`; no terminator; a missing component; anything but `DTM+` is a value;
  `extra`), `effective`, `readArgs`, `matchPreset` (every preset, custom, distinct states),
  `permalinkOf`, the verdict and detail of each shape, `memberText`, `stripApplies` and
  `stripNote`, `gapRows` and `widestGap`, `timelineLayout`, `explainNull` (each reason, each
  confirmed `null` by the real parser), `windowOffNote` and `splitText`, and `writeBack`.
- `src/lib/dtm-decoder-mount.test.tsx` (jsdom, against the real gmt): `REQUIRED_ROLES`; the
  wrapper and the `card` rule; a hostile seed is escaped; `it.each(DTM_PRESETS)` asserts the
  printed call, the output, the verdict, every member row and the write-back from the table in
  B1.2; a hyphenated period is the sentinel; `209` is a time and an offset; `206` opens the year
  controls; the strip of `local-203`, its marks, a changed zone (D-kolkata), a blank slot, a
  value that states its offset, a time the clock shows twice (D16, D16c), a period of local
  times; a bare value with `?` (D9raw) and the same text in a segment (D9); the year window
  (a start year clears the sentinel, a four-digit-year code disables both controls, `9901` is
  explained (Y-bad), `rolling` with a faked clock); seeding with no preset fallback and with an
  unlisted zone; the permalink of every preset round-trips as strings through
  `encodeWidgetPermalink` and `seedFromLocation`; the naming check; an aborted mount is inert
  and destroying twice is safe.

#### B1.8 Shell and page

- `src/components/DtmDecoder.astro`: `renderDtmDecoderTemplate()`, `seedFromLocation("dtm")`,
  `.gmt-dtm-decoder`, `showUnavailable` on catch, the `fullbleed` prop.
- `src/content/docs/tools/dtm-decoder.mdx`: title "DTM Decoder", `industries: [intermodal]`,
  `<ToolLayout useCase="UN/EDIFACT DTM dates and times">`.
  - `keypoint`: a `DTM` value means nothing without its format code, most codes carry no offset,
    and a value with no offset is a local time at a place the value does not name. It is not UTC.
  - `intro`, three paragraphs: the two inputs, the default service characters, the qualifier
    shown as sent, and that only a segment is un-released; the three verdicts and what a `ZZZ`
    field holds (`±HH`, `UTC` and `GMT` are offsets, any other three upper-case letters are zone
    text, anything else is `NO SIGNAL`); the strip (the zones are the reader's, GMT maps no place
    to a zone, `disambiguation: "reject"`). It links
    [`parseEdifactDtm`](/reference/intermodal/parse/parseEdifactDtm/), so the page uses the
    intermodal layer (`industry-tags.test.ts`).
  - `<DtmDecoder fullbleed />`.
  - `after`: "**Worth trying:**" with PD2, then PD3 and PD4; then a Reference paragraph linking
    `parseEdifactDtm`, `formatEdifactDtm`, `isValidEdifactDtmFormat`, `resolveLocal` and the
    guide.

#### B1.9 Chat copy

| Item | Value |
| --- | --- |
| Schema | `showDtmDecoderInput = z.object({ input: z.string().min(1).max(64), format: ediCodeSchema.optional(), yearWindow: yearWindowSchema.optional(), zone1: zoneSchema.optional(), zone2: zoneSchema.optional(), zone3: zoneSchema.optional(), zone4: zoneSchema.optional() })` |
| `purpose` | "A UN/EDIFACT DTM segment or value decoded by parseEdifactDtm against its 2379 format code: the members the code states, whether the offset is stated, not stated or zone text, which is not an offset, the instant an offsetless value names in each zone the reader chooses, and the value written back by formatEdifactDtm." |
| `when` | "the reader asks what a UN/EDIFACT DTM segment, value or 2379 format code such as 203, 303 or 718 means, whether it carries an offset, or what instant it names" |
| `args` | "input (a whole DTM segment such as DTM+137:202406151430:203' or the bare value such as 202406151430; at most 64 characters), format (the 2379 format code; needed with a bare value), yearWindow (only for a two-digit-year code: rolling, or the first year of the hundred-year window such as 2000; never assume it: ask), zone1 to zone4 (optional IANA ids to read an offsetless value in; only zones the reader named: never choose one from a port, a place, a partner or an abbreviation)." |
| Worker | `unknownZones` over the given zones; `accept("dtm-decoder")` |
| Registry | `dtmEntry`, `title: "DTM decoder"`, `kind: "dtm"`, `validate` runs `checkZones` over the given zones |
| Permalink | `dtm: "/tools/dtm-decoder/"` |
| Starter | "An EDIFACT DTM says 202406151430 with format code 203. What instant is that in New York?"; `area: "intermodal"`; args `{ input: "202406151430", format: "203", zone1: "America/New_York" }`. The question names New York, so the seed names it and the widget shows an instant. |

`ediCodeSchema = z.string().min(1).max(8)` and
`yearWindowSchema = z.union([z.literal("rolling"), z.number().int().min(0).max(9900)])` check
shape, not validity: a code or a window the library refuses is the widget's sentinel to show,
never a schema failure.

### B2. X12 Time Reader: `/tools/x12-time-reader/`, kind `xtime`

The tool answers the question a freight developer has in front of them: this segment has a date,
a time and maybe a time code, so what moment is it? Sections 1 to 4 read the three elements.
Sections 5 and 6 are a second, smaller tool on the same page for a `DTP` value.

#### B2.1 Inputs and how they are read (`src/lib/x12-time-reader.ts`, pure)

- `X12TimeReaderArgs`: `date?`, `time?`, `timeCode?` (elements 373, 337 and 623, as sent);
  `zone?`, `zone2?`, `zone3?`, `zone4?` (the strip's four slots; `zone` is the first);
  `format?`, `value?` (the 1250 qualifier and the element 1251 value of the `DTP` section);
  `yearWindow?: string | number`.
- `X12State`: `{ date, time, timeCode, zones }`. `DtpState`: `{ format, value, yearWindow }`. All
  strings. The two sections hold separate state.
- **Three inputs, one call.** `parseArgs(state)` is `[date, time, timeCode]`, trimmed, with
  trailing blanks dropped. A blank element before a sent one stays as `""`, which the library
  reads as "not sent". The call is `parseX12DateTime(...parseArgs(state))`, and the call line
  prints exactly that: `parseX12DateTime("20240615")`, `parseX12DateTime("", "1430")`,
  `parseX12DateTime("20240615", "", "ET")`.
- **With all three elements blank no call is made** (`mainBlank`). The parse frame is `hidden`,
  the output is `renderWidgetOutput(out, "nothing to read", "empty")`, and there is no aside.
  `parseArgs` leaves nothing to pass, and an amber sentinel for a form nobody filled in would
  report an error the reader did not make. The `DTP` section does the same when its two fields
  are blank (`dtpBlank`).
- The three text inputs are free text on purpose: `et` and `EST` must reach the library and come
  back as its sentinel.
- `isSeeded(args)`: true when any of `date`, `time`, `timeCode`, `format` or `value` is defined.
  `readArgs(args)` returns `{ main, dtp }`. A string is kept as typed, a numeric `yearWindow`
  becomes its text, and an absent key is blank. **Nothing falls back to a preset.**
- `permalinkOf(main, dtp)`: strings only, and only non-blank fields: `date`, `time`, `timeCode`,
  `zone`, `zone2`, `zone3`, `zone4`, `format`, `value`, `yearWindow`.

#### B2.2 Presets

Two preset selects, one per section: `preset` over `X12_PRESETS` and `dtp-preset` over
`DTP_PRESETS`. **They are separate** because the sections hold separate state: one list would
make a preset for the three elements overwrite a `DTP` value the reader typed. Choosing a preset
in one section leaves the other alone.

`X12_PRESETS`, in this order. **A preset is an example, and an example may state its place.**
Each preset whose result states no offset carries the zones that make it most informative, as
literal fields of the preset object, written by hand beside its description; each preset where
the strip does not apply (an offset code, a date or a time alone, a refused value) carries none,
because its zone selects are disabled. Nothing derives a zone from a time code, and a
description says the zone is the example's pick, not X12's.

| id | label | date | time | timeCode | zones 1–4 and why |
| --- | --- | --- | --- | --- | --- |
| `status-et` | A time with time code ET | `20240615` | `1430` | `ET` | `America/New_York`, `America/Atikokan`: two places on Eastern time, one on daylight time in June and one (Atikokan, Ontario) on standard time all year, an hour apart, so the name alone does not fix the offset |
| `status-ed` | The same time with ED | `20240615` | `1430` | `ED` | `America/New_York`: on daylight time on a June date, as the flag says |
| `status-es` | ES: standard time, in January | `20240115` | `1430` | `ES` | `America/New_York`: on standard time on a January date, as the flag says |
| `status-ut` | The same time with UT | `20240615` | `1430` | `UT` | none: the offset is stated |
| `code-13` | Code 13: the run counts down | `20240615` | `1430` | `13` | none: the offset is stated |
| `code-24` | Code 24: the other end of the run | `20240615` | `1430` | `24` | none: the offset is stated |
| `hundredths` | A time with hundredths | `20240615` | `14300012` | — | `America/New_York`, `Europe/Berlin`, `Asia/Shanghai`, `America/Los_Angeles`: nothing is stated, so the set the DTM Decoder's `local-203` reads |
| `no-code` | A time and no time code | `20240615` | `1430` | — | the same four, for the same reason |
| `local-lt` | Time code LT: local to the event | `20240615` | `1430` | `LT` | the same four: LT says the place is elsewhere in the message |
| `date-only` | A date only | `20240615` | — | — | none: no instant |
| `time-only` | A time only | — | `1430` | — | none: no instant |
| `code-no-time` | A time code with no time | `20240615` | — | `ET` | none: `NO SIGNAL` |

The ED and ES dates agree with the code's daylight flag: `resolveLocal` in `America/New_York`
gives offset `-04:00` on the June date and `-05:00` on the January date (asserted against the
library). The descriptions of the zoned presets name each zone and say it is the example's pick
(for instance, "This example reads it in America/New_York"); none words a zone as X12's or the
code's. `America/Atikokan` is in the zone picker for this preset.

**What each preset calls and shows.** `B` is
`date: "2024-06-15", time: "14:30:00", local: "2024-06-15T14:30:00"`.

| Preset | `parseX12DateTime` call → result | Verdict | Instant | Date and time written back |
| --- | --- | --- | --- | --- |
| `status-et` | `("20240615", "1430", "ET")` → `{ B, zone: "Eastern", daylight: null }` (T1) | `Zone named, offset not stated: Eastern (not said)` | `"2024-06-15T18:30:00Z"`, the first zone's `resolveLocal`; the second zone reads `19:30:00Z` | `"20240615"` (Twd), `"1430"` (Twt) |
| `status-ed` | `("20240615", "1430", "ED")` → `{ B, zone: "Eastern", daylight: true }` (T2) | `Zone named, offset not stated: Eastern (daylight)` | `"2024-06-15T18:30:00Z"` | Twd, Twt |
| `status-es` | `("20240115", "1430", "ES")` → `{ date: "2024-01-15", time: "14:30:00", local: "2024-01-15T14:30:00", zone: "Eastern", daylight: false }` | `Zone named, offset not stated: Eastern (standard)` | `"2024-01-15T19:30:00Z"` | `"20240115"`, Twt |
| `status-ut` | `("20240615", "1430", "UT")` → `{ B, offset: "+00:00", instant: "2024-06-15T14:30:00Z" }` (T3) | `Offset stated: +00:00` | `"2024-06-15T14:30:00Z"` | Twd, Twt |
| `code-13` | `("20240615", "1430", "13")` → `{ B, offset: "-12:00", instant: "2024-06-16T02:30:00Z" }` (T4) | `Offset stated: -12:00` | `"2024-06-16T02:30:00Z"` | Twd, Twt |
| `code-24` | `("20240615", "1430", "24")` → `{ B, offset: "-01:00", instant: "2024-06-15T15:30:00Z" }` (T5) | `Offset stated: -01:00` | `"2024-06-15T15:30:00Z"` | Twd, Twt |
| `hundredths` | `("20240615", "14300012")` → `{ date: "2024-06-15", time: "14:30:00.12", local: "2024-06-15T14:30:00.12" }` (T6) | `Nothing stated: no time code was sent` | `"2024-06-15T18:30:00.12Z"`, the first zone's `resolveLocal` | Twd; the time is `NO SIGNAL` (T6w) |
| `no-code` | `("20240615", "1430")` → `{ B }` (T7) | `Nothing stated: no time code was sent` | `"2024-06-15T18:30:00Z"`, the first zone's `resolveLocal` | Twd, Twt |
| `local-lt` | `("20240615", "1430", "LT")` → `{ B, zone: "Local", daylight: null }` (T8) | `Nothing stated: local to the event` | `"2024-06-15T18:30:00Z"`, the first zone's `resolveLocal` | Twd, Twt |
| `date-only` | `("20240615")` → `{ date: "2024-06-15" }` (T9) | `A date only` | `no instant` | Twd; the time is `not sent` |
| `time-only` | `("", "1430")` → `{ time: "14:30:00" }` (T10) | `A time only: a time alone names no instant` | `no instant` | the date is `not sent`; Twt |
| `code-no-time` | `("20240615", "", "ET")` → `null` (T11) | (blank) | `no instant` | `nothing to write back`, twice |

With `status-et`, whose first zone is `America/New_York`, the instant is
`resolveLocal("2024-06-15T14:30:00", "America/New_York", { disambiguation: "reject" })` →
`"2024-06-15T18:30:00Z"` (T1z), and the row shows offset `-04:00` (T1z-o) and
`2024-06-15T14:30:00-04:00` (T1z-l). With the date changed to `20240115` it is
`"2024-01-15T19:30:00Z"` (T1zj).

`DTP_PRESETS`, in this order:

| id | label | format | value | yearWindow | `parseX12DateTimePeriod` → result | Written back |
| --- | --- | --- | --- | --- | --- | --- |
| `range-rd8` | RD8: a range of dates | `RD8` | `20240615-20240620` | — | `{ date: "2024-06-15", periodEnd: { date: "2024-06-20" } }` (X5) | `formatX12DateTimePeriod("2024-06-15/2024-06-20", "RD8")` → `"20240615-20240620"` (X5w) |
| `ordinal-tc` | TC: a day of the year with no year | `TC` | `166` | — | `{ dayOfYear: 166 }` (X6) | none: "TC keeps only the day of the year, so there is no date to write back." |
| `overnight-rtm` | RTM: a window that crosses midnight | `RTM` | `2200-0600` | — | `{ time: "22:00:00", periodEnd: { time: "06:00:00" } }` (X7) | `formatX12DateTimePeriod("22:00:00/06:00:00", "RTM")` → `"2200-0600"` (X7w) |
| `d6-no-window` | D6: a two-digit year, no window | `D6` | `240615` | none | `null` (Y5) | none: `nothing to write back` |
| `d6-window` | D6: a two-digit year, window from 2000 | `D6` | `240615` | `2000` | `{ date: "2024-06-15" }` (Y6) | `formatX12DateTimePeriod("2024-06-15", "D6", { yearWindow: 2000 })` → `"240615"` (Y6w) |

#### B2.3 Readouts and verdict (sections 1 to 4)

- `MEMBER_ROWS`, seven rows: `date`, `time`, `local`, `instant`, `offset`, `zone`, `daylight`,
  labelled "Date", "Time", "Local date-time", "Instant", "Offset", "Zone name", "Daylight", with
  roles `member-date` … `member-daylight`. `daylight` shows `true`, `false` or `null`, as the
  library returned it.
- `verdictOf(result)`, decided by the result's own members, by the first branch that matches:

  | Case | Verdict | Detail |
  | --- | --- | --- |
  | `null` | (blank; the output is `NO SIGNAL`) | (blank) |
  | `offset`, with `instant` | `Offset stated: ${offset}` | "The time code gives the offset from UTC, so the date and the time name one instant." |
  | `offset`, no `instant` | the same | "The time code gives the offset from UTC. A time alone names no instant: it is on no day." |
  | `zone === "Local"` | `Nothing stated: local to the event` | "The place is elsewhere in the message. You supply its zone." |
  | any other `zone` | `Zone named, offset not stated: ${zone} (daylight \| standard \| not said)` | "The code says daylight time." or "… standard time." or "The code says neither standard nor daylight, so the date decides.", then "X12 states no offset for a named zone." |
  | no `time` | `A date only` | "A date alone names no instant in any zone." |
  | no `date` | `A time only: a time alone names no instant` | "There is no date and no time code, so nothing says which day or where the clock was." |
  | otherwise | `Nothing stated: no time code was sent` | "A blank time code means local to the event. The place is elsewhere in the message. You supply its zone." |

  A zone verdict on a time with no date adds "A time alone names no instant: it is on no day."

#### B2.4 The instant and the strip (section 3)

- `stripApplies(result)`: the result holds `local` and holds neither `offset` nor `instant`. The
  four zone selects are `disabled` for a stated offset, a date only, a time only and the
  sentinel.
- `gapRows(local, zones, lib)`: per slot `{ zone, instant, offset, withOffset, reason }`:
  `resolveLocal(local, zone, { disambiguation: "reject" })`, then
  `toOffsetInstant(instant, zone).offset`, then `fromOffsetInstant({ instant, offset })`.
- `instantPlan(result, zones)` says what the `instant-output` shows:
  - `stated`: the result holds an `instant`, and the output is that member. Note: "This is the
    instant member of the call above: the local date-time read at the offset the time code
    states."
  - `resolve`: a `local` and at least one chosen zone. The output is the first chosen zone's
    `resolveLocal` result, the `resolve` frame prints the call, and the note is "Read with
    disambiguation: "reject": a time the clock shows twice or never is not resolved." A `""`
    result is the sentinel, with `resolveReason` as the first line of `strip-aside`.
  - `none`: `renderWidgetOutput(out, "no instant", "empty")`, and a note by shape: "No value.";
    "A time alone names no instant: there is no date."; "A date alone names no instant."; "No
    instant: the code names `${zone}` time and states no offset. Pick the IANA zone it means for
    you."; or "No instant: nothing here states an offset. Pick the zone."
- **The strip's four zones are the only zone inputs**, as in the DTM Decoder. `zone` in a
  permalink or a chat call is the first slot. Choosing a preset fills that preset's zones;
  editing any field switches the select to "Custom" and leaves the zones as they are, because
  they are state; clearing a zone works as before. A permalink or a chat seed names only what it
  carries: an absent `zone` key is an empty zone, and nothing falls back to a preset's zones.
  Typing a time code never fills, suggests or changes a zone.
- Left pane: the `timeline` and the gap line. Right pane: the zone table, `strip-summary`,
  `strip-aside` (which carries the refused zones' reasons, the first chosen zone's included, so there is no second aside). Under the split, one line: `instant-output` (`.gmt-edi-out`) with `instant-note` beside `resolve-block`. Each variable region is a hold (B0.4).

#### B2.5 Why `NO SIGNAL` (sections 1 to 4)

`explainNull(state, lib)` probes the library with one element at a time, in this order.

| Reason | Test | Text |
| --- | --- | --- |
| `blank` | all three elements are blank | "Send a date, a time or both." |
| `bad-date` | the date is sent and `lib.parseX12DateTime(date) === null` | "The date is not a CCYYMMDD date: it has a four-digit year and names a day that exists." |
| `bad-time` | the time is sent and `lib.parseX12DateTime("", time) === null` | "The time is not one of the four element 337 forms: HHMM, HHMMSS, HHMMSSD or HHMMSSDD, with an hour from 00 to 23 and a minute and second from 00 to 59." |
| `not-a-code` | the code is sent and `lib.x12TimeCode(code) === null` | "`${timeCode}` is not a 623 time code. A code is two characters, upper case, and an abbreviation is not a code." |
| `needs-time` | no time, a code, and `lib.parseX12DateTime(date, "0000", code) !== null` | "A time code qualifies a time, so X12 requires the time whenever the code is sent. Send a time, or leave the time code out." |
| `bad-combination` | otherwise | "These elements do not fit together." |

#### B2.6 Written back (section 4)

One element each, through `formatX12DateTimePeriod`:

- `writeDate`: `formatX12DateTimePeriod(date, "D8")`, when the result holds a date.
- `writeTime`: `formatX12DateTimePeriod(time, code)`, when the result holds a time. **The code is
  `TM` when the time as typed is four characters, and `TS` otherwise.** The code follows the
  form the reader typed, so the value comes back in that form. A time with tenths or hundredths
  goes to `TS`, the library returns `""`, and the output is `NO SIGNAL` with the note
  "formatX12DateTimePeriod writes the time as HHMM or HHMMSS. Tenths and hundredths of a second
  are read and not written, so there is no value to show."
- With the sentinel, both outputs are `nothing to write back` (empty). With a result that lacks
  the member, the output is `not sent` (empty). Each frame is `hidden` when there is no call.

#### B2.7 The `DTP` section (sections 5 and 6)

- Inputs: "Qualifier (1250)" (`dtp-format`, `maxlength="8"`), "Value (1251)" (`dtp-value`) and
  the two year controls of B0.1, which follow the DTM Decoder's rule: always rendered, and
  `disabled` when `needsYearWindow(lib.formatX12DateTimePeriod, format)` is false. For a
  qualifier the library reads, `dtp-note` then says "Qualifier `D8` carries a four-digit year.
  The window is not read."
- One call: `parseX12DateTimePeriod(value, format, options?)`.
- `DTP_MEMBER_ROWS`, six rows: `date`, `time`, `local`, `dayOfYear`, `yearDigit`, `periodEnd`,
  labelled "Date", "Time", "Local date-time", "Day of year", "Year digit", "Range end", with
  roles `dtp-member-date` … `dtp-member-range-end`. No 1250 code carries an offset, so there is
  no instant, offset or zone row, no verdict, no time code and no strip.
- `explainDtpNull(state, lib)`, in this order: `blank-value` ("Type an element 1251 value.");
  `no-format` ("Type the 1250 qualifier the value is read under."); `unstructured`
  (`format === "UN"`: "UN is unstructured: it has no layout, and GMT never guesses one.");
  `unread-format` (`!lib.isValidX12DateTimePeriodFormat(format)`: "`${format}` is not a
  qualifier GMT reads. A partial value or a month-name form is not a complete date or time, and
  DTM is a segment name, not a 1250 code."); `needs-year-window`; `bad-year-window` (as B1.4,
  with `lib.isValidX12DateTimePeriod`); `bad-value` ("The value does not fit this qualifier,
  names a date that does not exist, is a range sent without its hyphen, or is a dated range
  whose end is before its start.").
- `dtpWriteBack`: `formatX12DateTimePeriod` of `isoOf(result)`, with the same qualifier and
  window. With nothing to write, the output is `nothing to write back` (empty) and
  `nothingToWriteNote` says why for `TC` and `EH`.

#### B2.8 Template and mount (`src/lib/x12-time-reader-mount.ts`)

`renderX12TimeReaderTemplate(args = {})` is seeded when `isSeeded(args)`, else it shows the first
preset of each section. The same escaping, teardown and clock rules as B1.6.

1. `<h4>1. The date, the time and the time code</h4>`: one `.gmt-field-grid.gmt-edi-top`
   (`data-line="main"`) line with the `preset` select, "Date (373)" (`data-role="date"`), "Time
   (337)" (`data-role="time"`) and "Time code (623)" (`data-role="time-code"`, `maxlength="8"`),
   each with the `optional` chip; `preset-description` (a hold); a hint: "Element 373 is CCYYMMDD.
   Element 337 is HHMM, HHMMSS, HHMMSSD or HHMMSSDD. Any of the three may be empty, and an empty
   element is left out of the call."
2. `<h4>2. What <code>parseX12DateTime</code> returns</h4>`: a split. Left pane: the `figure`
   panel (the three elements taken apart: the date as `CCYY MM DD`; the time as `HH MM`, then
   `SS`, then `D` for tenths or `DD` for hundredths by the digits typed; the time code as its own
   box, in the offset group with the bracket `offset`, or `zone` for a named zone; an element not
   sent as a ghost box `not sent`; the elements labelled 373, 337 and 623), `figure-note` (what
   `x12TimeCode` returned, in words, and what the last digits of the time are) and `reason-aside`,
   and under the panel `parse-block` with `codeFrameHtml("parse")`. Right pane: `verdict`,
   `verdict-detail`, the `<dl data-role="readouts">` (seven cells) and `parse-output`.
3. `<h4>3. The instant, and where the same digits land</h4>`: `strip-note`, then a split. Left
   pane: the `timeline`, `gap` and `resolve-block` with `codeFrameHtml("resolve")`. Right pane:
   the zone table (B0.5), `strip-summary`, `strip-aside`, `instant-output` and `instant-note`.
4. `<h4>4. Written back by <code>formatX12DateTimePeriod</code></h4>`: two pairs
   (`.gmt-edi-pairs`, side by side from 74.5rem): a hint and `date-output` above `date-block`
   with `codeFrameHtml("write-date")`; a hint and `time-output` above `time-block` with
   `codeFrameHtml("write-time")`; then `format-note`.
5. `<h4>5. A DTP value</h4>`: one `.gmt-field-grid.gmt-edi-top` (`data-line="dtp"`) line with
   the `dtp-preset` select, qualifier, value and the year controls; `dtp-preset-description`,
   `dtp-note`, and a hint ("A DTP segment carries a 1250 qualifier and an element 1251 value. It
   carries no time code, and no 1250 code states an offset.").
6. `<h4>6. What <code>parseX12DateTimePeriod</code> returns</h4>`: a split. Left pane: the
   `dtp-figure` panel (the value taken apart by the probed shape of the 1250 qualifier, with the
   1251 value and the 1250 qualifier above it, and `no offset` closing a read value),
   `dtp-figure-note` and `dtp-reason-aside`. Right pane: the `<dl data-role="dtp-readouts">` (six
   cells), `dtp-parse-block`, `dtp-parse-output`, `dtp-format-block`, `dtp-format-output` and
   `dtp-format-note`.

`mountX12TimeReader: MountFn<X12TimeReaderArgs>`; `onceDestroy`'s second argument returns
`permalinkOf(main, dtp)`.

#### B2.9 Tests

- `src/lib/x12-time-reader.test.ts`: `parseArgs` and `mainBlank`; the presets (zones exactly where
  the strip applies, the ED and ES dates agree with the flag, the ET pair differs by an hour,
  no module maps a code or a zone name to an IANA id, each matches itself, custom, no duplicated state, the `DTP` presets); `readArgs`, `isSeeded`
  and `permalinkOf`; `verdictOf` for every branch; `memberText`; `instantPlan` and the strip
  (the four zones, a winter date (T1zj), a time the clock shows twice); `explainNull` (each
  reason confirmed `null` by the real parser); the date and time write-back (`D8`, `TM`, `TS`,
  hundredths); the `DTP` section (`dtpBlank`, the members, the write-back, the window, `TU`, each
  null reason).
- `src/lib/x12-time-reader-mount.test.tsx` (jsdom, against the real gmt): `REQUIRED_ROLES`; six
  sections; a hostile seed is escaped; `it.each(X12_PRESETS)` asserts the call, the output, the
  verdict, every member row, the instant and both write-backs from the table in B2.2; choosing a
  preset fills its zones; every preset with zones renders its instant, strip rows and gap line on
  mount, derived from the library; every preset without zones keeps its disabled or empty state;
  with the zones empty and the select on Custom, typing each of the 56 time codes changes no zone
  and shows no IANA id; a seed that names no zone gets none; `ET` opens on `18:30Z`, and a
  January date moves it an hour and switches the select to Custom; four zones and the widest gap; `UT` disables the four zone selects; a time
  the clock shows twice; a time code with no time is `NO SIGNAL` with its reason; a blank main
  section makes no call and is empty, not amber; a legitimately empty write-back is not
  `NO SIGNAL`; `it.each(DTP_PRESETS)`; the year controls of the `DTP` section; a main preset
  leaves the `DTP` section alone; seeding; every preset of both sections round-trips as a
  permalink of strings; the naming check, and that the rendered text holds no IANA id the
  reader did not pick; abort and double destroy.

#### B2.10 Shell and page

- `src/components/X12TimeReader.astro`: as B1.8, with `seedFromLocation("xtime")` and
  `.gmt-x12-time-reader`.
- `src/content/docs/tools/x12-time-reader.mdx`: title "X12 Time Reader",
  `industries: [intermodal]`, `<ToolLayout useCase="X12 dates, times and time codes">`.
  - `keypoint`: no X12 date or time carries an offset; the time code beside them is the only
    thing that says where the clock was, and a named code such as `ET` is a zone name, not an
    offset.
  - `intro`, three paragraphs: X12 is a United States standard, the three elements and the
    segments that carry them (the 214's `AT7`, the 204's `G62`, and `DTM`), and the one call; the
    three outcomes of a time code, that a preset opens with its example's zones and the reader changes
    them, that nothing derives a zone from a code, that the tool does not
    check a daylight flag against the zone picked, and `disambiguation: "reject"`; the `DTP`
    section. It links `parseX12DateTime` and `parseX12DateTimePeriod`.
  - `<X12TimeReader fullbleed />`.
  - `after`: "**Worth trying:**" with PX2 (then change the date to January) and PX3 (then type
    `24`); then the Reference paragraph and the guide.
- Neither tool has a sheet of its own: both use `gmt-edi-widgets.css`, which holds the strip.

#### B2.11 Chat copy

| Item | Value |
| --- | --- |
| Schema | `showX12TimeReaderInput = z.object({ date: z.string().min(1).max(64).optional(), time: z.string().min(1).max(64).optional(), timeCode: ediCodeSchema.optional(), zone: zoneSchema.optional(), zone2: zoneSchema.optional(), zone3: zoneSchema.optional(), zone4: zoneSchema.optional(), format: ediCodeSchema.optional(), value: z.string().min(1).max(64).optional(), yearWindow: yearWindowSchema.optional() }).refine(…)`: one of `date`, `time` or `value` is needed, or the widget has nothing to read |
| `purpose` | "An X12 date, time and time code read together by parseX12DateTime (elements 373, 337 and 623, as AT7, G62 and DTM carry them): whether the offset is stated, a zone is named with no offset, or nothing is stated, the instant once a stated offset or a zone the reader picks fixes it, and the date and time written back by formatX12DateTimePeriod. A DTP value (a 1250 qualifier and an element 1251 value) is read by parseX12DateTimePeriod." |
| `when` | "the reader asks what an X12 date, time or time code means, what a 623 time code such as ET, LT, UT or 13 states, what instant the date, time and time code of an AT7, G62 or DTM name, or what a DTP value under a 1250 qualifier such as D8, RD8 or RTM means" |
| `args` | "date (element 373 as sent, such as 20240615; leave out when only a time is sent), time (element 337 as sent, such as 1430; leave out when only a date is sent), timeCode (optional element 623 time code such as ET, LT, UT or 13, exactly as sent), zone, zone2, zone3 and zone4 (optional IANA ids to read a local time in; only zones the reader named: never choose one from the time code, a place or a partner), format and value (a DTP value: the 1250 qualifier such as RD8, and the element 1251 value such as 20240615-20240620), yearWindow (only for a two-digit-year qualifier: rolling, or the first year of the window; never assume it: ask)." |
| Worker | `unknownZones` over the given zones; `accept("x12-time-reader")` |
| Registry | `x12TimeEntry`, `title: "X12 time reader"`, `kind: "xtime"`, `validate` runs `checkZones` over the given zones |
| Permalink | `xtime: "/tools/x12-time-reader/"` |
| Starter | "X12 date 20240615, time 1430, time code ET, read in New York: what instant is that?"; `area: "intermodal"`; args `{ date: "20240615", time: "1430", timeCode: "ET", zone: "America/New_York" }`. The question names New York, so the seed names it and the widget shows an instant; `ET` does not choose it. |

### B3. States, for both tools

| State | Where | Rendering |
| --- | --- | --- |
| Live | any output with a library result | `renderWidgetOutput(out, formatValue(r), "live")` |
| Sentinel | a `null` or `""` the library returned | `renderWidgetOutput(out, "NO SIGNAL", "sentinel")` plus `renderAside(el, "caution", "No result", text)` from `explainNull`, `explainDtpNull` or `resolveReason` |
| Empty | no library call behind it | `renderWidgetOutput(out, text, "empty")`; the frame is `hidden` |
| Load error | `loadEdiLib()` rejects | the mount throws `WidgetLoadError`; the shell calls `showUnavailable(root, error)` |
| No JS | — | the server-rendered template: controls with the first preset's values and blank, height-reserved readouts |

The two tools treat a blank form differently. The DTM Decoder calls the library with a blank
input and shows its sentinel with the `blank-value` reason. Each section of the X12 Time Reader
makes no call when all of its inputs are blank and shows the empty state.

### B4. Permalinks

Flat strings, each 1 to 64 characters, read by `seedFromLocation`. **Generate every link with
`encodeWidgetPermalink` (or `URLSearchParams`), never `encodeURIComponent` and never by hand:** a
`DTM` segment holds `'`, `+`, `?` and `:`. `encodeURIComponent` leaves `'` raw, which ends the
match of the content-permalink test (`widget-permalink.test.ts:100`,
`/\?w=([a-z]+)&wa=([^)"'\s]+)/`) and breaks the link; a raw `+` in a query string decodes as a
space.

| id | kind | JSON | Link | On |
| --- | --- | --- | --- | --- |
| PD1 | dtm | `{"input":"DTM+137:202406151430:203'","zone1":"America/New_York","zone2":"Europe/Berlin","zone3":"Asia/Shanghai","zone4":"America/Los_Angeles"}` | `/tools/dtm-decoder/?w=dtm&wa=%7B%22input%22%3A%22DTM%2B137%3A202406151430%3A203%27%22%2C%22zone1%22%3A%22America%2FNew_York%22%2C%22zone2%22%3A%22Europe%2FBerlin%22%2C%22zone3%22%3A%22Asia%2FShanghai%22%2C%22zone4%22%3A%22America%2FLos_Angeles%22%7D` | `scenarios/a-203-read-as-utc.mdx` |
| PD2 | dtm | `{"input":"DTM+137:202406151430CET:303'"}` | `/tools/dtm-decoder/?w=dtm&wa=%7B%22input%22%3A%22DTM%2B137%3A202406151430CET%3A303%27%22%7D` | `tools/dtm-decoder.mdx` |
| PD3 | dtm | `{"input":"240615","format":"101"}` | `/tools/dtm-decoder/?w=dtm&wa=%7B%22input%22%3A%22240615%22%2C%22format%22%3A%22101%22%7D` | `tools/dtm-decoder.mdx` |
| PD4 | dtm | `{"input":"240615","format":"101","yearWindow":"2000"}` | `/tools/dtm-decoder/?w=dtm&wa=%7B%22input%22%3A%22240615%22%2C%22format%22%3A%22101%22%2C%22yearWindow%22%3A%222000%22%7D` | `tools/dtm-decoder.mdx` |
| PX1 | xtime | `{"date":"20240615","time":"1430","timeCode":"ET"}` | `/tools/x12-time-reader/?w=xtime&wa=%7B%22date%22%3A%2220240615%22%2C%22time%22%3A%221430%22%2C%22timeCode%22%3A%22ET%22%7D` | `scenarios/et-is-not-an-offset.mdx` |
| PX2 | xtime | `{"date":"20240615","time":"1430","timeCode":"ET","zone":"America/New_York"}` | `/tools/x12-time-reader/?w=xtime&wa=%7B%22date%22%3A%2220240615%22%2C%22time%22%3A%221430%22%2C%22timeCode%22%3A%22ET%22%2C%22zone%22%3A%22America%2FNew_York%22%7D` | `tools/x12-time-reader.mdx` |
| PX3 | xtime | `{"date":"20240615","time":"1430","timeCode":"13"}` | `/tools/x12-time-reader/?w=xtime&wa=%7B%22date%22%3A%2220240615%22%2C%22time%22%3A%221430%22%2C%22timeCode%22%3A%2213%22%7D` | `tools/x12-time-reader.mdx`, `scenarios/et-is-not-an-offset.mdx` |
| PX4 | xtime | `{"date":"20240615","time":"1430","timeCode":"ED"}` | `/tools/x12-time-reader/?w=xtime&wa=%7B%22date%22%3A%2220240615%22%2C%22time%22%3A%221430%22%2C%22timeCode%22%3A%22ED%22%7D` | `scenarios/et-is-not-an-offset.mdx` |

Each link round-trips through `seedFromLocation` with every key kept and matches the
content-test pattern whole.

---

## C. Registration checklist (both tools at every step)

Each item names the test that guards it, or says that nothing does.

| # | File (under `apps/dox/`) | Where | What is registered | Guard |
| --- | --- | --- | --- | --- |
| C1 | `src/lib/dox-tools.ts` | 333–384 | `ediCodeSchema` (333), `yearWindowSchema` (340), `showDtmDecoderInput` (350), `showX12TimeReaderInput` (369) | `widget-registry.test.ts` |
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
| C13 | `astro.config.mjs` | `customCss` (234; 264–265) | `gmt-edi-widgets.css` | **manual**; an unregistered sheet shows as an unstyled widget in G8 |
| C14 | `src/lib/mdx-jsx.ts` | the dropped-components list (334; 350, 358) | `"DtmDecoder"` and `"X12TimeReader"` | `scripts/llms.test.ts` ("no built text surface carries a raw component tag"), **only after a build** |
| C15 | `scripts/html-diff.mjs` | `PAGES` (32; 97–104) | `tools/dtm-decoder` and `tools/x12-time-reader`, each with its root class string | **manual** |
| C16 | `scripts/visual-snapshot.mjs` | `PAGES` (86; 121–122) | `tool-dtm-decoder`, `tool-x12-time-reader` | **manual** |
| C17 | `scripts/grow-measure.mjs` | `PAGES` (79; 177–188) | `dtm-decoder` and `x12-time-reader`: `root: ".gmt-widget"`, `preset: '[data-role="preset"]'`, `drag: null` | **manual** |
| C18 | `src/styles/gmt-a11y.css` | the `@media (forced-colors: active)` block at 113; rules at 317–336 | the picture's boxes, brackets and pins and the timeline's axis, ticks and stems keep a system colour, and the panels, member cells and verdict plates take `border-color: CanvasText` | **manual**; checked in G13 |
| C19 | `src/lib/gmt-modules.ts` | 59–60 | the `intermodal/parse` and `intermodal/validate` keys | the mounts' tests |
| C20 | `src/lib/industry-tags.ts` | 50–51 | the intermodal `definition` (D11) | `industry-tags.test.ts` |
| C21 | `src/styles/dox.css` | 232–243; 330–339 | the home grid's card-colour comment and the odd-last-card rule (D7) | G9 |

`scripts/readout-still.mjs` (`TOOLS`, 101) lists the tools with a drag handle. These two have
none, so they are not in it, and G10 checks stillness instead. `astro.config.mjs`
`optimizeDeps.entries` (58) already globs `src/lib/**/*.ts`.

**Trap: `DOX_TOOLS` reads `DOX_TOOL_DOCS` by position.** Each `DOX_TOOLS` entry's description is
`DOX_TOOL_DOCS[n].purpose` with a literal `n`. Inserting a doc anywhere but the end shifts every
later index, and each tool then carries its neighbour's description with no test failing.
**Append**, and after editing confirm `DOX_TOOL_DOCS[n].name` equals the key for every entry (G1
has the one-liner).

**The forced-colours rules, and why the pictures have them.** The picture's marks are edges, a
pseudo-element bracket and an axis, ticks and stems drawn as backgrounds, which forced colours
drops or recolours. The fields and zones are told apart by text (the mask letters, the bracket
labels, the numbers on the pins), so each of those is `forced-color-adjust: none` with a system
colour (`CanvasText` edges and lines, a `Canvas` fill). The panels, member cells and plates hold
text and never opt out.

---

## D. Content pages

All paths are under `apps/dox/src/content/docs/`. Every fenced block and every `rightCode` or
`gmtCode` that shows a `call // result` imports the function it calls, so
`scripts/api-surface.mjs check` executes it. A `naiveCode` or `wrongCode` has no import and is
checked only by appendix Z.

`fixedSpecId` and `rightSpecId` are keys of `LIVE_PLAYGROUND_TEMPLATES`: `parseEdifactDtm`,
`parseX12DateTime`, `x12TimeCode` and `parseEpcisEvent`. The reference routes under
`/reference/intermodal/{parse,format,validate}/` and the type pages come from the generator. A
type gets a page only when two or more public functions reach it, and the generator's usage
graph decides that, so no page and no spec lists the types by hand. If a key or a route is
missing after `pnpm dox:generate`, stop and report.

### D1. `guides/industries/intermodal-edi-timestamps.mdx`

The filename starts with `intermodal-`: `scripts/stats.mjs` `industryLayers()` reads the
namespace from the prefix and throws on any other. Frontmatter: title "Intermodal: EDI
Timestamps", `sidebar.order: 7`, `industries: [intermodal]`. Sections, in this order:

1. **Intro (no heading).** Freight mostly does not send ISO 8601. Some formats carry a UTC offset
   and some do not, and the only signal is a code. Trading-partner maps vary; the data elements
   under them do not. Then the imports from `@northguild/gmt/intermodal` and one line naming the
   three module barrels.
2. **`## Which codes carry an offset`.** The 2379 table: the 23 codes GMT reads, their masks and
   an Offset column (`none`; `yes: a signed HHMM` for `205`–`208`; `209`, a time, so no instant;
   `ZZZ: see below` for `301`–`304` and `404`; `406`, the offset itself). It says where the masks
   were read, that the hyphen in a period mask is notation, that `208` is the code to ask for
   when a partner can send seconds and an offset, and that every other code returns `null`. Then
   the 623 table, from release 008010 with its 56 codes: `01`–`12`, `13`–`24` (**descending**),
   `25`–`29` (the half-hour offsets, which date from release 006010), `UT`, `GM` (a GMT rule that
   rests on UN/ECE Recommendation 7 ¶12), the named standard and daylight codes, the generic
   codes, and `LT`.
3. **`## A DTM value against its code: parseEdifactDtm`.** The value (2380) and the code (2379);
   the result holds only the members the code can state. A code with no offset returns `local`
   and never an instant; a code with an offset returns `local`, `offset` and `instant`; a
   date-only code returns `date`, not `local`.
4. **`## What ZZZ is`.** Three characters the directory does not define. `±HH`, `UTC` and `GMT`
   resolve; any other three upper-case letters come back as `zone` text with no offset, which is
   a GMT rule and is said as one; anything else (`+24`, digits, lower case, a lone `Z`) is the
   sentinel.
5. **`## The release character is yours`.** `+` is the data element separator, so `+02` is
   transmitted as `?+02`. The rule is cited from the UN/EDIFACT syntax rules (UNTDID Part 4,
   Chapter 2.2). The functions take the unescaped value.
6. **`## A period has no hyphen on the wire`.** UN/EDIFACT transmits a period as consecutive
   characters, and a hyphenated value is the sentinel. X12 transmits a range with its hyphen.
7. **`## Writing a DTM value: formatEdifactDtm`.**
8. **`## An X12 date, time and time code: parseX12DateTime`.** Elements 373, 337 and 623 and the
   segments that carry them: the 214's `AT7`, the 204's `G62` and `DTM-02`/`03`/`04`. A date
   alone, a time alone, a time code with no time, tenths and hundredths, and writing the date
   and the time back with `formatX12DateTimePeriod`.
9. **`## The time code: x12TimeCode`.** A named code is a zone name, not an offset: the caller
   maps it to an IANA zone.
10. **`## An X12 date time period: parseX12DateTimePeriod`.** The 1250 table. A 1250 value
    carries no time code, and no page advises pairing one with a 623 code. The carriers of the
    pair are named in INT-15.md's terms: a `DTP` segment, as an 837 claim always carries its
    dates and ranges, and `DTM-05`/`06`, which a 315 may carry in place of the plain date in
    `DTM-02` (a 315 has no `DTP`). The 214 carries no 1250 element. As prose, not a section of
    its own: healthcare uses the same element, in the `DTP` segments of an 837 and an 834. Name
    no statute and no agency.
11. **`## Writing a date time period: formatX12DateTimePeriod`.**
12. **`## A two-digit year needs a window`.** A number is the first year of a fixed window;
    `"rolling"` is the hundred years around the current UTC year. `990615` read at different
    years is a table and not executable code, because the result depends on the clock. The codes
    that need a window, that a `yy` pattern token follows the same rule, and the closing line: a
    two-digit year is a legacy form.
13. **`## Check before reading: the validators`.**
14. **`## EPCIS: two facts, both required`.** `eventTime` is the instant; `eventTimeZoneOffset`
    is the offset in force where the event happened. That the offset inside `eventTime` need not
    match `eventTimeZoneOffset` is given as GS1's explanation: the standard marks that passage
    non-normative.
15. **`## From a local time to an instant`.** `resolveLocal` with a zone and `toOffsetInstant`
    with a stated offset.
16. **`## What is not done`.** A bulleted list of the limits: the codes read, no offsetless value
    becomes UTC, no name is mapped to a zone, a time alone names no instant, a two-digit year
    gets no century, fractions are read and not written.
17. **`## See it break, then work`.** Links to both tools, the three scenarios and
    `/mistakes/intermodal/#edi-timestamps`.

### D2. Scenarios (`scenarios/`)

Each has `title`, `description`, `industries: [intermodal]`, a `<Scenario … />`, then a paragraph
saying what to edit, with permalinks and a link to the guide. `scenarios/index.mdx` is generated:
never edit it. A code sample in a `naiveCode`, `wrongCode`, `gmtCode` or `rightCode` prop builds
strings with `+`, never with `${…}`: the prop is itself a template literal, and
`scripts/llms.test.ts` fails a built text surface that carries an unevaluated `{…}` expression
(only after a build).

| File | Title | `fixedSpecId` | Naive rows | Links |
| --- | --- | --- | --- | --- |
| `a-203-read-as-utc.mdx` | A 203 Read as UTC | `parseEdifactDtm` | N1 | PD1 |
| `et-is-not-an-offset.mdx` | ET Is Not an Offset | `parseX12DateTime` | N2 | PX1, PX4, PX3 |
| `the-epcis-offset-nobody-kept.mdx` | The EPCIS Offset Nobody Kept | `parseEpcisEvent` | N6 | the guide's EPCIS section; there is no EPCIS tool |

- **A 203 Read as UTC.** `gmtCode`: D1, then D1cd (`resolveLocal` in Shanghai), then D5 as the
  code that carries its offset. The edit paragraph: change the code to `205` and the value to
  `202406151430+0200`, and an instant appears.
- **ET Is Not an Offset.** `gmtCode`: T1, T1zd, T1zjd (the same wall time in January is an hour
  later in UTC), T1es, T2, then T4 as a code that states its offset.
- **The EPCIS Offset Nobody Kept.** `gmtCode`: E1, E2, E3. The edit paragraph: change
  `eventTimeZoneOffset` to `-05:00` and `local` moves to `2024-06-15T18:30:00` (E11).

### D3. `mistakes/intermodal.mdx`

- The intro names the layer's functions in four groups and holds no count: free time and
  demurrage; billing deadlines; B/L dates and multimodal ETA; EDI timestamps.
- `## EDI timestamps` (anchor `#edi-timestamps`), the last section, holds these `<Mistake>`
  entries. Each `rightCode` imports from `@northguild/gmt/intermodal` (and
  `@northguild/gmt/instant` where it resolves a local time).

| severity | title | rightSpecId |
| --- | --- | --- |
| high | Reading an offsetless code as UTC | `parseEdifactDtm` |
| high | Treating a named time code as an offset | `x12TimeCode` |
| high | Joining an X12 date and time by hand | `parseX12DateTime` |
| high | Reading time codes 13 to 24 in ascending order | `x12TimeCode` |
| high | A two-digit year given a century by the library | `parseEdifactDtm` |
| medium | Passing the value with its release character | `parseEdifactDtm` |
| medium | Deciding what a zone abbreviation means | `parseEdifactDtm` |
| medium | Splitting a period on a hyphen | `parseEdifactDtm` |
| high | Dropping eventTimeZoneOffset | `parseEpcisEvent` |
| medium | Writing Z or +0200 as the EPCIS offset | `parseEpcisEvent` |

Descriptions are one or two sentences, name the standard's rule and name no statute.

### D4. `mistakes/index.mdx`

Under `## Intermodal`: `- [EDI Timestamp Mistakes](/mistakes/intermodal/#edi-timestamps)`, last.

### D5. `guides/concepts/standards.mdx`

**Trap.** This page is tagged `industries: [core]`. `industry-tags.test.ts` fails a `core` page
whose source contains `/reference/intermodal/` or `@northguild/gmt/intermodal"`. So this page
names an industry layer's functions as inline code and links the guide, never a reference page of
an industry layer.

- **`## EDI and supply-chain events`**, after "Email and HTTP dates": one bullet per standard,
  each saying what it is and which GMT functions implement it.
  - **UN/EDIFACT**: UNTDID data element 2379 (UNECE's archived D.21B page and two directory
    mirrors, said to be an archive and mirrors), the UN/EDIFACT syntax rules (UNTDID Part 4) for
    the service characters and the release character, and UN/ECE Recommendation 7.
  - **ANSI X12**: a United States standard. Data elements 373, 337 and 623, then 1250 and 1251.
    The lists were read through an X12-licensed dictionary, not the X12 text. 623 links release
    008010; the others link release 005010.
  - **GS1 EPCIS 2.0** (ISO/IEC 19987): the JSON schema and the XSD.
  - A closing link to the guide.
- **`## Databases and other systems' clocks`**, after it: SQL-92 §5.3 with the ODBC `ts` escape
  (`parseSql`, `formatSql`); NTP timestamps, RFC 5905; and .NET ticks, Windows `FILETIME` and
  PostgreSQL's `timestamptz` microseconds, said to be vendor formats and not standards, with no
  link: their JSDoc gives none. `toExcelSerial` and `fromExcelSerial` are left off.
- **`## When sources disagree`**: after the numbered list, "A realm's own primary source decides
  a realm rule: the UNTDID directory for a 2379 code, the X12 dictionary for a time code, the GS1
  schema for an EPCIS field. The list above decides anything it covers."
- **External links.** `unece.org`, `iso.org` and `www.gs1.org` answer 403 to an automated
  request (`ref.gs1.org` answers 200). A link to one of them is listed only once it loads the
  page it claims in a real browser (G6); otherwise the standard is named in bold with no link.
  The page links `https://www.gs1.org/standards/epcis` and
  `https://www.iso.org/standard/85557.html`, and both are checked that way.

### D6. `index.mdx`

- **"Every standard, in one place"**: UN/EDIFACT, ANSI X12, GS1 EPCIS and SQL-92 are in the list,
  after RFC 9110 and before test262.
- **"The formats freight actually sends"** is the sixth card of "Built on the standards", with
  the `random` icon, before the pointer card, which stays last.

### D7. The seven-card section and the grid

- `.gmt-home-grid` is `repeat(auto-fit, minmax(min(24rem, 100%), 1fr))` with a 3rem gap. Inside a
  section, `.card-grid` is one column, and two only when the section itself is at least 40rem
  wide.
- "Built on the standards" has seven cards. At 1440px each `CardGrid` is one column, so there is
  no orphan. At 390px everything is one column.
- At tablet widths the section is alone on its row and its `CardGrid` is two columns. One rule
  inside `@container gmt-grid-section (min-width: 40rem)` spans an odd last card across both:

  ```css
  .gmt-grid-section .card-grid > .card:last-child:nth-child(odd) {
    grid-column: 1 / -1;
  }
  ```

  The last card is the pointer to the Standards guide, so a full-width closing row reads as
  intended, and the rule covers any odd count.
- The sixth card takes `--gmt-ice` (`.gmt-home-grid .card:nth-child(6n)`). The seventh is
  position `4n + 3`, takes Starlight's green and needs no rule.

### D8. `why-gmt.mdx`

The `after-industries` fragment holds one sentence: "The intermodal layer also reads and writes
the timestamp formats freight exchanges: UN/EDIFACT `DTM`, ANSI X12 dates and time codes, and GS1
EPCIS 2.0 event times." It types no count. Every count on that page is derived from
`gmt-stats.json`.

### D9. `guides/industries/index.mdx`

- **Layers**: a bullet for "Intermodal: EDI timestamps", after the B/L and multimodal ETA bullet.
- **Scenarios**: three bullets with the three titles of D2.

### D10. `guides/index.mdx`

The Industries row of the table lists "EDI timestamps", last.

### D11. The tag and the area label

- `src/lib/industry-tags.ts`: the intermodal `definition` is "Container free time, demurrage,
  billing deadlines, bill of lading dates and EDI timestamps." Its `guide` is the free-time
  guide.
- `src/lib/chat-constants.ts`: the area label is `"Intermodal, billing and EDI"`. The id is
  `intermodal`. No test asserts the label text.

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
   region. G10 tests it by bounding box across every preset.
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

## F. `context/dox/built.md` and the tracker

`built.md` holds the as-built record, in present tense: § Tier 2 has the two widgets in the
teaching-widget list, the registration lists, the tool pages and the traps (the permalink of a
`DTM` segment, the `core` Standards guide, the pattern chips of the Converter Bench); § Tier 6
has the two widget tools, the tool and starter counts and the area list; § Runbooks has the
`dist` alias trap and the baseline rule.

**Tracker.** This work adds no row to `context/dox/tracker.md`: it belongs to a realm story, and
its row is INT-15's in `context/domination/tracker.md`. Dox owes no `pnpm deps:sync`. The library
finalizer sets INT-15's `Status` to `Done` there and runs it. `docs-site.md` allows a function on
the site only when its story is `Done`, so the tester reports it as open if the row is not `Done`
when G runs; it is not a Dox failure.

---

## G. Definition of done (`dox-tester`: run each line literally)

`$WT` is the worktree root. `$SP` is the session scratchpad. **Prefix every command with
`eval "$(fnm env)" && fnm use &&`.** `packages/gmt/dist` is built from the final library source
before G runs. Build it only when no `astro dev` is serving pages from it (section 0).

1. `pnpm -C $WT --filter @gmt/dox test` passes. It includes the five EDI test files and
   `widget-ui`, `widget-registry`, `chat-starters`, `widget-permalink` (with the
   content-permalink test), `widget-graph`, `client-graph`, `lib-module-graph`,
   `widget-load-error`, `industry-tags`, `font-floor`, `date-ban`, `chat-handler`,
   `tools.test.ts` and `scripts/llms.test.ts`. Then the positional-index check prints `ok`:

   ```sh
   eval "$(fnm env)" && fnm use && cd $WT/apps/dox && pnpm exec tsx -e 'import("./src/lib/dox-tools.ts").then((m) => { const keys = Object.keys(m.DOX_TOOLS); const bad = keys.filter((k, i) => m.DOX_TOOL_DOCS[i]?.name !== k || m.DOX_TOOLS[k].description !== m.DOX_TOOL_DOCS[i].purpose); console.log(bad.length === 0 && keys.length === m.DOX_TOOL_DOCS.length ? "ok" : "MISMATCH " + bad.join(",")); })'
   ```

2. `pnpm -C $WT --filter @gmt/dox check` reports 0 errors, then
   `pnpm -C $WT --filter @gmt/dox lint` passes.
3. From `$WT`: `node scripts/api-surface.mjs check` exits 0 with 0 failing results, and
   `node scripts/stats.mjs check` exits 0. `node scripts/api-surface.mjs show` lists the guide's,
   the scenarios' and the mistakes' examples as checked, not skipped (the `990615` table is prose
   and is not listed).
4. **Every value against dist.** Save appendix Z as `$SP/int15-values.mjs`. Then
   `DIST=$WT/packages/gmt/dist node $SP/int15-values.mjs` prints `all ok`, and again with
   `TZ=America/Los_Angeles` and `TZ=Asia/Tokyo`. Then list every `// result` comment in the
   content pages of section D and every expected literal in the five EDI test files, and confirm
   each is a row of appendix Z or a JSDoc `@example` of the function called. A result in neither
   fails. If a row fails, stop and report.
5. `pnpm -C $WT --filter @gmt/dox build` succeeds. The generated `scenarios/index.mdx` lists the
   three titles, and the generated `tools/index.mdx` lists both tools under Intermodal.
6. **Links.**
   - Internal: from `$WT/apps/dox` after the build, run the script in
     `context/dox/specs/int-58-billing-deadlines.md` § 10 with
     `tools/dtm-decoder tools/x12-time-reader guides/industries/intermodal-edi-timestamps guides/industries guides guides/concepts/standards scenarios/a-203-read-as-utc scenarios/et-is-not-an-offset scenarios/the-epcis-offset-nobody-kept scenarios mistakes/intermodal mistakes why-gmt`
     and the home page checked by hand. It prints nothing and exits 0. Confirm
     `id="edi-timestamps"` in the built `mistakes/intermodal` and
     `id="edi-and-supply-chain-events"` in the built Standards guide.
   - External: for every `http` link in the pages of section D,
     `curl -s -o /dev/null -L -m 20 -w "%{http_code}" <url>` prints `200`, except `unece.org`,
     `iso.org` and `www.gs1.org`, which refuse automated requests with a 403. Open each of those
     in a real browser and record the page title beside the URL. A link that does not load the page it claims is removed and
     the standard named in plain bold.
7. **Structural and pixel gates against a clean baseline.** The baseline is a detached worktree
   of the commit the branch is based on, built clean. It is not the local `main` branch, which
   can lag `origin/main`, and it is never the working tree with changes set aside.

   ```sh
   eval "$(fnm env)" && fnm use
   BASE=$SP/dox-base
   BASE_SHA=$(git -C $WT merge-base HEAD origin/main)
   git -C $WT worktree add --detach "$BASE" "$BASE_SHA"
   mkdir -p "$BASE/apps/dox/src/generated"
   [ -f $WT/apps/dox/src/generated/upstream-filings.live.json ] && cp $WT/apps/dox/src/generated/upstream-filings.live.json "$BASE/apps/dox/src/generated/"   # same upstream data, no network
   pnpm -C "$BASE" install --frozen-lockfile
   pnpm -C "$BASE" --filter @northguild/gmt build && pnpm -C "$BASE" --filter @gmt/dox build
   (cd "$BASE/apps/dox" && node scripts/html-diff.mjs capture $SP/html-baseline && pnpm visual:before)
   rm -rf $WT/apps/dox/.visual/before && mkdir -p $WT/apps/dox/.visual && cp -R "$BASE/apps/dox/.visual/before" $WT/apps/dox/.visual/before
   lsof -iTCP:48173 -sTCP:LISTEN   # must print nothing before the branch run
   (cd $WT/apps/dox && node scripts/html-diff.mjs compare $SP/html-baseline; pnpm visual:after; pnpm visual:diff)
   git -C $WT worktree remove --force "$BASE"
   ```

   The baseline's library build runs in the baseline worktree and leaves `$WT/packages/gmt/dist`
   alone.

   **Expected `html-diff`:** `+ tools/dtm-decoder` and `+ tools/x12-time-reader` (widget pages
   with no baseline); `~` or `✓` for every other page. `✗` anywhere is a regression.

   **Expected `visual:diff`:** `MISSING (no before)` for the eight `tool-dtm-decoder-*` and
   `tool-x12-time-reader-*` shots. `✗` or `ERROR (size mismatch)` is allowed only for these, each
   confirmed by opening the before and after PNGs and finding nothing else changed:
   - `home`: the freight card and the longer list in "Every standard, in one place" (a taller
     page);
   - every `tool-*` page and `tools-index` at desktop: two more rows under Tools in the sidebar,
     and two more entries on the index;
   - `tool-converter-bench` and `converter-bench` (the reference page embeds the same
     `<ConverterBench />`): two more pattern chips, `epcisEventTime` and `epcisTimeZoneOffset`,
     because the chip list is every pattern the `regex` barrel exports (a taller page);
   - `dox`: two more example cards and the area heading "Intermodal, billing and EDI";
   - any page whose only change is the library's reference entries or published counts, which
     the baseline lacks.
   Any other difference is a regression.
8. **Capture the pages.** With the build served on port 48173
   (`pnpm -C $WT --filter @gmt/dox preview --port 48173`), a scratch Playwright script (in `$SP`,
   not the repo) screenshots, full page, at 1440×900 and 390×844 in both themes: both tool pages
   on every preset of every preset select, the guide, the three scenarios,
   `/mistakes/intermodal/#edi-timestamps`, the Standards guide and the home page. Save to
   `$WT/apps/dox/.visual/int15/<slug>-<theme>-<viewport>.png`. Read each **as a long page, not
   as a thumbnail**: nothing overlaps, every label row lines up, no text is clipped, nothing is
   amber but a `NO SIGNAL`, and no element has a coloured left edge.
9. **The home grid.** At 1440, 768 and 390 wide, read
   `getComputedStyle(grid).gridTemplateColumns` for the `.card-grid` in "Built on the standards"
   and the bounding box of its last card. No card sits alone in a two-column row: where the grid
   has two columns, the last card spans both. `document.documentElement.scrollWidth <=
   window.innerWidth` at all three.
10. **Every region holds still** (a scratch Playwright script, Chromium and WebKit, at 2560,
    2000, 1920, 1800, 1440, 1024, 768 and 390 viewports; the two-pane band and the stacked
    layout both): after one warm-up, for every preset of `preset` in turn (and on the X12 Time
    Reader every preset of `dtp-preset`), plus stress inputs (the widest single value, the widest
    period, a refused value, an unsupported code, zone text, a time with hundredths, a DST
    ambiguity, every zone cleared), record the `getBoundingClientRect()` of every section, split,
    pane, panel, hold, member cell, zone row, timeline, written line and field grid. Each is equal
    across every state (±0.5px) in `x`, `width`, `height` and its `top` measured from its own
    section. The script fails if it checked nothing or the page scrolls horizontally.
11. **`grow:measure`.** Serve the build statically, never with `astro preview`
    (`python3 -m http.server 4351 --bind 127.0.0.1 --directory $WT/apps/dox/dist`), then
    `(cd $WT/apps/dox && node scripts/grow-measure.mjs --base http://127.0.0.1:4351 --out $SP/grow --only dtm-decoder,x12-time-reader)`
    passes in Chromium and WebKit at 1440 and 390: an HTTP 200 page, a root that matches, the
    preset switch happened, no painted jump over 48px, every `.gmt-grow` at rest.
12. **Keyboard-only pass** (no mouse) on each tool page and in the `/dox` rail through each of
    the two example cards:
    - Tab reaches each preset select, every input and select, and each copy button, in visual
      order, and nothing else inside the widget.
    - Arrow keys change the preset, and the verdict, readouts, calls and outputs follow.
    - DTM Decoder: typing `DTM+137:202406151430CET:303'` turns the verdict to the zone-text one;
      choosing a zone in `zone-1` fills its row. Choosing `two-digit-no-window` shows
      `NO SIGNAL`; choosing "From a start year" and typing `2000` clears it.
    - X12 Time Reader: with `ET` typed, choosing `America/New_York` in `zone-1` shows
      `2024-06-15T18:30:00Z`; typing `UT` disables the four zone selects. Choosing `d6-no-window`
      in the second preset select shows `NO SIGNAL`, and a start year of `2000` clears it.
    - A disabled control is skipped by Tab and announced as unavailable.
    - The focus ring is visible on every control in both themes.
13. **`prefers-reduced-motion: reduce`**: nothing on either tool page animates or transitions
    when a preset, a value or a zone changes; `[data-growing]` never appears.
    **`forced-colors: active`** (Chromium emulation): the picture's boxes and brackets and the timeline's axis, ticks and pins stay visible and tell apart by their text and numbers; the member cells, the verdict
    plates, the disabled controls and every focus ring stay distinguishable; all text keeps a
    system colour. Screenshot to `$WT/apps/dox/.visual/int15/forced-<tool>.png`.
14. **Contrast and text size**, measured on the rendered tool pages in both themes: labels,
    hints, verdicts, details, member cells (present and "not stated"), strip values,
    the gap line, outputs and asides are at least 7:1 and at least 12px.
15. **Phone width**: at 390×844, on each tool page and each preset,
    `document.documentElement.scrollWidth <= window.innerWidth`; in every `.gmt-field-grid` the
    labels of one rendered row share a `.gmt-label-text` top and a control top (±1px); no two
    visible text boxes inside the strip or a readout block intersect. `/dox`'s examples panel
    fits at 390 with every card.
16. **Droppability and naming greps.**
    - In the build, neither tool page's scripts pull in a `zod`, `ai` or `dox-tools` chunk
      (`grep -l "dox-tools\|zod" dist/_astro/*.js` over the chunks each page references). A
      reference page loads no React.
    - Prints nothing:
      `grep -rniE "CFR|statut|regulat|docket|agency|HIPAA|customs|court" $WT/apps/dox/src/content/docs/tools/dtm-decoder.mdx $WT/apps/dox/src/content/docs/tools/x12-time-reader.mdx $WT/apps/dox/src/content/docs/guides/industries/intermodal-edi-timestamps.mdx $WT/apps/dox/src/content/docs/scenarios/a-203-read-as-utc.mdx $WT/apps/dox/src/content/docs/scenarios/et-is-not-an-offset.mdx $WT/apps/dox/src/content/docs/scenarios/the-epcis-offset-nobody-kept.mdx $WT/apps/dox/src/lib/edi-*.ts $WT/apps/dox/src/lib/dtm-decoder*.ts* $WT/apps/dox/src/lib/x12-time-reader*.ts*`
      (`dtm-decoder.test.ts` and the two mount tests hold the forbidden-word pattern itself: read
      those hits and no others).
    - Prints nothing but the X12 mount test's own pattern: the same files through
      `grep -rniE "luxon|date-fns|moment\.?js|day\.?js|spacetime"`. The pattern is `moment\.?js`
      and not `moment`, because the guide uses "moment" as an English word.
    - `git -C $WT diff -U0 -- apps/dox | grep -E "^\+.*(bolTimestamp|multimodalETA)"` prints only
      the intro of `mistakes/intermodal.mdx`, which names every function of the layer.
    - The `<Mistake>` blocks, the Standards guide's two sections, the home card and the two
      `DOX_TOOL_DOCS` and `CHAT_STARTERS` entries are read by eye for the same words.
    - `grep -rnE "border-left|border-inline-start" $WT/apps/dox/src/styles/gmt-edi-widgets.css`
      prints nothing.
17. With no `astro dev` serving pages: `pnpm -C $WT stats:sync && pnpm -C $WT run validate`
    exits 0.
18. `git -C $WT status --short` shows nothing staged, and under `apps/dox` and `context/dox` only
    the files in section H. The `packages/gmt`, `context/domination`,
    `context/coding-standards.md` and `.changeset` lines are the library story's.

---

## H. Files

**The two tools** (under `apps/dox/`):

- Shared: `src/lib/edi-widgets.ts`, `src/lib/edi-widgets.test.ts`, `src/lib/edi-lib.ts`,
  `src/test/edi-lib.ts`, `src/styles/gmt-edi-widgets.css`.
- DTM Decoder: `src/lib/dtm-decoder.ts`, `src/lib/dtm-decoder.test.ts`,
  `src/lib/dtm-decoder-mount.ts`, `src/lib/dtm-decoder-mount.test.tsx`,
  `src/components/DtmDecoder.astro`, `src/content/docs/tools/dtm-decoder.mdx`.
- X12 Time Reader: `src/lib/x12-time-reader.ts`, `src/lib/x12-time-reader.test.ts`,
  `src/lib/x12-time-reader-mount.ts`, `src/lib/x12-time-reader-mount.test.tsx`,
  `src/components/X12TimeReader.astro`, `src/content/docs/tools/x12-time-reader.mdx`.

**Content** (under `apps/dox/src/content/docs/`):

- Pages of their own: `guides/industries/intermodal-edi-timestamps.mdx`,
  `scenarios/a-203-read-as-utc.mdx`, `scenarios/et-is-not-an-offset.mdx`,
  `scenarios/the-epcis-offset-nobody-kept.mdx`.
- Pages that carry a part: `guides/concepts/standards.mdx`, `guides/industries/index.mdx`,
  `guides/index.mdx`, `mistakes/intermodal.mdx`, `mistakes/index.mdx`, `index.mdx`, `why-gmt.mdx`.

**Registration** (under `apps/dox/`): `src/lib/dox-tools.ts`, `src/lib/chat-constants.ts`,
`src/lib/widget-permalink.ts`, `src/lib/widget-load-error.test.tsx`, `src/lib/mdx-jsx.ts`,
`src/lib/industry-tags.ts`, `src/lib/gmt-modules.ts`, `src/components/ask/widget-registry.ts`,
`src/components/ask/widget-graph.test.ts`, `worker/tools.ts`, `src/styles/gmt-a11y.css`,
`src/styles/dox.css`, `astro.config.mjs`, `scripts/html-diff.mjs`, `scripts/visual-snapshot.mjs`,
`scripts/grow-measure.mjs`.

**Regenerated, not hand-edited:** `src/generated/reference/gmt-corpus.json` and
`src/generated/reference/route-manifest.ts` (both tracked, although `.gitignore` lists their
directory) and `src/data/gmt-stats.json` (`pnpm stats:sync`). The rest of `src/generated/`,
`src/content/docs/reference/`, `scenarios/index.mdx` and `tools/index.mdx` are gitignored.

**Context:** `context/dox/built.md`, `context/dox/tracker.md`, this spec.

---

## J. Risks and decisions

- **R1. Three X12 inputs, one call.** A freight segment sends a date, a time and a time code as
  three elements, and `parseX12DateTime` takes them as three arguments. The tool passes them as
  typed and prints the call as made. Nothing is joined and no qualifier is inferred.
- **R2. A `DTP` value is a second section, not a second tool.** It is the same standard and the
  same page of the guide, but a different element pair with no time code and no instant. It
  holds its own state and its own preset select, so neither section resets the other.
- **R3. A bare `DTM` value is not un-released.** Only a pasted segment is split and un-released.
  A bare value reaches the library as typed, so `202406151430?+02` shows the library's own
  sentinel and the reason (D9raw). This is the JSDoc's own example, and it keeps the tool from
  hiding the mistake.
- **R4. The year-window controls are always rendered.** Showing and hiding a row would move
  every readout below it, so the controls stay in place and are disabled, with a line saying
  the window is not read, when the code has a four-digit year.
- **R5. `disambiguation: "reject"`, with no control.** Any other policy picks an instant for a
  repeated or skipped time, which is a guess the tool must not make. Both tools state the
  policy beside the result and in the printed call, and `classifyLocal` supplies the reason.
- **R6. The strip has no "answer" row, and its four zones are the only zone inputs.** The zones
  are equals. Each row shows its instant, its offset and the same value with that offset, so
  the reader sees one set of digits become four different moments. A preset is an example and
  may state its place: every preset whose result states no offset prefills its example's zones
  and says they are the example's pick. Nothing derives a zone from a code or a name, so a
  typed code never fills one, and a preset where the strip does not apply carries none.
- **R7. A probe instead of a list of two-digit-year codes** (B0.1). The site holds no copy of
  the library's code table. Each probe costs at most 22 formatter calls.
- **R8. `rolling` reads the clock.** The widgets call the library with it only after mount, the
  presets use a fixed window, and the two `rolling` tests fake the clock. The guide shows it as
  a table from the library's own fake-clock tests, never as an executable example.
- **R9. `TM` or `TS` by the form typed** (B2.6). The library has no formatter for element 337, so
  the tool picks the 1250 code whose mask matches what the reader sent. A fraction has no mask,
  and the sentinel that follows is the lesson: tenths and hundredths are read, not written.
- **R10. An empty X12 form makes no call** (B2.1), while a blank DTM Decoder input does (B1.4).
- **R11. The function qualifier in the presets is `137`.** The tool shows it and interprets
  nothing, and no preset label gives it a meaning.
- **R12. Twenty example cards on `/dox`.** G15 checks phone width. Trimming cards is an owner
  decision.
- **R13. Chat tool overlap.** `showDtmDecoder` and `showX12TimeReader` sit near
  `showConverterBench`. The `when` lines name the standards and their codes, which a conversion
  question does not. Probing brains spends quota: `scripts/probe-brains.ts` is the owner's to
  run after merge.
- **R14. The visual harness captures no guide and no scenario.** G8's scratch capture covers
  them.
- **R15. `unece.org`, `iso.org` and `www.gs1.org` refuse automated requests.** Their links are
  confirmed in a browser or left out (D5, G6).
- **R16. The Converter Bench grows with the `regex` barrel.** Its pattern chips are every
  `RegExp` the barrel exports, so the two EPCIS patterns add two chips and change that page's
  height in a visual diff (G7).

## What the library provides

Nothing here is built on the site. Two things hold when G runs, and both are the library
story's: `packages/gmt/dist` is built from the final source, and the reference corpus is
generated from it, so that the four `fixedSpecId` and `rightSpecId` keys and the reference routes
exist (D, preamble).

---

## Appendix Z. The values script (`$SP/int15-values.mjs`)

Run: `DIST=$WT/packages/gmt/dist node $SP/int15-values.mjs`, then again with
`TZ=America/Los_Angeles` and `TZ=Asia/Tokyo`. It prints `ok <id>` per row and
`all ok (<n> rows)`, or exits 1 on any `FAIL`. Row ids: `D*` the DTM Decoder and UN/EDIFACT, `Y*`
two-digit years, `T*` the three X12 elements, `X*` the time code and the 1250 qualifiers, `E*`
EPCIS, `N*` naive JavaScript. This is its content.

```js
// int15-values.mjs — every library value the INT-15 Dox tools, guide, scenarios and mistakes show.
// Run: DIST=<path to packages/gmt/dist> node int15-values.mjs
// Prints `ok <id>` per row, then `all ok (<n> rows)`; exits 1 on any FAIL.
const DIST = process.env.DIST;
if (!DIST) {
  console.error("Set DIST to the absolute path of packages/gmt/dist.");
  process.exit(2);
}
const load = (m) => import(`${DIST}/${m}/index.js`);
const { parseEdifactDtm, parseX12DateTime, parseX12DateTimePeriod, x12TimeCode, parseEpcisEvent } = await load("intermodal/parse");
const { formatEdifactDtm, formatX12DateTimePeriod, formatEpcisEvent } = await load("intermodal/format");
const { isValidEdifactDtm, isValidEdifactDtmFormat, isValidX12DateTime, isValidX12DateTimePeriod, isValidX12DateTimePeriodFormat, isValidX12TimeCode, isValidEpcisEvent } = await load("intermodal/validate");
const { resolveLocal, classifyLocal, toOffsetInstant, fromOffsetInstant } = await load("instant/convert");
const { minUtc, maxUtc, diffUtcAsDuration } = await load("utc/calculate");
const { parseDateWithPattern } = await load("plain/parse");
const R = { disambiguation: "reject" };
const L = "2024-06-15T14:30:00";
const D = "2024-06-15";
const T = "14:30:00";
const FOUR = ["2024-06-15T18:30:00Z", "2024-06-15T12:30:00Z", "2024-06-15T06:30:00Z", "2024-06-15T21:30:00Z"];
// What `needsYearWindow` (apps/dox/src/lib/edi-widgets.ts) asks the formatter.
const SAMPLES = ["2024-06-15", "2024-06-15T14:30", "2024-06-15T14:30:00+02:00", "14:30", "14:30:00+02:00", "+02:00", "2024-06-15/2024-06-20", "2024-06-15T14:30/2024-06-20T16:00", "2024-06-15/2024-06-20T16:00", "2024-06-15T14:30/2024-06-20", "09:00/17:00"];
const needs = (format, code) => SAMPLES.every((s) => format(s, code) === "") && SAMPLES.some((s) => format(s, code, { yearWindow: 2000 }) !== "");
const EDIFACT_CODES = ["101", "102", "201", "202", "203", "204", "205", "206", "207", "208", "209", "301", "302", "303", "304", "401", "402", "404", "406", "713", "717", "718", "719"];
const X12_CODES = ["D8", "D6", "DB", "TT", "DT", "TR", "RTS", "TM", "TS", "RD8", "RD6", "RD", "RDT", "DTS", "DDT", "DTD", "RTM", "TC", "TU", "EH", "UN"];
const rows = [
  // --- DTM Decoder: the ten presets, in DTM_PRESETS order (parse, the string isoOf builds, write-back)
  ["D1", () => parseEdifactDtm("202406151430", "203"), { local: L }],
  ["D1w", () => formatEdifactDtm(L, "203"), "202406151430"],
  ["D2", () => parseEdifactDtm("202406151430+00", "303"), { local: L, offset: "+00:00", instant: "2024-06-15T14:30:00Z" }],
  ["D2raw", () => parseEdifactDtm("202406151430?+00", "303"), null],
  ["D2l", () => fromOffsetInstant({ instant: "2024-06-15T14:30:00Z", offset: "+00:00" }), "2024-06-15T14:30:00+00:00"],
  ["D2w", () => formatEdifactDtm("2024-06-15T14:30:00+00:00", "303"), "202406151430+00"],
  ["D3", () => parseEdifactDtm("202406151430UTC", "303"), { local: L, offset: "+00:00", instant: "2024-06-15T14:30:00Z" }],
  ["D3g", () => parseEdifactDtm("202406151430GMT", "303"), { local: L, offset: "+00:00", instant: "2024-06-15T14:30:00Z" }],
  ["D4", () => parseEdifactDtm("202406151430CET", "303"), { local: L, zone: "CET" }],
  ["D4w", () => formatEdifactDtm(L, "303"), ""],
  ["D4z", () => formatEdifactDtm("2024-06-15T14:30:00+02:00", "303"), "202406151430+02"],
  ["D5", () => parseEdifactDtm("202406151430+0200", "205"), { local: L, offset: "+02:00", instant: "2024-06-15T12:30:00Z" }],
  ["D5l", () => fromOffsetInstant({ instant: "2024-06-15T12:30:00Z", offset: "+02:00" }), "2024-06-15T14:30:00+02:00"],
  ["D5w", () => formatEdifactDtm("2024-06-15T14:30:00+02:00", "205"), "202406151430+0200"],
  ["D5s", () => parseEdifactDtm("20240615143045+0200", "208"), { local: "2024-06-15T14:30:45", offset: "+02:00", instant: "2024-06-15T12:30:45Z" }],
  ["D5s-l", () => fromOffsetInstant({ instant: "2024-06-15T12:30:45Z", offset: "+02:00" }), "2024-06-15T14:30:45+02:00"],
  ["D5s-w", () => formatEdifactDtm("2024-06-15T14:30:45+02:00", "208"), "20240615143045+0200"],
  ["D6", () => parseEdifactDtm("2024061520240620", "718"), { date: D, periodEnd: { date: "2024-06-20" } }],
  ["D6h", () => parseEdifactDtm("20240615-20240620", "718"), null],
  ["D6r", () => parseEdifactDtm("2024062020240615", "718"), null],
  ["D6w", () => formatEdifactDtm("2024-06-15/2024-06-20", "718"), "2024061520240620"],
  ["D7", () => parseEdifactDtm("240615", "101"), null],
  ["D8", () => parseEdifactDtm("240615", "101", { yearWindow: 2000 }), { date: D }],
  ["D8w", () => formatEdifactDtm(D, "101", { yearWindow: 2000 }), "240615"],
  ["D8n", () => formatEdifactDtm(D, "101"), ""],
  ["D8x", () => formatEdifactDtm("1969-01-01", "101", { yearWindow: 2000 }), ""],
  // --- DTM Decoder: the strip of `local-203` (resolveLocal, the offset in force, the same value as a 205)
  ["D1a", () => resolveLocal(L, "America/New_York", R), FOUR[0]],
  ["D1a-o", () => toOffsetInstant(FOUR[0], "America/New_York"), { instant: FOUR[0], offset: "-04:00", timeZone: "America/New_York" }],
  ["D1a-l", () => fromOffsetInstant({ instant: FOUR[0], offset: "-04:00" }), "2024-06-15T14:30:00-04:00"],
  ["D1a-5", () => formatEdifactDtm("2024-06-15T14:30:00-04:00", "205"), "202406151430-0400"],
  ["D1b", () => resolveLocal(L, "Europe/Berlin", R), FOUR[1]],
  ["D1b-o", () => toOffsetInstant(FOUR[1], "Europe/Berlin"), { instant: FOUR[1], offset: "+02:00", timeZone: "Europe/Berlin" }],
  ["D1b-l", () => fromOffsetInstant({ instant: FOUR[1], offset: "+02:00" }), "2024-06-15T14:30:00+02:00"],
  ["D1b-5", () => formatEdifactDtm("2024-06-15T14:30:00+02:00", "205"), "202406151430+0200"],
  ["D1c", () => resolveLocal(L, "Asia/Shanghai", R), FOUR[2]],
  ["D1c-o", () => toOffsetInstant(FOUR[2], "Asia/Shanghai"), { instant: FOUR[2], offset: "+08:00", timeZone: "Asia/Shanghai" }],
  ["D1c-l", () => fromOffsetInstant({ instant: FOUR[2], offset: "+08:00" }), "2024-06-15T14:30:00+08:00"],
  ["D1c-5", () => formatEdifactDtm("2024-06-15T14:30:00+08:00", "205"), "202406151430+0800"],
  ["D1d", () => resolveLocal(L, "America/Los_Angeles", R), FOUR[3]],
  ["D1d-o", () => toOffsetInstant(FOUR[3], "America/Los_Angeles"), { instant: FOUR[3], offset: "-07:00", timeZone: "America/Los_Angeles" }],
  ["D1d-l", () => fromOffsetInstant({ instant: FOUR[3], offset: "-07:00" }), "2024-06-15T14:30:00-07:00"],
  ["D1d-5", () => formatEdifactDtm("2024-06-15T14:30:00-07:00", "205"), "202406151430-0700"],
  ["D1min", () => minUtc(FOUR), "2024-06-15T06:30:00Z"],
  ["D1max", () => maxUtc(FOUR), "2024-06-15T21:30:00Z"],
  ["D1gap", () => diffUtcAsDuration("2024-06-15T06:30:00Z", "2024-06-15T21:30:00Z", "hours"), "PT15H"],
  ["D-kolkata", () => resolveLocal(L, "Asia/Kolkata", R), "2024-06-15T09:00:00Z"],
  ["Dgap-half", () => diffUtcAsDuration("2024-06-15T09:00:00Z", "2024-06-15T18:30:00Z", "hours"), "PT9H30M"],
  ["Dgap-one", () => diffUtcAsDuration("2024-06-15T12:30:00Z", "2024-06-15T12:30:00Z", "hours"), "PT0S"],
  ["D1cd", () => resolveLocal(L, "Asia/Shanghai"), "2024-06-15T06:30:00Z"],
  ["D1bd", () => resolveLocal(L, "Europe/Berlin"), "2024-06-15T12:30:00Z"],
  ["D16", () => resolveLocal("2024-11-03T01:30:00", "America/New_York", R), ""],
  ["D16c", () => classifyLocal("2024-11-03T01:30:00", "America/New_York"), "ambiguous"],
  ["D16n", () => classifyLocal("2024-03-10T02:30:00", "America/New_York"), "nonexistent"],
  ["D16u", () => classifyLocal(L, "America/New_York"), "unique"],
  ["D16p", () => parseEdifactDtm("202411030130", "203"), { local: "2024-11-03T01:30:00" }],
  // --- DTM Decoder: the other shapes, and every reason behind NO SIGNAL
  ["D9", () => parseEdifactDtm("202406151430+02", "303"), { local: L, offset: "+02:00", instant: "2024-06-15T12:30:00Z" }],
  ["D9raw", () => parseEdifactDtm("202406151430?+02", "303"), null],
  ["D10", () => parseEdifactDtm("2024", "602"), null],
  ["D10f", () => isValidEdifactDtmFormat("602"), false],
  ["D10g", () => isValidEdifactDtmFormat("203"), true],
  ["D11", () => parseEdifactDtm("202406151430", ""), null],
  ["D12", () => parseEdifactDtm("202406151430202406201600", "719"), { local: L, periodEnd: { local: "2024-06-20T16:00:00" } }],
  ["D12w", () => formatEdifactDtm("2024-06-15T14:30:00/2024-06-20T16:00:00", "719"), "202406151430202406201600"],
  ["D13", () => parseEdifactDtm("143045+02", "404"), { time: "14:30:45", offset: "+02:00" }],
  ["D13w", () => formatEdifactDtm("14:30:45+02:00", "404"), "143045+02"],
  ["D14", () => parseEdifactDtm("+0200", "406"), { offset: "+02:00" }],
  ["D14w", () => formatEdifactDtm("+02:00", "406"), "+0200"],
  ["D15", () => parseEdifactDtm("20240615", "102"), { date: D }],
  ["D15w", () => formatEdifactDtm(D, "102"), "20240615"],
  ["D17", () => parseEdifactDtm("143045+0200", "209"), { time: "14:30:45", offset: "+02:00" }],
  ["D17w", () => formatEdifactDtm("14:30:45+02:00", "209"), "143045+0200"],
  ["D18", () => parseEdifactDtm("2406151430+0200", "206"), null],
  ["D18y", () => parseEdifactDtm("2406151430+0200", "206", { yearWindow: 2000 }), { local: L, offset: "+02:00", instant: "2024-06-15T12:30:00Z" }],
  ["D19", () => parseEdifactDtm("202406151430+24", "303"), null],
  ["D19z", () => parseEdifactDtm("202406151430Z", "303"), null],
  ["D19l", () => parseEdifactDtm("202406151430cet", "303"), null],
  ["D19n", () => parseEdifactDtm("202406151430000", "303"), null],
  ["D20", () => parseEdifactDtm("202406150030+0200", "205"), { local: "2024-06-15T00:30:00", offset: "+02:00", instant: "2024-06-14T22:30:00Z" }],
  ["Dv1", () => isValidEdifactDtm("202406151430", "203"), true],
  ["Dv2", () => isValidEdifactDtm("202406151430", "204"), false],
  ["Dv3", () => isValidEdifactDtm("240615", "101", { yearWindow: 2000 }), true],
  ["Dset", () => EDIFACT_CODES.filter((c) => !isValidEdifactDtmFormat(c)), []],
  ["Dneeds", () => [...EDIFACT_CODES, "602"].filter((c) => needs(formatEdifactDtm, c)), ["101", "201", "202", "206", "207", "301", "302", "713", "717"]],
  // --- two-digit years (Y*)
  ["Y1", () => parseEdifactDtm("990615", "101", { yearWindow: 1950 }), { date: "1999-06-15" }],
  ["Y2", () => parseEdifactDtm("990615", "101", { yearWindow: 2000 }), { date: "2099-06-15" }],
  ["Y3", () => parseEdifactDtm("690101", "101", { yearWindow: 2000 }), { date: "2069-01-01" }],
  ["Y4", () => parseEdifactDtm("690101", "101", { yearWindow: 1969 }), { date: "1969-01-01" }],
  ["Y5", () => parseX12DateTimePeriod("240615", "D6"), null],
  ["Y6", () => parseX12DateTimePeriod("240615", "D6", { yearWindow: 2000 }), { date: D }],
  ["Y6w", () => formatX12DateTimePeriod(D, "D6", { yearWindow: 2000 }), "240615"],
  ["Y7", () => parseX12DateTimePeriod("990615", "D6", { yearWindow: 1950 }), { date: "1999-06-15" }],
  ["Y8", () => parseDateWithPattern("03/15/24", "MM/dd/yy"), ""],
  ["Y9", () => parseDateWithPattern("03/15/24", "MM/dd/yy", undefined, { yearWindow: 1950 }), "2024-03-15"],
  ["Y10", () => parseDateWithPattern("03/15/99", "MM/dd/yy", undefined, { yearWindow: 1950 }), "1999-03-15"],
  ["Y11", () => parseEdifactDtm("20240615", "102", { yearWindow: 1950 }), { date: D }],
  ["Y-bad", () => parseEdifactDtm("240615", "101", { yearWindow: 9901 }), null],
  ["Y-bad-p", () => parseX12DateTimePeriod("240615", "D6", { yearWindow: 9901 }), null],
  // --- X12 Time Reader, sections 1 to 4: the eleven presets, in X12_PRESETS order (T*)
  ["T1", () => parseX12DateTime("20240615", "1430", "ET"), { date: D, time: T, local: L, zone: "Eastern", daylight: null }],
  ["T2", () => parseX12DateTime("20240615", "1430", "ED"), { date: D, time: T, local: L, zone: "Eastern", daylight: true }],
  ["T3", () => parseX12DateTime("20240615", "1430", "UT"), { date: D, time: T, local: L, offset: "+00:00", instant: "2024-06-15T14:30:00Z" }],
  ["T4", () => parseX12DateTime("20240615", "1430", "13"), { date: D, time: T, local: L, offset: "-12:00", instant: "2024-06-16T02:30:00Z" }],
  ["T5", () => parseX12DateTime("20240615", "1430", "24"), { date: D, time: T, local: L, offset: "-01:00", instant: "2024-06-15T15:30:00Z" }],
  ["T6", () => parseX12DateTime("20240615", "14300012"), { date: D, time: "14:30:00.12", local: "2024-06-15T14:30:00.12" }],
  ["T6w", () => formatX12DateTimePeriod("14:30:00.12", "TS"), ""],
  ["T7", () => parseX12DateTime("20240615", "1430"), { date: D, time: T, local: L }],
  ["T8", () => parseX12DateTime("20240615", "1430", "LT"), { date: D, time: T, local: L, zone: "Local", daylight: null }],
  ["T9", () => parseX12DateTime("20240615"), { date: D }],
  ["T10", () => parseX12DateTime("", "1430"), { time: T }],
  ["T11", () => parseX12DateTime("20240615", "", "ET"), null],
  // --- X12 Time Reader: the instant, the strip and the write-back
  ["T1es", () => parseX12DateTime("20240615", "1430", "ES"), { date: D, time: T, local: L, zone: "Eastern", daylight: false }],
  ["T1z", () => resolveLocal(L, "America/New_York", R), "2024-06-15T18:30:00Z"],
  ["T1z-o", () => toOffsetInstant("2024-06-15T18:30:00Z", "America/New_York"), { instant: "2024-06-15T18:30:00Z", offset: "-04:00", timeZone: "America/New_York" }],
  ["T1z-l", () => fromOffsetInstant({ instant: "2024-06-15T18:30:00Z", offset: "-04:00" }), "2024-06-15T14:30:00-04:00"],
  ["T1zj", () => resolveLocal("2024-01-15T14:30:00", "America/New_York", R), "2024-01-15T19:30:00Z"],
  ["T1zd", () => resolveLocal(L, "America/New_York"), "2024-06-15T18:30:00Z"],
  ["T1zjd", () => resolveLocal("2024-01-15T14:30:00", "America/New_York"), "2024-01-15T19:30:00Z"],
  ["Twd", () => formatX12DateTimePeriod(D, "D8"), "20240615"],
  ["Twt", () => formatX12DateTimePeriod(T, "TM"), "1430"],
  ["Tws", () => formatX12DateTimePeriod("14:30:45", "TS"), "143045"],
  ["T12", () => parseX12DateTime("20240615", "143045"), { date: D, time: "14:30:45", local: "2024-06-15T14:30:45" }],
  ["T13", () => parseX12DateTime("", "1430", "UT"), { time: T, offset: "+00:00" }],
  ["T14", () => parseX12DateTime("", "1430", "ES"), { time: T, zone: "Eastern", daylight: false }],
  ["T15", () => parseX12DateTime("20240615", "1430", "20"), { date: D, time: T, local: L, offset: "-05:00", instant: "2024-06-15T19:30:00Z" }],
  ["T16", () => parseX12DateTime("20240615", "2330", "24"), { date: D, time: "23:30:00", local: "2024-06-15T23:30:00", offset: "-01:00", instant: "2024-06-16T00:30:00Z" }],
  // --- X12 Time Reader: every reason behind NO SIGNAL in sections 1 to 4
  ["Tn1", () => parseX12DateTime("", ""), null],
  ["Tn2", () => parseX12DateTime("240615"), null],
  ["Tn3", () => parseX12DateTime("20240615", "2430"), null],
  ["Tn4", () => parseX12DateTime("20240615", "1430", "EST"), null],
  ["Tn5", () => parseX12DateTime("", "", "UT"), null],
  ["Tn6", () => parseX12DateTime("20240615", "0000", "ET") !== null, true],
  ["Tv1", () => isValidX12DateTime("20240615", "1430", "ET"), true],
  ["Tv2", () => isValidX12DateTime("20240615", "", "ET"), false],
  // --- the time code alone (X*c, X9 to X16)
  ["X1c", () => x12TimeCode("ET"), { zone: "Eastern", daylight: null }],
  ["X2c", () => x12TimeCode("01"), { offset: "+01:00" }],
  ["X2i", () => toOffsetInstant("2024-06-15T14:30:00+01:00"), { instant: "2024-06-15T13:30:00Z", offset: "+01:00" }],
  ["X3c", () => x12TimeCode("13"), { offset: "-12:00" }],
  ["X4c", () => x12TimeCode("24"), { offset: "-01:00" }],
  ["X8c", () => x12TimeCode("LT"), { zone: "Local", daylight: null }],
  ["X9", () => x12TimeCode("ES"), { zone: "Eastern", daylight: false }],
  ["X10", () => x12TimeCode("ED"), { zone: "Eastern", daylight: true }],
  ["X11", () => x12TimeCode("UT"), { offset: "+00:00" }],
  ["X12", () => x12TimeCode("GM"), { offset: "+00:00" }],
  ["X13", () => x12TimeCode("27"), { offset: "+05:30" }],
  ["X14", () => x12TimeCode("EST"), null],
  ["X15", () => x12TimeCode("et"), null],
  ["X16", () => isValidX12TimeCode("EST"), false],
  // --- X12 Time Reader, sections 5 and 6: the five DTP presets, in DTP_PRESETS order, and the other qualifiers
  ["X5", () => parseX12DateTimePeriod("20240615-20240620", "RD8"), { date: D, periodEnd: { date: "2024-06-20" } }],
  ["X5w", () => formatX12DateTimePeriod("2024-06-15/2024-06-20", "RD8"), "20240615-20240620"],
  ["X5n", () => parseX12DateTimePeriod("2024061520240620", "RD8"), null],
  ["X5r", () => parseX12DateTimePeriod("20240620-20240615", "RD8"), null],
  ["X6", () => parseX12DateTimePeriod("166", "TC"), { dayOfYear: 166 }],
  ["X7", () => parseX12DateTimePeriod("2200-0600", "RTM"), { time: "22:00:00", periodEnd: { time: "06:00:00" } }],
  ["X7w", () => formatX12DateTimePeriod("22:00:00/06:00:00", "RTM"), "2200-0600"],
  ["X1", () => parseX12DateTimePeriod("202406151430", "DT"), { local: L }],
  ["X1w", () => formatX12DateTimePeriod(L, "DT"), "202406151430"],
  ["X17", () => parseX12DateTimePeriod("20240615", "D8"), { date: D }],
  ["X18", () => parseX12DateTimePeriod("1430", "TM"), { time: T }],
  ["X19", () => parseX12DateTimePeriod("20240615143000", "RTS"), { local: L }],
  ["X20", () => parseX12DateTimePeriod("24366", "TU", { yearWindow: 2000 }), { date: "2024-12-31", dayOfYear: 366 }],
  ["X20w", () => formatX12DateTimePeriod("2024-12-31", "TU", { yearWindow: 2000 }), "24366"],
  ["X20n", () => parseX12DateTimePeriod("23366", "TU", { yearWindow: 2000 }), null],
  ["X21", () => parseX12DateTimePeriod("20240615", "UN"), null],
  ["X21f", () => isValidX12DateTimePeriodFormat("UN"), true],
  ["X22", () => parseX12DateTimePeriod("202406", "CM"), null],
  ["X22f", () => isValidX12DateTimePeriodFormat("CM"), false],
  ["X22g", () => isValidX12DateTimePeriodFormat("DTM"), false],
  ["X23", () => isValidX12DateTimePeriod("20240615", "D8"), true],
  ["X24", () => parseX12DateTimePeriod("202406151430", "D8"), null],
  ["X26", () => formatX12DateTimePeriod("2024-06-15T14:30Z", "DT"), ""],
  ["X27", () => parseX12DateTimePeriod("4166", "EH"), { yearDigit: 4, dayOfYear: 166 }],
  ["Xset", () => X12_CODES.filter((c) => !isValidX12DateTimePeriodFormat(c)), []],
  ["Xneeds", () => [...X12_CODES, "CM"].filter((c) => needs(formatX12DateTimePeriod, c)), ["D6", "TT", "TR", "RD6", "TU"]],
  // --- EPCIS (E*): no tool; the guide, one scenario and two mistakes
  ["E1", () => parseEpcisEvent({ eventTime: "2024-06-15T23:30:00Z", eventTimeZoneOffset: "+02:00" }), { instant: "2024-06-15T23:30:00Z", offset: "+02:00", local: "2024-06-16T01:30:00" }],
  ["E2", () => formatEpcisEvent({ instant: "2024-06-15T23:30:00Z", offset: "+02:00" }), { eventTime: "2024-06-15T23:30:00Z", eventTimeZoneOffset: "+02:00" }],
  ["E3", () => parseEpcisEvent({ eventTime: "2024-06-15T23:30:00Z" }), null],
  ["E4", () => parseEpcisEvent({ eventTime: "2024-06-15T23:30:00Z", eventTimeZoneOffset: "Z" }), null],
  ["E5", () => parseEpcisEvent({ eventTime: "2024-06-15T23:30:00Z", eventTimeZoneOffset: "+0200" }), null],
  ["E6", () => parseEpcisEvent({ eventTime: "2024-06-15T14:30:00Z", eventTimeZoneOffset: "-05:00" }), { instant: "2024-06-15T14:30:00Z", offset: "-05:00", local: "2024-06-15T09:30:00" }],
  ["E7", () => parseEpcisEvent({ eventTime: "2024-06-15T10:00:00+02:00", eventTimeZoneOffset: "-05:00" }), { instant: "2024-06-15T08:00:00Z", offset: "-05:00", local: "2024-06-15T03:00:00" }],
  ["E8", () => isValidEpcisEvent({ eventTime: "2024-06-15T23:30:00Z" }), false],
  ["E9", () => isValidEpcisEvent({ eventTime: "2024-06-15T23:30:00Z", eventTimeZoneOffset: "+02:00" }), true],
  ["E10", () => formatEpcisEvent({ instant: "2024-06-15T23:30:00Z", offset: "Z" }), null],
  ["E11", () => parseEpcisEvent({ eventTime: "2024-06-15T23:30:00Z", eventTimeZoneOffset: "-05:00" }), { instant: "2024-06-15T23:30:00Z", offset: "-05:00", local: "2024-06-15T18:30:00" }],
  // --- naive JavaScript (N*): the same in any TZ, because every string carries Z or an offset
  ["N1", () => { const v = "202406151430"; return new Date(v.slice(0, 4) + "-" + v.slice(4, 6) + "-" + v.slice(6, 8) + "T" + v.slice(8, 10) + ":" + v.slice(10, 12) + ":00Z").toISOString(); }, "2024-06-15T14:30:00.000Z"],
  ["N2", () => new Date("2024-06-15T14:30:00-05:00").toISOString(), "2024-06-15T19:30:00.000Z"],
  ["N3", () => { const code = 13; return code <= 12 ? code : -(code - 12); }, -1],
  ["N4", () => { const yy = 99; return yy < 50 ? 2000 + yy : 1900 + yy; }, 1999],
  ["N4b", () => { const yy = 49; return yy < 50 ? 2000 + yy : 1900 + yy; }, 2049],
  ["N5", () => "2024061520240620".split("-"), ["2024061520240620"]],
  ["N6", () => new Date("2024-06-15T23:30:00Z").toISOString().slice(0, 10), "2024-06-15"],
  ["N7", () => new Date("2024-06-15T14:30:00+01:00").toISOString(), "2024-06-15T13:30:00.000Z"],
];
let failed = 0;
for (const [id, run, expected] of rows) {
  let actual;
  try { actual = run(); } catch (error) { actual = `THROWS ${error}`; }
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(ok ? `ok ${id}` : `FAIL ${id} ${JSON.stringify(actual)}`);
}
const ids = rows.map(([id]) => id);
const repeated = ids.filter((id, i) => ids.indexOf(id) !== i);
if (repeated.length > 0) { failed++; console.log(`FAIL repeated ids ${repeated.join(",")}`); }
console.log(failed === 0 ? `all ok (${rows.length} rows)` : `${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
```
