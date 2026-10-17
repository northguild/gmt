## 0. Binding rules

- **No git operation that changes state, and no `gh` write.** No `add`, `commit`, `stash`,
  `checkout`, `restore`, `rm`, `worktree add`, `push`, pull request or issue edit. Every change
  stays unstaged.
- **Never touched:** `packages/gmt/src`, `packages/gmt/skills`, `packages/gmt/package.json`,
  `.changeset/` and `context/domination/`. A library problem found here is reported to the main
  session and never built around. **One exception, named here:** the "By industry:" line and the
  namespace-link line of `README.md` and `packages/gmt/README.md` (B3), because `stats.mjs check`
  enforces them in the same change. The two files stay byte-identical. Nothing else in either
  README changes. The library finalizer's `/update-readme` pass verifies these lines and does not
  rewrite them. **A second exception, for step DU (section M):** the CORE-76 lines of
  `context/domination/issues/CORE-76.md` (line 41) and `context/domination/tracker.md` (the CORE-76
  notes near lines 157–158, 196 and 215). Other sessions edit `tracker.md`; re-read it and change
  only those lines.
- **Never rebuild `packages/gmt/dist` in this worktree.** The owner's `pnpm dox:dev` aliases the
  library to `dist`, so a rebuild breaks every open tool. Do not run `pnpm run validate`,
  `pnpm build`, `pnpm dox:dev`, `pnpm --filter @northguild/gmt build` or any script that builds
  the library here. The main session builds `dist` once, before step D1 (section K). Every value
  a page or test shows is run against that `dist` with a throwaway script in the scratchpad.
- **Never use port 4321 or `apps/dox/dist`.** A site build goes into a private tree under the
  session scratchpad (I0). Stop every server you start.
- **Toolchain.** Prefix every Node command with `eval "$(fnm env)" && fnm use &&`.
- **Never run `vitest list --json` with a file path.** Use `vitest run <file> --reporter=verbose`.
- **Import gmt at module granularity only**, through `GMT_MODULES`. The four new keys
  (`gnss/convert`, `timescale/calculate`, `timescale/convert`, `timescale/validate`) are the
  library pipeline's (L§5.4); this work adds none.
- **The widget draws the library's results and computes none of them.** Every instant, week,
  era, label, offset and verdict on screen is a gmt call. Where a mark sits is drawing.
  `@js-temporal/polyfill` is imported for drawing positions and for reading the clock only.
- **The site holds no table of the library's rules.** A counter's modulus, a system's epoch and an
  era's start come from probing the library (D3). The lists of counter and system names are the
  library's type members, held in one leaf module and checked against the generated playground
  templates (D1).
- **The printed call is the call made.** Every call is recorded and printed beside its result,
  in order. A blank optional input is left out and never filled from a preset.
- **World standards only.** GLONASS appears only as the RINEX and BIPM `GLO` scale: GLONASS time
  in UTC's own hours, with UTC's leap seconds. No string in this work (widget, preset, chat copy,
  page copy, industry text, test name) mentions UTC+3, Moscow time, MSK or a three-hour shift.
  The library's JSDoc may; this work, the guides and mistakes pages of F1 included, does not
  repeat it. Where a page needs to say what `GLO` is, it says: GLONASS time as RINEX and the BIPM
  report it, in UTC's own hours, and the library reads no other GLONASS scale.
- **Core namespaces, industry layers, cross-industry layers** (`context/coding-standards.md` line
  230). A function shared across industries goes in the cross-industry layer for its domain
  (`workforce`, `gnss`) or in Core if it is truly general (`timescale`), never in a grab-bag
  "shared" namespace, never in one industry's namespace when others need it, and never in a new
  namespace that is not a recognised domain. On the site a cross-industry layer is an industry
  like any other, and other industries declare it among the modules they draw on (B1).
- **"space" is not an industry, area, kind or namespace name.** A planned spatial and geo
  expansion takes the word.
- **GMT tracks no law.** No statute, regulator, agency, court or named regime appears in a widget
  string, a preset, a chat doc, page copy or a test name. A working-time regime is described by its
  numbers only.
