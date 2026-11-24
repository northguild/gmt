# Tier 2: tool rules

Part of [built/index.md](index.md). Platform: [tier-2-platform.md](tier-2-platform.md). Gates: [tier-2-gates.md](tier-2-gates.md). Tool pages live at `/tools/<slug>/`; the list is `scripts/build-tool-index.ts` output.

## Rules for every tool

- A widget draws library results and computes none. The printed call is the call made.
- The site holds no table of codes, grammar, widths or leap-second data. NO SIGNAL (amber) appears only when the library refuses typed text. A correct empty or "no result" answer is never NO SIGNAL.
- A value is never trimmed, upper-cased or repaired before a call. A window or reference input is never defaulted and has no placeholder. Reasons come from probing the library, not guesses.
- Nothing derives a zone from a place name, abbreviation or code. Every zone is read with `disambiguation: "reject"`.
- On-screen text never calls the library "GMT".
- Hold still: every region is present in every state and nothing moves as the reader types or drags. Use `hold`, ghost sizers and the `readout-still` gate. Size each region to the tallest thing it can show, reserve fixed slot counts, lay out the NO SIGNAL slot and only make it visible, and make server HTML hide exactly what the initial state hides.
- State is words and patterns, never colour alone. A series colour goes on marks, never text. Surfaces are tint-and-hairline panels with no `backdrop-filter`. Text plates are opaque.
- Axis and track labels are fitted by measurement (`label-fit.ts`, `selectTickMinutes`, `placeLabels` in `punctuality-widgets.ts`) and sit on an opaque surface above the lines.
- A mount whose `GMT_MODULES` import fails throws `WidgetLoadError` (`src/lib/widget-mount.ts`) and never returns an inert handle. Every `.astro` shell catches it and calls `showUnavailable(root, error)`. `widget-load-error.test.tsx` runs every library-backed mount with all imports rejecting.
- Trap: the notice covers a failed gmt import, not a failed page script. A failed static `@js-temporal/polyfill` import means the script never runs and nothing catches it. A dev server that answers `504 (Outdated Optimize Dep)` does this (tier 6, Runbooks).
- Result regions ease through `.gmt-grow` (rules: `reference/design-system.md` § Smooth growth). Section 1, the controls, is never wrapped. A list in section 1 whose row count follows a preset carries `data-grow="slot"` itself.
- `escapeAttr` goes on every template interpolation: values come from a model or a URL.
- `/why-gmt` "Correct at the edges": every claim links a named `packages/gmt` test and claims nothing beyond it. Its only figure comes from `gmtStats` (`formatCount`). It cites specs only, names no peer library and never says "every time zone".
- Cut-off Countdown: one property, `--gmt-countdown-inset` (on the root in `tools/cutoff-countdown.module.css`), insets both axis and drag field; padding or a border added to either goes into it.
- Cut-off Countdown clock: "Live clock" is a switch beside "Use my clock". The page opens pinned, so the switch starts off; on means live and ticking. Turning it off while live pauses on the last values, and turning it on from pinned starts the live clock. A drag or an edit pins the clock and turns the switch off. Ticks are aligned with `msToNextSecond` and write text in place, so focus survives. Reduced motion starts the clock paused.
- Expiry Calculator clock: "Live clock" is a switch between the start chips and the hint. It is on under Now unless reduced motion is set, and disabled and unchecked under "A date", where nothing ticks. The reader's last choice is kept, so going back to Now restores it. Each tick lands on the whole second: the wait is `msToNextSecond(getUtcNow())`, not the whole-second Now snapshot, which would keep the offset Now was chosen at and drift as each real timer runs late. Paused, it holds the last four plates and the hint says so. A tick writes text in place (`paintPlates`, `paintVerdict`, `paintCodeFrame`, `paintHeldText`, each next to its builder), so focus on the copy button or the switch survives it.
- DST Inspector: `buildZonedValueFromMinutes` omits an offset on purpose; resolving the ambiguity is what `startOfZoned` shows.
- Interval Visualizer: presets use the fixed calendar-year scale; seeded and typed values fit their own scale with 10% padding.

