# Slice 6 — upstream-tracker: `fullcalendar/temporal-polyfill` on `/upstream/`

Index: [index.md](index.md). Clauses: index Authority rows "The tracker follows
`fullcalendar/temporal-polyfill`" and "A closed filing stays listed". Facts: research
[§4.6](../../research/temporal-polyfill-swap.md#46-upstream). Independent of slices 1–5.

## What it does

GMT has five reports on `fullcalendar/temporal-polyfill`: #119, #120 and #121 (closed, fixed in
1.0.7), and #125 and #126 (open). The tracker discovers filings only in the repositories listed in
`REPOS`, so today it shows none of them. After this slice the `/upstream/` page has a third table
for that repository, after the other two, and `js-temporal-polyfill-bugs.md` lists the five.

## 1. `scripts/upstream.mjs`

- `REPOS` becomes
  `["js-temporal/temporal-polyfill", "tc39/proposal-temporal", "fullcalendar/temporal-polyfill"]`.
  The order is the page order.
- **Sort by that order, not alphabetically.** `byRepoThenNumber` sorts by `repo.localeCompare`,
  which would put `fullcalendar/…` first on the page and first in a defect row's "What we sent".
  Sort by the repository's index in `REPOS`, an unknown repository after every listed one, then by
  repository name, then by number:

  ```js
  const repoRank = (repo) => (REPOS.includes(repo) ? REPOS.indexOf(repo) : REPOS.length);
  const byRepoThenNumber = (a, b) =>
    repoRank(a.repo) - repoRank(b.repo) || a.repo.localeCompare(b.repo) || a.number - b.number;
  ```

  Both existing call sites (the `sync` write and the `refresh` write) keep using it. The current
  JSON (js-temporal, then tc39) is already in this order, so no existing row moves.
- Header comment: the tracker also covers `fullcalendar/temporal-polyfill`, where GMT reports
  defects found by the swap check (CORE-92). Keep it to one sentence.
- No change to `AUTHORS`, the check rules or the synced fields.

## 2. `apps/dox/src/data/upstream-filings.ts` (+ test)

- `export const TRACKED_REPOS = [...] as const`: the same three strings, same order, with a
  JSDoc saying it mirrors `REPOS` in `scripts/upstream.mjs` and a test holds them equal.
- `byRepoThenNumber` here uses the same rank rule over `TRACKED_REPOS`, so `overlayLive` sorts
  as the script does. `filingRepos` stays "first-seen order", which is now the rank order.
- The file's header comment names the third repository.

Test rows (`upstream-filings.test.ts`):

| Row | Expected |
| --- | -------- |
| `TRACKED_REPOS` vs the script's `REPOS` (regex read of `scripts/upstream.mjs`, as the `HAND_WRITTEN_FIELDS` row does) | equal, and not empty |
| `overlayLive` adds live-only `fullcalendar/temporal-polyfill#130` beside committed tc39 #3336 and live js-temporal #400 | order js-temporal #400, tc39 #3336, fullcalendar #130 |
| `overlayLive` with a live-only filing in `whatwg/html` | sorts after all three tracked repositories |
| the committed data | every `filing.repo` is in `TRACKED_REPOS` |

The existing "repo-then-number order" row stays green unchanged.

## 3. Short labels: one rule, three places

`shortRef` in `apps/dox/src/data/temporal-compat.ts` labels a filing as `tc39 #n` or
`polyfill #n`. Two copies of the rule print everything that is not tc39 as "polyfill", which
would call fullcalendar #126 "polyfill #126":