- **International authority first.** Every citation follows decision 11: ISO, IEC, ITU, BIPM, IERS,
  IAU, IMO, CGPM and IGS/RINEX first; multinational industry bodies next; a national source only
  as one labelled peer. The six satellite systems' scales are defined by RINEX and the BIPM. **Why
  they are peers** (research §9a):
  - The short form, used in the Maritime guide and tool copy: "IMO recognises GPS, GLONASS,
    BeiDou, Galileo, NavIC (IRNSS) and QZSS as components of the Worldwide Radionavigation
    System." Its one primary page naming all six is IMO's Maritime Safety Committee 104th session
    summary (October 2021).
  - The full citation, where a page gives one: recognition under the policy of IMO resolution
    A.1046(27) (2011), whose annex MSC.599(111) (2026) revised; GPS and GLONASS by A.860(20)
    (1997); BeiDou by SN.1/Circ.329 (2014); Galileo by SN.1/Circ.334 (2016); IRNSS by
    SN.1/Circ.340 (2020); QZSS by SN.1/Circ.341 (2021). **A.1046(27) itself names no system**, so
    it is never cited alone for the six.
  - **The scope caveat, said once wherever a page or tool says "peers":** recognition is not
    equal everywhere. BeiDou and IRNSS are recognised for ocean waters, and IRNSS only within
    55°E–110°E, 50°N–5°S.
  - **IEC 61108** is cited per system only (part 1 GPS, 2 GLONASS, 3 Galileo, 5 BeiDou, 6
    NavIC/IRNSS), never as a six-system authority: it has no QZSS part.
  - **IEC 61162-1:2024 (Edition 6.0)** is cited for the sentence format shipboard equipment uses,
    not for peer status.
  A system's own interface document is cited only for a signal fact no international body
  restates, labelled with its system.
- **No US lead.** No tool, preset, starter or page opens on `America/New_York`, on `en-US` or on a
  US-only example. Rotate zones through `Europe/London`, `Asia/Tokyo`, `Australia/Sydney`,
  `America/Sao_Paulo`, `Africa/Johannesburg` and `Asia/Kolkata`, keeping a zone only where the
  example needs its DST shape or a standard's own code needs it (an X12 time code such as `ET`
  names a US zone by definition). A locale, where one is needed, is regionless (`"en"`).
- **Every sentinel renders through `renderWidgetOutput(out, "NO SIGNAL", "sentinel")`** with one
  plain sentence. A state with no library call behind it renders as `"empty"`, never amber.
- **No left-border-only accent** on any plate, lane, row, table or result block. An accent edge
  is a bottom edge, or the element has a full border. No class contains `card` except
  `.gmt-widget-card`.
- **Amber is the sentinel's alone.** No verdict, era, lane or state is amber, green for good or
  red for bad. A series colour goes on a mark, never on text.
- **Readouts hold still.** Plates are pinned at their edges with reserved widths, `tabular-nums`
  and `nowrap`. Every region is present in every state. Nothing above a dragged control moves or
  resizes, and no plate moves or resizes while a range is dragged.
- **Every new tool ships with its Dox button:** its `CHAT_STARTERS` card and its chat-widget
  registration land with the tool.
- **Zero known bugs.** No `it.skip`, `it.todo` or `it.fails`. A defect found is fixed now, with
  every other case of it. Every existing assertion stays unless this spec changes what it asserts;
  each one that changes is listed in the builder's report with its reason.
- **No constants that age.** No fixed year window, era count or "current era". Which eras to draw
  comes from the library at the reader's today (D3).
- **No catch-all functions** in new helpers. Split by kind with narrow unions; one shape out.
- **Plain English** (`/plain-english`) for page copy, widget strings, comments and context files.
  Page copy holds no tool, function or test count.
- **React stays inside `/dox`.** Each tool page is Astro plus a plain-DOM module, and imports no
  `dox-tools.ts`, `zod` or `ai`.
- **Re-verify every changed example by running it.** A preset, a page example or a starter whose
  zone changes gets its new output from a run against the built `dist`, never by editing the old
  value. Test fixtures under `packages/gmt` and the CI zone matrix are never touched.

---

## A. Scope and non-goals

