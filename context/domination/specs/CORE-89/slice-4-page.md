# Slice 4 — the Morocco page, its chat pill and its widget

This slice builds the page out of the shared parts (slice 1), the Worker (slice 2), the map
(slice 3) and the minimums card (slice 8). It also registers the tool in every list that `built.md` keeps, following the
registration rule in [CORE-88](../../issues/CORE-88.md#decisions). React stays out of it: the
page is Astro and plain DOM.

## Page

- `src/content/docs/check/morocco-2026-clock-change.mdx`
  - Frontmatter: `title: Morocco 2026 clock-change checker`, a `description` in the same form as
    Canada's, `industries: [core]` and `tableOfContents: false`.
  - The page renders, in order:
    - one lead sentence;
    - `<MoroccoClockChange />`;
    - `## Related`, with links to the Canada checker, the Stored Time Audit,
      [`getDstTransitions`] and [`getTimeZoneOffset`];
    - `<MoroccoProbeScript />`.
  - Lead sentence: "Since 20 September 2026 at 02:00, Morocco and Western Sahara stay on UTC+00
    all year, as tzdb 2026c records, and anything with older time zone data shows them an hour
    ahead for most of the year."
- `src/components/MoroccoClockChange.astro` and `MoroccoProbeScript.astro`: copies of the Canada
  pair, with three changes:
  - `idPrefix: "morocco"`;
  - permalink seed `seedFromLocation("moroccoclock")`;
  - the template and probe source from the Morocco modules.
- `src/lib/morocco-clock-change-mount.ts`
  - `renderMoroccoClockChangeTemplate({ idPrefix = "morocco" })`, root class `gmt-morocco`. The
    rows are:

    | Row | Contents |
    |---|---|
    | 1 | Key points, then the browser card (2 zones × 2 instants) |
    | 2 | Map section: map, pin panel, legend, then two clocks (Casablanca, El Aaiun) |
    | 3 | Servers card, then the **Upgrade to at least** card (slice 8) |
    | 4 | **Clock changes your data gets wrong**, then the help card |
    | 5 | Transitions for 2026 and 2027, full width |
    | 6 | Saved events |

  - Also exports `mountMoroccoClockChange`, `mountMoroccoClockChangeWidget: MountFn<MoroccoClockChangeArgs>`
    (`NO_LOCATION`/`NO_HISTORY`, returns `onceDestroy`) and
    `renderMoroccoClockChangeWidgetTemplate(idPrefix)`.
  - Every part is the shared one called with Morocco's config. None is copied.
- `src/data/morocco-key-points.ts`: `MOROCCO_KEY_POINTS: KeyCard[]` and `MOROCCO_HELP: HelpCard`,
  using the shared text types. There are three key cards:
  - **What tzdb records**: 2026c, the date, and both zones.
  - **What old data does**: it shows +01:00 outside the old Ramadan weeks and +00:00 inside
    them, so it is right for a few weeks and wrong for the rest of the year.
  - **What to do**: update the runtime, then check the saved events.
  - `TESTS_HREF` points at `oh-morocco.test.ts` on GitHub, in the same form as Canada's.
- `src/lib/morocco-saved-example.ts`: an appointment saved for 09:00 on 16 November 2026 in
  Casablanca as `+01:00`. It reads 08:00 now. Same shape as `canada-saved-example.ts`.
- `MOROCCO_PRESET`, in `morocco-clock-change.ts`:
  - **Kind changed:** four Moroccan lines whose kind changed in 2026c.
    - `2026-11-16T09:00:00+01:00[Africa/Casablanca]`
    - `2027-03-14T02:30:00+00:00[Africa/Casablanca]`
    - `2026-09-20T01:30:00+00:00[Africa/Casablanca]`
    - `2027-02-22T10:00:00+00:00[Africa/El_Aaiun]` (inside the old Ramadan weeks, so it is the
      same on both data)
  - **One of each kind:** four `[Europe/Lisbon]` lines that give one of each kind on any data:
    valid in summer, valid in winter, an offset mismatch, and a time in the 2026-10-25 overlap.
  - As in Canada, the labels never claim a kind. Run each line once on Node 26.12.1 and record
    its kind in the hand-back, never in the code.

## Map hand-over from slice 3

- The template's `data-role="map"` frame sets `style="--zonemap-map-height:860"` (the shared CSS
  defaults to 640), and the credits id is `morocco-data-credits`. `MOROCCO_MAP` is in
  `morocco-map.ts`.
