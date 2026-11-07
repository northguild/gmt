# CORE-107 — Core: A changelog page in Dox, and the You-Dont-Need-Momentjs PR on `/upstream`

**Scope:** Dox gains changelog pages built from each package's `CHANGELOG.md`: `/changelog/`
(`@northguild/gmt`), `/changelog/gmt-eslint/`, `/changelog/gmt-oxlint/` and `/changelog/gmt-biome/`.
The releases published under the retired `@burglekitt` npm scope sit in their own group, set apart
from the `@northguild` releases by an "In memoriam" plate with the old logo. The `/upstream` page lists GMT's pull request to
You-Dont-Need-Momentjs in a separate "Beyond Temporal" section. Adds no library function. Tracked
as #451.

## Gap

Each package's release notes live only in `packages/*/CHANGELOG.md` on GitHub. Dox has no page for
them, so a reader on the site cannot see what changed in a release or when a function arrived.

`@northguild/gmt` 1.0.0 to 1.14.1 were published as `@burglekitt/gmt` (npm: 17 versions,
1.0.0 … 1.14.1). 1.14.1 is the deprecation notice; 1.14.2 is the first `@northguild/gmt` release
(`eea82a0`). The lint packages moved at the same commit: `@burglekitt/gmt-eslint` ends at 1.0.3,
`@northguild/gmt-eslint` starts at 1.0.4.

GMT opened [you-dont-need/You-Dont-Need-Momentjs#159](https://github.com/you-dont-need/You-Dont-Need-Momentjs/pull/159)
("Add a Built on column and @northguild/gmt to the comparison", opened 2026-11-03). The
`/upstream` tracker (`apps/dox/src/data/upstream-filings.ts`) did not list it.

## Scope

- **Four changelog pages,** built at build time from the package changelogs, so they never drift
  from the files a release writes. Each lists every release, newest first, with its release date
  from the git tag, in two groups: the current `@northguild` scope and the retired `@burglekitt`
  scope. The `.md` twins follow the site's rules for every page. `llms.txt` links the pages;
  `llms-full.txt` and the chat's retrieval chunks leave them out.
- **A top-level "Changelog" sidebar group** with the four pages.
- **You-Dont-Need-Momentjs #159** as a synced `listings` entry on `/upstream`. The Temporal
  filings, their tally and their tests do not change.
- **An "In memoriam" plate** on each page's retired `@burglekitt` group: the old logo and one
  sentence built from the groups.

Out of scope: editing any `CHANGELOG.md` beyond the one wrong name in the 1.14.1 entries
(Decision 5), release data from npm, a Dox chat tool.

## What gmt provides (do not re-implement)

- The site at `northguild.dev/gmt` and its Worker (`CORE-86`)
- The `/upstream` page and its filings tracker (`UpstreamTracker`, `upstream-filings.ts`)

## Verification

- Every `## <version>` heading in `packages/gmt/CHANGELOG.md` appears on the page.
- `pnpm run validate` stays green.

## Decisions

1. Scope comes from each version's tag, per package: `@burglekitt/gmt` is 1.0.0 to 1.14.1,
   `@northguild/gmt` 1.14.2 on; the plugins split by their own tags. No hand-kept boundary file.
2. Each `@burglekitt/<pkg>` group opens with an "In memoriam" plate: the old logo and one
   sentence built from the groups, never typed. The releases under it look like every other
   release. The page never shows a stand-in logo.
3. The plugin changelogs are in: `/changelog/gmt-eslint/`, `/gmt-oxlint/`, `/gmt-biome/`.
4. YDNM #159 is a separate synced `listings` list in a "Beyond Temporal" section on `/upstream`.
5. The 1.14.1 entry in all four changelogs names `@burglekitt/<pkg>` as the package that gets no
   further updates, so it agrees with the plate above it. An empty changeset covers that edit.
   The pages show every entry verbatim.
6. Sidebar: a top-level "Changelog" group, four links.
7. Release dates come from the tags at build time, printed as the site prints dates (`YYYY-MM-DD`,
   via gmt). Only a package's newest version may lack a tag; it shows "Not yet released". Any older
   untagged version fails the build.
8. The changelogs stay out of `llms-full.txt` and the chat's retrieval; `llms.txt` links them.
9. Page title "Changelog"; URLs as in Scope.
10. Generated changelog tables get extra code break points (after `(`, after an argument `,`, after
    an ISO instant's `T`, before a `[` zone annotation) only inside the `gmt-changelog` wrapper
    (`src/lib/code-break.ts` with `{ calls: true }`, enabled by `rehype-table-scroll.ts`). No CSS
    rule kept short tokens whole and kept the tables from scrolling.
11. The changelog has its own heading scale, because the site's `h3` (1.05rem) is smaller than
    Starlight's `h4` and `h5`.
12. Listings own no styles of their own. The tracker and the listings share the prose-table sheet,
    `src/styles/gmt-content-tables.css`.
13. A defect that predates this story is fixed under Core Rule 12: Astro's default
    `compressHTML: "jsx"` drops line-break whitespace beside an element or `{expression}` in
    `.astro` templates. It ran words together ("markedTheirs", "Repliescounts" on `/upstream/`, and
    the footer's "Everything else:" on every page). The fix is in the source; `compressHTML` is
    unchanged. `apps/dox/scripts/inline-whitespace.test.ts` guards it.
