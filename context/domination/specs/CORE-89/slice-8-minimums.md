# Slice 8 — the "Upgrade to at least" card

The Morocco page gets the same card as the Canada page: for each runtime, the first release that
carries tz data 2026c or later, with a primary source on every row. The card's code becomes
shared and each page keeps its own data. **No version number is written into this spec.** Every
row comes from the research step below.

## Step 1 — research (the main session runs `researcher` before the builder)

**Question.** For each runtime the Canada card lists in `apps/dox/src/data/canada-runtime-minimums.ts`
(`RUNTIME_MINIMUMS`), find the first release of each supported line that carries tzdb 2026c or
later. That means 2026c, 2026d or 2026e: a line may skip from 2026b straight to 2026e.
- **Runtimes:** Node.js (each supported major), Chrome (Stable and Extended Stable), OpenJDK
  (each update line on the Canada card), Python `tzdata` and `pytz`, Ubuntu (each LTS on the
  card), Alpine, RHEL 8 to 10, Fedora, Amazon Linux 2023, and Mac and iPhone.
- **Windows** is off the Canada card. Report it only if a Microsoft page names the Morocco
  change for a stated update. Otherwise it stays off this card too.
- **Owner's decisions after the research.** Microsoft's 2026-09-08 updates name the change
  (the KBs are in `minimums-research.md`), so the Morocco card gets a **Windows** row. The
  OpenJDK row also lists **27.0.1**: 27 is a supported line with a primary source. Canada's card
  is unchanged.

**What counts as a source.** Each answer needs one of these primary sources:
- the runtime's release notes or changelog entry naming the tz or ICU update;
- the commit that pins the tz or ICU data, together with the first release tag that contains it;
- the distribution's package page or advisory for that version.

A blog post, forum answer or third-party tracker does not count. Give the tz version the release
carries, not just "updated tz data".

**Cross-checks.** These confirm a source; they never replace one.
- Node: `eval "$(fnm env)" && fnm exec --using=<version> node -p process.versions.tz` for any
  version already installed. Measured here: 24.19.0 gives `2026b` and 24.21.0 gives `2026c`, so
  the Node 24 answer is 24.20.x or 24.21.0.
- Chromium: Playwright 1.63.0's Chromium 153.0.8010.12 predates 2026c (see slice 6), so the answer
  is a later release.

**Output.** Write `context/domination/specs/CORE-89/minimums-research.md`, with one table row per
runtime line. The columns are:

| runtime | line | first release | tz it carries | source URL | quoted line or commit |
|---|---|---|---|---|---|

Mark a line **none** when no release of it carries 2026c or later. Also mark lines that are
end-of-life and never got it. The research file is deleted with this folder at story close; the
data file's `sources` keep the links.

## Step 2 — share the card (builder)

- **New `src/data/clock-change-minimums.ts`.** It takes from `canada-runtime-minimums.ts`, unchanged:
  - the types `MinimumPart`, `MinimumSource` and `RuntimeMinimum`;
  - `escapeHtml` and the parts renderer.

  It also adds:
  ```ts
  export interface MinimumsText {
    heading: string; intro: string; footer: string; note: string; rows: RuntimeMinimum[];
  }
  export function minimumsItemsHtml(text: MinimumsText): string;
  export function minimumsMarkdown(text: MinimumsText): string;
  export function minimumsCardHtml(idPrefix: string, text: MinimumsText): string; // from the Canada mount
  ```
- **`canada-runtime-minimums.ts` keeps Canada's data only.** That is the four strings,
  `RUNTIME_MINIMUMS`, and `CANADA_MINIMUMS: MinimumsText`, which holds them. Its callers in
  `canada-clock-change{,-mount}.ts` and `canada-palette.test.ts` pass `CANADA_MINIMUMS`. Nothing is
  re-exported.
- **Classes.** The card renders `gmt-clockcheck-minimums`, `-minimums-list`, `-minimums-src` and
  `-minimums-note`. Their rules, including the forced-colors one in the `canada-clock-change.css`
  block at the `.gmt-canada-minimums,` selector, move to `clock-change.css`. The card keeps its
  full bevelled cyan border: no left-border accent.
- **The Canada page does not change.** Slice 1's `HTML_DIFF_RENAME` pair `gmt-clockcheck-:gmt-canada-`
  already covers the new class names.

