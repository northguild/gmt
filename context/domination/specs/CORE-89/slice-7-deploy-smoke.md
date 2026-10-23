# Slice 7 — deploy smoke and close-out

`apps/dox/scripts/deploy-smoke.mjs` runs after `wrangler deploy` in `deploy-dox.yml`. It is the
only check of offsets from the newest tzdb release, and it runs against the deployed Worker
([CORE-88](../../issues/CORE-88.md#decisions)). Merging to `main` deploys the site.

## Rows to add, after the Canada rows

1. **`morocco-clock-change probe`**: `GET ${ND}/gmt/api/morocco-clock-change` returns 200 JSON.
   Check that all four `probe` rows (two zones at `2026-11-02T12:00:00Z` and `2027-02-22T12:00:00Z`)
   have `offset === "+00:00"`. Build the failure message the way the Canada row does: `probe differs from tzdb 2026c: <zone> at <instant>
   wanted +00:00, got …`. Also check that no `changes` row with `recordedBy: "2026b"` has
   `present: true`, and that every `recordedBy: "2026c"` row has `present: true`. The two
   expected values are literals in the row, cited to tzdb 2026c, as the Canada row cites 2026e.
   When a later tzdb changes Morocco again, this row fails, and the page needs updating.
2. **`morocco-clock-change HEAD`**: 200, `cache-control: no-store`, empty body.
3. **`morocco-clock-change PUT`**: 405, with `allow: GET, HEAD, POST`.
4. **`morocco-clock-change stored times (report only)`**: POST, url-encoded, with
   `zone=Africa/Casablanca` and the three lines `2026-11-16T09:00:00+01:00[Africa/Casablanca]`,
   `2027-03-14T02:30:00+00:00` and `2027-06-01T09:00:00+00:00 Africa/El_Aaiun`. It reports the
   `kind` of each line in the same way as the Canada report-only row.
5. **`morocco-clock-change stored times (${storedMax} lines)`**: a full-size POST. `storedMax`
   comes from the same regex read of `clock-change-stored-lines.ts` (slice 1). It must answer
   200 within the Workers Free CPU budget. Error 1102 is a failure.
6. **Page**: `GET ${ND}/gmt/check/morocco-2026-clock-change/` answers 200 HTML. So does
   `/gmt/timezone-boundaries-morocco.json`, as JSON whose `license` is `ODbL-1.0`.

The rate limit is per client id, and the run is retried up to six times. So that the run stays
under the 20-calls-per-60-s `morocco:` bucket, it makes at most 6 Morocco calls. They do not count
against the Canada bucket.

## The stored-times cap drops to 25 (owner's decision)

- `STORED_MAX_LINES` in `clock-change-stored-lines.ts` becomes `25`, for both checkers. 50 lines
  of `classifyStoredZoned` measured 8 to 10 ms of CPU warm and 24 ms on a cold isolate on workerd,
  against the Workers Free plan's 10 ms; 25 lines take 4 to 5 ms warm.
- The page text, the tests and row 5 above read the constant, so only literals that assert 50
  change. `STORED_MAX_BYTES` stays.
- `built.md` and the cap line in `issues/CORE-88.md` § Decisions give 25 with these figures and
  the reason, in present tense.

## Close-out (in the same PR, before it opens)

- **`context/dox/built.md`**: it describes what is built, in present tense, with no history.
  - Add the Morocco checker entry (slices 3 and 4), the shared-parts entry (slice 1), the
    endpoint and the `morocco:` bucket (slice 2), the deploy-smoke rows, and the recount of
    tools and starters.
  - Correct the stale lines that [index § Corrections](./index.md#corrections-to-context) lists:
    "Node here carries tz 2026c", and the 405 `allow: GET`.
  - State that the workerd that `wrangler dev` runs locally (1.20260825.1) carries tz data older
    than 2026c, so a local Morocco Worker answers as old data. The deployed Worker has 2026e,
    which is why the smoke rows run against it and never against `wrangler dev`.
- **`context/domination/issues/CORE-89.md`**:
  - fix "shows Casablanca as one probe row";
  - add a `## Decisions` section in the shape of CORE-88's (endpoint, instants, stated changes,
    map, boundary data and credits, the minimums card's source rule, tests, registration). The finalizer moves this spec's
    decisions there and deletes `specs/CORE-89/` once the story is Done.
- **`.changeset/morocco-clock-change-checker.md`**: empty frontmatter, then this text: "No
  release. The Morocco 2026 clock-change checker is a Dox page outside the published package;
  in `packages/gmt` only a test file and the README's test counts change."
- **Tracker**: the main session sets the Status in `context/domination/tracker.md` and runs
  `pnpm deps:sync`. The builder does not.
- **`/optimize`**: run it on the files this branch changed, and fix what it reports in them.

## Definition of done

1. `node --check apps/dox/scripts/deploy-smoke.mjs` passes.
2. Run the script against production before the merge:
   `node apps/dox/scripts/deploy-smoke.mjs`. The six Morocco rows fail with 404, because nothing
   is deployed yet, and every other row passes.
3. Then run it against a preview deploy, if the owner provides one. There, every row passes, the
   probe row included. If he provides none, the main session runs it after the merge, as its own
   post-merge check.
4. `pnpm run validate` passes from the repo root. Warn the owner before it runs: it rebuilds
   `packages/gmt/dist`, which his dev server reads. Run it once, last.
5. `git status` shows only the files that index § Files lists, plus the moved tests. Nothing is
   staged. There is no commit and no push.
6. The hand-back lists:
   - every class that slice 1 renamed;
   - the measured kind of each preset line;
   - the Chromium and WebKit verdicts from slice 4;
   - the `0 passed` line on Node 24.19.0 from slice 5;
   - the compact and formatted sizes of the Morocco boundary file.