**In scope:** section B (industry layers, hub pages, the README line and the agent docs that state
the rule); section C (the classifier fix, the rename redirect); section D (five tools and their
registration); the MAR-16 content pages of F1 (L§8.4: the GNSS and Maritime guides, the Core guide, five
scenarios, two mistakes pages, the index edits); the five tool pages; the links between the tools
and from the content pages into them; the GNSS and Maritime overview text; section M (the Workforce layer: the duty pages
moved and retagged, with their redirects); section N (the Dox items of the international-standards audit: widget defaults, the
example rebalance, the Workforce guide's examples); the stacked "By industry" chart (B9); `context/dox/` close-out (section H).

**Not in scope:**

- A `maritime/` namespace. MAR-17 creates it; then `industries.json` adds `"maritime"` to the
  Maritime list and B's rules make it Maritime's own namespace with no other edit.
- Aviation and IoT layers. The design allows each as one `industries.json` entry, one icon and one
  overview text, and a tag on the decoder page (`industries: [maritime, aviation]`).
- A GLONASS week, a GLONASS mode or any non-RINEX GLONASS scale.
- SPA-46's TAI64 functions (not merged).
- `packages/gmt`, `.changeset/`, and `context/domination/` beyond the CORE-76 lines of section M.
- The library half of the audit: the JSDoc example rebalance, the parser default locale, the NRF
  wording, the skills. The generated reference pages change when that lands; this work does not
  edit them.

---

## G. Design constraints

1. **No left-border-only accent, anywhere.** No `border-left`, `border-inline-start`, left inset
   shadow or left `::before` bar as the only accent of a plate, lane, bar, row, table or note. A
   chosen lane or row is lit glass, a hatch and a chip; a plate's series colour is the 3px bottom
   bar.
2. **Every region is present in every state, and holds still.** Values `tabular-nums` and `nowrap`;
   each plate reserves the widest value in `em` and sub line in `ch`, measured across every preset,
   every range position, a nine-digit fraction and the live countdown; each varying region holds
   its tallest text. **Dragging any range never moves or resizes a plate, the frame, a lane, a bar
   chip, a table or anything above the range, and typing never resizes a plate.** A change of
   mode, counter or system may change the lane count; that region eases through `.gmt-grow`.
3. **Amber is the sentinel's alone.** "Your reading", "nearest today", "today", "a different
   instant", "leap second", "next to wrap", "derived", "inserted" and "early" are words and
   patterns.
4. **Text at least 12px**, and **at least 7:1** in both themes against the worst pixel behind it.
5. **Tokens only.** No colour literal and no `[data-theme="light"]` colour block.
6. **Compose `gmt-form-controls.css` through `widget-ui.ts`:** `.gmt-field-grid`,
   `labelTextHtml`, `.gmt-input`, `.gmt-select`, `chipToggleHtml`, `rangeFieldHtml`, `syncRange`,
   `setControlValue`. No control CSS. Real `<select>`, `<input>` and `<input type="range">`.
7. **`not-content` and `container-type: inline-size` on every root.** Narrow rules are named
   `@container` queries (the field-grid trap). No horizontal page scroll at 390px, and none in
   the rail at 360px or 300px. Tables become stacked rows in the narrow rail.
8. **No motion on a value.** No `transition` or `animation` on a plate, a lane, a bar, a pin, a
   cell. The live countdown changes its text once a second and nothing else.
9. **No class containing `card`** except `.gmt-widget-card`; no `backdrop-filter`, no
   `clip-path` inside a tool.
10. **Nothing in a drawing is focusable.** Each drawing is `role="img"` with an `aria-label` and a
    hidden list. The keyboard reaches the chips, selects, inputs, ranges and links, in DOM order.
11. **`escapeAttr` / `escapeHtml` on every interpolation.**
12. **An element with an author `display` has its own `[hidden]` rule.**
13. **Tables** take `overflow-x: auto`, never `overflow: hidden`; first and last cells have at
    least 10px inline padding (the bevel trap); `display: table` with `table-layout: fixed`.
14. **On-screen text calls the library "the library".**

---

## L. `built.md` sections the builder reads

- **Rules that bind every change.**
- **Tiers 0–1:** Generator (A3a), all of it, especially "Where a type is documented…", "The doc
  gate", "Index pages", "The two industry namespaces stand apart…" with its Sidebar, divider,
  icon, Tools/Scenarios/Mistakes dividers, Root page, Overview text and Page tag bullets,
  "`public/_redirects`", "Every `build-utils` module … `referenceInputs()`" and "Unreleased
  badge"; AI surface (A3b); Guides (A4a).
- **Tier 2:** "Playground on every example"; "Sentinel-aware output everywhere"; the teaching
  widgets list (the EDI family, the INT-14 tools, the Cut-off Countdown's live clock); "A new tool
  is registered in lists no single test covers"; "Tools, scenarios, guides and mistakes carry an
  industry tag" and its trap; "A widget that cannot load says so"; "One control system for every
  widget"; every "Trap:" bullet in Tier 2; "The prose list dash stays out of widgets"; "Result
  regions ease through `.gmt-grow`"; "Tool pages", "`seedFromLocation` keeps only…" and the
  permalink trap; "`escapeAttr`"; "Gates".
- **Tier 6:** Retrieval; Widget tools; Brains and budget (for N1's cap); Traps; Runbooks ("a
  build or a second Astro command breaks a running `astro dev`", "A gate baseline is a clean
  worktree").
- **Reference:** `design-system.md` § Form controls, § Smooth growth, § Drawn charts, § Verifying
  a change is visually safe; `visual-design.md` § Corners, borders, focus and § Layout
  stability; `style-guide.md` whole.