- Add the Morocco rows to `scripts/data-credits-check.mjs` and
  `scripts/data-credits-built.test.ts` (`frame: ".gmt-zonemap-map"`, scoped to the Morocco root),
  then run slice 3's definition-of-done lines 5 and 6 on the served page.
- **The Gibraltar and Ceuta rings overlap** by about 2 px at width 800 (slice 3 measured them
  about 10 px apart, r = 6). Overlapping targets can send a click to the wrong zone: separate
  them (a smaller ring, or a small stated nudge in `MAP_MARKERS`), with a test that no two rings'
  drawn circles intersect.

## Wording and display rules

- **The verdict comes from the `verdict` instant only.** The `blind` row reads "Old and new data
  agree here, so a check during these weeks cannot tell." It is never a cross or a tick.
- **Clock changes your data gets wrong.** The title covers both kinds; `recordedBy` tells them
  apart. One row for each stated change and zone, in words:
  - its date and time, in UTC and local;
  - from and to;
  - for `"2026b"`: "In tzdb 2026b and earlier; removed in 2026c". For `"2026c"`: "Added in
    tzdb 2026c; older data does not have it";
  - the Worker's `present`, as "This server still has it" or "This server does not have it".

  No colour carries a verdict, and there are no totals.
- **Copy must hold before and after every date.** Static text never says "will", "is due",
  "upcoming" or "next" about a fixed date. The next change of a zone comes only from the
  Worker's `next`.
- **Readouts hold still.**
  - The browser cells and the Worker cells reserve their width, use tabular figures and do not
    wrap.
  - Paired cards are pinned to opposite edges (`justify-content: space-between`).
  - The saved-events results keep the shared fixed-height placeholder.
- **No left-border-only accent** on any card, row or result. An accent is a bottom border or a
  full bevelled border. The rules live in `clock-change.css`. Only rules that belong to Morocco
  alone go in a new `morocco-clock-change.css`.
- **When the Worker does not answer:** a 429 shows the retry delay, a failed fetch shows "The Dox
  Worker did not answer.", and every cell stays `NO SIGNAL`. All of this is in the shared parts.

## Registration (every list in `built.md`)

- **`src/lib/dox-tools.ts`:**
  - `showMoroccoClockChangeInput = z.object({ zone: zoneSchema.optional() })`;
  - the tool-name union, the schema map, the docs entry (`purpose`, `when`, `args`), the tool and
    the name list;
  - `args` reads: "zone: optional, one IANA id from the checker's map list to pin (never a
    country or a place name)".
- **`worker/tools.ts`:** `showMoroccoClockChange`, which calls `accept("morocco-clock-change")`
  when `zone` is undefined or in `morocco-region-zones.json`. Otherwise it rejects with the same
  wording Canada uses.
- **`src/components/ask/widget-registry.ts`:** `defineWidget` with title, kind, parse, load and
  validate (the same zone-list check), plus the kind union and the map entries.
- **`src/lib/chat-constants.ts`:** a `CHAT_STARTERS` entry:
  ```ts
  { text: "Does my runtime still show Africa/Casablanca an hour ahead after 20 September 2026?",
    widget: "showMoroccoClockChange", area: "core", args: { zone: "Africa/Casablanca" } }
  ```
- **`src/lib/widget-permalink.ts`:**
  - kind `moroccoclock`: `withBase("/check/morocco-2026-clock-change/")`, under the same comment
    as Canada's;
  - the kind union, and the cases in `widget-permalink.test.ts`.
- **`src/lib/mdx-jsx.ts`:**
  - `MoroccoClockChange` becomes `keyPointsMarkdown(MOROCCO_KEY_POINTS) + serversMarkdown(…) +
    minimumsMarkdown(MOROCCO_MINIMUMS)`;
  - `MoroccoProbeScript` is dropped.