## Registering a new tool

Lists no single test covers (`docs-site.md` § Purpose-built widgets has the full set). The chat side fails `widget-registry.test.ts`, `chat-starters.test.ts`, `widget-permalink.test.ts` or `client-graph.test.ts` when a schema, `ENABLED_TOOL_NAMES` entry, Worker tool, registry entry, `WidgetKind` or `CHAT_STARTERS` card is missing. Kept by hand, and nothing fails when one is forgotten:

- `MOUNTS` in `src/lib/widget-load-error.test.tsx`.
- The `heavy` list in `src/components/ask/widget-graph.test.ts` (the tool's pure module and any shared helper or loader it adds).
- `PAGES` in `scripts/html-diff.mjs`, `scripts/visual-snapshot.mjs`, `scripts/grow-measure.mjs`.
- `TOOLS` in `scripts/readout-still.mjs`, for a tool with a drag handle, with its measured WebKit `minutes` (the weekly legs are dealt by them; see the script's header).
- Its forced-colours rules (platform file).
- After a build only: the component's name in the dropped-components list in `src/lib/mdx-jsx.ts`, checked by `scripts/llms.test.ts`.
- `DOX_TOOLS` reads `DOX_TOOL_DOCS` by position: append a doc, never insert. An insert gives every later tool its neighbour's description and no test fails.

## Industry tags

- A page's frontmatter lists `industries` (`src/content.config.ts`). `IndustryTags.astro` renders them under the title: one style, no colour per industry, not a link. Tags are `core` plus the industries in `src/data/industries.json` (`src/lib/industry-tags.ts`). Index pages carry none. The Markdown export writes an `Industry:` line (`pageToMarkdown`).
- A new industry is one entry in `industries.json`, one glyph in `INDUSTRY_ICON_PATHS` and one hub text in `industry-overview.ts`; it gets a tag when its first page ships.
- A page takes the one industry whose own namespace it runs. A page that runs only Core functions (`timescale` included) is `core`. An industry that draws on a layer links that layer's pages from its hub's `solves` list instead of tagging them.
- `industry-tags.test.ts` fails a page with no tag, an unknown tag, a tag outside `allowedTags`, or more than one tag. It cannot tell the owner from an industry that only draws on the layer; authoring picks the owner.
- Cross-industry layers (`workforce`, `gnss`) are industries on the site; each user lists them in `drawsOn`. Rule: [`context/coding-standards/design-rules.md`](../../coding-standards/design-rules.md#plain--zoned-separation), "Core namespaces, industry layers, cross-industry layers".
- Trap: a `core` page never links an own namespace's reference pages. The test reads `/reference/<ns>/` or an `@northguild/gmt/<ns>` import as use of that namespace. The Standards guide names EDI functions as inline code and links the EDI guide.

## Permalinks

- `?w=&wa=` seeds a widget through `seedFromLocation`, with structural checks rather than zod, so a docs page never pulls in `ai`.
- `seedFromLocation` keeps only top-level strings of 1-64 characters and years. Lists flatten into numbered string keys or joined strings. `content-permalink` tests check every key survives. A preset-only state is `{ preset }` alone; otherwise `{ preset }` plus each scalar that differs (`"none"` clears an optional one).
- `LONG_STRING_KEYS` exempts long values, each with a regression test: `rules` (capped at 95,000, the longest list the chat schema accepts) and `holidays` (capped at 1,000). `EMPTY_LIST_KEYS` keeps an empty `weekend` or `offsets` as empty, not dropped.
- An old link with a `yearWindow` loads and the key is ignored.
- Zone Planner: `?w=planner&wa={"time":...,"zone1":...}`, a UTC instant ending in `Z` and up to eight numbered zone ids, strings only (`permalinkOf` in `src/lib/zone-planner.ts`); `seededZones` also reads a `zones` array, which a chat call carries.
- Trap: build a permalink written into a page with `encodeWidgetPermalink`, never `encodeURIComponent` or by hand. A `DTM` segment ends in `'`, which `encodeURIComponent` leaves raw and the test's regex (`widget-permalink.test.ts`) cuts at; a raw `+` decodes as a space.

## Traps

- Starlight's `Icon` is not an override slot. Icons live in `src/components/Icon.astro`; a plain-DOM template calls `transportIcon()` (`src/lib/transport-icons.ts`); MDX imports `~/components/Icon.astro`.
- A second class name containing "card" turns into glass within glass: `[class*="card"]` rules in `gmt-glass.css`, `gmt-a11y.css` and `gmt-light.css` match it. The `card` builder is the widget's one layer. Name parts without the substring, or override all three rules as `tools/cutoff-ruler.module.css` does.
- An element with an author `display` ignores `hidden`. A chip a fit pass hides needs its own `[hidden] { display: none }`.
- Tint a hatched element with `background-color`, never the `background` shorthand.
- A block table (`.gmt-widget.not-content`) takes `overflow-x: auto`, never `hidden`. It does not fill its panel: a table that must reach both edges sets `display: table`, `table-layout: fixed`, widths on `th`s and a `<wbr>` break point in long values (the Timetable Reader does). A cell wraps between words only (`overflow-wrap: normal`, `tier-0-1-site.md`); a call in a cell takes its seams from `cellCallArgs` or `cellCall`, and a call in a code frame from `frameCallArgs` (no seams: Chromium breaks a `pre` at a `<wbr>`).
- An unnamed `@container` query inside the field grid resolves to the grid. Name the section and query it by name (`tt-section`).
- A held table cell whose value can be wider than its column (`reservedText` in `families/holiday`) takes `format: instant`: the live text and every sample break between an instant's pieces, and the tallest sample fixes the height. The Expiry Calculator's Start and Ends columns use it, so no widget CSS sets `white-space` on a held value. The EDI zone strip's third column (`zoneStrip` `widths.thirdLines`) does the same in a fixed box: the X12 Time Reader reserves 23 characters and two lines for an offset instant up to `1900-06-15T14:30:00.12+05:21:10` (31 characters), and `readout-still` holds that reservation still.
- The live wrapper in a hold cell must keep the grid's default stretch (`builders/hold.ts`, `families/edi/edi-hold.ts`, `families/holiday/held-text.ts`). Aligned to the start, its height jumps and `readout:still` reports a resize.
- A bevelled corner hides text under it: first and last cells need at least 10px of inline padding.
- The Converter Bench's pattern chips grow with the library (`getRegexList` in `converter-bench-mount.ts`). A new `regex` export changes the bench's height in a visual diff; read that as expected.

## Clock-change checkers (Canada, Morocco, Sunshine Protection Act)

- A checker is a config over the shared modules in `families/clockcheck/`, `lib/clock-change-*.ts` and `worker/clock-change-shared.ts`, never a copy. Years live once. A checker's words use past tense only (`Moment {at, from}`).
- Tests never assert a 2026e offset as runtime-computed. Only `deploy-smoke.mjs` checks 2026e, against the deployed Worker.
- The Worker reads form fields with `typeof value === "string"`, answers 400, 413 or 429, and caps stored input with `capStoredInput`.
- Map data comes from `scripts/prepare-region-boundaries.py --region <name>`, cut back to Natural Earth land. Spend size on `tolerance` and `min_area`, never the 400 KB limit. `isZoneFeature` filters the `{"land":"other"}` feature.
- The mounts' ready signal and `waitForState` are in `scripts/lib/clock-check-harness.mjs`. Layout gates: `canada-layout-check.mjs`, `canada-stored-still.mjs`.
- `sunshine-protection-act-wording.test.ts` scans the wording. No law or body is named in the data.

## Rail and IoT tools (GTFS, PTP)

- The GTFS tools load gmt through `rail-lib.ts` (`loadRailLib`, `loadServiceDayLib`, `loadTripBoardLib`) and the PTP tool through `iot-lib.ts`. Each lib takes its types from the library through `pickTyped` (`gmt-pick.ts`), so a renamed or retyped function fails the typecheck. gmt is imported dynamically only, and `literal` lives in `lib/literal.ts`, so the polyfill stays out of the first-paint chunk.
- No GTFS or PTP bound is typed in the tool's code: no hour limit, 2^48, 10^9 or int16. Range numbers appear only in the preset files. A refused PTP read gets its reason by asking the library again (the record check, then a known-good record with the same offset, then offset 0), never from a range written on the site.
- **Never "since midnight".** A GTFS time is days past the service day and the seconds left over, counted from noon minus 12 hours, never a time of day. The clock note is always shown, because a clock time needs the agency's zone.
- A GTFS zone is a text box, not a select: a feed's zone is pasted, and an offset such as `+05:30` is accepted. The chat never resolves an agency to a zone.
- The PTP "PTP now" section (first on the page) reads `getUtcNow()` each second, aligned to the second with `msToNextSecond`, and shows `utcToPtp(now, taiMinusUtc(now))` in four plates and the calls it made (`nowFacts` in `ptp-clock-converter.ts`). The server render is blank plates with ghost sizers and never reads the clock. A tick writes text in place (`paintSignalPlates`, `paintCodeFrame`), so focus on the copy button or the calls survives. "Live clock" is a switch, on by default and off under reduced motion; there is no `aria-live`. A clock before 1972 gives a null table, so the three dependent plates show NO SIGNAL. It is not linked (`?w=`) or exposed to WebMCP: it holds no input, only the reader's own clock, so there is nothing to share or call. **Precision trap:** `getUtcNow()` has sub-millisecond digits even under a faked `Date`, and they are not real time. Polyfill 0.5.1's `SystemUTCEpochNanoSeconds` adds the previous reading's `Date.now() % 1e6` as a nanosecond tail (D21 in `packages/gmt/src/internal/temporalCompat/README.md`): with `Date.now` faked at `2024-06-12T15:20:00.250Z` it reads `...15:20:00.25060025Z`, and a second later `...15:20:01.00060025Z`. The digits depend on earlier reads, so no test can compare an exact UTC string. Assert an aligned pattern such as `^2024-06-12T15:20:01(\.000\d{0,6})?Z$` and derive the nanoseconds plate from the UTC plate's fraction.
- The PTP ruler is a fixed 0 to 40 s and clamps ("off the ruler: N s"): a rescaled axis would hide how small 1 s is next to 37 s. `currentUtcOffsetValid` and `ptpTimescale` stay prose only, because the library reads neither flag and a switch would suggest a check it does not make.
- Prose names a function as shipped and pastes its results from `dist`. No page says "planned". A page link to a preset carries `preset` alone, and the prose tests check it against the widget its `w=` kind opens.
- Readout plates (`plate-fit` is the gate). A plate's grid has one track as wide as the plate (`minmax(0, 1fr)`), so a line that wraps lays out in the plate and not in its widest unbroken text. A tool sizes its plate columns to its widest reading across the whole input range at the largest value size (`2rem`): the Terrestrial Time Stack's `176.427468382 s` (TCG - TT at the slider's 9999 end) needs about 21rem a plate, so it is one column below 43rem of stage, two to 86rem, four above; the Julian Day Counter's eighteen-digit single numbers (`-883655957.9260122`) need about 24rem, so two columns start at 49rem. A value that can be wider than any sensible column wraps anywhere instead of scrolling or running on: the Julian two-part form, the PTP Clock Converter's `+275760-09-12T23:59:59.999999999Z` and `no result`, the TAI64N Log Reader's label and instants, the Report Time Resolver's and GTFS Time Reader's values, the GTFS Service Day Clock's zone name (a plate wraps its value under the caption when the two do not fit one line, and breaks inside the 32-character zone piece below 20rem), and the CCSDS Time Code Decoder's two written codes. Their reserved samples share the value's cell, so the plate holds the height of the longest wrap and a changing reading still never reflows the row.