## Step 3 — Morocco's data (builder)

- **New `src/data/morocco-runtime-minimums.ts`: `MOROCCO_MINIMUMS: MinimumsText`.**
  - `heading`: "Upgrade to at least".
  - `intro`: "These releases carry tz data 2026c or later, which records the change in Morocco and
    Western Sahara. Older releases show both an hour ahead after 20 September 2026, except in the
    weeks around Ramadan."
  - `note`: "gmt uses the time-zone rules of the device it runs on. A device without tz data
    2026c shows Morocco and Western Sahara an hour ahead for most of the year after 20 September
    2026, so do the time maths on your server when it has to be right."
  - `footer`: "Anything else: run the command in Test your own servers. It shows what that runtime
    really does." Add each runtime the research left out to the footer's list, in brackets, as
    Canada's footer does.
  - `rows`: one row per runtime from `minimums-research.md`, in the Canada order. The versions go
    in `{ code }` parts, and the research's source URLs go in `sources`.
- **When a line has no release with 2026c, it is left out**, following the Canada rule: no "not
  fixed yet" row, because such a row goes stale.
  - If a runtime has some supported lines with a release and some without, its row lists only the
    lines that have one.
  - If a runtime has no supported line with a release, it has no row, and the footer covers it.
  - A line that is end-of-life and never got the data gets one plain clause, as Canada's Node row
    does ("Node 20 and 25 are end-of-life and never got it"). That fact cannot go stale.
  - List every line left out in the hand-back, so that the main session can decide whether to
    track it.
- **A row without versions** (Canada's "Mac and iPhone") is kept only if the research finds an
  Apple source naming the update. Otherwise the row is left out.
- **Mount.** `morocco-clock-change-mount.ts` puts `minimumsCardHtml("morocco", MOROCCO_MINIMUMS)` in
  row 3, beside the servers card (slice 4). `mdx-jsx.ts` appends `minimumsMarkdown(MOROCCO_MINIMUMS)`
  to the `MoroccoClockChange` twin.

## Tests

- **`src/data/clock-change-minimums.test.ts`**, run for both `CANADA_MINIMUMS` and `MOROCCO_MINIMUMS`:
  - every row with a `{ code }` part has at least one source, and every href matches `^https://`;
  - no text matches `/\bwill\b|not fixed|not yet|coming soon|statute/i`;
  - `minimumsMarkdown` contains every source href and ends with the note.
- **Morocco only:**
  - `intro` contains `2026c`;
  - the rows match the research: checked once by hand against `minimums-research.md`, not by a
    test, because a test that reads a file deleted at story close would be skipped for good;
  - the rendered card sits between the servers card and the changes card. Test this with the
    heading-order check from `canada-palette.test.ts`.
- **The Canada card test is unchanged** apart from its imports, and it still passes.

## Definition of done

1. `context/domination/specs/CORE-89/minimums-research.md` exists, with a
   source URL and a quoted line or commit in every row that is not **none**.
2. Every source link answers. From the repo root, run
   `grep -o "https://[^\"]*" apps/dox/src/data/morocco-runtime-minimums.ts | sort -u | xargs -n1 curl -s -o /dev/null -w "%{http_code} %{url}\n" -L`.
   Every line starts with `200`.
3. `pnpm --filter @gmt/dox exec vitest run src/data/clock-change-minimums.test.ts src/lib/canada-palette.test.ts --reporter=verbose`
   passes.
4. `HTML_DIFF_RENAME="gmt-clockcheck-:gmt-canada-,gmt-zonemap-:gmt-canada-" node apps/dox/scripts/html-diff.mjs compare /tmp/core89-before`
   prints no `✗` for the Canada page. That includes its `.md` twin and `llms-full.txt`.
5. On the served Morocco page at 1440, 1024, 520 and 375 px, row 3 holds the servers card and
   this card. There is no horizontal scroll, and at 375 px the version chips wrap inside the card.
6. `grep -rn "gmt-canada-minimums" apps/dox/src` prints nothing.
7. `built.md`: the **Upgrade to at least** line under the Canada entry names the shared
   `clock-change-minimums.ts` and its `MinimumsText`. The Morocco entry gives its card's release
   (2026c or later), the left-out rule and the research source rule, each with a one-line reason.