- **`astro.config.mjs`:** register any Morocco stylesheet. The sidebar picks up `check/` on its
  own.
- **Scripts:**
  - add the page to `html-diff.mjs` PAGES (widget `gmt-morocco gmt-widget`) and to
    `visual-snapshot.mjs`, `grow-measure.mjs` and `contrast-measure.mjs`;
  - give `canada-clock-still.mjs`, `canada-stored-still.mjs` and `canada-layout-check.mjs` a
    `--path` option. The default stays the Canada page, so its runs do not change.
- **`stored-time-audit.mdx`:** add the Morocco checker beside the Canada link.
- **Tool count:** re-derive the tool count and the `CHAT_STARTERS` count from source
  (`grep -c 'widget: "show' src/lib/chat-constants.ts`), never from `built.md`, and update the
  list in `built.md`.

## Tests

- `morocco-clock-change-mount.test.ts`:
  - render the template, then mount it with a stubbed Worker answer built by
    `computeMoroccoCheck` with `now` set to `2026-10-25T12:00:00Z`, `2027-02-20T12:00:00Z` and
    `2027-06-01T12:00:00Z`;
  - every time, the static text matches none of `/\bwill\b|\bis due\b|\bupcoming\b/i`;
  - the verdict comes from the verdict row alone: a stub browser that is `+00:00` at the blind
    instant and `+01:00` at the verdict instant gives the "wrong" verdict;
  - `expect(html).not.toMatch(/canada/i)`.
- `morocco-clock-change-widget.test.ts`: mirrors Canada's.
- `widget-registry` and `tools.test.ts`: `zone: "Europe/Madrid"` is accepted, and
  `zone: "America/Toronto"` is rejected with a reason.
- `runtime-tz-canary.test.ts`: add both Moroccan zones at the verdict instant, compared with
  `MOROCCO_EXPECTED`. The failure message names the runtime.
- **Unique ids per mounted instance (fixes a Canada defect too).** `canada-clock-change-mount.ts`
  passes the literal `idPrefix: "canada"` to `mountClocks` (and so to the crystal clocks'
  `clipPath`, gradient and filter ids), whatever prefix the widget template was rendered with.
  The page and a chat widget, or two chat widgets, then share ids, and one clock's `url(#…)` can
  resolve to the other copy. Each mount, Canada's and Morocco's, takes its ids from the prefix its
  template was rendered with. Test: mount the page and a widget (or two widgets) in one document,
  and every `id` in it is unique.

## Definition of done

1. `pnpm dox:test` passes, and so do the `--reporter=verbose` runs of the four test files
   above.
2. Serve the build on port 4351. Then
   `node apps/dox/scripts/canada-layout-check.mjs --base http://127.0.0.1:4351/gmt --path /check/morocco-2026-clock-change/ --widths 1440,1024,520,375`
   passes. No card moves when results arrive. There is no horizontal scroll at 375 px.
3. `node apps/dox/scripts/canada-clock-still.mjs --path /check/morocco-2026-clock-change/` and
   `canada-stored-still.mjs --path …` pass: 0 px of movement while the clocks tick and while
   results arrive.
4. Keyboard only, on the served page:
   - Tab order: key points, browser card, map list (one stop), pin panel, servers copy button,
     the minimums card's source links, saved-events form, run;
   - every control has a visible focus ring;
   - the chat pill opens the widget, and its Close button closes it (the rail is a plain
     panel, not a dialog, like every other widget's).
5. Chromium 153 (Playwright's own build) shows the "wrong" verdict. WebKit 26.6 shows the
   "right" verdict. Record both in the hand-back.
6. `node apps/dox/scripts/html-diff.mjs compare /tmp/core89-before` prints no `✗` for the Canada
   page (slice 1's rename env still set). The Morocco page is new.
7. `pnpm dox:check` and `pnpm dox:lint` are clean.
8. `built.md`:
   - a **Morocco 2026 clock-change checker** entry: its rows, the two instants and why the
     verdict uses one of them, the stated changes and their source, and the map from slice 3;
   - the tool list and count, the widget kind, the Worker tool and the permalink kind.