- `KNOWN_REPOS` gains `"fullcalendar/temporal-polyfill": "fullcalendar"`. js-temporal keeps
  "polyfill" (the package GMT installs, as the page's prose calls it).
- `apps/dox/src/components/UpstreamFilingRefs.astro`: `ref()` uses `shortRef(repo, Number(number))`
  for its label instead of its own tc39-or-polyfill test.
- `apps/dox/src/lib/mdx-jsx.ts` `renderUpstreamDefects`: delete the local `shortRef` and import
  the one from `../data/temporal-compat`.

Test rows (`temporal-compat.test.ts`): add `fullcalendar/temporal-polyfill` | 126 |
`"fullcalendar #126"` to the `shortRef` table, and one row asserting that every entry of
`TRACKED_REPOS` gets a short label (`shortRef(repo, 1) !== \`${repo} #1\``), so a newly tracked
repository can never print its full name or someone else's label.

## 4. `apps/dox/src/data/upstream-filings.json`

The five entries come from `sync`, not from hand:

1. Land §1 first, so `sync` writes the new order.
2. `pnpm upstream:sync` (needs `gh` signed in, and `packages/gmt/dist`, which `scripts/lib/gmt.mjs`
   loads; build it once, in this worktree only, and say so in the hand-off). It adds the five
   with their GitHub fields, prints NEW for each, and also refreshes the GitHub fields and
   `checked` stamp of the existing 16. Keep those refreshed values.
3. Fill the hand-written fields below by hand. Read each issue first (`gh issue view <n> --repo
   fullcalendar/temporal-polyfill`) and correct a summary that does not match it.
4. `node scripts/upstream.mjs check` passes.

If `gh` is not signed in, stop and hand back: do not type the GitHub fields by hand.

| # | `summary` (run `/plain-english`) | `gmtGuard` | `gmtNote` | `outcome` |
| - | -------------------------------- | ---------- | --------- | --------- |
| 119 | Date parsing accepts strings RFC 9557 rejects: an empty annotation such as `2024-10-03[]`, or a calendar annotation before the time zone. | `null` | N1 | O1 |
| 120 | `ZonedDateTime.from` rejects the two exact instants at the ends of Temporal's range, such as `-271821-04-20T00:00:00Z[Asia/Tokyo]`, which the standard accepts. | `null` | N1 | O1 |
| 121 | When a zone's offset changes twice within a few weeks, the polyfill skips the period between the changes and reads the wrong offset all through it, as in `Africa/Casablanca` during Ramadan in 2018. A daily check of every zone found it in 11 zones. | `null` | N1 | O1 |
| 125 | Searching back for a zone's last transition never returns one later than about three years from today. From any later date it returns an older transition, so the answer depends on the day the code runs. | `null` | N2 | `null` |
| 126 | Transitions before 1847 are not found, so `Asia/Manila` and four Pacific zones miss their offset change on 31 December 1844. | `"zoned.E"` | `null` | `null` |

- **N1:** "GMT runs on `@js-temporal/polyfill`, which gets this right, so this can't affect GMT.
  GMT's weekly swap check runs its tests on every new `temporal-polyfill` release."
- **N2:** the same first sentence, then "GMT's weekly swap check fails while this bug remains."
- **O1:** "Closed as fixed: released in temporal-polyfill 1.0.7." `OUTCOME_RULES` requires an
  `outcome` on any filing closed without a merge, and an issue never merges.
- All five: `work: "report"`, `role: "author"`, `contributionUrl: null`, `pairsWith`, `closes`
  and `dependsOn` empty. #126 is the same defect as js #372 and tc39 #3330, but "Same fix" means a
  shared patch and must be symmetric, so it stays empty; `gmtGuard: "zoned.E"` puts #126 in that
  defect's "What we sent" beside them, and the row reads "Already handled" (GMT's zoned.E code
  gives the right answer on both polyfills; the 1.0.7 suite run had no zoned.E failure).

**No change** to `temporal-compat.json` (generated) or `scripts/lib/workarounds.mjs`: zoned.E's
trigger is about the `@js-temporal/polyfill` release GMT runs on.

## 5. `apps/dox/src/components/UpstreamTrackerLegend.astro`

"Each closed row says why it closed: so far every one was closed because the fix was going
somewhere better, not because it was turned down." is false once #119–#121 close as fixed.
Replace it with a sentence that cannot go stale:

> Each closed row says why it closed, because GitHub's "Closed" alone doesn't say whether a report
> was fixed, answered or turned down.

Keep the component's header comment true (it says a closed row is not a rejected one).

## 6. `context/domination/js-temporal-polyfill-bugs.md`

- Opening paragraph: one clause saying the document also lists GMT's reports to
  `fullcalendar/temporal-polyfill`, from the swap check
  ([research §4.6](../../research/temporal-polyfill-swap.md#46-upstream)).
- Status block and "Filed" intro: add the five to the count, and the key
  `"fc" is fullcalendar/temporal-polyfill`.
- "Status as of" list: one bullet — fc #119, #120 and #121 closed as fixed in 1.0.7; #125 and #126
  open, no reply yet. Use the dates `gh` reports.
- Filed table: five `fc` rows. "Carries": `swap §4.1`, `§4.2`, `§4.3` for #119–#121, `swap §4.4`
  for #125, and `E, swap §4.5` for #126. "Pairs with": `none: other polyfill`. "Filed": `createdAt` from `gh`.

## Done when

- `pnpm --filter @gmt/dox test` (the two data tests), `node scripts/upstream.mjs check` and the Dox
  build and link check pass.
- `/upstream/` in a local build shows three tables in order js-temporal, tc39, fullcalendar; the
  zoned.E row lists `polyfill #372, tc39 #3330, fullcalendar #126`; #119–#121 read "Closed" with
  O1 under them.
