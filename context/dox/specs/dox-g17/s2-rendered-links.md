# Slice 2: links a page renders end in a slash

[Story](./index.md) · repo: gmt · gate: new `rendered-links` (tier `pr`, Chromium)

## Why

`test:dist` fails a page link without its slash in the built HTML (`pageLinksWithoutSlash`) and in
Markdown (`pageLinksWithoutSlashInMarkdown`). Both live in `apps/dox/scripts/build-utils/dist-base.ts`
(DOX-G8). Widgets add more links at run time: about 20 modules under `src/lib/` and
`src/components/` set an `href`. Today they all build hrefs with `withBase("/…/")`, so none of them
lacks the slash. But no check holds them to it, and Googlebot renders the page and follows those
links. A slashless link added later would grow "Page with redirect" again with no gate to catch it.
Slice 1 makes such a hop permanent, but every hop still costs a crawl.

## Reuse

| Piece | Path | Use |
| --- | --- | --- |
| Slash predicate | `scripts/build-utils/dist-base.ts` (`isPageLinkWithoutSlash`, private) | **moves** to `scripts/lib/page-links.mjs`, exported; `dist-base.ts` imports it. One check, one home. |
| Gate contract | `scripts/gates/contract.mjs`, `scripts/lib/gate-cli.mjs` (`--list-pages`, `--pages`, `--base`, `recordFinding`, `recordMeasured`) | the new gate's CLI and report |
| Browser launch | `scripts/lib/browser-launch.mjs` | Chromium |
| Page list from `dist` | pattern of `scripts/lib/tool-pages.mjs` (`listToolPages(distRoot)`) | new `listWidgetPages(distRoot)` in `scripts/lib/widget-pages.mjs` |
| Registry | `scripts/gates/registry.mjs` | one row; it lands in the `other` CI leg on its own (`ci-legs.test.ts`) |

New files and their layer:

- `scripts/lib/page-links.mjs` (shared). Exports `isPageLinkWithoutSlash(value)` and the `ORIGIN`
  and `underBase` it needs. `dist-base.ts` imports all three instead of defining them, so the base
  rule exists once.
- `scripts/lib/widget-pages.mjs` (shared). `listWidgetPages(distRoot)` returns the site path of every
  built page whose HTML holds a `data-widget=` element, sorted. The list is read from `dist`, never
  typed in.
- `scripts/rendered-links.mjs` (the gate).
- `scripts/lib/page-links.test.ts` and `widget-pages.test.ts`: unit tests.

**Second-instance test.** A second rendered-link rule, such as no `http://` links, would add one
predicate to `page-links.mjs` and one call in the gate. It would need no second gate and no second
page list.

## The gate: `scripts/rendered-links.mjs`

- Pages: `listWidgetPages(distRoot)`. `--list-pages` prints them, and `--pages` narrows them.
- For each page, in Chromium at 1440 × 900:
  1. Load the page and wait for `load`, then for each `[data-widget]` root to be attached. Reuse the
     wait an existing Chromium gate uses (`a11y-axe.mjs`), not a fixed sleep.
  2. Read `href` from every `a[href]` and `area[href]` **attribute** in the document
     (`getAttribute`, not the resolved `.href`), so a relative or base-less value is judged as
     written.
  3. Record a finding (rule `page-link-without-slash`) for each value where
     `isPageLinkWithoutSlash` is true. The finding names the page, the value and the closest
     `[data-widget]` name.
  4. `recordMeasured` the number of links checked. A page with no widget root fails as
     `measured nothing`, as every gate does.
- A static link is checked again here, and that is fine: one predicate makes the same verdict in
  both checks, and `test:dist` stays the fast check.
- Close the page and the browser in `finally`, so a failed assertion still tears down.

Registry row:

```js
{ id: "rendered-links", script: "rendered-links.mjs", tier: "pr",
  browsers: ["chromium"], fullBrowsers: ["chromium"], themes: false, needs: null }
```

The link logic does not depend on the theme, so `themes: false` (as 18 gates already use) halves the run.

## Tests

- `page-links.test.ts`. The cases `dist-base.test.ts` already covers for the HTML scan move here as
  table cases for the predicate:
  - `/gmt/reference` → true; `/gmt/reference/` → false; `/gmt/llms.txt` → false;
  - `https://northguild.dev/gmt/tools/x?w=1#a` → true; `/other` → false; `//cdn/x` → false.
  `dist-base.test.ts` keeps its HTML-scanning tests. Delete any case that only exercised the
  predicate there.
- `widget-pages.test.ts`: a temporary `dist` with three pages: one holding `data-widget="a"`, one
  without, and one with `data-widget` only inside a `<script>` string. Expect only the first page.
  The scan reads the attribute in markup, so a regex on `<[^>]*\sdata-widget=` is enough.
- The gate itself: run `node scripts/rendered-links.mjs --base <served dist> --pages /tools/dst-inspector/`
  once by hand and paste the PASS line into the slice's notes. Then force a failure: in a local
  scratch edit, change one `withBase` call to drop its slash, see the gate FAIL with the page and
  value, and revert.

## Traps

- `getAttribute("href")` can return a value starting `./` or `../`, which the predicate passes.
  Add `resolveHref(value, pageUrl)` to `page-links.mjs`: it resolves such a value against the
  page URL and returns a root-absolute path. The gate judges that path. `page-links.test.ts`
  covers `./x` and `../x` from a page URL.
- The zone planner and scrubber links carry `?w=` or `?tz=` on a slash path. They pass, and
  slice 3 handles them.
- Links that appear only after the reader clicks something are not covered here. Each tool's own
  tests drive its states; do not add clicks to this gate.

## Close-out

- `context/dox/built/tier-0-1-site.md`, under "Page links end in `/`": the predicate now lives in
  `scripts/lib/page-links.mjs`. The `rendered-links` gate checks the links widgets render.
- `context/dox/built/tier-2-gates.md`: one line for `rendered-links` in the gate list, in the
  house format.

## Definition of done

- The new unit tests pass, and `dist-base.test.ts` and `registry.test.ts` and `ci-legs.test.ts` still pass.
- `git grep -n "function isPageLinkWithoutSlash\|function underBase" apps/dox/scripts` prints only
  `scripts/lib/page-links.mjs`.
- `pnpm --filter dox gates --plan --only rendered-links` lists the sample; a run on two widget pages
  passes.
- Rule 10: every new file is under 400 lines.
